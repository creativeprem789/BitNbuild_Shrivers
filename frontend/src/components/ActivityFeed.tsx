import React, { useState } from 'react';
import type { TaskEvent } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { Terminal, Search, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ActivityFeedProps {
  events: TaskEvent[];
  onSelectTask: (taskId: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events, onSelectTask }) => {
  const [filter, setFilter] = useState<'all' | 'handoff' | 'blocked' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = events.filter((evt) => {
    // Type Filter
    if (filter === 'handoff' && evt.event_type !== 'task.handoff') return false;
    if (filter === 'blocked' && evt.event_type !== 'task.blocked') return false;
    if (filter === 'system' && (evt.event_type === 'task.handoff' || evt.event_type === 'task.blocked')) return false;

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const reasonStr = (evt as any).reason || '';
      const descStr = (evt as any).description || '';
      const taskId = evt.task_id.toLowerCase();
      return reasonStr.toLowerCase().includes(q) || descStr.toLowerCase().includes(q) || taskId.includes(q);
    }

    return true;
  });

  return (
    <div className="flex flex-col h-[280px] p-4 rounded-xl glass-panel activity-feed-panel">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-gray-200">LIVE ORCHESTRATION ACTIVITY FEED</h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {events.length} EVENTS
          </span>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
            <input
              type="text"
              placeholder="Search log reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 w-36 sm:w-48 font-mono"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-white/10 text-xs font-mono">
            {(['all', 'handoff', 'blocked', 'system'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded capitalize transition-colors ${
                  filter === f
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrolling Timestamped Event Log */}
      <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-1">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 italic">
            No event logs match filter criteria.
          </div>
        ) : (
          filteredEvents.map((evt, idx) => {
            const timeStr = evt.timestamp || new Date().toLocaleTimeString();

            return (
              <div
                key={idx}
                onClick={() => onSelectTask(evt.task_id)}
                className="p-2 rounded-lg bg-slate-950/70 border border-white/5 hover:border-white/20 transition-colors flex items-start gap-2.5 cursor-pointer group"
              >
                {/* Timestamp & Sequence */}
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 shrink-0">
                  <span>[{timeStr}]</span>
                  <span className="text-amber-400 font-bold">#seq:{evt.sequence_no}</span>
                </div>

                {/* Event Type Badge */}
                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold shrink-0 ${
                  evt.event_type === 'task.created'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : evt.event_type === 'task.routed'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : evt.event_type === 'task.handoff'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : evt.event_type === 'task.blocked'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {evt.event_type.replace('task.', '')}
                </span>

                {/* Human-Readable Event Log Line */}
                <div className="flex-1 text-gray-300 truncate leading-snug">
                  {evt.event_type === 'task.created' && (
                    <span>Task received: "{evt.description}"</span>
                  )}
                  
                  {evt.event_type === 'task.routed' && (
                    <span>
                      Routed to <strong style={{ color: AGENT_DEFINITIONS[evt.agent_id].color }}>{AGENT_DEFINITIONS[evt.agent_id].name}</strong> ({Math.round(evt.confidence * 100)}% conf): {evt.reason}
                    </span>
                  )}

                  {evt.event_type === 'task.handoff' && (
                    <span className="flex items-center gap-1">
                      <span style={{ color: AGENT_DEFINITIONS[evt.from_agent].color }}>{AGENT_DEFINITIONS[evt.from_agent].name}</span>
                      <ArrowRight className="w-3 h-3 text-orange-400 shrink-0 inline" />
                      <span style={{ color: AGENT_DEFINITIONS[evt.to_agent].color }}>{AGENT_DEFINITIONS[evt.to_agent].name}</span>
                      <span className="text-gray-400 ml-1.5 truncate">- {evt.reason}</span>
                    </span>
                  )}

                  {evt.event_type === 'task.blocked' && (
                    <span className="text-red-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 inline" />
                      BLOCKED at {AGENT_DEFINITIONS[evt.agent_id].name}: {evt.reason}
                    </span>
                  )}

                  {evt.event_type === 'task.completed' && (
                    <span className="text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 inline" />
                      Completed successfully in {evt.duration_ms}ms
                    </span>
                  )}
                </div>

                {/* Task ID Link Tag */}
                <span className="text-[10px] text-gray-500 group-hover:text-amber-300 transition-colors font-mono shrink-0">
                  #{evt.task_id.substring(0, 6)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
