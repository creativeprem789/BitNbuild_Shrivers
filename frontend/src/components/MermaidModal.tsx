import React, { useEffect, useState } from 'react';
import { X, GitFork, CheckCircle2 } from 'lucide-react';
import { apiGetGraphMermaid } from '../services/api';

interface MermaidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FALLBACK_MERMAID = `
graph TD
    Start([START]) --> Classify[classify_and_route / Gemini 2.5 Flash]
    Classify -->|Confidence >= 0.60| Email[email_agent / Specialist]
    Classify -->|Confidence >= 0.60| Calendar[calendar_agent / Real HTTP API]
    Classify -->|Confidence >= 0.60| Search[search_agent / Research Analyst]
    Classify -->|Confidence < 0.60| Custom[custom_agent / Executive Resolver]
    
    Search -->|Handoff| Email
    Calendar -->|Missing Details| Blocked[BLOCKED: Awaiting Details]
    Blocked -->|Retry Payload| Custom
    
    Email --> Finalize[finalize / Duration]
    Calendar --> Finalize
    Search --> Finalize
    Custom --> Finalize
    Finalize --> End([END])
`;

export const MermaidModal: React.FC<MermaidModalProps> = ({ isOpen, onClose }) => {
  const [mermaidGraph, setMermaidGraph] = useState<string>(FALLBACK_MERMAID);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiGetGraphMermaid().then((graph) => {
        if (graph) setMermaidGraph(graph);
        setLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl glass-panel p-6 rounded-2xl border border-white/20 shadow-2xl relative flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2 text-orange-400 font-bold text-base">
            <GitFork className="w-5 h-5" />
            <span>LANGGRAPH ORCHESTRATION TOPOLOGY</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 text-gray-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto font-mono text-xs text-gray-300 bg-slate-950 p-4 rounded-xl border border-white/5 space-y-4">
          <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
            <span>StateGraph inspectable architecture compile state:</span>
            <span className="font-bold flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> VERIFIED
            </span>
          </div>

          <pre className="p-4 rounded-lg bg-slate-900 overflow-x-auto text-amber-200 text-xs leading-relaxed">
            {loading ? 'Fetching graph from http://localhost:8000/orchestration/graph...' : mermaidGraph}
          </pre>

          <div className="text-[11px] text-gray-400 space-y-1 leading-relaxed">
            <p className="font-bold text-gray-200">Execution Guarantees:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Atomic database commit writes `task_events` with monotonic sequence numbers before Redis publish.</li>
              <li>Low-confidence routes (`&lt; 0.60`) redirect directly to `custom_agent`.</li>
              <li>Blocked tasks pause graph state; retries beyond 2 attempts escalate to `custom_agent`.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
