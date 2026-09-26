import React from 'react';
import type { ActiveTask } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  ArrowRight,
  SlidersHorizontal
} from 'lucide-react';

interface StatusPanelProps {
  tasks: ActiveTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask
}) => {
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null;

  const totalCount = tasks.length;
  const activeCount = tasks.filter((t) => t.status === 'created' || t.status === 'routed' || t.status === 'working').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  const avgDuration = Math.round(
    tasks
      .filter((t) => t.durationMs)
      .reduce((acc, curr) => acc + (curr.durationMs || 0), 0) / (completedCount || 1)
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl glass-panel bg-blue-950/20 border-blue-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-gray-400">TOTAL TASKS</span>
          <span className="text-xl font-bold font-mono text-blue-300 mt-1">{totalCount}</span>
        </div>
        
        <div className="p-3 rounded-xl glass-panel bg-amber-950/20 border-amber-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-gray-400">EXECUTING</span>
          <span className="text-xl font-bold font-mono text-amber-300 mt-1 flex items-center gap-1.5">
            {activeCount}
            {activeCount > 0 && <Activity className="w-4 h-4 animate-spin text-amber-400" />}
          </span>
        </div>

        <div className="p-3 rounded-xl glass-panel bg-red-950/20 border-red-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-gray-400">BLOCKED</span>
          <span className="text-xl font-bold font-mono text-red-400 mt-1 flex items-center gap-1.5">
            {blockedCount}
            {blockedCount > 0 && <AlertTriangle className="w-4 h-4 animate-bounce text-red-400" />}
          </span>
        </div>

        <div className="p-3 rounded-xl glass-panel bg-emerald-950/20 border-emerald-500/20 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-gray-400">DONE (AVG TIME)</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {completedCount > 0 ? `${avgDuration}ms` : '0ms'}
          </span>
        </div>
      </div>

      {/* Selected Task Inspector Panel */}
      <div className="flex-1 p-4 rounded-xl glass-panel flex flex-col overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-gray-200">STAGE TIMELINE INSPECTOR</h3>
          </div>
          
          {/* Task Picker Dropdown / Selector Pill */}
          {tasks.length > 0 && (
            <select
              value={selectedTask?.id || ''}
              onChange={(e) => onSelectTask(e.target.value)}
              className="bg-slate-900 text-xs font-mono text-amber-300 border border-amber-500/30 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id.substring(0, 8)} - {t.description.substring(0, 22)}...
                </option>
              ))}
            </select>
          )}
        </div>

        {!selectedTask ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 p-6">
            <BarChart3 className="w-10 h-10 mb-2 stroke-1 text-gray-600" />
            <p className="text-xs">No active tasks dispatched yet.</p>
            <p className="text-[11px] text-gray-600">Submit a prompt to view the stage execution DAG timeline.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1">
            {/* Task Card Summary */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-mono text-amber-300 font-bold">TASK #{selectedTask.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                  selectedTask.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : selectedTask.status === 'blocked'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {selectedTask.status}
                </span>
              </div>
              <p className="text-xs text-gray-200 font-medium">{selectedTask.description}</p>
            </div>

            {/* Stage History Sequential Timeline */}
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-amber-500/30">
              {selectedTask.events.map((evt, idx) => {
                return (
                  <div key={idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-slate-900 border-2 border-amber-400 flex items-center justify-center text-[9px] font-mono text-amber-300">
                      {evt.sequence_no}
                    </div>

                    {/* Timeline Card */}
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-white/5 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mb-1">
                        <span className="text-amber-300 font-semibold uppercase">
                          {evt.event_type.replace('task.', '')}
                        </span>
                        <span>{evt.timestamp || new Date().toLocaleTimeString()}</span>
                      </div>

                      {/* Event Specific Content */}
                      {evt.event_type === 'task.created' && (
                        <p className="text-gray-300 text-[11px]">Task received at Reception Desk.</p>
                      )}

                      {evt.event_type === 'task.routed' && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-gray-200 font-medium">
                            <span>Routed to</span>
                            <span 
                              className="font-bold font-mono px-1.5 py-0.5 rounded text-[10px]"
                              style={{ 
                                backgroundColor: `${AGENT_DEFINITIONS[evt.agent_id].color}25`,
                                color: AGENT_DEFINITIONS[evt.agent_id].color 
                              }}
                            >
                              {AGENT_DEFINITIONS[evt.agent_id].name}
                            </span>
                            <span className="text-emerald-400 font-mono text-[10px]">
                              ({Math.round(evt.confidence * 100)}% confidence)
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 italic">"{evt.reason}"</p>
                        </div>
                      )}

                      {evt.event_type === 'task.handoff' && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-gray-200 font-medium text-[11px]">
                            <span className="font-mono text-blue-400">{AGENT_DEFINITIONS[evt.from_agent].name}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="font-mono text-orange-400">{AGENT_DEFINITIONS[evt.to_agent].name}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 italic">"{evt.reason}"</p>
                        </div>
                      )}

                      {evt.event_type === 'task.blocked' && (
                        <div className="space-y-1">
                          <p className="text-red-400 font-semibold flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            Execution Paused at {AGENT_DEFINITIONS[evt.agent_id].name}
                          </p>
                          <p className="text-[11px] text-red-300/90 italic bg-red-950/40 p-1.5 rounded border border-red-500/20">
                            "{evt.reason}"
                          </p>
                        </div>
                      )}

                      {evt.event_type === 'task.completed' && (
                        <div className="flex items-center justify-between text-emerald-400 font-mono text-[11px]">
                          <span className="flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> TASK COMPLETED
                          </span>
                          <span>Execution: {evt.duration_ms}ms</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
