import React from 'react';
import { Bot, Wifi, WifiOff, Cpu, GitFork, Sparkles } from 'lucide-react';
import type { ConnectionState } from '../hooks/useTaskSocket';

interface HeaderProps {
  connectionStatus: ConnectionState;
  onOpenMermaidModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  onOpenMermaidModal
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'mock_mode':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            STANDALONE DEMO (MOCK)
          </span>
        );
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold">
            <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            LIVE BACKEND (WS:8000)
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold animate-pulse">
            <Cpu className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            CONNECTING...
          </span>
        );
      case 'disconnected':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-mono font-semibold">
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            OFFLINE
          </span>
        );
    }
  };

  return (
    <header className="w-full px-6 py-4 glass-panel border-b border-white/10 flex items-center justify-between mb-4">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-700 to-orange-700 flex items-center justify-center shadow-lg shadow-amber-700/30">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
            MULTI-AGENT TASK HARNESS
            <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 border border-amber-600/30">
              Bit N Build
            </span>
          </h1>
          <p className="text-xs text-gray-400">
            Virtual Office Visualization & Real-Time LangGraph DAG Stream
          </p>
        </div>
      </div>

      {/* Connection & Topology Control */}
      <div className="flex items-center gap-4">
        {getStatusBadge()}

        <button
          onClick={onOpenMermaidModal}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-mono font-semibold text-gray-200 transition-colors"
        >
          <GitFork className="w-4 h-4 text-orange-400" />
          <span>Topology Diagram</span>
        </button>
      </div>
    </header>
  );
};
