export type ModelType = 'gemini-3.7-flash' | 'fast-model-v1' | 'emergency-resilient-fallback';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface GenerationRequest {
  prompt: string;
  forceModel?: ModelType;
  simulateFault?: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504';
  temperature?: number;
  maxTokens?: number;
}

export interface HopTrace {
  hopIndex: number;
  targetModel: ModelType;
  modelDisplayName: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  httpStatus?: number;
  error?: string;
  latencyMs: number;
  circuitBreakerState: CircuitBreakerState;
  fallbackTriggerReason?: string;
}

export interface GenerationMetadata {
  requestId: string;
  originalPrompt: string;
  heuristicRoutedTo: ModelType;
  finalServedModel: ModelType;
  finalServedModelDisplayName: string;
  isFallbackTriggered: boolean;
  totalLatencyMs: number;
  virtualThreadId: string;
  circuitBreakerState: CircuitBreakerState;
  traces: HopTrace[];
  heuristicReasoning: {
    complexityScore: number; // 0 to 100
    tokenEstimate: number;
    detectedSignals: string[];
    classification: 'COMPLEX_REASONING' | 'FAST_LOOKUP' | 'ROUTED_DEFAULT';
  };
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: string;
}

export interface GenerationResponse {
  content: string;
  metadata: GenerationMetadata;
  success: boolean;
  warning?: string;
}

export interface ModelHealthInfo {
  id: ModelType;
  name: string;
  provider: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  consecutiveFailures: number;
  totalCalls: number;
  totalFailures: number;
  totalLatencyMs: number;
  lastFailureTime?: string;
  lastSuccessTime?: string;
  lastErrorMessage?: string;
  failureRatePercent?: number;
  averageLatencyMs?: number;
  circuitState: CircuitBreakerState;
}

export interface HealthRegistryState {
  models: Record<ModelType, ModelHealthInfo>;
  systemStatus: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';
  activeVirtualThreads: number;
  totalRequestsServed: number;
  totalFallbacksTriggered: number;
}

export interface PerformanceTimePoint {
  timestamp: string;
  timeLabel: string;
  epochMs: number;
  totalRequests: number;
  primarySuccess: number;
  fallbackSuccess: number;
  failures: number;
  primarySuccessRate: number; // 0 to 100%
  fallbackRate: number; // 0 to 100%
  overallSuccessRate: number; // 0 to 100%
  avgLatencyMs: number;
  circuitState: CircuitBreakerState;
  virtualThreads: number;
}

export interface PerformanceMetricsSummary {
  totalRequests: number;
  totalPrimarySuccess: number;
  totalFallbackSuccess: number;
  totalFailures: number;
  overallSuccessRatePercent: number;
  primaryDirectRatePercent: number;
  fallbackRescueRatePercent: number;
  averageLatencyMs: number;
  circuitBreakerTrips: number;
  slaUptimePercent: number;
}

export interface TelemetryData {
  history: PerformanceTimePoint[];
  summary: PerformanceMetricsSummary;
}

export interface FaultConfig {
  geminiFault: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504';
  fastModelFault: 'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504';
  simulatedDelayMs: number;
  circuitBreakerThreshold: number; // e.g., 50%
  slidingWindowSize: number; // e.g., 10
}

// ==========================================
// RESEARCH GAPS & SOLUTIONS (RG1 - RG6)
// ==========================================

export type ResearchGapId = 'RG1' | 'RG2' | 'RG3' | 'RG4' | 'RG5' | 'RG6';

export type TaskCategory = 'CODING' | 'REASONING' | 'MATHEMATICAL' | 'EXTRACTION' | 'GENERAL';

export type MultiObjectivePolicy = 'BALANCED' | 'QUALITY' | 'COST' | 'LATENCY' | 'CUSTOM';

export interface MultiObjectiveWeights {
  quality: number; // 0.0 - 1.0
  cost: number;    // 0.0 - 1.0
  latency: number; // 0.0 - 1.0
}

export interface PredictiveFailureMetrics {
  latencySlope: number; // ms acceleration per call
  rollingErrorRate: number; // 0 - 100%
  nearTimeoutRatio: number; // % of calls taking > 75% SLA
  failureProbabilityPercent: number; // 0 - 100%
  isDegradationPredicted: boolean;
  predictionReason?: string;
}

export interface SelfHealingState {
  canaryRampPercent: number; // e.g., 10%, 25%, 50%, 100%
  activeProbesCount: number;
  lastProbeTimestamp?: string;
  lastProbeStatus?: 'SUCCESS' | 'FAILED' | 'IDLE';
  recoveryStage: 'CLOSED_HEALTHY' | 'OPEN_COOLING' | 'HALF_OPEN_CANARY_RAMP';
}

export interface QualityProfile {
  taskCategory: TaskCategory;
  primaryQualityScore: number; // 0 - 100
  selectedFallbackModel: ModelType;
  fallbackQualityScore: number; // 0 - 100
  qualityRetentionPercent: number; // e.g. 94.5%
}

export interface HysteresisState {
  cooldownRemainingSeconds: number;
  isCooldownActive: boolean;
  hysteresisMarginPercent: number; // e.g. 15%
  recentSwitchesInWindow: number;
  isOscillationDamped: boolean;
  stabilityIndexPercent: number;
}

export type BenchmarkScenario =
  | 'CASCADING_OUTAGE'
  | 'FLAPPING_BROWNOUT'
  | 'RATE_LIMIT_SPIKE'
  | 'GRADUAL_DEGRADATION';

export interface BenchmarkResult {
  scenario: BenchmarkScenario;
  scenarioName: string;
  totalRequests: number;
  successCount: number;
  fallbackRescuedCount: number;
  hardFailuresCount: number;
  zeroDowntimeSlaPercent: number;
  mttrSeconds: number;
  qualityRetentionPercent: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  executionTimestamp: string;
  reportSummary: string;
}

export interface ResearchGapDefinition {
  id: ResearchGapId;
  title: string;
  challenge: string;
  proposedImprovement: string;
  solutionMechanism: string;
  status: 'SOLVED_AND_ACTIVE' | 'TESTED_AND_VERIFIED';
  keyMetric: string;
  metricValue: string;
}

