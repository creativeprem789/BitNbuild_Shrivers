import { useState } from 'react';
import { useTaskSocket } from './hooks/useTaskSocket';
import { Header } from './components/Header';
import { TaskInput } from './components/TaskInput';
import { OfficeFloor } from './components/OfficeFloor';
import { StatusPanel } from './components/StatusPanel';
import { ActivityFeed } from './components/ActivityFeed';
import { MermaidModal } from './components/MermaidModal';
import { apiCreateTask, apiRetryTask } from './services/api';

export function App() {
  const {
    useMock,
    setUseMock,
    connectionStatus,
    tasks,
    activityLogs,
    agentStates,
    clearAllTasks
  } = useTaskSocket(true); // Defaults to true for standalone demo mode

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMermaidOpen, setIsMermaidOpen] = useState<boolean>(false);

  // Dispatch new task prompt
  const handleDispatchTask = async (description: string) => {
    const res = await apiCreateTask(description, useMock);
    if (res && res.task_id) {
      setSelectedTaskId(res.task_id);
    }
  };

  // Trigger retry on blocked task
  const handleRetryTask = async (taskId: string, lastSeq: number) => {
    await apiRetryTask(taskId, lastSeq, useMock);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* App Header */}
      <Header
        connectionStatus={connectionStatus}
        onOpenMermaidModal={() => setIsMermaidOpen(true)}
      />

      {/* Main Content Layout */}
      <main className="flex-1 flex flex-col gap-6">
        {/* Task Dispatcher Form */}
        <TaskInput
          onSubmitTask={handleDispatchTask}
          onClearTasks={clearAllTasks}
          useMock={useMock}
          onToggleMock={setUseMock}
        />

        {/* Central Interactive Virtual Office Floor Canvas */}
        <OfficeFloor
          agentStates={agentStates}
          tasks={tasks}
          onRetryTask={handleRetryTask}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />

        {/* Lower Details Row: Stage Inspector & Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusPanel
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
          />
          <ActivityFeed
            events={activityLogs}
            onSelectTask={setSelectedTaskId}
          />
        </div>
      </main>

      {/* Mermaid Graph Topology Modal */}
      <MermaidModal
        isOpen={isMermaidOpen}
        onClose={() => setIsMermaidOpen(false)}
      />

      {/* Footer Branding */}
      <footer className="mt-8 py-3 border-t border-white/5 text-center text-xs font-mono text-gray-500">
        Interactive Multi-Agent Task Harness • Bit N Build Hackathon • FastAPI + LangGraph + React (Vite)
      </footer>
    </div>
  );
}

export default App;
