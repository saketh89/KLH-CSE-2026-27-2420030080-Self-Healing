import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  Activity,
  Workflow,
  Compass,
} from 'lucide-react';
import { PromptInterface } from './components/PromptInterface';
import { HealthRegistryDashboard } from './components/HealthRegistryDashboard';
import { RouteMasterWorkflow } from './components/RouteMasterWorkflow';
import { ResearchSolverDashboard } from './components/ResearchSolverDashboard';
import { CircuitBreakerState, GenerationResponse } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'prompt' | 'workflow' | 'health' | 'research'>('workflow');
  const [activeFault, setActiveFault] = useState<
    'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504'
  >('NONE');
  const [circuitState, setCircuitState] = useState<CircuitBreakerState>('CLOSED');
  const [lastResponse, setLastResponse] = useState<GenerationResponse | null>(null);

  // Poll health and circuit state
  const refreshState = async () => {
    try {
      const res = await fetch('/api/v1/models/health');
      if (res.ok) {
        const data = await res.json();
        if (data.circuitBreakerMetrics) {
          setCircuitState(data.circuitBreakerMetrics.state);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleFaultChange = async (
    fault: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504'
  ) => {
    setActiveFault(fault);
    try {
      await fetch('/api/v1/circuit-breaker/fault-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiFault: fault }),
      });
    } catch (e) {
      console.error('Failed to sync fault config', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-300 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-[#1E1E20] bg-[#0A0A0B]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#161618] border border-[#2A2A2C] flex items-center justify-center text-blue-400 shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  NexusAI <span className="text-blue-500 font-mono text-xs font-semibold ml-1 px-1.5 py-0.5 bg-blue-500/10 rounded border border-blue-500/20">v2.4.0-STABLE</span>
                </h1>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                Multi-Model Adaptive Fallback Routing Engine
              </p>
            </div>
          </div>

          {/* Right Status & Circuit Widget */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161618] border border-[#2A2A2C] rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${
                  circuitState === 'CLOSED'
                    ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                    : circuitState === 'OPEN'
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)] animate-pulse'
                    : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                }`}
              />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Circuit: {circuitState}
              </span>
            </div>

            <div className="text-right border-l border-[#1E1E20] pl-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">System Uptime</p>
              <p className="text-xs font-mono text-slate-300 font-medium">142:12:04:88</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-[#121214] p-1 rounded-xl border border-[#1E1E20]">
            <button
              id="tab-workflow-btn"
              onClick={() => setActiveTab('workflow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'workflow'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161618]'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI RouteMaster</span>
            </button>

            <button
              id="tab-prompt-btn"
              onClick={() => setActiveTab('prompt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'prompt'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161618]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prompt Router</span>
            </button>

            <button
              id="tab-health-btn"
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'health'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161618]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Health Registry</span>
              {circuitState === 'OPEN' && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              )}
            </button>

            <button
              id="tab-research-btn"
              onClick={() => setActiveTab('research')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'research'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161618]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Research Solutions</span>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-mono rounded border border-emerald-500/30">
                6/6
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'workflow' && <RouteMasterWorkflow />}

        {activeTab === 'prompt' && (
          <PromptInterface
            activeFault={activeFault}
            onFaultChange={handleFaultChange}
            circuitState={circuitState}
            onGenerationComplete={(res) => {
              setLastResponse(res);
              refreshState();
            }}
          />
        )}

        {activeTab === 'health' && (
          <HealthRegistryDashboard
            activeFault={activeFault}
            onFaultChange={handleFaultChange}
            onStateUpdated={refreshState}
          />
        )}

        {activeTab === 'research' && <ResearchSolverDashboard />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E1E20] bg-[#0A0A0B] py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-slate-400">NexusAI Adaptive Engine • Spring Boot 3.3.x / Java 21 Loom</span>
          <span className="font-mono text-[11px] text-slate-500">
            Resilience4j Circuit Breaker • Google Gemini 3.7 Flash • Zero-Downtime Fallback SLA
          </span>
        </div>
      </footer>
    </div>
  );
}
