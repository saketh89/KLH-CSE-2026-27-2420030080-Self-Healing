import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  RefreshCw,
  Zap,
  ShieldAlert,
  Flame,
  Power,
  RotateCcw,
  Sliders,
  Server,
} from 'lucide-react';
import { HealthRegistryState, CircuitBreakerState, ModelHealthInfo, TelemetryData } from '../types';
import { PerformanceChart } from './PerformanceChart';

interface HealthRegistryDashboardProps {
  onStateUpdated?: () => void;
  activeFault: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504';
  onFaultChange: (fault: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504') => void;
}

export const HealthRegistryDashboard: React.FC<HealthRegistryDashboardProps> = ({
  onStateUpdated,
  activeFault,
  onFaultChange,
}) => {
  const [healthData, setHealthData] = useState<{
    models: Record<string, ModelHealthInfo>;
    circuitBreakerMetrics: {
      state: CircuitBreakerState;
      slidingWindowSize: number;
      currentWindowCalls: number;
      failureCount: number;
      failureRatePercent: number;
      openTimeRemainingMs: number;
    };
    telemetry?: TelemetryData;
    systemStatus: string;
    activeVirtualThreads: number;
    timestamp: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/v1/models/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (e) {
      console.error('Failed to fetch model health', e);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleTripCircuit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/circuit-breaker/trip', { method: 'POST' });
      if (res.ok) {
        setActionMessage('Circuit manually tripped to OPEN.');
        await fetchHealth();
        if (onStateUpdated) onStateUpdated();
      }
    } finally {
      setLoading(false);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleResetCircuit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/circuit-breaker/reset', { method: 'POST' });
      if (res.ok) {
        setActionMessage('Circuit breaker reset to CLOSED.');
        await fetchHealth();
        if (onStateUpdated) onStateUpdated();
      }
    } finally {
      setLoading(false);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Healthy
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Degraded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3" /> Unhealthy
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Health Overview & Circuit State Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* System Health */}
        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              System Health
            </span>
            <Server className="w-4 h-4 text-green-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {healthData?.systemStatus || 'OPERATIONAL'}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-slate-500 uppercase font-mono mb-1">
              <span>VIRTUAL THREAD SATURATION</span>
              <span className="text-slate-400 font-sans">Active: ~{healthData?.activeVirtualThreads || 16} / 5,000</span>
            </div>
            <div className="h-1.5 w-full bg-[#1A1A1D] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(10, ((healthData?.activeVirtualThreads || 16) / 50) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gemini Circuit Breaker */}
        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Gemini Circuit Breaker
            </span>
            <ShieldAlert
              className={`w-4 h-4 ${
                healthData?.circuitBreakerMetrics?.state === 'CLOSED'
                  ? 'text-green-400'
                  : healthData?.circuitBreakerMetrics?.state === 'OPEN'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                healthData?.circuitBreakerMetrics?.state === 'CLOSED'
                  ? 'text-green-400'
                  : healthData?.circuitBreakerMetrics?.state === 'OPEN'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {healthData?.circuitBreakerMetrics?.state || 'CLOSED'}
            </span>
            <span className="text-xs font-mono text-slate-500">
              (Failures: {healthData?.circuitBreakerMetrics?.failureRatePercent || 0}%)
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-slate-500 uppercase font-mono mb-1">
              <span>FAILURE RATE (WINDOW)</span>
              <span className="text-slate-400 font-sans">{healthData?.circuitBreakerMetrics?.failureRatePercent || 0}% vs 50.0% max</span>
            </div>
            <div className="h-1.5 w-full bg-[#1A1A1D] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  (healthData?.circuitBreakerMetrics?.failureRatePercent || 0) >= 50
                    ? 'bg-rose-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, healthData?.circuitBreakerMetrics?.failureRatePercent || 4))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Chaos Injection Controls */}
        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Circuit Controls
            </span>
            <Sliders className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleTripCircuit}
              disabled={loading || healthData?.circuitBreakerMetrics?.state === 'OPEN'}
              className="flex-1 px-3 py-2 bg-rose-600/80 hover:bg-rose-600 disabled:bg-[#161618] disabled:text-slate-600 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Power className="w-3.5 h-3.5" /> Trip (OPEN)
            </button>
            <button
              onClick={handleResetCircuit}
              disabled={loading || healthData?.circuitBreakerMetrics?.state === 'CLOSED'}
              className="flex-1 px-3 py-2 bg-[#161618] hover:bg-[#1A1A1D] disabled:bg-[#121214] disabled:text-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[#2A2A2C]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset (CLOSED)
            </button>
          </div>
          {actionMessage ? (
            <p className="text-[11px] text-blue-400 mt-2 font-mono truncate">{actionMessage}</p>
          ) : (
            <p className="text-[10px] text-slate-500 mt-2 font-mono">Sliding window size: 10 calls</p>
          )}
        </div>
      </div>

      {/* Performance Chart: Success vs Fallback Rate Over Time */}
      <PerformanceChart
        telemetry={healthData?.telemetry || null}
        onRefresh={fetchHealth}
        onSimulateTraffic={async (count, faultRate) => {
          await fetch('/api/v1/models/telemetry/simulate-traffic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count, faultRate }),
          });
          await fetchHealth();
          if (onStateUpdated) onStateUpdated();
        }}
        onResetTelemetry={async () => {
          await fetch('/api/v1/models/telemetry/reset', { method: 'POST' });
          await fetchHealth();
          if (onStateUpdated) onStateUpdated();
        }}
        isLoading={loading}
      />

      {/* Model Health Cards Table */}
      <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E1E20] pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Model Health Registry
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live telemetry logging upstream cluster availability, latency, and circuit trips
            </p>
          </div>
          <button
            onClick={fetchHealth}
            className="p-2 bg-[#161618] hover:bg-[#1A1A1D] text-slate-300 rounded-lg border border-[#2A2A2C] transition-all cursor-pointer"
            title="Refresh health metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          {healthData?.models &&
            Object.values(healthData.models as Record<string, ModelHealthInfo>).map((model: ModelHealthInfo) => {
              const isPrimary = model.id === 'gemini-3.7-flash';
              const isFast = model.id === 'fast-model-v1';

              return (
                <div
                  key={model.id}
                  className={`p-4 bg-[#1A1A1D] rounded-r-lg border-l-2 ${
                    isPrimary
                      ? 'border-blue-500'
                      : isFast
                      ? 'border-slate-500'
                      : 'border-orange-500/80'
                  } border-t border-r border-b border-[#1E1E20] space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm">{model.name}</h4>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            isPrimary
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : isFast
                              ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}
                        >
                          {isPrimary ? 'PRIMARY' : isFast ? 'FAST-PATH' : 'FALLBACK'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{model.provider}</p>
                    </div>
                    {getStatusBadge(model.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2A2A2C] text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Total Calls</span>
                      <p className="font-semibold text-slate-200 font-mono">{model.totalCalls}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Failures</span>
                      <p className="font-semibold text-rose-400 font-mono">
                        {model.totalFailures} ({model.consecutiveFailures} streak)
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Avg Latency</span>
                      <p className="font-semibold text-slate-200 font-mono">
                        {model.totalCalls > 0
                          ? `${Math.round(model.totalLatencyMs / model.totalCalls)}ms`
                          : '--'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Circuit State</span>
                      <p
                        className={`font-semibold font-mono text-[11px] ${
                          model.circuitState === 'CLOSED'
                            ? 'text-green-400'
                            : model.circuitState === 'OPEN'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {model.circuitState || 'CLOSED'}
                      </p>
                    </div>
                  </div>

                  {model.lastErrorMessage && model.status !== 'HEALTHY' && (
                    <div className="p-2 rounded bg-rose-950/30 border border-rose-900/40 text-[10px] text-rose-300 font-mono truncate">
                      Err: {model.lastErrorMessage}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
