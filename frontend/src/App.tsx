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

// --- Execution Orchestration Types ---
export interface ExecSession {
  /** Unique key — changes every time a new agent starts so ExecutionModal remounts fresh */
  sessionKey: string;
  taskId: string;
  agentId: AgentId;
  taskDescription: string;
  isClosing: boolean;
}

export function App() {
  const {
    useMock, setUseMock,
    connectionStatus,
    tasks, activityLogs, agentStates,
    clearAllTasks
  } = useTaskSocket(false);

  const [currentPage, setCurrentPage] = useState<Page>('workspace');
  const [chatOpen, setChatOpen] = useState(false);
  const [justCompletedTask, setJustCompletedTask] = useState<ActiveTask | null>(null);

  // ------------------------------------------------------------------
  // Execution-panel state machine
  // ------------------------------------------------------------------
  const [execSession, setExecSession] = useState<ExecSession | null>(null);

  // Track what we last showed so we don't duplicate
  const lastShownAgentKeyRef = useRef<string>('');
  const isTransitioningRef = useRef(false);

  /**
   * Close the current panel (with animation) then run `then` callback.
   */
  const closePanel = useCallback((then?: () => void) => {
    setExecSession(prev => prev ? { ...prev, isClosing: true } : null);
    setTimeout(() => {
      setExecSession(null);
      isTransitioningRef.current = false;
      then?.();
    }, 900); // matches CSS close animation
  }, []);

  /**
   * Open a fresh panel for the given task+agent.
   * Waits `openDelay` ms so the token travel animation can play first.
   */
  const openPanel = useCallback((task: ActiveTask, agentId: AgentId, openDelay: number) => {
    setTimeout(() => {
      const key = `${task.id}-${agentId}-${Date.now()}`;
      setExecSession({
        sessionKey: key,
        taskId: task.id,
        agentId,
        taskDescription: task.description,
        isClosing: false,
      });
    }, openDelay);
  }, []);

  // Watch tasks → drive execution sequence
  useEffect(() => {
    const activeTask = tasks.find(
      t => (t.status === 'routed' || t.status === 'working') && t.currentAgentId
    );

    // ── Task completed ──────────────────────────────────────────────
    const completedTask = tasks.find(t => t.status === 'completed');
    if (completedTask) {
      if (!justCompletedTask || justCompletedTask.id !== completedTask.id) {
        setJustCompletedTask(completedTask);
      }
      // If panel is open for this task, close it
      if (execSession && execSession.taskId === completedTask.id && !execSession.isClosing) {
        closePanel();
        lastShownAgentKeyRef.current = '';
        return;
      }
    }

    // ── No active task ───────────────────────────────────────────────
    if (!activeTask?.currentAgentId) return;

    const newKey = `${activeTask.id}-${activeTask.currentAgentId}`;
    if (newKey === lastShownAgentKeyRef.current) return;   // already showing this
    if (isTransitioningRef.current) return;                 // mid-animation, wait

    lastShownAgentKeyRef.current = newKey;
    isTransitioningRef.current = true;

    if (execSession && !execSession.isClosing) {
      // Different agent → close old panel first, then open new one
      closePanel(() => {
        // 600 ms gap so the user sees the token move before the next panel
        openPanel(activeTask, activeTask.currentAgentId!, 600);
      });
    } else {
      // No panel open → wait for token travel (1 400 ms) then open
      openPanel(activeTask, activeTask.currentAgentId!, 1400);
      setTimeout(() => { isTransitioningRef.current = false; }, 1500);
    }
  }, [tasks]);

  // ── Blocked task: close panel ────────────────────────────────────
  useEffect(() => {
    const blocked = tasks.find(t => t.status === 'blocked');
    if (blocked && execSession && execSession.taskId === blocked.id && !execSession.isClosing) {
      closePanel();
    }
  }, [tasks]);

  // ------------------------------------------------------------------
  // Task dispatch / retry
  // ------------------------------------------------------------------
  const handleDispatchTask = async (description: string) => {
    setJustCompletedTask(null);
    lastShownAgentKeyRef.current = '';
    await apiCreateTask(description, useMock);
  };

  const handleRetryTask = async (taskId: string, lastSeq: number) => {
    await apiRetryTask(taskId, lastSeq, useMock);
  };

  const handleManualOpenExecution = (task: ActiveTask) => {
    if (!task.currentAgentId) return;
    const key = `${task.id}-${task.currentAgentId}-manual`;
    setExecSession({
      sessionKey: key,
      taskId: task.id,
      agentId: task.currentAgentId,
      taskDescription: task.description,
      isClosing: false,
    });
  };

  // ------------------------------------------------------------------
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
                lastShownAgentKeyRef.current = '';
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

      {/* Per-agent execution panel — keyed so it fully remounts per agent */}
      {execSession && (
        <ExecutionModal
          key={execSession.sessionKey}
          agentId={execSession.agentId}
          taskDescription={execSession.taskDescription}
          tasks={tasks}
          taskId={execSession.taskId}
          isClosing={execSession.isClosing}
          onClose={() => closePanel()}
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
