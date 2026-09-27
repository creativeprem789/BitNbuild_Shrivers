import React, { useState } from 'react';
import type { ActiveTask } from '../types/task';

interface DispatchSectionProps {
  onDispatch: (description: string) => void;
  onClearTasks: () => void;
  tasks: ActiveTask[];
  useMock: boolean;
}

const PRESETS = [
  {
    label: '✉️ Send Email',
    text: 'Send an email to the engineering team about tomorrow\'s product review meeting',
    tag: 'Email'
  },
  {
    label: '🔬 Research & Report',
    text: 'Research the latest AI benchmark results and report the findings to the VP',
    tag: 'Research → Email'
  },
  {
    label: '📅 Schedule Meeting',
    text: 'Schedule a quarterly review meeting with the product and engineering team for next Monday',
    tag: 'Calendar'
  },
  {
    label: '⚠️ Missing Info',
    text: 'Book conference room Alpha for an unscheduled team meeting',
    tag: 'Blocked'
  },
];

export const DispatchSection: React.FC<DispatchSectionProps> = ({
  onDispatch,
  onClearTasks,
  tasks,
  useMock
}) => {
  const [value, setValue] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

  const hasActiveTasks = tasks.some(t => t.status !== 'completed');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isDispatching) return;

    setIsDispatching(true);
    await onDispatch(trimmed);
    setValue('');
    setIsDispatching(false);
  };

  const handlePreset = (text: string) => {
    setValue(text);
  };

  return (
    <section className="task-dispatch-section">
      <div className="section-eyebrow">Give the office a task</div>
      <h1 className="section-title">What do you need done today?</h1>
      <p className="section-subtitle">
        Describe your task in plain language — the right specialist will handle it automatically.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="task-input-row">
          <input
            className="task-input-field"
            type="text"
            placeholder="Enter a task for the office…"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoComplete="off"
            disabled={isDispatching}
          />
          <button
            type="submit"
            className="btn-dispatch"
            disabled={!value.trim() || isDispatching}
          >
            {isDispatching ? (
              <>
                <SpinnerIcon />
                Dispatching…
              </>
            ) : (
              <>
                <SendIcon />
                Dispatch Task
              </>
            )}
          </button>
        </div>
      </form>

      <div className="task-presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="preset-pill"
            onClick={() => handlePreset(p.text)}
            type="button"
          >
            {p.label}
            <span className="preset-tag">{p.tag}</span>
          </button>
        ))}

        {tasks.length > 0 && (
          <button
            className="preset-pill"
            onClick={onClearTasks}
            type="button"
            style={{ marginLeft: 'auto', borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
          >
            🗑 Clear All
          </button>
        )}
      </div>

      {useMock && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#6366f1',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          🎭 <strong>Demo mode</strong> — tasks run with simulated data. Switch to Live for real backend.
        </div>
      )}
    </section>
  );
};

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
    <path d="M21 12a9 9 0 11-6.219-8.56" />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);
