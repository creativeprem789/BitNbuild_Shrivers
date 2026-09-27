import React from 'react';
import type { ActiveTask, AgentId, AgentState } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { DeskCard } from './DeskCard';
import { ReceptionDesk } from './ReceptionDesk';
import { SubmitDesk } from './SubmitDesk';

interface OfficeFloorProps {
  agentStates: Record<AgentId, AgentState>;
  tasks: ActiveTask[];
  onRetryTask: (taskId: string, lastSeq: number) => void;
  onOpenExecution: (task: ActiveTask) => void;
  justCompletedTask: ActiveTask | null;
  onAskAssistant: () => void;
}

export const OfficeFloor: React.FC<OfficeFloorProps> = ({
  agentStates,
  tasks,
  onRetryTask,
  onOpenExecution,
  justCompletedTask,
  onAskAssistant
}) => {
  // Tasks by location
  const inboxTasks = tasks.filter(t => t.currentLocation === 'inbox' && t.status !== 'completed');
  const doneTasks = tasks.filter(t => t.status === 'completed');

  const getTasksForAgent = (agentId: AgentId) =>
    tasks.filter(t => t.currentAgentId === agentId && t.status !== 'completed');

  const agentOrder: AgentId[] = ['email_agent', 'calendar_agent', 'search_agent', 'custom_agent'];

  // Determine if any task is actively moving between locations
  const hasActiveFlow = tasks.some(t => t.status === 'routed' || t.status === 'working');

  return (
    <section className="office-floor-section">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Your virtual office</div>
          <h2 className="section-header-title">Office Floor</h2>
        </div>
        <button className="btn-ghost" onClick={onAskAssistant}>
          💬 Ask Assistant
        </button>
      </div>

      {/* Main 3-column office layout */}
      <div className="office-layout">
        {/* LEFT: Reception */}
        <div className="side-desk-col">
          <div className="side-col-label">Reception</div>
          <ReceptionDesk tasks={inboxTasks} hasActiveFlow={hasActiveFlow} />
        </div>

        {/* CENTER: Managers grid */}
        <div>
          <div className="side-col-label" style={{ textAlign: 'center', marginBottom: '12px' }}>
            Specialist Managers
          </div>
          <div className="managers-grid">
            {agentOrder.map(agentId => {
              const def = AGENT_DEFINITIONS[agentId];
              const state = agentStates[agentId];
              const agentTasks = getTasksForAgent(agentId);

              return (
                <DeskCard
                  key={agentId}
                  agentId={agentId}
                  def={def}
                  state={state}
                  tasks={agentTasks}
                  onRetryTask={onRetryTask}
                  onOpenExecution={onOpenExecution}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT: Submit Desk */}
        <div className="side-desk-col">
          <div className="side-col-label">Submit Desk</div>
          <SubmitDesk
            doneTasks={doneTasks}
            justCompletedTask={justCompletedTask}
            onAskAssistant={onAskAssistant}
          />
        </div>
      </div>

      {/* Flow indicator legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginTop: '24px',
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
        color: 'var(--text-muted)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
          Idle
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-working)', display: 'inline-block' }} />
          Working
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-done)', display: 'inline-block' }} />
          Completed
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--status-blocked)', display: 'inline-block' }} />
          Needs Attention
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Click any desk to view task details
        </span>
      </div>
    </section>
  );
};
