import React from 'react';
import type { ActiveTask } from '../types/task';

interface SubmitDeskProps {
  doneTasks: ActiveTask[];
  justCompletedTask: ActiveTask | null;
  onAskAssistant: () => void;
}

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const SubmitDesk: React.FC<SubmitDeskProps> = ({ doneTasks, justCompletedTask, onAskAssistant }) => {
  const hasCompleted = doneTasks.length > 0;

  return (
    <div className={`desk-card desk-submit ${hasCompleted ? 'desk-has-completed' : ''}`}>
      <div className="desk-header">
        <div className="desk-icon icon-submit" style={{ fontSize: '18px' }}>
          ✅
        </div>
        <div className="desk-meta">
          <div className="desk-name">Submit Desk</div>
          <div className="desk-role">Completed Tasks</div>
        </div>
      </div>

      <div className="desk-status-row">
        <div
          className="desk-status-badge"
          style={{ color: hasCompleted ? 'var(--status-done)' : 'var(--status-idle)' }}
        >
          <span
            className="status-indicator"
            style={{ background: hasCompleted ? 'var(--status-done)' : 'var(--status-idle)' }}
          />
          {doneTasks.length > 0 ? `${doneTasks.length} done` : 'Empty'}
        </div>
      </div>

      {/* Just completed task summary */}
      {justCompletedTask && (
        <div className="completion-card" style={{ marginTop: '12px', padding: '12px 14px' }}>
          <div className="completion-title">
            ✓ Task Completed
          </div>
          <div className="completion-desc" style={{ fontSize: '12.5px', marginBottom: '10px' }}>
            {justCompletedTask.description}
          </div>
          {justCompletedTask.durationMs && (
            <div style={{ fontSize: '11px', color: 'var(--status-done)', marginBottom: '8px' }}>
              Finished in {formatDuration(justCompletedTask.durationMs)}
            </div>
          )}
          <div className="completion-actions" style={{ flexDirection: 'column', gap: '6px' }}>
            <button
              className="btn-completion"
              style={{ fontSize: '11.5px', textAlign: 'left' }}
              onClick={onAskAssistant}
            >
              💬 Ask about this task
            </button>
            <button
              className="btn-completion"
              style={{ fontSize: '11.5px', textAlign: 'left', background: 'var(--status-done-bg)', borderColor: 'var(--status-done-border)', color: 'var(--status-done)' }}
            >
              ✓ Saved to History
            </button>
          </div>
        </div>
      )}

      {/* All completed tasks list */}
      {doneTasks.length > 0 && !justCompletedTask && (
        <div style={{ marginTop: '10px' }}>
          {doneTasks.slice(0, 3).map(task => (
            <div
              key={task.id}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'var(--status-done-bg)',
                border: '1px solid var(--status-done-border)',
                marginBottom: '6px',
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ color: 'var(--status-done)', fontSize: '12px' }}>✓</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {task.description}
              </span>
              <span style={{ color: 'var(--status-done)', fontSize: '10px', flexShrink: 0 }}>
                {formatDuration(task.durationMs)}
              </span>
            </div>
          ))}
          {doneTasks.length > 3 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
              +{doneTasks.length - 3} more in History
            </div>
          )}
        </div>
      )}

      {doneTasks.length === 0 && !justCompletedTask && (
        <div style={{
          marginTop: '10px',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          lineHeight: '1.5'
        }}>
          Completed tasks will appear here.
        </div>
      )}
    </div>
  );
};
