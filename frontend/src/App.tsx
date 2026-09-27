import { useState, useEffect } from 'react';
import { useTaskSocket } from './hooks/useTaskSocket';
import { Navigation } from './components/Navigation';
import { DispatchSection } from './components/DispatchSection';
import { OfficeFloor } from './components/OfficeFloor';
import { ExecutionModal } from './components/ExecutionModal';
import { ChatbotPanel } from './components/ChatbotPanel';
import { HistoryPage } from './components/HistoryPage';
import { apiCreateTask, apiRetryTask } from './services/api';
import type { ActiveTask } from './types/task';
import './index.css';

type Page = 'workspace' | 'history';

export function App() {
  const {
    useMock,
    setUseMock,
    connectionStatus,
    tasks,
    activityLogs,
    agentStates,
    clearAllTasks
  } = useTaskSocket(false);

  const [currentPage, setCurrentPage] = useState<Page>('workspace');
  const [selectedTask, setSelectedTask] = useState<ActiveTask | null>(null);
  const [executionModalTask, setExecutionModalTask] = useState<ActiveTask | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [justCompletedTask, setJustCompletedTask] = useState<ActiveTask | null>(null);

  // When a task completes, show the completion summary
  useEffect(() => {
    const completedTask = tasks.find(t => t.status === 'completed');
    if (completedTask && (!justCompletedTask || justCompletedTask.id !== completedTask.id)) {
      setJustCompletedTask(completedTask);
      // Close execution modal when task completes
      if (executionModalTask?.id === completedTask.id) {
        setTimeout(() => setExecutionModalTask(null), 1200);
      }
    }
  }, [tasks]);

  // When a task becomes active (routed/working), open the execution modal
  useEffect(() => {
    const activeTask = tasks.find(t => t.status === 'routed' || t.status === 'working');
    if (activeTask && (!executionModalTask || executionModalTask.id !== activeTask.id || activeTask.status !== executionModalTask.status)) {
      setExecutionModalTask(activeTask);
    }
  }, [tasks]);

  const handleDispatchTask = async (description: string) => {
    setJustCompletedTask(null);
    const res = await apiCreateTask(description, useMock);
    if (res?.task_id) {
      setSelectedTask(null);
    }
  };

  const handleRetryTask = async (taskId: string, lastSeq: number) => {
    await apiRetryTask(taskId, lastSeq, useMock);
  };

  const handleOpenExecution = (task: ActiveTask) => {
    setExecutionModalTask(task);
  };

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
              onClearTasks={clearAllTasks}
              tasks={tasks}
              useMock={useMock}
            />

            <OfficeFloor
              agentStates={agentStates}
              tasks={tasks}
              onRetryTask={handleRetryTask}
              onOpenExecution={handleOpenExecution}
              justCompletedTask={justCompletedTask}
              onAskAssistant={() => setChatOpen(true)}
            />
          </>
        )}

        {currentPage === 'history' && (
          <HistoryPage
            tasks={tasks}
            activityLogs={activityLogs}
            onOpenExecution={handleOpenExecution}
            onNavigateToWorkspace={() => setCurrentPage('workspace')}
          />
        )}
      </main>

      {/* Execution modal */}
      {executionModalTask && (
        <ExecutionModal
          task={executionModalTask}
          allTasks={tasks}
          onClose={() => setExecutionModalTask(null)}
        />
      )}

      {/* Chatbot */}
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
