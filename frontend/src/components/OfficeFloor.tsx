import React, { useRef } from 'react';
import type { AgentId, AgentState, ActiveTask, TaskLocation } from '../types/task';
import { DeskAvatar } from './DeskAvatar';
import { TaskToken } from './TaskToken';
import { Inbox, CheckCircle2, Workflow, Radio } from 'lucide-react';

interface OfficeFloorProps {
  agentStates: Record<AgentId, AgentState>;
  tasks: ActiveTask[];
  onRetryTask: (taskId: string, lastSeq: number) => void;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export const OfficeFloor: React.FC<OfficeFloorProps> = ({
  agentStates,
  tasks,
  onRetryTask,
  selectedTaskId,
  onSelectTask
}) => {
  const floorRef = useRef<HTMLDivElement>(null);

  // Position anchors for each zone relative to container size (px)
  const LOCATIONS: Record<TaskLocation, { x: number; y: number }> = {
    inbox: { x: 40, y: 160 },
    email_agent: { x: 260, y: 50 },
    calendar_agent: { x: 580, y: 50 },
    search_agent: { x: 260, y: 350 },
    custom_agent: { x: 580, y: 350 },
    done: { x: 900, y: 200 }
  };

  // Compute active task counts per desk/zone
  const taskCounts: Record<TaskLocation, number> = {
    inbox: 0,
    email_agent: 0,
    calendar_agent: 0,
    search_agent: 0,
    custom_agent: 0,
    done: 0
  };

  tasks.forEach((t) => {
    if (taskCounts[t.currentLocation] !== undefined) {
      taskCounts[t.currentLocation] += 1;
    }
  });

  return (
    <div className="relative w-full overflow-x-auto p-4">
      <div 
        ref={floorRef}
        className="relative min-w-[1150px] h-[640px] rounded-2xl border border-white/10 glass-panel office-grid-bg shadow-2xl p-6 overflow-hidden"
      >
        {/* Header Ribbon on Floor */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <span>VIRTUAL OFFICE FLOOR PLAN</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  4 WORKSTATIONS
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Real-time LangGraph multi-agent execution canvas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              TOPOLOGY: DIRECTED DAG
            </span>
          </div>
        </div>

        {/* SVG Pipeline Data Wires (DAG Connection Paths) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="handoffGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Inbox -> Desk Connections */}
          <path d="M 190 220 Q 220 120 260 120" stroke="url(#pathGradient)" strokeWidth={agentStates.email_agent !== 'idle' ? "3" : "2"} fill="none" className="dag-path-active" />
          <path d="M 190 220 Q 220 420 260 420" stroke="url(#pathGradient)" strokeWidth={agentStates.search_agent !== 'idle' ? "3" : "2"} fill="none" className="dag-path-active" />

          {/* Handoff Wires Between Desks */}
          {/* Top Row: Email <-> Calendar */}
          <path 
            d="M 500 120 L 580 120" 
            stroke={agentStates.email_agent !== 'idle' && agentStates.calendar_agent !== 'idle' ? "url(#handoffGradient)" : "rgba(255,255,255,0.2)"} 
            strokeWidth={agentStates.email_agent !== 'idle' && agentStates.calendar_agent !== 'idle' ? "3.5" : "2"} 
            strokeDasharray="6 6" 
            filter={agentStates.email_agent !== 'idle' && agentStates.calendar_agent !== 'idle' ? "url(#glow)" : undefined}
            fill="none" 
            className="dag-path-active"
          />

          {/* Bottom Row: Search <-> Custom */}
          <path 
            d="M 500 420 L 580 420" 
            stroke={agentStates.search_agent !== 'idle' && agentStates.custom_agent !== 'idle' ? "url(#handoffGradient)" : "rgba(255,255,255,0.2)"} 
            strokeWidth="2" 
            strokeDasharray="6 6" 
            fill="none" 
            className="dag-path-active"
          />

          {/* Vertical Cross-Desk: Search (Bottom Left) <-> Email (Top Left) */}
          <path 
            d="M 380 230 L 380 350" 
            stroke={(agentStates.search_agent !== 'idle' || agentStates.email_agent !== 'idle') ? "url(#handoffGradient)" : "rgba(255,255,255,0.2)"} 
            strokeWidth={(agentStates.search_agent !== 'idle' || agentStates.email_agent !== 'idle') ? "3.5" : "2"} 
            strokeDasharray="6 6" 
            filter={(agentStates.search_agent !== 'idle' || agentStates.email_agent !== 'idle') ? "url(#glow)" : undefined}
            fill="none" 
            className="dag-path-active"
          />

          {/* Vertical Cross-Desk: Calendar (Top Right) <-> Custom (Bottom Right) */}
          <path 
            d="M 700 230 L 700 350" 
            stroke="rgba(255,255,255,0.2)" 
            strokeWidth="2" 
            strokeDasharray="6 6" 
            fill="none" 
          />

          {/* Desks -> Done Vault Connections */}
          <path 
            d="M 820 120 Q 860 120 900 240" 
            stroke={taskCounts.done > 0 ? "#10b981" : "url(#pathGradient)"} 
            strokeWidth={taskCounts.done > 0 ? "3" : "2"} 
            filter={taskCounts.done > 0 ? "url(#glow)" : undefined}
            fill="none" 
            className="dag-path-active" 
          />
          <path 
            d="M 820 420 Q 860 420 900 240" 
            stroke={taskCounts.done > 0 ? "#10b981" : "url(#pathGradient)"} 
            strokeWidth={taskCounts.done > 0 ? "3" : "2"} 
            filter={taskCounts.done > 0 ? "url(#glow)" : undefined}
            fill="none" 
            className="dag-path-active" 
          />
        </svg>

        {/* 1. INBOX / RECEPTION ZONE */}
        <div 
          style={{ left: `${LOCATIONS.inbox.x}px`, top: `${LOCATIONS.inbox.y}px` }}
          className="absolute w-[160px] p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-md z-10"
        >
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm mb-1">
            <Inbox className="w-4 h-4" />
            <span>RECEPTION</span>
          </div>
          <p className="text-[11px] text-cyan-200/70 mb-2">Ingress task queue</p>
          <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 p-1.5 rounded text-center border border-cyan-500/20">
            {taskCounts.inbox} IN QUEUE
          </div>
        </div>

        {/* 2. FOUR WORKSTATIONS (DESKS) */}
        {/* Email Agent Desk */}
        <div 
          style={{ left: `${LOCATIONS.email_agent.x}px`, top: `${LOCATIONS.email_agent.y}px` }}
          className="absolute w-[240px] z-10"
        >
          <DeskAvatar 
            agentId="email_agent" 
            state={agentStates.email_agent} 
            activeTaskCount={taskCounts.email_agent}
            currentTask={tasks.find(t => t.currentLocation === 'email_agent' && t.status !== 'completed')}
          />
        </div>

        {/* Calendar Agent Desk */}
        <div 
          style={{ left: `${LOCATIONS.calendar_agent.x}px`, top: `${LOCATIONS.calendar_agent.y}px` }}
          className="absolute w-[240px] z-10"
        >
          <DeskAvatar 
            agentId="calendar_agent" 
            state={agentStates.calendar_agent} 
            activeTaskCount={taskCounts.calendar_agent}
            currentTask={tasks.find(t => t.currentLocation === 'calendar_agent' && t.status !== 'completed')}
          />
        </div>

        {/* Search Agent Desk */}
        <div 
          style={{ left: `${LOCATIONS.search_agent.x}px`, top: `${LOCATIONS.search_agent.y}px` }}
          className="absolute w-[240px] z-10"
        >
          <DeskAvatar 
            agentId="search_agent" 
            state={agentStates.search_agent} 
            activeTaskCount={taskCounts.search_agent}
            currentTask={tasks.find(t => t.currentLocation === 'search_agent' && t.status !== 'completed')}
          />
        </div>

        {/* Custom Agent Desk */}
        <div 
          style={{ left: `${LOCATIONS.custom_agent.x}px`, top: `${LOCATIONS.custom_agent.y}px` }}
          className="absolute w-[240px] z-10"
        >
          <DeskAvatar 
            agentId="custom_agent" 
            state={agentStates.custom_agent} 
            activeTaskCount={taskCounts.custom_agent}
            currentTask={tasks.find(t => t.currentLocation === 'custom_agent' && t.status !== 'completed')}
          />
        </div>

        {/* 3. DONE / EXECUTION VAULT ZONE */}
        <div 
          style={{ left: `${LOCATIONS.done.x}px`, top: `${LOCATIONS.done.y}px` }}
          className="absolute w-[180px] p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md z-10"
        >
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>DONE VAULT</span>
          </div>
          <p className="text-[11px] text-emerald-200/70 mb-2">Finalized DAG outputs</p>
          <div className="text-xs font-mono text-emerald-400 bg-emerald-950/60 p-1.5 rounded text-center border border-emerald-500/20">
            {taskCounts.done} COMPLETED
          </div>
        </div>

        {/* 4. MOVING TASK TOKENS */}
        {(() => {
          const stackCounters: Record<TaskLocation, number> = {
            inbox: 0,
            email_agent: 0,
            calendar_agent: 0,
            search_agent: 0,
            custom_agent: 0,
            done: 0
          };

          return tasks.map((task) => {
            const loc = task.currentLocation;
            const targetPos = LOCATIONS[loc] || LOCATIONS.inbox;
            const stackIdx = stackCounters[loc] || 0;
            stackCounters[loc] = stackIdx + 1;

            return (
              <TaskToken
                key={task.id}
                task={task}
                targetCoords={targetPos}
                stackIndex={stackIdx}
                onRetry={onRetryTask}
                isSelected={selectedTaskId === task.id}
                onSelect={onSelectTask}
              />
            );
          });
        })()}
      </div>
    </div>
  );
};
