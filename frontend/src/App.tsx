import { useState, useEffect, useRef, useCallback } from 'react';
import { useTaskSocket } from './hooks/useTaskSocket';
import { Navigation } from './components/Navigation';
import { DispatchSection } from './components/DispatchSection';
import { OfficeFloor } from './components/OfficeFloor';
import { ExecutionModal } from './components/ExecutionModal';
import { ChatbotPanel } from './components/ChatbotPanel';
import { HistoryPage } from './components/HistoryPage';
import { apiCreateTask, apiRetryTask } from './services/api';
import type { ActiveTask, AgentId } from './types/task';
import './index.css';

type Page = 'workspace' | 'history';

function buildJourneyFromEvents(events: any[]): AgentId[] {
  const agents: AgentId[] = [];
  for (const e of events) {
    if (e.event_type === 'task.routed' && !agents.includes(e.agent_id)) agents.push(e.agent_id);
    if (e.event_type === 'task.handoff' && !agents.includes(e.to_agent)) agents.push(e.to_agent);
  }
  return agents;
}

export interface ExecSession {
  sessionKey: string;
  taskId: string;
  agentId: AgentId;
  taskDescription: string;
  isClosing: boolean;
}

// ─────────────────────────────────────────────────────────────
// Timing constants (all in ms)
// ─────────────────────────────────────────────────────────────
const TOKEN_TRAVEL_MS   = 1300;  // how long the token travels to a desk
const FIRST_OPEN_DELAY  = 700;   // delay before first agent panel opens
                                  //   (fast reception: token travel + small buffer)
const NEXT_OPEN_DELAY   = 700;   // gap after old panel closes before new opens
const PANEL_CLOSE_MS    = 850;   // must match CSS modal-content-out duration

