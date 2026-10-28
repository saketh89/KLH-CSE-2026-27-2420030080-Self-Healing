import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Cpu,
  DollarSign,
  Layers,
  Sparkles,
  RefreshCw,
  Terminal,
  Pause,
  Filter,
  Check,
  Flame,
  ShieldAlert,
  Server,
  Workflow,
} from 'lucide-react';
import { CircuitBreakerState } from '../types';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'ROUTING' | 'FAILURE' | 'SELF_HEAL' | 'RECOVERY' | 'HEALTH_PROBE';
  message: string;
  details?: string;
  latencyMs?: number;
  httpStatus?: number;
  badge: string;
}

export const RouteMasterWorkflow: React.FC = () => {
  const [circuitState, setCircuitState] = useState<CircuitBreakerState>('CLOSED');
  const [activeStep, setActiveStep] = useState<'IDLE' | 'PROMPT' | 'INTENT' | 'PRIMARY_ATTEMPT' | 'PRIMARY_FAIL' | 'HEAL_REROUTE' | 'SUCCESS'>('IDLE');
  const [isSimulatingHeal, setIsSimulatingHeal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logFilter, setLogFilter] = useState<'ALL' | 'ROUTING' | 'FAILURES' | 'HEALING'>('ALL');
  const [selectedNode, setSelectedNode] = useState<string | null>('intent-router');

  // Logs stream state
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-1',
      timestamp: '12:31:02',
      type: 'ROUTING',
      message: "Prompt complexity evaluated: 'High' (score: 88/100) -> Target: Primary (Gemini 3.7 / Claude 3.5 Sonnet)",
      details: 'Signals: [architecture, virtual-threads, circuit-breaker]',
      badge: '[Routing]',
    },
    {
      id: 'log-2',
      timestamp: '12:31:03',
      type: 'FAILURE',
      message: 'Primary Cluster returned 502 Bad Gateway (Simulated Rate Limit/Overload Spike)',
      details: 'HTTP 502 Gateway Error: Upstream cluster latency exceeded SLA threshold (420ms)',
      httpStatus: 502,
      latencyMs: 420,
      badge: '[Failure]',
    },
    {
      id: 'log-3',
      timestamp: '12:31:03',
      type: 'SELF_HEAL',
      message: 'Self-Healing Engine engaged: Resilience4j Circuit Breaker tripped. Recalculated dynamic Tool Graph route.',
      details: 'Fail-fast safeguard triggered. Redirecting payload to secondary high-concurrency model.',
      badge: '[Self-Heal]',
    },
    {
      id: 'log-4',
      timestamp: '12:31:04',
      type: 'RECOVERY',
      message: 'Re-routed request payload to Llama 3.3 70B / Fast-Model node. Resolved with Success (HTTP 200 OK).',
      details: 'Zero downtime guaranteed to client. Token stream completed in 118ms.',
      httpStatus: 200,
      latencyMs: 118,
      badge: '[Recovery]',
    },
  ]);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Format current time
  const getNowFormatted = () => {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  };

  // Add Log Entry helper
  const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: getNowFormatted(),
      ...entry,
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 40)]);
  };

  // Automated Self-Healing Simulation Step Machine
  const runSelfHealingDemo = async () => {
    if (isSimulatingHeal) return;
    setIsSimulatingHeal(true);

    // Step 1: Prompt Ingestion
    setActiveStep('PROMPT');
    addLog({
      type: 'ROUTING',
      message: "Incoming user request intercepted on VirtualThread[#loom-8492]: 'Architect resilient multi-model pipeline'",
      badge: '[Ingestion]',
      details: 'Payload size: 68 tokens • SLA constraint: < 800ms',
    });
    await new Promise((r) => setTimeout(r, 900));

    // Step 2: Intent Router
    setActiveStep('INTENT');
    addLog({
      type: 'ROUTING',
      message: "Intent & Complexity Router: Evaluated score 92/100 -> Route candidate: Primary (Claude 3.5 / Gemini 3.7)",
      badge: '[Intent-Router]',
      details: 'Guardrails & Evals: Passed (0 safety violations, latency SLA verified)',
    });
    await new Promise((r) => setTimeout(r, 900));

    // Step 3: Primary Attempt
    setActiveStep('PRIMARY_ATTEMPT');
    addLog({
      type: 'ROUTING',
      message: 'Dispatching non-blocking HTTP call to Primary cluster endpoint...',
      badge: '[Dispatch]',
      latencyMs: 150,
    });
    await new Promise((r) => setTimeout(r, 1100));

    // Step 4: Primary Failure 502 / 429
    setActiveStep('PRIMARY_FAIL');
    setCircuitState('OPEN');
    addLog({
      type: 'FAILURE',
      message: 'Primary Cluster returned 502 Bad Gateway (Upstream worker nodes overloaded)',
      httpStatus: 502,
      latencyMs: 380,
      badge: '[Failure]',
      details: 'Error intercepted before client boundary. Short-circuiting future calls.',
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Step 5: Self-Healing Triggered
    setActiveStep('HEAL_REROUTE');
    addLog({
      type: 'SELF_HEAL',
      message: '⚡ SELF-HEALING ACTIVATED: Recalculated routing DAG -> Auto-shifting load to Secondary (Llama 3.3 70B)',
      badge: '[Self-Heal]',
      details: 'Resilience4j Circuit state: OPEN • Failover latency: 12ms',
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Step 6: Recovery Success
    setActiveStep('SUCCESS');
    addLog({
      type: 'RECOVERY',
      message: 'Secondary Llama 3.3 70B cluster responded successfully (HTTP 200 OK). Request served seamlessly.',
      httpStatus: 200,
      latencyMs: 95,
      badge: '[Recovery]',
      details: 'Zero downtime SLA maintained: 100.0%. Total turnaround: 487ms.',
    });
    await new Promise((r) => setTimeout(r, 1400));

    setIsSimulatingHeal(false);
  };

  // Ambient background logs stream
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const types = ['HEALTH_PROBE', 'ROUTING'];
      const rand = Math.random();
      if (rand > 0.6) {
        addLog({
          type: 'HEALTH_PROBE',
          message: `Cluster Heartbeat Probe: Fast-Model v1 [HEALTHY: 42ms] • Llama 3.3 70B [STANDBY: Ready]`,
          badge: '[Health-Probe]',
        });
      }
    }, 9000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter === 'ALL') return true;
    if (logFilter === 'ROUTING') return l.type === 'ROUTING';
    if (logFilter === 'FAILURES') return l.type === 'FAILURE';
    if (logFilter === 'HEALING') return l.type === 'SELF_HEAL' || l.type === 'RECOVERY';
    return true;
  });

  return (
    <div className="w-full space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg font-mono">
            Ξ
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-white">
                AI RouteMaster Engine
              </h2>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                SYSTEM STATUS: HEALING ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Autonomous multi-model failover DAG with dynamic circuit healing & guardrails
            </p>
          </div>
        </div>

        {/* Right Header Status Widget */}
        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#1E1E20] pt-3 md:pt-0 md:pl-6">
          <div className="text-left md:text-right">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">
              System SLA Uptime
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400 tracking-tight">
              99.98% (Zero Downtime)
            </span>
          </div>

          <button
            onClick={runSelfHealingDemo}
            disabled={isSimulatingHeal}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSimulatingHeal ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating Failover...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Simulate 502 Self-Healing</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Metric Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Throughput */}
        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Throughput
            </span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              4.2k <span className="text-xs text-slate-400 font-sans font-normal">req/min</span>
            </span>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +14.2%
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-[#1E1E20] pt-2">
            <span>Peak: 6.8k/min</span>
            <span className="font-mono text-slate-400">Virtual Threads: 4,096</span>
          </div>
        </div>

        {/* Card 2: Avg Latency */}
        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Avg Latency
            </span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              182ms
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              (p95: 310ms)
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-[#1E1E20] pt-2">
            <span>Fast-Path: 88ms</span>
            <span className="font-mono text-emerald-400">SLA: &lt; 500ms</span>
          </div>
        </div>

        {/* Card 3: Cost Saved */}
        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Cost Saved
            </span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
              $4,210
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              this month
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-[#1E1E20] pt-2">
            <span>Smart Routing: 42%</span>
            <span className="font-mono text-slate-400">Avoided Outages: 18</span>
          </div>
        </div>
      </div>

      {/* 3. Visual Node Routing Workflow Layer */}
      <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E1E20] pb-4">
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Visual Node Routing Workflow Layer
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Ingress
            </span>
            <span className="flex items-center gap-1.5 ml-2">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Primary
            </span>
            <span className="flex items-center gap-1.5 ml-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Healed Re-route
            </span>
          </div>
        </div>

        {/* Interactive Visual Graph Canvas */}
        <div className="bg-[#0A0A0C] border border-[#1E1E20] rounded-xl p-6 relative overflow-hidden select-none">
          {/* Active Flow Indicator Banner */}
          {activeStep !== 'IDLE' && (
            <div className="mb-4 px-3 py-1.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-xs text-blue-300 font-mono flex items-center justify-between">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                Active Transaction: {activeStep}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                Simulating Self-Healing Execution DAG
              </span>
            </div>
          )}

          {/* Graphical Nodes Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* NODE 1: User Prompt */}
            <div
              onClick={() => setSelectedNode('prompt')}
              className={`col-span-1 md:col-span-3 p-4 rounded-xl transition-all cursor-pointer border ${
                activeStep === 'PROMPT'
                  ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                  : selectedNode === 'prompt'
                  ? 'bg-[#161618] border-blue-500/60'
                  : 'bg-[#121214] border-[#1E1E20] hover:border-[#2A2A2C]'
              } space-y-2 relative`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                  Step 01 • Ingress
                </span>
                <Cpu className="w-4 h-4 text-slate-400" />
              </div>
              <h4 className="font-bold text-white text-sm">[ User Prompt ]</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                Intercepts request on Loom Virtual Thread with SLA token budget.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                POST /api/v1/generate
              </div>
            </div>

            {/* CONNECTOR 1 */}
            <div className="hidden md:flex col-span-1 justify-center items-center">
              <ArrowRight className={`w-5 h-5 ${activeStep === 'PROMPT' || activeStep === 'INTENT' ? 'text-blue-400 animate-pulse' : 'text-[#2A2A2C]'}`} />
            </div>

            {/* NODE 2: Intent Router & Guardrails Stack */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-3">
              {/* Intent Router */}
              <div
                onClick={() => setSelectedNode('intent-router')}
                className={`p-4 rounded-xl transition-all cursor-pointer border ${
                  activeStep === 'INTENT'
                    ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                    : selectedNode === 'intent-router'
                    ? 'bg-[#161618] border-blue-500/60'
                    : 'bg-[#121214] border-[#1E1E20] hover:border-[#2A2A2C]'
                } space-y-1.5`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                    Step 02 • Core Dispatch
                  </span>
                  <Sparkles className="w-4 h-4 text-blue-400" />
                </div>
                <h4 className="font-bold text-white text-sm">( INTENT ROUTER )</h4>
                <p className="text-[11px] text-slate-400 font-mono">
                  Heuristic Complexity: 92/100 • Routing to Primary Node
                </p>
              </div>

              {/* Guardrails / Evals Sub-Node */}
              <div
                onClick={() => setSelectedNode('guardrails')}
                className={`p-3 rounded-lg transition-all cursor-pointer border ${
                  selectedNode === 'guardrails'
                    ? 'bg-[#161618] border-slate-500'
                    : 'bg-[#0E0E10] border-[#1E1E20] hover:border-[#2A2A2C]'
                } flex items-center justify-between text-xs`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 font-mono text-[11px]">[ Evals / Guardrails ]</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                  PASSED (0.01s)
                </span>
              </div>
            </div>

            {/* CONNECTOR 2 */}
            <div className="hidden md:flex col-span-1 justify-center items-center flex-col gap-6">
              <ArrowRight className={`w-5 h-5 ${activeStep === 'PRIMARY_ATTEMPT' ? 'text-green-400 animate-pulse' : 'text-[#2A2A2C]'}`} />
              <ArrowRight className={`w-5 h-5 ${activeStep === 'HEAL_REROUTE' || activeStep === 'SUCCESS' ? 'text-amber-400 animate-pulse' : 'text-[#2A2A2C]'}`} />
            </div>

            {/* NODE 3 & 4: Target Model Nodes (Primary & Fallback) */}
            <div className="col-span-1 md:col-span-3 flex flex-col gap-3">
              {/* PRIMARY NODE: Claude 3.5 Sonnet / Gemini 3.7 Flash */}
              <div
                onClick={() => setSelectedNode('primary')}
                className={`p-4 rounded-xl transition-all cursor-pointer border ${
                  activeStep === 'PRIMARY_FAIL'
                    ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
                    : activeStep === 'PRIMARY_ATTEMPT'
                    ? 'bg-green-950/30 border-green-500 ring-2 ring-green-500/30'
                    : selectedNode === 'primary'
                    ? 'bg-[#161618] border-green-500/60'
                    : 'bg-[#121214] border-[#1E1E20] hover:border-[#2A2A2C]'
                } space-y-2 relative overflow-hidden`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-green-400">
                    Primary Node
                  </span>
                  <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.2 rounded border border-green-500/20 font-mono">
                    Tier 1
                  </span>
                </div>
                <h4 className="font-bold text-white text-sm">[ Claude 3.5 Sonnet / Gemini ]</h4>
                <div className="text-[11px] font-mono text-slate-400">
                  {activeStep === 'PRIMARY_FAIL' ? (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> 502 Bad Gateway (Overload)
                    </span>
                  ) : (
                    <span>Status: Available • Latency: 420ms</span>
                  )}
                </div>
                {activeStep === 'PRIMARY_FAIL' && (
                  <div className="text-[10px] text-rose-300 bg-rose-950/60 border border-rose-800 p-1.5 rounded font-mono">
                    ⚡ Circuit Tripped → Fail-Fast
                  </div>
                )}
              </div>

              {/* SECONDARY NODE: Llama 3.3 70B / Fast-Model */}
              <div
                onClick={() => setSelectedNode('secondary')}
                className={`p-4 rounded-xl transition-all cursor-pointer border ${
                  activeStep === 'HEAL_REROUTE' || activeStep === 'SUCCESS'
                    ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-900/20'
                    : selectedNode === 'secondary'
                    ? 'bg-[#161618] border-amber-500/60'
                    : 'bg-[#121214] border-[#1E1E20] hover:border-[#2A2A2C]'
                } space-y-2 relative overflow-hidden`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    ⚡ HEALED RE-ROUTE
                  </span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/20 font-mono">
                    Tier 2 Fallback
                  </span>
                </div>
                <h4 className="font-bold text-white text-sm">[ Llama 3.3 70B / Fast-Model ]</h4>
                <div className="text-[11px] font-mono text-slate-400">
                  {activeStep === 'SUCCESS' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Success (HTTP 200 OK • 118ms)
                    </span>
                  ) : (
                    <span>Latency: 118ms • Zero-Downtime Standby</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Routing Logs & Incident Timeline */}
      <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E1E20] pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              Live Routing Logs & Incident Timeline
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              High-frequency telemetry recording prompt classification, 502/429 circuit trips, and healed failover events
            </p>
          </div>

          {/* Log Controls & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#161618] p-1 rounded-lg border border-[#2A2A2C] text-xs">
              <button
                onClick={() => setLogFilter('ALL')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer font-mono ${
                  logFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setLogFilter('ROUTING')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer font-mono ${
                  logFilter === 'ROUTING' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Routing
              </button>
              <button
                onClick={() => setLogFilter('FAILURES')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer font-mono ${
                  logFilter === 'FAILURES' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Failures (502s)
              </button>
              <button
                onClick={() => setLogFilter('HEALING')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer font-mono ${
                  logFilter === 'HEALING' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Self-Healing
              </button>
            </div>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-2.5 py-1.5 bg-[#161618] hover:bg-[#1A1A1D] text-slate-300 rounded-lg border border-[#2A2A2C] text-xs font-mono transition-all flex items-center gap-1 cursor-pointer"
            >
              {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              onClick={() => setLogs([])}
              className="p-1.5 bg-[#161618] hover:bg-[#1A1A1D] text-slate-400 hover:text-slate-200 rounded-lg border border-[#2A2A2C] transition-all cursor-pointer"
              title="Clear log timeline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Log Entries Timeline Terminal Box */}
        <div
          ref={logContainerRef}
          className="bg-[#0A0A0C] border border-[#1E1E20] rounded-xl p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-2.5 divide-y divide-[#1E1E20]/50"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-mono text-xs">
              No logs in this category. Click 'Simulate 502 Self-Healing' above to generate real-time events.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isRouting = log.type === 'ROUTING';
              const isFailure = log.type === 'FAILURE';
              const isSelfHeal = log.type === 'SELF_HEAL';
              const isRecovery = log.type === 'RECOVERY';

              return (
                <div key={log.id} className="pt-2.5 first:pt-0 flex items-start gap-3 group">
                  {/* Timestamp & Bullet */}
                  <div className="flex items-center gap-2 shrink-0 text-slate-500">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isFailure
                          ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                          : isSelfHeal
                          ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
                          : isRecovery
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                          : 'bg-blue-400'
                      }`}
                    />
                    <span className="text-[11px] text-slate-500">{log.timestamp}</span>
                  </div>

                  {/* Badge */}
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] shrink-0 font-bold ${
                      isFailure
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : isSelfHeal
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : isRecovery
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {log.badge}
                  </span>

                  {/* Message & Details */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p
                      className={`leading-relaxed text-[11.5px] ${
                        isFailure
                          ? 'text-rose-300 font-medium'
                          : isSelfHeal
                          ? 'text-amber-300 font-semibold'
                          : isRecovery
                          ? 'text-emerald-300 font-semibold'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.message}
                    </p>
                    {log.details && (
                      <p className="text-[10.5px] text-slate-500 leading-relaxed truncate group-hover:whitespace-normal">
                        └─ {log.details}
                      </p>
                    )}
                  </div>

                  {/* Latency & Status Pill */}
                  {log.latencyMs !== undefined && (
                    <span className="shrink-0 text-[10px] text-slate-500 font-mono">
                      {log.latencyMs}ms
                    </span>
                  )}
                  {log.httpStatus && (
                    <span
                      className={`shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${
                        log.httpStatus >= 400
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-800'
                          : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      HTTP {log.httpStatus}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
