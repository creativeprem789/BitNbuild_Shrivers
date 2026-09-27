import React, { useState } from 'react';
import { Send, Sparkles, RefreshCw } from 'lucide-react';

interface TaskInputProps {
  onSubmitTask: (description: string) => void;
  onClearTasks: () => void;
  useMock: boolean;
  onToggleMock: (val: boolean) => void;
}

const PRESETS = [
  {
    title: '🔬 Research & Report to VP',
    desc: 'Research the benchmarks and report to the VP',
    tag: 'Search ➔ Email'
  },
  {
    title: '📅 Research & Schedule Sync',
    desc: 'Research competitor AI agent platforms and schedule a team review meeting',
    tag: 'Search ➔ Calendar'
  },
  {
    title: '📆 Direct Calendar Booking',
    desc: 'Schedule a quarterly product review with engineering tomorrow at 2 PM',
    tag: 'Calendar'
  },
  {
    title: '⚠️ Blocked Task & Human Retry',
    desc: 'Book conference room Alpha (unscheduled date and time)',
    tag: 'Blocked / Retry'
  }
];

export const TaskInput: React.FC<TaskInputProps> = ({
  onSubmitTask,
  onClearTasks,
  useMock,
  onToggleMock
}) => {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    onSubmitTask(prompt);
    setPrompt('');
    setTimeout(() => setIsSubmitting(false), 500);
  };

  const handleSelectPreset = (desc: string) => {
    setPrompt(desc);
  };

  return (
    <div className="p-4 rounded-xl glass-panel flex flex-col gap-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-gray-200">DISPATCH NEW TASK</h3>
        </div>

        {/* Backend Connection Status Badge & Mock Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClearTasks}
            className="text-[11px] font-mono text-gray-400 hover:text-white px-2 py-1 rounded bg-slate-900 border border-white/10 transition-colors"
          >
            Reset Workspace
          </button>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-mono select-none">
            <span className="text-gray-400">MOCK MODE</span>
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => onToggleMock(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600 relative"></div>
          </label>
        </div>
      </div>

      {/* Quick Task Presets */}
      <div>
        <span className="text-[11px] font-mono text-gray-400 mb-1.5 block">QUICK TASK PRESETS</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(p.desc)}
              className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 hover:border-amber-500/40 hover:bg-amber-950/20 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-200 group-hover:text-amber-300">
                  {p.title}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {p.tag}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                {p.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Natural Language Prompt Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-1">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter natural language task (e.g. 'Research benchmarks and email report to VP')..."
          className="flex-1 bg-amber-200 border border-amber-600/50 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-sans"
        />

        <button
          type="submit"
          disabled={!prompt.trim() || isSubmitting}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition-all shadow-lg active:scale-95 shrink-0"
        >
          {isSubmitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Dispatch Task</span>
        </button>
      </form>
    </div>
  );
};
