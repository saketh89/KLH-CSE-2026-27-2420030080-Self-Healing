import React, { useState, useEffect } from 'react';
import {
  Send,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Cpu,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  Flame,
} from 'lucide-react';
import { GenerationResponse, CircuitBreakerState } from '../types';

interface PromptInterfaceProps {
  onGenerationComplete?: (res: GenerationResponse) => void;
  activeFault: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504';
  onFaultChange: (fault: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504') => void;
  circuitState?: CircuitBreakerState;
}

export const PromptInterface: React.FC<PromptInterfaceProps> = ({
  onGenerationComplete,
  activeFault,
  onFaultChange,
  circuitState = 'CLOSED',
}) => {
  const [prompt, setPrompt] = useState(
    'Write a high-concurrency Java 21 Virtual Threads algorithm with Resilience4j circuit breaker integration.'
  );
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heuristicPreview, setHeuristicPreview] = useState<{
    score: number;
    classification: 'COMPLEX_REASONING' | 'FAST_LOOKUP';
    selectedModel: string;
    detectedSignals: string[];
  } | null>(null);

  // Heuristic evaluation as user types
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!prompt.trim()) {
        setHeuristicPreview(null);
        return;
      }
      try {
        const res = await fetch('/api/v1/heuristic/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        if (res.ok) {
          const data = await res.json();
          setHeuristicPreview(data);
        }
      } catch (e) {
        // Fallback local preview
        const isComplex =
          prompt.length > 120 ||
          /\b(code|algorithm|explain|analyze|architect|refactor|debug|calculate|proof|compare|sql|java|python|system design)\b/i.test(
            prompt
          );
        setHeuristicPreview({
          score: isComplex ? 85 : 30,
          classification: isComplex ? 'COMPLEX_REASONING' : 'FAST_LOOKUP',
          selectedModel: isComplex ? 'gemini-3.7-flash' : 'fast-model-v1',
          detectedSignals: [],
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [prompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          simulateFault: activeFault !== 'NONE' ? activeFault : undefined,
        }),
      });

      const data: GenerationResponse = await res.json();
      if (!res.ok && !data.content) {
        throw new Error(data.warning || 'Generation failed on routing cluster');
      }

      setResponse(data);
      if (onGenerationComplete) {
        onGenerationComplete(data);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected routing error occurred');
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    {
      title: 'Complex Reasoning (Routes to Gemini 3.7 Flash)',
      text: 'Analyze the architectural trade-offs between Java 21 Virtual Threads and reactive Netty event loops under high AI API gateway loads.',
      badge: 'Complex Intent',
    },
    {
      title: 'Fast Lookup (Routes to Fast-Model v1)',
      text: 'What is the standard HTTP status code for rate limit exceeded?',
      badge: 'Fast Intent',
    },
    {
      title: 'Algorithm Design (Routes to Gemini 3.7 Flash)',
      text: 'Write a thread-safe token bucket rate limiter in Java with sliding window metrics and exponential backoff.',
      badge: 'Coding Intent',
    },
  ];

  return (
    <div id="prompt-interface-container" className="w-full space-y-6">
      {/* Interactive Control Card */}
      <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-6 shadow-xl relative overflow-hidden">
        {/* Top Header & Simulation Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-[#1E1E20]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#161618] border border-[#2A2A2C] flex items-center justify-center text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Adaptive AI Router Engine</h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wider ${
                    circuitState === 'CLOSED'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : circuitState === 'OPEN'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  Circuit: {circuitState}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Heuristic routing with Resilience4j circuit breaker fallback & zero downtime
              </p>
            </div>
          </div>

          {/* Fault Simulator Dropdown */}
          <div className="flex items-center gap-2 bg-[#161618] p-1.5 rounded-lg border border-[#2A2A2C]">
            <Flame className="w-4 h-4 text-orange-400 ml-1.5 shrink-0" />
            <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Fault Injection:</label>
            <select
              id="fault-simulation-select"
              value={activeFault}
              onChange={(e) => onFaultChange(e.target.value as any)}
              className="text-xs bg-[#121214] border border-[#2A2A2C] rounded-md px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="NONE">None (200 OK)</option>
              <option value="429_RATE_LIMIT">Simulate 429 Rate Limit</option>
              <option value="503_SERVICE_UNAVAILABLE">Simulate 503 Overload</option>
              <option value="TIMEOUT_504">Simulate 504 Timeout</option>
            </select>
          </div>
        </div>

        {/* Quick Sample Prompts */}
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Preset Routing Scenarios
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {samplePrompts.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sample.text)}
                className="text-left p-3 rounded-lg bg-[#161618] hover:bg-[#1A1A1D] border border-[#2A2A2C] hover:border-slate-700 transition-all text-xs group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-slate-200 group-hover:text-blue-400 truncate">
                    {sample.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#121214] text-slate-400 font-mono shrink-0 border border-[#2A2A2C]">
                    {sample.badge}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">{sample.text}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Model Input (Adaptive Context)
            </label>
            <textarea
              id="prompt-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe the core benefits of fallback routing in AI middleware..."
              className="w-full p-3.5 bg-[#161618] border border-[#2A2A2C] rounded-lg text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600 resize-y font-mono leading-relaxed"
            />
          </div>

          {/* Dynamic Heuristic Detection Bar & Submit */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs">
              {heuristicPreview ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 uppercase text-[10px] font-bold">Predicted Target:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium text-xs font-mono ${
                      heuristicPreview.classification === 'COMPLEX_REASONING'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}
                  >
                    {heuristicPreview.classification === 'COMPLEX_REASONING' ? (
                      <>
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        Gemini 3.7 Flash [PRIMARY] (Score: {heuristicPreview.score}/100)
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 text-green-400" />
                        Fast-Model v1 [FAST-PATH] (Score: {heuristicPreview.score}/100)
                      </>
                    )}
                  </span>
                  {heuristicPreview.detectedSignals.length > 0 && (
                    <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                      Signals: [{heuristicPreview.detectedSignals.slice(0, 3).join(', ')}]
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-500 text-xs font-mono">Evaluating intent heuristic...</span>
              )}
            </div>

            <button
              id="submit-prompt-btn"
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-[#161618] disabled:text-slate-600 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>ROUTING REQUEST...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>EXECUTE</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Alert */}
        {error && (
          <div className="mt-5 p-4 bg-rose-950/30 border border-rose-800/50 rounded-lg text-xs text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold font-mono">Routing Intercept Failure:</span> {error}
            </div>
          </div>
        )}
      </div>

      {/* 3-Column Engine Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-4 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Active Model</p>
          <p className="text-lg font-bold text-white mt-0.5">
            {response ? response.metadata.finalServedModelDisplayName.split('(')[0].trim() : 'Gemini 3.7 Flash'}
          </p>
          <p className="text-[10px] text-blue-400 font-mono mt-0.5">
            {response ? response.metadata.finalServedModel : 'gemini-3.7-flash (v1beta)'}
          </p>
        </div>

        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-4 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Routing Logic</p>
          <p className="text-lg font-bold text-white mt-0.5">Adaptive-H</p>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5 italic">@AiRoutingService.class</p>
        </div>

        <div className="bg-[#121214] border border-[#1E1E20] rounded-xl p-4 flex flex-col justify-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Resilience Layer</p>
          <p className="text-lg font-bold text-white mt-0.5">Resilience4j</p>
          <p className="text-[10px] text-green-400 font-mono mt-0.5">CB_ENABLED_ACTIVE ({circuitState})</p>
        </div>
      </div>

      {/* Response Display Card in Stream Terminal Style */}
      {response && (
        <div id="response-output-card" className="bg-[#121214] border border-[#1E1E20] rounded-xl flex flex-col overflow-hidden shadow-xl">
          {/* Terminal Title Bar */}
          <div className="p-4 border-b border-[#1E1E20] bg-[#161618] flex justify-between items-center">
            <span className="text-xs font-mono text-slate-400">/api/v1/generate/prompt-stream</span>
            <div className="flex gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2A2A2C]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#2A2A2C]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#2A2A2C]"></span>
            </div>
          </div>

          {/* Metadata & Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#0E0E10] border-b border-[#1E1E20]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs text-slate-500 uppercase text-[10px] font-bold">Served By:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded font-mono ${
                  response.metadata.isFallbackTriggered
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                    : 'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}
              >
                {response.metadata.isFallbackTriggered ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                )}
                {response.metadata.finalServedModelDisplayName}
              </span>

              {response.metadata.isFallbackTriggered && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded animate-pulse">
                  FALLBACK ACTIVE
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Latency: <strong className="text-white">{response.metadata.totalLatencyMs}ms</strong>
              </span>
              <span className="hidden sm:inline">
                Thread: <strong className="text-slate-300">{response.metadata.virtualThreadId}</strong>
              </span>
            </div>
          </div>

          {/* Fallback Execution Hop Chain */}
          {response.metadata.traces && response.metadata.traces.length > 0 && (
            <div className="p-4 bg-[#121214] border-b border-[#1E1E20] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  Telemetry Hop Chain
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  {response.metadata.traces.length} Attempt{response.metadata.traces.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {response.metadata.traces.map((trace, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono ${
                      trace.status === 'SUCCESS'
                        ? 'bg-[#161618] border-green-900/40 text-green-300'
                        : trace.status === 'FAILED'
                        ? 'bg-[#161618] border-rose-900/40 text-rose-300'
                        : 'bg-[#161618] border-[#2A2A2C] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-5 h-5 rounded bg-[#121214] text-[11px] flex items-center justify-center text-slate-400 font-bold shrink-0 border border-[#2A2A2C]">
                        {trace.hopIndex}
                      </span>
                      <span className="font-semibold text-white">{trace.modelDisplayName}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          trace.status === 'SUCCESS'
                            ? 'bg-green-500/10 text-green-400'
                            : trace.status === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {trace.status} ({trace.httpStatus || 200})
                      </span>
                      {trace.fallbackTriggerReason && (
                        <span className="text-[11px] text-slate-400 italic">
                          — {trace.fallbackTriggerReason}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-slate-500 text-[11px] shrink-0">
                      <span>Latency: {trace.latencyMs}ms</span>
                      <span>Circuit: {trace.circuitBreakerState}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model Stream Output Content */}
          <div className="p-6 bg-[#0E0E10] font-mono text-sm leading-relaxed overflow-y-auto space-y-3">
            <p className="text-blue-400 opacity-80 text-xs">
              [SYSTEM] Intercepting request ID: {response.metadata.requestId}...
            </p>
            <p className="text-blue-400 opacity-80 text-xs">
              [ROUTER] Heuristic analysis: {response.metadata.heuristicReasoning?.classification || 'COMPLEX_REASONING'} detected. Routing to {response.metadata.heuristicRoutedTo}...
            </p>
            {response.metadata.isFallbackTriggered && (
              <p className="text-orange-400 opacity-90 text-xs">
                [RESILIENCE4J] Primary upstream circuit tripped. Auto-fallback engaged seamlessly to {response.metadata.finalServedModel}...
              </p>
            )}
            <div className="pt-2 text-white whitespace-pre-wrap leading-relaxed text-sm">
              {response.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
