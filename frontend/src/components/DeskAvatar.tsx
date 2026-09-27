import React from 'react';
import type { AgentId, AgentState, ActiveTask } from '../types/task';
import { AGENT_DEFINITIONS } from '../types/task';
import { 
  Mail, 
  Calendar, 
  Search, 
  ShieldAlert, 
  Cpu, 
  AlertTriangle, 
  Activity,
  Zap,
  Sparkles
} from 'lucide-react';

interface DeskAvatarProps {
  agentId: AgentId;
  state: AgentState;
  activeTaskCount: number;
  currentTask?: ActiveTask;
}

export const DeskAvatar: React.FC<DeskAvatarProps> = ({ 
  agentId, 
  state, 
  activeTaskCount,
  currentTask 
}) => {
  const agent = AGENT_DEFINITIONS[agentId];

  const getAgentIcon = () => {
    switch (agentId) {
      case 'email_agent': return <Mail className="w-5 h-5 text-blue-400" />;
      case 'calendar_agent': return <Calendar className="w-5 h-5 text-orange-400" />;
      case 'search_agent': return <Search className="w-5 h-5 text-emerald-400" />;
      case 'custom_agent': return <ShieldAlert className="w-5 h-5 text-amber-400" />;
    }
  };

  // Generate dynamic, role-specific speech bubble content
  const getSpeechBubbleData = () => {
    const taskDesc = currentTask?.description ? `"${currentTask.description.slice(0, 50)}${currentTask.description.length > 50 ? '...' : ''}"` : '';

    if (state === 'blocked') {
      return {
        tag: '⚠️ Blocked - Awaiting Input',
        text: currentTask?.blockReason 
          ? `I am blocked! ${currentTask.blockReason}` 
          : 'I need missing parameters or authorization to proceed.',
        terminalText: currentTask?.blockReason || 'BLOCKED: Awaiting input'
      };
    }

    if (state === 'working') {
      switch (agentId) {
        case 'search_agent':
          return {
            tag: '🔍 Fetching Research Data',
            text: taskDesc 
              ? `I am investigating queries, analyzing benchmarks, and gathering data for ${taskDesc}` 
              : 'I am fetching external datasets and synthesizing analytical findings.',
            terminalText: 'RESEARCH: Fetching benchmarks & synthesizing report...'
          };
        case 'calendar_agent':
          return {
            tag: '📅 Querying Calendar API',
            text: taskDesc 
              ? `I am connecting to the external Calendar API to verify availability and book slot for ${taskDesc}` 
              : 'I am communicating with external Calendar HTTP service to reserve time.',
            terminalText: 'CALENDAR_API: POST /calendar/events [200 OK]'
          };
        case 'email_agent':
          return {
            tag: '✉️ Drafting Communications',
            text: taskDesc 
              ? `I am drafting the executive briefing and formatting email payload for ${taskDesc}` 
              : 'I am structuring communication templates and preparing delivery.',
            terminalText: 'SMTP_OUT: Formatting briefing payload...'
          };
        case 'custom_agent':
          return {
            tag: '⚡ Executive Resolution',
            text: taskDesc 
              ? `I am evaluating multi-domain policies and resolving edge cases for ${taskDesc}` 
              : 'I am resolving low-confidence tasks and coordinating recovery.',
            terminalText: 'RESOLVE: Executing adaptive multi-agent policy...'
          };
      }
    }

    // Idle State (shown on hover for rich information sharing)
    switch (agentId) {
      case 'search_agent':
        return {
          tag: '💡 Research Analyst Ready',
          text: 'Ready to investigate topics, benchmark competitors, gather facts, and synthesize analytical reports.',
          terminalText: 'Awaiting DAG task dispatch...'
        };
      case 'calendar_agent':
        return {
          tag: '📅 Calendar Manager Ready',
          text: 'Ready to check schedules, resolve conflicting slots, and book verified calendar events via external API.',
          terminalText: 'Awaiting DAG task dispatch...'
        };
      case 'email_agent':
        return {
          tag: '📬 Email Specialist Ready',
          text: 'Ready to triage incoming requests, draft stakeholder communications, and deliver briefing updates.',
          terminalText: 'Awaiting DAG task dispatch...'
        };
      case 'custom_agent':
        return {
          tag: '🛡️ Executive Resolver Ready',
          text: 'Standing by for complex escalations, multi-domain edge cases, and human-in-the-loop recovery.',
          terminalText: 'Awaiting DAG task dispatch...'
        };
    }
  };

  const bubbleData = getSpeechBubbleData();

  return (
    <div className={`group relative p-4 rounded-xl glass-panel agent-desk-panel transition-all duration-300 ${
      state === 'working' ? 'desk-working ring-1 ring-amber-400/40' : state === 'blocked' ? 'desk-blocked ring-1 ring-red-500/50' : 'hover:border-white/20'
    }`}>
      
      {/* 1. Dynamic Pop-up Speech Bubble at Head of Agent */}
      <div className={`absolute -top-24 sm:-top-28 left-1/2 -translate-x-1/2 w-64 sm:w-72 z-40 transition-all duration-300 pointer-events-none ${
        state !== 'idle' 
          ? 'opacity-100 scale-100 translate-y-0' 
          : 'opacity-0 scale-95 translate-y-2 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0'
      }`}>
        <div className={`relative p-3 rounded-xl text-left shadow-2xl backdrop-blur-xl border ${
          state === 'blocked'
            ? 'bg-red-950/95 border-red-500/60 shadow-red-500/20 text-red-100'
            : state === 'working'
            ? 'bg-slate-900/95 border-amber-400/60 shadow-amber-500/25 text-amber-100'
            : 'bg-slate-900/95 border-white/20 shadow-black/60 text-gray-200'
        }`}>
          {/* Bubble Header */}
          <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 truncate">
              {state === 'working' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />}
              {state === 'blocked' && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />}
              {state === 'idle' && <Sparkles className="w-3 h-3 text-cyan-400 inline-block" />}
              <span className="truncate">{bubbleData.tag}</span>
            </span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
              state === 'working' ? 'bg-amber-500/20 text-amber-300' :
              state === 'blocked' ? 'bg-red-500/20 text-red-300' : 'bg-slate-800 text-gray-400'
            }`}>
              {state.toUpperCase()}
            </span>
          </div>

          {/* Bubble Body with role action text */}
          <p className="text-xs font-sans leading-tight line-clamp-3 text-gray-200">
            {bubbleData.text}
          </p>

          {/* Pointer tail pointing down to avatar */}
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-6 border-x-transparent border-t-8 ${
            state === 'blocked'
              ? 'border-t-red-950'
              : 'border-t-slate-900'
          }`} />
        </div>
      </div>

      {/* Top Header Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ 
              backgroundColor: state === 'working' 
                ? '#eab308' 
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
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' 
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
              <Activity className="w-3 h-3 animate-spin text-amber-400" />
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
              state === 'working' ? 'scale-105 shadow-lg shadow-amber-500/20' : ''
            }`}
            style={{
              background: `radial-gradient(circle, ${agent.color}35 0%, rgba(15,23,42,0.9) 100%)`,
              border: `2px solid ${state === 'working' ? '#eab308' : state === 'blocked' ? '#ef4444' : 'rgba(255,255,255,0.12)'}`
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
            <div className="absolute -bottom-2 right-0 bg-amber-500 text-slate-950 font-mono text-xs font-bold px-2 py-0.5 rounded-full border-2 border-slate-900 shadow-lg">
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
          <p className="text-gray-500 italic flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-ping flex-shrink-0" />
            <span className="truncate">{bubbleData.terminalText}</span>
          </p>
        )}
        {state === 'working' && (
          <p className="text-amber-300 font-mono flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
            <span className="truncate">{bubbleData.terminalText}</span>
          </p>
        )}
        {state === 'blocked' && (
          <p className="text-red-400 font-mono flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping flex-shrink-0" />
            <span className="truncate">{bubbleData.terminalText}</span>
          </p>
        )}
      </div>
    </div>
  );
};
