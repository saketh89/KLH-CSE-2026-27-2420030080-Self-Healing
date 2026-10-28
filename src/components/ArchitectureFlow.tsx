import React from 'react';
import {
  Cpu,
  Zap,
  ShieldCheck,
  Activity,
  Layers,
  ArrowRight,
  GitBranch,
  Repeat,
  AlertTriangle,
  CheckCircle2,
  Server,
  Sparkles,
} from 'lucide-react';

export const ArchitectureFlow: React.FC = () => {
  return (
    <div className="w-full bg-[#121214] border border-[#1E1E20] rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E1E20] pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-400" />
            Adaptive AI Fallback Engine Architecture
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            End-to-end prompt interception, Java 21 Virtual Threading, and Resilience4j circuit state machine
          </p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Java 21 + Spring Boot 3.3 + Resilience4j
        </span>
      </div>

      {/* Interactive Architectural Pipeline Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {/* Step 1: Ingestion & Virtual Thread Dispatch */}
        <div className="p-4 rounded-lg bg-[#161618] border border-[#2A2A2C] space-y-2 relative">
          <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs font-mono">
            01
          </div>
          <h4 className="font-semibold text-white text-sm">Prompt Ingestion</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            REST Controller intercepts <code className="text-blue-400 font-mono">/api/v1/generate</code> on lightweight Java 21 Virtual Threads.
          </p>
          <div className="pt-2 text-[10px] font-mono text-blue-400 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> VirtualThread[#loom]
          </div>
        </div>

        {/* Step 2: Heuristic Analysis */}
        <div className="p-4 rounded-lg bg-[#161618] border border-[#2A2A2C] space-y-2 relative">
          <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs font-mono">
            02
          </div>
          <h4 className="font-semibold text-white text-sm">Heuristic Routing</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Evaluates query complexity signals (code, math, architecture, length) to route to Gemini 3.7 Flash or Fast-Model v1.
          </p>
          <div className="pt-2 text-[10px] font-mono text-blue-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> @AiRoutingService
          </div>
        </div>

        {/* Step 3: Circuit Breaker & Primary Model */}
        <div className="p-4 rounded-lg bg-[#161618] border border-[#2A2A2C] space-y-2 relative">
          <div className="w-7 h-7 rounded bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 font-bold text-xs font-mono">
            03
          </div>
          <h4 className="font-semibold text-white text-sm">Resilience4j Circuit</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Monitors sliding window failure rates. If 429 Rate Limit or 503 Overload occurs, trips circuit and invokes fallback chain.
          </p>
          <div className="pt-2 text-[10px] font-mono text-green-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> @CircuitBreaker
          </div>
        </div>

        {/* Step 4: Multi-Tier Fallback Chain */}
        <div className="p-4 rounded-lg bg-[#161618] border border-[#2A2A2C] space-y-2 relative">
          <div className="w-7 h-7 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-xs font-mono">
            04
          </div>
          <h4 className="font-semibold text-white text-sm">Zero-Downtime Fallback</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Level 1: Fast-Model v1 → Level 2: Emergency Resilient Engine. Health Registry logs status in real-time.
          </p>
          <div className="pt-2 text-[10px] font-mono text-orange-400 flex items-center gap-1">
            <Repeat className="w-3 h-3" /> Multi-Tier Fallback
          </div>
        </div>
      </div>

      {/* Resilience Flow Table */}
      <div className="p-4 bg-[#0E0E10] rounded-xl border border-[#1E1E20] text-xs space-y-3">
        <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
          Self-Healing Recovery State Machine
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-lg bg-[#161618] border border-[#2A2A2C]">
            <span className="font-semibold text-green-400 font-mono text-xs">1. CLOSED (Normal Operation)</span>
            <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
              Requests flow directly to primary Gemini 3.7 Flash. 100% SLA with latency logging in Health Registry.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#161618] border border-[#2A2A2C]">
            <span className="font-semibold text-rose-400 font-mono text-xs">2. OPEN (Circuit Tripped)</span>
            <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
              Triggered after ≥50% failure rate (429/503). Calls fail-fast and immediately route to Fast-Model v1 without latency.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#161618] border border-[#2A2A2C]">
            <span className="font-semibold text-amber-400 font-mono text-xs">3. HALF_OPEN (Probing)</span>
            <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
              After wait duration (10s), 3 trial calls test primary recovery. Successful trials reset circuit to CLOSED.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
