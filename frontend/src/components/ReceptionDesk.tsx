import React from 'react';
import type { ActiveTask } from '../types/task';

interface ReceptionDeskProps {
  tasks: ActiveTask[];
  hasActiveFlow: boolean;
}

export const ReceptionDesk: React.FC<ReceptionDeskProps> = ({ tasks, hasActiveFlow }) => {
  const isActive = tasks.length > 0 || hasActiveFlow;

  return (
    <div className={`desk-card desk-reception ${isActive ? 'desk-active-reception' : ''}`}>
      <div className="desk-header">
        <div className="desk-icon icon-reception" style={{ fontSize: '18px' }}>
          🏛️
        </div>
        <div className="desk-meta">
          <div className="desk-name">Reception</div>
          <div className="desk-role">Task Intake & Routing</div>
        </div>
      </div>

      <div className="desk-status-row">
        <div className="desk-status-badge" style={{ color: isActive ? 'var(--accent)' : 'var(--status-idle)' }}>
          <span
            className="status-indicator"
            style={{
              background: isActive ? 'var(--accent)' : 'var(--status-idle)',
              animation: isActive ? 'working-pulse 1.4s infinite' : 'none'
            }}
          />
          {isActive ? 'Receiving' : 'Ready'}
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="reception-queue">
          {tasks.map(task => (
            <div key={task.id} className="reception-task-chip">
              <span
                className="chip-dot"
                style={{ background: 'var(--accent)' }}
              />
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {task.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <div style={{
          marginTop: '10px',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          lineHeight: '1.5'
        }}>
          Awaiting your next task.
          <br />
          Dispatch one above ↑
        </div>
      )}
    </div>
  );
};
