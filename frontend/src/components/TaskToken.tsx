import React from 'react';
import type { ActiveTask } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface TaskTokenProps {
  task: ActiveTask;
  targetCoords: { x: number; y: number };
  stackIndex: number;
  onRetry: (taskId: string, lastSeq: number) => void;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
}

export const TaskToken: React.FC<TaskTokenProps> = ({
  task,
  targetCoords,
  stackIndex,
  onRetry,
  isSelected,
  onSelect
}) => {
  // Apply stacking offset
  const computedX = targetCoords.x + stackIndex * 18;
  const computedY = targetCoords.y + stackIndex * 22;

  const getBorderColor = () => {
    if (task.status === 'blocked') return '#ef4444';
    if (task.status === 'completed') return '#10b981';
    if (task.currentAgentId) return AGENT_DEFINITIONS[task.currentAgentId].color;
    return '#06b6d4'; // Inbox Cyan
  };

  const hasHandoff = task.events.some(e => e.event_type === 'task.handoff');

  const getStageName = () => {
    if (task.status === 'completed') return 'DONE VAULT';
    if (task.status === 'blocked') return 'PAUSED / BLOCKED';
    if (task.currentAgentId === 'search_agent') return 'RESEARCH ANALYST';
    if (task.currentAgentId === 'email_agent') return 'EMAIL SPECIALIST';
    if (task.currentAgentId === 'calendar_agent') return 'CALENDAR MANAGER';
    if (task.currentAgentId === 'custom_agent') return 'EXECUTIVE RESOLVER';
    return 'INGRESS QUEUE';
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      style={{
        transform: `translate3d(${computedX}px, ${computedY}px, 0)`,
        borderColor: getBorderColor(),
        boxShadow: `0 8px 30px -4px ${getBorderColor()}35`
      }}
      className={`task-token-node absolute top-0 left-0 z-30 cursor-pointer p-3 rounded-xl glass-panel backdrop-blur-xl transition-all duration-500 hover:scale-105 ${
        isSelected ? 'ring-2 ring-amber-400 scale-105' : ''
      } ${task.status === 'blocked' ? 'animate-pulse' : ''}`}
    >
      {/* Stage Badge on Token */}
      <div className="flex items-center justify-between gap-1 mb-1.5 pb-1 border-b border-white/10 text-[9px] font-mono font-bold">
        <span 
          className="px-1.5 py-0.5 rounded flex items-center gap-1"
          style={{ backgroundColor: `${getBorderColor()}25`, color: getBorderColor() }}
        >
          {task.status !== 'completed' && task.status !== 'blocked' && (
            <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: getBorderColor() }} />
          )}
          {getStageName()}
        </span>

        {hasHandoff && (
          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-0.5 animate-pulse">
            <ArrowRight className="w-2.5 h-2.5" /> HANDOFF
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Token Icon & ID */}
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shadow-inner flex-shrink-0"
          style={{ backgroundColor: `${getBorderColor()}30`, color: getBorderColor(), border: `1px solid ${getBorderColor()}50` }}
        >
          {task.status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : task.status === 'blocked' ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : task.currentAgentId ? (
            <span className="text-base">{AGENT_DEFINITIONS[task.currentAgentId].avatar}</span>
          ) : (
            <Sparkles className="w-4 h-4 text-cyan-400" />
          )}
        </div>

        {/* Info Preview */}
        <div className="flex flex-col min-w-[130px] max-w-[190px]">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-gray-400 font-semibold">
              SEQ #{task.lastSequenceNo}
            </span>
            {task.confidence !== undefined && (
              <span className="text-emerald-400 font-semibold">
                {Math.round(task.confidence * 100)}% conf
              </span>
            )}
          </div>
          
          <p className="text-xs font-medium text-gray-200 truncate leading-snug mt-0.5">
            {task.description}
          </p>
        </div>
      </div>

      {/* Blocked Action Row (Retry Button) */}
      {task.status === 'blocked' && (
        <div className="mt-2.5 pt-2 border-t border-red-500/30 flex items-center justify-between gap-2">
          <span className="text-[10px] text-red-300 font-mono truncate max-w-[120px]">
            {task.blockReason || 'Missing details'}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry(task.id, task.lastSequenceNo);
            }}
            className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold px-2.5 py-1 rounded-md transition-colors shadow-md active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Resume</span>
          </button>
        </div>
      )}

      {/* Completed Duration Footer */}
      {task.status === 'completed' && task.durationMs && (
        <div className="mt-1.5 pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-emerald-400 font-mono">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> VERIFIED
          </span>
          <span>{task.durationMs}ms</span>
        </div>
      )}
    </div>
  );
};