export function App() {
  const {
    useMock, setUseMock,
    connectionStatus,
    tasks, activityLogs, agentStates,
    clearAllTasks,
  } = useTaskSocket(false);

  const [currentPage,        setCurrentPage]       = useState<Page>('workspace');
  const [chatOpen,           setChatOpen]          = useState(false);
  const [justCompletedTask,  setJustCompletedTask] = useState<ActiveTask | null>(null);
  const [execSession,        setExecSession]       = useState<ExecSession | null>(null);
  const [playedAgents,       setPlayedAgents]      = useState<Set<string>>(new Set());

  const lastShownKeyRef   = useRef('');
  const isTransitioningRef = useRef(false);
  // Tracks whether we already handled the step-complete close for a given session
  const stepsDoneKeyRef   = useRef('');

  // ── Close helper ────────────────────────────────────────────────
  const closePanel = useCallback((then?: () => void) => {
    setExecSession(prev => prev ? { ...prev, isClosing: true } : null);
    setTimeout(() => {
      setExecSession(null);
      isTransitioningRef.current = false;
      then?.();
    }, PANEL_CLOSE_MS);
  }, []);

  // ── Open helper ─────────────────────────────────────────────────
  const openPanel = useCallback((task: ActiveTask, agentId: AgentId, delay: number) => {
    setTimeout(() => {
      const key = `${task.id}-${agentId}-${Date.now()}`;
      setExecSession({
        sessionKey: key,
        taskId: task.id,
        agentId,
        taskDescription: task.description,
        isClosing: false,
      });
    }, delay);
  }, []);

  // ── React to task state changes ─────────────────────────────────
  useEffect(() => {
    // We want to find the first unplayed agent in the most recently active task.
    // Since tasks is ordered or we just care about tasks that have unplayed journey steps:
    let nextPlayable: { task: ActiveTask; agentId: AgentId } | null = null;

    // Search backwards to prioritize the newest tasks
    for (let i = tasks.length - 1; i >= 0; i--) {
      const t = tasks[i];
      const journey = buildJourneyFromEvents(t.events);
      for (const aid of journey) {
        const key = `${t.id}-${aid}`;
        if (!playedAgents.has(key)) {
          nextPlayable = { task: t, agentId: aid };
          break;
        }
      }
      if (nextPlayable) break; // found the next thing to play
    }

    // Completed task bookkeeping (visual completion)
    // A task is visually completed when the backend says it's completed AND we played all its agents
    const visuallyCompleted = tasks.find(t => {
      if (t.status !== 'completed') return false;
      const journey = buildJourneyFromEvents(t.events);
      return journey.every(aid => playedAgents.has(`${t.id}-${aid}`));
    });

    if (visuallyCompleted && (!justCompletedTask || justCompletedTask.id !== visuallyCompleted.id)) {
      setJustCompletedTask(visuallyCompleted);
    }

    if (!nextPlayable) return;

    const newKey = `${nextPlayable.task.id}-${nextPlayable.agentId}`;
    if (newKey === lastShownKeyRef.current) return;
    if (isTransitioningRef.current) return;

    // Check if we are already showing this agent
    if (execSession && execSession.sessionKey.startsWith(newKey) && !execSession.isClosing) {
      return; 
    }

    lastShownKeyRef.current   = newKey;
    isTransitioningRef.current = true;

    if (execSession && !execSession.isClosing) {
      // Agent changed → close existing panel, then open new after gap
      closePanel(() => openPanel(nextPlayable!.task, nextPlayable!.agentId, NEXT_OPEN_DELAY));
    } else {
      // No panel open → wait for token to travel then open
      openPanel(nextPlayable.task, nextPlayable.agentId, FIRST_OPEN_DELAY + TOKEN_TRAVEL_MS);
      setTimeout(() => { isTransitioningRef.current = false; }, FIRST_OPEN_DELAY + TOKEN_TRAVEL_MS + 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, playedAgents]);

  // Blocked task → close panel so user can see the desk
  useEffect(() => {
    const blocked = tasks.find(t => t.status === 'blocked');
    if (blocked && execSession && execSession.taskId === blocked.id && !execSession.isClosing) {
      closePanel();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // ── Called by ExecutionModal when all animation steps complete ──
  // This is the PRIMARY close trigger. After every step is done the
  // panel closes automatically — never stays open indefinitely.
  const handleStepsComplete = useCallback(() => {
    if (!execSession) return;
    const key = execSession.sessionKey;
    if (stepsDoneKeyRef.current === key) return;   // already handled
    stepsDoneKeyRef.current = key;

    if (!execSession.isClosing) {
      // Mark this agent as played so the next one can open!
      setPlayedAgents(prev => {
        const next = new Set(prev);
        next.add(`${execSession.taskId}-${execSession.agentId}`);
        return next;
      });
      closePanel();
    }
  }, [execSession, closePanel]);

  // ── Dispatch / retry ────────────────────────────────────────────
  const handleDispatchTask = async (description: string) => {
    setJustCompletedTask(null);
    lastShownKeyRef.current   = '';
    stepsDoneKeyRef.current   = '';
    // We intentionally don't clear playedAgents here so history remains consistent,
    // unless we strictly want to reset the UI state. We'll leave it to just accumulate.
    await apiCreateTask(description, useMock);
  };

  const handleRetryTask = async (taskId: string, lastSeq: number) => {
    await apiRetryTask(taskId, lastSeq, useMock);
  };

  const handleManualOpenExecution = (task: ActiveTask) => {
    if (!task.currentAgentId) return;
    setExecSession({
      sessionKey: `${task.id}-${task.currentAgentId}-manual-${Date.now()}`,
      taskId: task.id,
      agentId: task.currentAgentId,
      taskDescription: task.description,
      isClosing: false,
    });
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="app-root">
      <Navigation
        connectionStatus={connectionStatus}
        useMock={useMock}
        onToggleMock={setUseMock}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
      />

      <main className="app-main">
        {currentPage === 'workspace' && (
          <>
            <DispatchSection
              onDispatch={handleDispatchTask}
              onClearTasks={() => {
                clearAllTasks();
                setJustCompletedTask(null);
                lastShownKeyRef.current   = '';
                stepsDoneKeyRef.current   = '';
                setExecSession(null);
              }}
              tasks={tasks}
              useMock={useMock}
            />
            <OfficeFloor
              agentStates={agentStates}
              tasks={tasks}
              onRetryTask={handleRetryTask}
              onOpenExecution={handleManualOpenExecution}
              justCompletedTask={justCompletedTask}
              onAskAssistant={() => setChatOpen(true)}
            />
          </>
        )}
        {currentPage === 'history' && (
          <HistoryPage
            tasks={tasks}
            activityLogs={activityLogs}
            onOpenExecution={handleManualOpenExecution}
            onNavigateToWorkspace={() => setCurrentPage('workspace')}
          />
        )}
      </main>

      {/* Execution panel — key forces full remount per agent */}
      {execSession && (
        <ExecutionModal
          key={execSession.sessionKey}
          agentId={execSession.agentId}
          taskDescription={execSession.taskDescription}
          tasks={tasks}
          taskId={execSession.taskId}
          isClosing={execSession.isClosing}
          onClose={() => closePanel()}
          onStepsComplete={handleStepsComplete}
        />
      )}

      <ChatbotPanel
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        tasks={tasks}
        activityLogs={activityLogs}
      />
    </div>
  );
}

export default App;
