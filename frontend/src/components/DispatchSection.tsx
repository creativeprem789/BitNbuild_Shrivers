import React, { useState } from 'react';
import type { ActiveTask } from '../types/task';

interface DispatchSectionProps {
  onDispatch: (description: string) => void;
  onClearTasks: () => void;
  tasks: ActiveTask[];
  useMock: boolean;
}

const PRESETS = [
  { label: 'Write Email', text: 'Send an email to the engineering team about tomorrow\'s meeting' },
  { label: 'Schedule Meeting', text: 'Schedule a quarterly review meeting with the team for next Monday' },
  { label: 'Research Topic', text: 'Research the latest AI benchmark results and summarize' },
  { label: 'Organize Files', text: 'Organize the latest downloads into appropriate folders' },
];

export const DispatchSection: React.FC<DispatchSectionProps> = ({
  onDispatch,
  onClearTasks,
  tasks,
  useMock
}) => {
  const [value, setValue] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isDispatching) return;

    setIsDispatching(true);
    await onDispatch(trimmed);
    setValue('');
    setSelectedPreset(null);
    setIsDispatching(false);
  };

  const handlePreset = (text: string, label: string) => {
    setValue(text);
    setSelectedPreset(label);
  };

  return (
    <section className="task-dispatch-section">
      <h1 className="section-title">What do you need done today?</h1>

      <form onSubmit={handleSubmit}>
        <div className="task-input-row">
          <SearchIcon />
          <input
            className="task-input-field"
            type="text"
            placeholder="Search"
            value={value}
            onChange={e => {
              setValue(e.target.value);
              setSelectedPreset(null); // Clear selection on manual edit
            }}
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
        {PRESETS.map((p) => {
          const isSelected = selectedPreset === p.label;
          return (
            <button
              key={p.label}
              className={`preset-pill ${isSelected ? 'preset-pill-selected' : ''}`}
              onClick={() => handlePreset(p.text, p.label)}
              type="button"
            >
              <div className="preset-pill-content">
                <span className="preset-pill-label">{p.label}</span>
              </div>
            </button>
          );
        })}

        {tasks.length > 0 && (
          <button
            className="preset-pill"
            onClick={onClearTasks}
            type="button"
            style={{ marginLeft: 'auto', borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
          >
            <div className="preset-pill-content">
              <span>🗑 Clear All</span>
            </div>
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

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a09282" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
    <path d="M21 12a9 9 0 11-6.219-8.56" />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);
