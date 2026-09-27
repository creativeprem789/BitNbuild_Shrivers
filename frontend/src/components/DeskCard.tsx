import React from 'react';
import type { ActiveTask, AgentId, AgentState, AgentInfo } from '../types/task';

interface DeskCardProps {
  agentId: AgentId;
  def: AgentInfo;
  state: AgentState;
  tasks: ActiveTask[];
  onRetryTask: (taskId: string, lastSeq: number) => void;
  onOpenExecution: (task: ActiveTask) => void;
}

const AGENT_ICONS: Record<AgentId, string> = {
  email_agent: '✉️',
  calendar_agent: '📅',
  search_agent: '🔍',
  custom_agent: '⚡',
};

const AGENT_ICON_CLASS: Record<AgentId, string> = {
  email_agent: 'icon-email',
  calendar_agent: 'icon-calendar',
  search_agent: 'icon-research',
  custom_agent: 'icon-executive',
};

const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  email_agent: 'Communication & Outreach',
  calendar_agent: 'Schedule & Logistics',
  search_agent: 'Research & Knowledge',
  custom_agent: 'Fallback & Resolution',
};

const AGENT_WORKING_LABEL: Record<AgentId, string> = {
  email_agent: 'Writing & sending email',
  calendar_agent: 'Booking calendar slot',
  search_agent: 'Researching & gathering data',
  custom_agent: 'Resolving your request',
};

export const DeskCard: React.FC<DeskCardProps> = ({
  agentId,
  def,
  state,
  tasks,
  onRetryTask,
  onOpenExecution,
}) => {
  const hasTasks = tasks.length > 0;
  const activeTask = tasks[0] ?? null;
  const isWorking = state === 'working';
  const isBlocked = state === 'blocked';

  const getDeskClass = () => {
    if (isBlocked) return 'desk-card desk-blocked';
    if (isWorking) return 'desk-card desk-working';
    if (tasks.some(t => t.status === 'completed')) return 'desk-card desk-completed';
    return 'desk-card desk-idle';
  };

  const getStatusLabel = () => {
    if (isBlocked) return 'Needs Attention';
    if (isWorking) return 'Working';
    return 'Idle';
  };

  const getStatusColor = () => {
    if (isBlocked) return 'var(--status-blocked)';
    if (isWorking) return 'var(--status-working)';
    return 'var(--status-idle)';
  };

  return (
    <div
      className={getDeskClass()}
      onClick={() => activeTask && onOpenExecution(activeTask)}
      style={{ cursor: hasTasks ? 'pointer' : 'default' }}
    >
      <div className="desk-header">
        <div className={`desk-icon ${AGENT_ICON_CLASS[agentId]}`}>
          {AGENT_ICONS[agentId]}
        </div>
        <div className="desk-meta">
          <div className="desk-name">{def.name}</div>
          <div className="desk-role">{AGENT_DESCRIPTIONS[agentId]}</div>
        </div>
      </div>

      <div className="desk-status-row">
        <div className="desk-status-badge" style={{ color: getStatusColor() }}>
          <span className={`status-indicator ${state}`} />
          {getStatusLabel()}
        </div>
        {isWorking && (
          <span style={{
            fontSize: '10px',
            color: 'var(--status-working)',
            fontWeight: 500,
            animation: 'fade-in-up 0.3s ease'
          }}>
            {AGENT_WORKING_LABEL[agentId]}
          </span>
        )}
      </div>

      {/* Active task token on desk */}
      {activeTask && (
        <div className={`desk-task-token token-${isBlocked ? 'blocked' : 'working'}`}>
          <div className="token-label">Current Task</div>
          <div className="token-desc">{activeTask.description}</div>
          {isBlocked && activeTask.blockReason && (
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--status-blocked)' }}>
                {activeTask.blockReason}
              </span>
              <button
                className="btn-retry"
                onClick={e => {
                  e.stopPropagation();
                  onRetryTask(activeTask.id, activeTask.lastSequenceNo);
                }}
              >
                ↺ Retry
              </button>
            </div>
          )}
          {isWorking && (
            <div style={{
              marginTop: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <span style={{
                width: '6px', height: '6px',
                background: 'var(--status-working)',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'working-pulse 1.2s infinite'
              }} />
              Tap to see what's happening →
            </div>
          )}
        </div>
      )}
    </div>
  );
};
