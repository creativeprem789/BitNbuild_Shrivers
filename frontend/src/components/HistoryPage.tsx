import React, { useState } from 'react';
import type { ActiveTask, TaskEvent, AgentId } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { ExecutionModal } from './ExecutionModal';

interface HistoryPageProps {
  tasks: ActiveTask[];
  activityLogs: TaskEvent[];
  onOpenExecution: (task: ActiveTask) => void;
  onNavigateToWorkspace: () => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function buildPath(task: ActiveTask): string {
  const parts: string[] = ['Reception'];
  for (const e of task.events) {
    if (e.event_type === 'task.routed') {
      parts.push(AGENT_DEFINITIONS[e.agent_id]?.name ?? e.agent_id);
    }
    if (e.event_type === 'task.handoff') {
      parts.push(AGENT_DEFINITIONS[e.to_agent]?.name ?? e.to_agent);
    }
  }
  if (task.status === 'completed') parts.push('Submit Desk');
  return parts.join(' → ');
}

function getAgentIcon(task: ActiveTask): string {
  const routedEvent = task.events.find(e => e.event_type === 'task.routed');
  if (routedEvent && routedEvent.event_type === 'task.routed') {
    return AGENT_DEFINITIONS[routedEvent.agent_id]?.avatar ?? '📋';
  }
  return '📋';
}

function getAgentIconClass(task: ActiveTask): string {
  const routedEvent = task.events.find(e => e.event_type === 'task.routed');
  if (routedEvent && routedEvent.event_type === 'task.routed') {
    const map: Record<AgentId, string> = {
      email_agent: 'icon-email',
      calendar_agent: 'icon-calendar',
      search_agent: 'icon-research',
      custom_agent: 'icon-executive'
    };
    return map[routedEvent.agent_id] ?? '';
  }
  return '';
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  tasks,
  activityLogs: _activityLogs,
  onOpenExecution: _onOpenExecution,
  onNavigateToWorkspace
}) => {
  const [replayTask, setReplayTask] = useState<ActiveTask | null>(null);

  // All tasks ordered by most recent
  const sortedTasks = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="history-section">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Past activity</div>
          <h2 className="section-header-title">Task History</h2>
        </div>
        <button className="btn-ghost" onClick={onNavigateToWorkspace}>
          ← Back to Workspace
        </button>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-icon">📋</div>
          <div className="history-empty-text">No tasks yet</div>
          <div className="history-empty-sub">
            Dispatch your first task from the Workspace to get started.
          </div>
          <button
            className="btn-dispatch"
            style={{ margin: '20px auto 0', display: 'flex' }}
            onClick={onNavigateToWorkspace}
          >
            Go to Workspace
          </button>
        </div>
      ) : (
        <div className="history-list">
          {sortedTasks.map(task => (
            <div
              key={task.id}
              className="history-card"
              onClick={() => setReplayTask(task)}
            >
              <div className={`history-icon ${getAgentIconClass(task)}`} style={{ fontSize: '17px' }}>
                {getAgentIcon(task)}
              </div>

              <div className="history-meta">
                <div className="history-desc">{task.description}</div>
                <div className="history-path">
                  {buildPath(task).split(' → ').map((part, i, arr) => (
                    <React.Fragment key={i}>
                      <span>{part}</span>
                      {i < arr.length - 1 && <span className="history-path-sep">→</span>}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`history-status-badge ${task.status === 'completed' ? 'completed' : 'blocked'}`}>
                    {task.status === 'completed' ? '✓ Completed' : task.status === 'blocked' ? '⚠ Blocked' : '● Active'}
                  </span>
                  {task.durationMs && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {task.durationMs < 1000 ? `${task.durationMs}ms` : `${(task.durationMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>
              </div>

              <div className="history-time">
                <div>{formatTime(task.createdAt)}</div>
                <div style={{
                  marginTop: '8px',
                  fontSize: '11.5px',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  View details →
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Replay modal */}
      {replayTask && (
        <ExecutionModal
          agentId={replayTask.currentAgentId ?? 'custom_agent'}
          taskDescription={replayTask.description}
          taskId={replayTask.id}
          tasks={tasks}
          isClosing={false}
          onClose={() => setReplayTask(null)}
        />
      )}
    </section>
  );
};
