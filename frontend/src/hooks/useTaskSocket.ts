import { useState, useEffect, useRef, useCallback } from 'react';
import type { 
  TaskEvent, 
  ActiveTask, 
  AgentId, 
  AgentState, 
  TaskLocation
} from '../types/task';
import { mockEventSource } from '../services/mockEventSource';
import { apiGetTaskDetails } from '../services/api';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/tasks?subscribe=all';
const ANIMATION_DELAY_MS = 800; // Time between processing queued events to allow token animations to play smoothly

export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'mock_mode' | 'disconnected';

export function useTaskSocket(initialUseMock: boolean = true) {
  const [useMock, setUseMock] = useState<boolean>(initialUseMock);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>(
    initialUseMock ? 'mock_mode' : 'connecting'
  );
  
  const [tasks, setTasks] = useState<Map<string, ActiveTask>>(new Map());
  const [activityLogs, setActivityLogs] = useState<TaskEvent[]>([]);
  const [agentStates, setAgentStates] = useState<Record<AgentId, AgentState>>({
    email_agent: 'idle',
    calendar_agent: 'idle',
    search_agent: 'idle',
    custom_agent: 'idle'
  });

  // Monotonic sequence tracker per task_id
  const lastSeqMap = useRef<Map<string, number>>(new Map());
  
  // Event queue & processing flag
  const eventQueueRef = useRef<TaskEvent[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);

  // Connection references
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  // Apply single event to state
  const applyEventToState = useCallback((event: TaskEvent) => {
    const taskId = event.task_id;
    const lastSeq = lastSeqMap.current.get(taskId) || 0;

    // Sequence Check: Monotonic filter - discard if sequence_no <= last applied sequence_no
    if (event.sequence_no <= lastSeq) {
      console.warn(`[TaskHarness] Discarding duplicate/out-of-order event for ${taskId}. Received seq: ${event.sequence_no}, Last applied: ${lastSeq}`);
      return;
    }

    // Update monotonic sequence number
    lastSeqMap.current.set(taskId, event.sequence_no);

    // Append to Activity Logs
    setActivityLogs((prev) => [event, ...prev]);

    // Update Tasks map & Agent states
    setTasks((prevTasks) => {
      const nextMap = new Map(prevTasks);
      let existingTask = nextMap.get(taskId);

      if (!existingTask) {
        existingTask = {
          id: taskId,
          description: event.event_type === 'task.created' ? event.description : 'Task ' + taskId.substring(0, 6),
          status: 'created',
          currentLocation: 'inbox',
          lastSequenceNo: event.sequence_no,
          events: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }

      const updatedTask: ActiveTask = {
        ...existingTask,
        lastSequenceNo: event.sequence_no,
        events: [...existingTask.events, event],
        updatedAt: Date.now()
      };

      // Handle Event Type Specific State Logic
      switch (event.event_type) {
        case 'task.created': {
          updatedTask.status = 'created';
          updatedTask.currentLocation = 'inbox';
          if (event.description) updatedTask.description = event.description;
          break;
        }

        case 'task.routed': {
          updatedTask.status = 'routed';
          updatedTask.currentLocation = event.agent_id as TaskLocation;
          updatedTask.currentAgentId = event.agent_id;
          updatedTask.confidence = event.confidence;
          break;
        }

        case 'task.handoff': {
          updatedTask.status = 'working';
          updatedTask.currentLocation = event.to_agent as TaskLocation;
          updatedTask.currentAgentId = event.to_agent;
          break;
        }

        case 'task.blocked': {
          updatedTask.status = 'blocked';
          updatedTask.currentLocation = event.agent_id as TaskLocation;
          updatedTask.currentAgentId = event.agent_id;
          updatedTask.blockReason = event.reason;
          break;
        }

        case 'task.completed': {
          updatedTask.status = 'completed';
          updatedTask.currentLocation = 'done';
          updatedTask.durationMs = event.duration_ms;
          break;
        }
      }

      nextMap.set(taskId, updatedTask);

      // Recompute Agent Working/Blocked/Idle states from active tasks
      const newAgentStates: Record<AgentId, AgentState> = {
        email_agent: 'idle',
        calendar_agent: 'idle',
        search_agent: 'idle',
        custom_agent: 'idle'
      };

      nextMap.forEach((t) => {
        if (t.status !== 'completed' && t.currentAgentId) {
          if (t.status === 'blocked') {
            newAgentStates[t.currentAgentId] = 'blocked';
          } else if (t.status === 'routed' || t.status === 'working') {
            if (newAgentStates[t.currentAgentId] !== 'blocked') {
              newAgentStates[t.currentAgentId] = 'working';
            }
          }
        }
      });

      setAgentStates(newAgentStates);

      return nextMap;
    });
  }, []);

  // Process event queue sequentially with delay for token animations
  const processQueue = useCallback(() => {
    if (isProcessingQueueRef.current || eventQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    const nextEvent = eventQueueRef.current.shift();

    if (nextEvent) {
      applyEventToState(nextEvent);

      setTimeout(() => {
        isProcessingQueueRef.current = false;
        processQueue();
      }, ANIMATION_DELAY_MS);
    } else {
      isProcessingQueueRef.current = false;
    }
  }, [applyEventToState]);

  // Queue incoming event
  const enqueueEvent = useCallback((event: TaskEvent) => {
    eventQueueRef.current.push(event);
    processQueue();
  }, [processQueue]);

  // Re-sync active tasks upon WS reconnect
  const resyncTasksOnReconnect = useCallback(async () => {
    console.log('[TaskHarness] Reconnected! Triggering GET /tasks/{id} re-sync for active tasks...');
    const activeTaskIds: string[] = [];

    tasks.forEach((t) => {
      if (t.status !== 'completed' && !t.id.startsWith('mock-')) {
        activeTaskIds.push(t.id);
      }
    });

    for (const taskId of activeTaskIds) {
      const history = await apiGetTaskDetails(taskId);
      if (history && history.events) {
        history.events.forEach((e) => {
          const formattedEvent: TaskEvent = {
            ...(e.payload || {}),
            event_type: e.event_type as any,
            sequence_no: e.sequence_no
          };
          enqueueEvent(formattedEvent);
        });
      }
    }
  }, [tasks, enqueueEvent]);

  // Connection Handler (WebSocket or Mock)
  useEffect(() => {
    if (useMock) {
      setConnectionStatus('mock_mode');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Subscribe to mock source
      const unsubscribe = mockEventSource.subscribe((evt) => {
        enqueueEvent(evt);
      });

      return () => {
        unsubscribe();
      };
    }

    // Real WebSocket Client implementation
    let isCancelled = false;

    const connectWS = () => {
      setConnectionStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isCancelled) return;
          console.log('[TaskHarness] WS Connected successfully to', WS_URL);
          setConnectionStatus('connected');
          
          ws.send(JSON.stringify({ subscribe: 'all' }));

          if (reconnectAttemptsRef.current > 0) {
            resyncTasksOnReconnect();
          }
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (messageEvent) => {
          if (isCancelled) return;
          try {
            const data = JSON.parse(messageEvent.data);
            const eventPayload: TaskEvent = data.event_type ? data : {
              ...data.payload,
              event_type: data.event || data.payload?.event_type,
              sequence_no: data.sequence_no || data.payload?.sequence_no
            };

            if (eventPayload && eventPayload.event_type && eventPayload.sequence_no) {
              enqueueEvent(eventPayload);
            }
          } catch (err) {
            console.error('[TaskHarness] Error parsing WS message:', err);
          }
        };

        ws.onerror = (err) => {
          console.warn('[TaskHarness] WS connection error', err);
        };

        ws.onclose = () => {
          if (isCancelled) return;
          console.warn('[TaskHarness] WS Connection closed.');
          setConnectionStatus('disconnected');

          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000);
          console.log(`[TaskHarness] Reconnecting in ${delay}ms... (Attempt ${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isCancelled && !useMock) {
              connectWS();
            }
          }, delay);
        };
      } catch (err) {
        console.error('[TaskHarness] Exception creating WS connection:', err);
        setConnectionStatus('disconnected');
      }
    };

    connectWS();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [useMock, enqueueEvent, resyncTasksOnReconnect]);

  const clearAllTasks = useCallback(() => {
    setTasks(new Map());
    setActivityLogs([]);
    lastSeqMap.current.clear();
    eventQueueRef.current = [];
    setAgentStates({
      email_agent: 'idle',
      calendar_agent: 'idle',
      search_agent: 'idle',
      custom_agent: 'idle'
    });
  }, []);

  return {
    useMock,
    setUseMock,
    connectionStatus,
    tasks: Array.from(tasks.values()),
    activityLogs,
    agentStates,
    clearAllTasks
  };
}
