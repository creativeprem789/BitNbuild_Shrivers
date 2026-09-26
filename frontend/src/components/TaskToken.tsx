import React from 'react';
import type { ActiveTask } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

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

  const shortId = task.id.substring(0, 6);

  const getBorderColor = () => {
    if (task.status === 'blocked') return '#ef4444';
    if (task.status === 'completed') return '#10b981';
    if (task.currentAgentId) return AGENT_DEFINITIONS[task.currentAgentId].color;
    return '#06b6d4'; // Inbox Cyan
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      style={{
        transform: `translate3d(${computedX}px, ${computedY}px, 0)`,
        borderColor: getBorderColor()
      }}
      className={`task-token-node absolute top-0 left-0 z-20 cursor-pointer p-2.5 rounded-xl glass-panel shadow-2xl transition-all duration-300 hover:scale-105 ${
        isSelected ? 'ring-2 ring-amber-400 scale-105' : ''
      } ${task.status === 'blocked' ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-center gap-2">
        {/* Token Icon & ID */}
        <div 
          className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shadow-inner"
          style={{ backgroundColor: `${getBorderColor()}30`, color: getBorderColor() }}
        >
          {task.status === 'completed' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : task.status === 'blocked' ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            `#${shortId}`
          )}
        </div>

        {/* Info Preview */}
        <div className="flex flex-col min-w-[120px] max-w-[180px]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-400 font-semibold">
              SEQ #{task.lastSequenceNo}
            </span>
            {task.confidence !== undefined && (
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                {Math.round(task.confidence * 100)}% conf
              </span>
            )}
          </div>
          
          <p className="text-xs font-medium text-gray-200 truncate leading-snug">
            {task.description}
          </p>
        </div>
      </div>

      {/* Blocked Action Row (Retry Button) */}
      {task.status === 'blocked' && (
        <div className="mt-2 pt-2 border-t border-red-500/30 flex items-center justify-between gap-2">
          <span className="text-[10px] text-red-300 font-mono truncate max-w-[120px]">
            {task.blockReason || 'Missing details'}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry(task.id, task.lastSequenceNo);
            }}
            className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold px-2.5 py-1 rounded-md transition-colors shadow-md active:scale-95"
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Completed Duration Footer */}
      {task.status === 'completed' && task.durationMs && (
        <div className="mt-1.5 pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-emerald-400 font-mono">
          <span>COMPLETED</span>
          <span>{task.durationMs}ms</span>
        </div>
      )}
    </div>
  );
};
