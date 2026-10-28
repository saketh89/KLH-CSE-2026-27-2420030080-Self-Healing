import React, { useState, useRef, useMemo } from 'react';
import {
  TrendingUp,
  Activity,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Play,
  Flame,
  RotateCcw,
  BarChart3,
  Layers,
  Clock,
  CheckCircle2,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { PerformanceTimePoint, PerformanceMetricsSummary, TelemetryData } from '../types';

interface PerformanceChartProps {
  telemetry: TelemetryData | null;
  onRefresh?: () => void;
  onSimulateTraffic?: (count: number, faultRate: number) => Promise<void>;
  onResetTelemetry?: () => Promise<void>;
  isLoading?: boolean;
}

type ChartViewMode = 'RATES' | 'VOLUME' | 'LATENCY';
type TimeWindow = '2M' | '15M' | 'ALL';

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  telemetry,
  onRefresh,
  onSimulateTraffic,
  onResetTelemetry,
  isLoading = false,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('RATES');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('15M');
  const [hoveredPoint, setHoveredPoint] = useState<PerformanceTimePoint | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter history based on time window
  const filteredHistory = useMemo(() => {
    if (!telemetry?.history || telemetry.history.length === 0) return [];
    const full = telemetry.history;
    if (timeWindow === '2M') {
      return full.slice(-10);
    } else if (timeWindow === '15M') {
      return full.slice(-24);
    }
    return full;
  }, [telemetry?.history, timeWindow]);

  const summary: PerformanceMetricsSummary = telemetry?.summary || {
    totalRequests: 0,
    totalPrimarySuccess: 0,
    totalFallbackSuccess: 0,
    totalFailures: 0,
    overallSuccessRatePercent: 100,
    primaryDirectRatePercent: 100,
    fallbackRescueRatePercent: 0,
    averageLatencyMs: 0,
    circuitBreakerTrips: 0,
    slaUptimePercent: 100,
  };

  // SVG dimensions
  const svgWidth = 900;
  const svgHeight = 260;
  const padding = { top: 24, right: 30, bottom: 36, left: 52 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Compute maximums for scaling
  const maxVolume = useMemo(() => {
    if (filteredHistory.length === 0) return 10;
    const maxReq = Math.max(...filteredHistory.map((p) => p.totalRequests));
    return Math.max(10, Math.ceil(maxReq * 1.25));
  }, [filteredHistory]);

  const maxLatency = useMemo(() => {
    if (filteredHistory.length === 0) return 500;
    const maxLat = Math.max(...filteredHistory.map((p) => p.avgLatencyMs));
    return Math.max(400, Math.ceil(maxLat * 1.2));
  }, [filteredHistory]);

  // Point mapping helpers
  const getX = (index: number, total: number) => {
    if (total <= 1) return padding.left + graphWidth / 2;
    return padding.left + (index / (total - 1)) * graphWidth;
  };

  const getYRate = (ratePercent: number) => {
    const clamped = Math.max(0, Math.min(100, ratePercent));
    return padding.top + (1 - clamped / 100) * graphHeight;
  };

  const getYVolume = (vol: number) => {
    const clamped = Math.max(0, vol);
    return padding.top + (1 - clamped / maxVolume) * graphHeight;
  };

  const getYLatency = (lat: number) => {
    const clamped = Math.max(0, lat);
    return padding.top + (1 - clamped / maxLatency) * graphHeight;
  };

  // Smooth SVG path generator (Bézier spline)
  const generateSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  // Generate Area path (closed at bottom)
  const generateAreaPath = (points: { x: number; y: number }[], baseY: number) => {
    if (points.length === 0) return '';
    const smooth = generateSmoothPath(points);
    const last = points[points.length - 1];
    const first = points[0];
    return `${smooth} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  };

  // Series points
  const pointsCount = filteredHistory.length;
  const primaryRatePoints = filteredHistory.map((p, i) => ({
    x: getX(i, pointsCount),
    y: getYRate(p.primarySuccessRate),
  }));

  const fallbackRatePoints = filteredHistory.map((p, i) => ({
    x: getX(i, pointsCount),
    y: getYRate(p.fallbackRate),
  }));

  const totalVolumePoints = filteredHistory.map((p, i) => ({
    x: getX(i, pointsCount),
    y: getYVolume(p.totalRequests),
  }));

  const fallbackVolumePoints = filteredHistory.map((p, i) => ({
    x: getX(i, pointsCount),
    y: getYVolume(p.fallbackSuccess),
  }));

  const latencyPoints = filteredHistory.map((p, i) => ({
    x: getX(i, pointsCount),
    y: getYLatency(p.avgLatencyMs),
  }));

  const baseY = padding.top + graphHeight;

  // Handle Mouse Hover / Scrubbing
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (filteredHistory.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;

    let closestIdx = 0;
    let minDistance = Infinity;

    filteredHistory.forEach((_, i) => {
      const px = getX(i, pointsCount);
      const dist = Math.abs(px - mouseX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    });

    setHoverIndex(closestIdx);
    setHoveredPoint(filteredHistory[closestIdx] || null);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoveredPoint(null);
  };

  // Traffic Simulation triggers
  const triggerTrafficSimulation = async (count: number, faultRate: number, label: string) => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationNotice(`Simulating ${count} requests (${faultRate}% fault rate)...`);
    try {
      if (onSimulateTraffic) {
        await onSimulateTraffic(count, faultRate);
      } else {
        await fetch('/api/v1/models/telemetry/simulate-traffic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count, faultRate }),
        });
        if (onRefresh) onRefresh();
      }
      setSimulationNotice(`Injected ${count} requests successfully! Telemetry updated.`);
    } catch (e) {
      setSimulationNotice('Simulation failed. Check backend connection.');
    } finally {
      setIsSimulating(false);
      setTimeout(() => setSimulationNotice(null), 3500);
    }
  };

  const triggerResetTelemetry = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      if (onResetTelemetry) {
        await onResetTelemetry();
      } else {
        await fetch('/api/v1/models/telemetry/reset', { method: 'POST' });
        if (onRefresh) onRefresh();
      }
      setSimulationNotice('Telemetry timeline reset.');
    } finally {
      setIsSimulating(false);
      setTimeout(() => setSimulationNotice(null), 3000);
    }
  };

  return (
    <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-6 shadow-2xl space-y-6">
      {/* Top Banner & KPI Stat Strip */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E1E20] pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Routing Engine Performance & Fallback Dynamics
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE STREAM
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Time-series analysis measuring primary model success rate vs automatic secondary fallback engagement
            </p>
          </div>

          {/* View Mode & Window Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Pill Switch */}
            <div className="flex items-center bg-[#161618] p-1 rounded-lg border border-[#2A2A2C]">
              <button
                onClick={() => setViewMode('RATES')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'RATES'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Success vs Fallback %
              </button>
              <button
                onClick={() => setViewMode('VOLUME')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'VOLUME'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Request Volume
              </button>
              <button
                onClick={() => setViewMode('LATENCY')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'LATENCY'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Latency & Circuits
              </button>
            </div>

            {/* Time Window Switch */}
            <div className="flex items-center bg-[#161618] p-1 rounded-lg border border-[#2A2A2C]">
              <button
                onClick={() => setTimeWindow('2M')}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  timeWindow === '2M'
                    ? 'bg-[#2A2A2C] text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2m
              </button>
              <button
                onClick={() => setTimeWindow('15M')}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  timeWindow === '15M'
                    ? 'bg-[#2A2A2C] text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                15m
              </button>
              <button
                onClick={() => setTimeWindow('ALL')}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  timeWindow === 'ALL'
                    ? 'bg-[#2A2A2C] text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* 4 Summary Stat Mini-Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3.5 bg-[#161618] border border-[#2A2A2C] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Primary Direct Rate
              </span>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-blue-400">
                {summary.primaryDirectRatePercent}%
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({summary.totalPrimarySuccess} reqs)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Served by Gemini 3.7 Flash</p>
          </div>

          <div className="p-3.5 bg-[#161618] border border-[#2A2A2C] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Fallback Rescue Rate
              </span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-amber-400">
                {summary.fallbackRescueRatePercent}%
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                ({summary.totalFallbackSuccess} reqs)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Rescued by Fast-Model / Edge</p>
          </div>

          <div className="p-3.5 bg-[#161618] border border-[#2A2A2C] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Zero-Downtime SLA
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-400">
                {summary.slaUptimePercent}%
              </span>
              <span className="text-[11px] text-emerald-500/80 font-mono">
                {summary.totalFailures === 0 ? '0 unhandled' : `${summary.totalFailures} err`}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Seamless Client Continuity</p>
          </div>

          <div className="p-3.5 bg-[#161618] border border-[#2A2A2C] rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Average Latency
              </span>
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-slate-200">
                {summary.averageLatencyMs}ms
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {summary.circuitBreakerTrips} circuit trips
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Multiplexed Non-blocking I/O</p>
          </div>
        </div>
      </div>

      {/* SVG Performance Chart Canvas */}
      <div className="relative bg-[#0E0E10] border border-[#1E1E20] rounded-xl p-4 overflow-hidden" ref={containerRef}>
        {/* Top Graph Legend & Status */}
        <div className="flex items-center justify-between text-xs mb-2 px-2">
          <div className="flex items-center gap-4">
            {viewMode === 'RATES' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
                  <span className="text-slate-300 font-medium text-[11px]">Primary Success Rate (%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 rounded-full" />
                  <span className="text-slate-300 font-medium text-[11px]">Fallback Rescue Rate (%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <span className="w-3 h-0.5 border-b border-rose-500/60 border-dashed" />
                  <span>50% Circuit Trip Threshold</span>
                </div>
              </>
            )}

            {viewMode === 'VOLUME' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-blue-500/40 border border-blue-400 rounded-xs" />
                  <span className="text-slate-300 font-medium text-[11px]">Primary Direct Requests</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-2 bg-amber-500/50 border border-amber-400 rounded-xs" />
                  <span className="text-slate-300 font-medium text-[11px]">Fallback Rescued Requests</span>
                </div>
              </>
            )}

            {viewMode === 'LATENCY' && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-400 rounded-full" />
                  <span className="text-slate-300 font-medium text-[11px]">Engine Latency (ms)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-slate-400 text-[11px]">Circuit OPEN state</span>
                </div>
              </>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            {filteredHistory.length} data samples • 100% SLA preserved
          </div>
        </div>

        {/* SVG Area */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-64 select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              {/* Gradients */}
              <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="fallbackAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="latencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>

              {/* Glow filters */}
              <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3B82F6" floodOpacity="0.7" />
              </filter>
              <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#F59E0B" floodOpacity="0.7" />
              </filter>
              <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10B981" floodOpacity="0.7" />
              </filter>
            </defs>

            {/* Background Grid Lines & Y-Axis labels */}
            {viewMode === 'RATES' &&
              [100, 75, 50, 25, 0].map((percent) => {
                const y = getYRate(percent);
                const isThreshold = percent === 50;
                return (
                  <g key={percent}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke={isThreshold ? '#E11D48' : '#1E1E22'}
                      strokeDasharray={isThreshold ? '4 4' : '2 2'}
                      strokeWidth={isThreshold ? 1.2 : 1}
                      opacity={isThreshold ? 0.6 : 0.8}
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill={isThreshold ? '#FB7185' : '#64748B'}
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {percent}%
                    </text>
                  </g>
                );
              })}

            {viewMode === 'VOLUME' &&
              [1, 0.75, 0.5, 0.25, 0].map((frac) => {
                const val = Math.round(maxVolume * frac);
                const y = getYVolume(val);
                return (
                  <g key={frac}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="#1E1E22"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

            {viewMode === 'LATENCY' &&
              [1, 0.75, 0.5, 0.25, 0].map((frac) => {
                const val = Math.round(maxLatency * frac);
                const y = getYLatency(val);
                return (
                  <g key={frac}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="#1E1E22"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {val}ms
                    </text>
                  </g>
                );
              })}

            {/* X-Axis Time Labels */}
            {filteredHistory.map((point, i) => {
              // Show label every few steps to avoid clutter
              const step = filteredHistory.length > 20 ? 4 : filteredHistory.length > 12 ? 3 : 2;
              if (i % step !== 0 && i !== filteredHistory.length - 1) return null;
              const x = getX(i, pointsCount);
              return (
                <g key={point.timestamp + i}>
                  <line
                    x1={x}
                    y1={baseY}
                    x2={x}
                    y2={baseY + 4}
                    stroke="#2A2A2C"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={baseY + 16}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {point.timeLabel}
                  </text>
                </g>
              );
            })}

            {/* VIEW MODE: RATES (Success vs Fallback Rate) */}
            {viewMode === 'RATES' && pointsCount > 0 && (
              <>
                {/* Fallback Rate Area & Path */}
                <path
                  d={generateAreaPath(fallbackRatePoints, baseY)}
                  fill="url(#fallbackAreaGrad)"
                />
                <path
                  d={generateSmoothPath(fallbackRatePoints)}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                  filter="url(#glowAmber)"
                />

                {/* Primary Success Rate Area & Path */}
                <path
                  d={generateAreaPath(primaryRatePoints, baseY)}
                  fill="url(#primaryAreaGrad)"
                />
                <path
                  d={generateSmoothPath(primaryRatePoints)}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  filter="url(#glowBlue)"
                />

                {/* Points on lines */}
                {filteredHistory.map((p, i) => {
                  const px = getX(i, pointsCount);
                  const pyPrimary = getYRate(p.primarySuccessRate);
                  const pyFallback = getYRate(p.fallbackRate);
                  const isHovered = hoverIndex === i;

                  return (
                    <g key={`rates-point-${i}`}>
                      {/* Primary Node */}
                      <circle
                        cx={px}
                        cy={pyPrimary}
                        r={isHovered ? 5 : 2.5}
                        fill="#3B82F6"
                        stroke="#0E0E10"
                        strokeWidth="1.5"
                      />
                      {/* Fallback Node */}
                      <circle
                        cx={px}
                        cy={pyFallback}
                        r={isHovered ? 5 : 2.5}
                        fill="#F59E0B"
                        stroke="#0E0E10"
                        strokeWidth="1.5"
                      />
                      {/* Circuit Breaker Open Indicator Badge on X axis */}
                      {p.circuitState === 'OPEN' && (
                        <circle
                          cx={px}
                          cy={baseY - 6}
                          r="3"
                          fill="#EF4444"
                          stroke="#7F1D1D"
                          strokeWidth="1"
                        />
                      )}
                    </g>
                  );
                })}
              </>
            )}

            {/* VIEW MODE: VOLUME (Request Count Bars / Stacked Areas) */}
            {viewMode === 'VOLUME' && pointsCount > 0 && (
              <>
                {filteredHistory.map((p, i) => {
                  const x = getX(i, pointsCount);
                  const barWidth = Math.max(8, Math.min(22, (graphWidth / pointsCount) * 0.55));
                  const isHovered = hoverIndex === i;

                  const totalH = (p.totalRequests / maxVolume) * graphHeight;
                  const fallbackH = (p.fallbackSuccess / maxVolume) * graphHeight;
                  const primaryH = Math.max(0, totalH - fallbackH);

                  const yBase = baseY;
                  const yFallback = yBase - fallbackH;
                  const yPrimary = yFallback - primaryH;

                  return (
                    <g key={`vol-bar-${i}`}>
                      {/* Fallback Portion */}
                      {fallbackH > 0 && (
                        <rect
                          x={x - barWidth / 2}
                          y={yFallback}
                          width={barWidth}
                          height={fallbackH}
                          fill="#F59E0B"
                          opacity={isHovered ? 0.95 : 0.75}
                          rx="2"
                        />
                      )}
                      {/* Primary Portion */}
                      {primaryH > 0 && (
                        <rect
                          x={x - barWidth / 2}
                          y={yPrimary}
                          width={barWidth}
                          height={primaryH}
                          fill="#3B82F6"
                          opacity={isHovered ? 0.95 : 0.75}
                          rx="2"
                        />
                      )}
                    </g>
                  );
                })}
              </>
            )}

            {/* VIEW MODE: LATENCY */}
            {viewMode === 'LATENCY' && pointsCount > 0 && (
              <>
                <path
                  d={generateAreaPath(latencyPoints, baseY)}
                  fill="url(#latencyAreaGrad)"
                />
                <path
                  d={generateSmoothPath(latencyPoints)}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  filter="url(#glowGreen)"
                />

                {filteredHistory.map((p, i) => {
                  const px = getX(i, pointsCount);
                  const py = getYLatency(p.avgLatencyMs);
                  const isHovered = hoverIndex === i;

                  return (
                    <g key={`lat-point-${i}`}>
                      <circle
                        cx={px}
                        cy={py}
                        r={isHovered ? 5.5 : 3}
                        fill={p.circuitState === 'OPEN' ? '#EF4444' : '#10B981'}
                        stroke="#0E0E10"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </>
            )}

            {/* Hover Crosshair Line */}
            {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < pointsCount && (
              <g>
                <line
                  x1={getX(hoverIndex, pointsCount)}
                  y1={padding.top}
                  x2={getX(hoverIndex, pointsCount)}
                  y2={baseY}
                  stroke="#60A5FA"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Hover Floating Tooltip */}
        {hoveredPoint && hoverIndex !== null && (
          <div
            className="absolute top-4 pointer-events-none transition-all duration-100 z-20 bg-[#161618]/95 backdrop-blur-md border border-[#2A2A2C] rounded-lg p-3 shadow-2xl text-xs space-y-1.5"
            style={{
              left: `${Math.max(
                12,
                Math.min(
                  80,
                  (getX(hoverIndex, pointsCount) / svgWidth) * 100
                )
              )}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#2A2A2C] pb-1.5">
              <span className="font-mono text-slate-400 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {hoveredPoint.timeLabel}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  hoveredPoint.circuitState === 'CLOSED'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : hoveredPoint.circuitState === 'OPEN'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                Circuit: {hoveredPoint.circuitState}
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-blue-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Primary Success:
                </span>
                <span className="font-bold text-white">
                  {hoveredPoint.primarySuccessRate}% ({hoveredPoint.primarySuccess} reqs)
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Fallback Rescued:
                </span>
                <span className="font-bold text-white">
                  {hoveredPoint.fallbackRate}% ({hoveredPoint.fallbackSuccess} reqs)
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#2A2A2C]">
                <span className="text-slate-400">Total Throughput:</span>
                <span className="font-bold text-slate-200">{hoveredPoint.totalRequests} reqs</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Average Latency:</span>
                <span className="font-bold text-emerald-400">{hoveredPoint.avgLatencyMs}ms</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Simulation & Test Control Strip */}
      <div className="bg-[#161618] border border-[#2A2A2C] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Interactive Traffic Simulator
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Generate synthetic traffic bursts to witness the dynamic success vs fallback shift in real-time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => triggerTrafficSimulation(12, 0, 'Clean Traffic')}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-[#1E1E22] hover:bg-[#252528] disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium border border-[#2A2A2C] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Play className="w-3 h-3 text-emerald-400" />
            +12 Clean Reqs
          </button>

          <button
            onClick={() => triggerTrafficSimulation(15, 65, 'Fault Surge')}
            disabled={isSimulating}
            className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 disabled:opacity-50 rounded-lg text-xs font-medium border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Flame className="w-3 h-3 text-amber-400" />
            Inject Fault Surge (65%)
          </button>

          <button
            onClick={triggerResetTelemetry}
            disabled={isSimulating}
            className="p-1.5 bg-[#1E1E22] hover:bg-[#252528] disabled:opacity-50 text-slate-400 hover:text-slate-200 rounded-lg border border-[#2A2A2C] transition-all cursor-pointer"
            title="Reset telemetry baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {simulationNotice && (
        <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-xs text-blue-300 font-mono animate-fadeIn flex items-center justify-between">
          <span>{simulationNotice}</span>
          <span className="text-[10px] text-slate-500">Auto-dismissing...</span>
        </div>
      )}
    </div>
  );
};
