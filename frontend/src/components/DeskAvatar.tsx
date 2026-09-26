import React from 'react';
import type { AgentId, AgentState } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { 
  Mail, 
  Calendar, 
  Search, 
  ShieldAlert, 
  Cpu, 
  AlertTriangle, 
  Activity,
  Zap
} from 'lucide-react';

interface DeskAvatarProps {
  agentId: AgentId;
  state: AgentState;
  activeTaskCount: number;
}

export const DeskAvatar: React.FC<DeskAvatarProps> = ({ agentId, state, activeTaskCount }) => {
  const agent = AGENT_DEFINITIONS[agentId];

  const getAgentIcon = () => {
    switch (agentId) {
      case 'email_agent': return <Mail className="w-5 h-5 text-blue-400" />;
      case 'calendar_agent': return <Calendar className="w-5 h-5 text-orange-400" />;
      case 'search_agent': return <Search className="w-5 h-5 text-emerald-400" />;
      case 'custom_agent': return <ShieldAlert className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className={`relative p-4 rounded-xl glass-panel agent-desk-panel transition-all duration-300 ${
      state === 'working' ? 'desk-working' : state === 'blocked' ? 'desk-blocked' : ''
    }`}>
      {/* Top Header Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ 
              backgroundColor: state === 'working' 
                ? '#3b82f6' 
                : state === 'blocked' 
                ? '#ef4444' 
                : '#6b7280' 
            }} 
          />
          <span className="text-xs font-mono font-semibold tracking-wider text-gray-300 uppercase">
            DESK_{agentId.split('_')[0].toUpperCase()}
          </span>
        </div>

        {/* State Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          state === 'working' 
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' 
            : state === 'blocked' 
            ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse' 
            : 'bg-gray-800/60 text-gray-400 border border-gray-700/50'
        }`}>
          {state === 'idle' && (
            <>
              <span className="text-[10px]">Zzz...</span>
              <span>Idle</span>
            </>
          )}
          {state === 'working' && (
            <>
              <Activity className="w-3 h-3 animate-spin text-blue-400" />
              <span>Working</span>
            </>
          )}
          {state === 'blocked' && (
            <>
              <AlertTriangle className="w-3 h-3 text-red-400 animate-bounce" />
              <span>Blocked</span>
            </>
          )}
        </div>
      </div>

      {/* Main Avatar Workstation Graphic */}
      <div className="flex flex-col items-center my-2">
        <div className="relative">
          {/* Avatar Base Icon Outer Ring */}
          <div 
            className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              state === 'working' ? 'scale-105' : ''
            }`}
            style={{
              background: `radial-gradient(circle, ${agent.color}25 0%, rgba(15,23,42,0.8) 100%)`,
              border: `2px solid ${state === 'working' ? agent.color : state === 'blocked' ? '#ef4444' : 'rgba(255,255,255,0.1)'}`
            }}
          >
            {/* Avatar Pose Illustration / Mascot */}
            <div className="relative flex items-center justify-center">
              <span className="text-3xl select-none">{agent.avatar}</span>
              
              {/* Overlay Pose FX */}
              {state === 'working' && (
                <Zap 
                  className="absolute -top-2 -right-2 w-5 h-5 text-amber-300 animate-bounce" 
                />
              )}
              {state === 'blocked' && (
                <div className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1 shadow-lg animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Sleeping Bubbles for Idle */}
            {state === 'idle' && (
              <div className="absolute -top-2 right-1 flex flex-col items-center pointer-events-none">
                <span className="text-[10px] font-mono text-amber-300 anim-zzz-1">z</span>
                <span className="text-xs font-mono text-amber-200 anim-zzz-2">Z</span>
              </div>
            )}
          </div>

          {/* Active Tasks Badge Offset */}
          {activeTaskCount > 0 && (
            <div className="absolute -bottom-2 right-0 bg-amber-600 text-white font-mono text-xs font-bold px-2 py-0.5 rounded-full border-2 border-slate-900 shadow-lg">
              {activeTaskCount} {activeTaskCount === 1 ? 'task' : 'tasks'}
            </div>
          )}
        </div>

        {/* Agent Metadata Title & Role */}
        <div className="text-center mt-3">
          <div className="flex items-center justify-center gap-1.5 font-semibold text-sm text-gray-100">
            {getAgentIcon()}
            <span>{agent.name}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{agent.role}</p>
        </div>
      </div>

      {/* Monitor Display Terminal Simulation */}
      <div className="mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-white/5 font-mono text-[11px] leading-tight text-gray-400">
        <div className="flex items-center justify-between text-[10px] text-gray-500 pb-1 border-b border-white/5 mb-1.5">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-amber-400" /> SYS.MONITOR
          </span>
          <span className="text-emerald-400 font-semibold">ONLINE</span>
        </div>
        
        {state === 'idle' && (
          <p className="text-gray-500 italic flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-ping" />
            Awaiting DAG task dispatch...
          </p>
        )}
        {state === 'working' && (
          <p className="text-blue-300 font-mono animate-pulse flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            Executing async node operation...
          </p>
        )}
        {state === 'blocked' && (
          <p className="text-red-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            BLOCKED: Awaiting scheduling input
          </p>
        )}
      </div>
    </div>
  );
};
