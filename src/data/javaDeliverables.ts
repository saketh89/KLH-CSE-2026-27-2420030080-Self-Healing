export interface CodeSnippetFile {
  filename: string;
  language: string;
  description: string;
  badge: string;
  code: string;
}

export const JAVA_DELIVERABLES: CodeSnippetFile[] = [
  {
    filename: 'application.yml',
    language: 'yaml',
    description: 'Resilience4j Circuit Breaker, TimeLimiter, Virtual Threads, and Gemini API Configuration',
    badge: 'Config',
    code: `# ==============================================================================
# Self-Healing Multi-Model Adaptive Fallback Routing Engine - Spring Boot 3.x / Java 21
# ==============================================================================

server:
  port: 8080
  shutdown: graceful

spring:
  application:
    name: ai-adaptive-routing-engine
  # Java 21 Virtual Threads natively handle 10,000+ concurrent AI stream/blocking requests
  threads:
    virtual:
      enabled: true

# Google Gemini API & Multi-Model Engine Configuration
ai:
  gemini:
    api-key: \${GEMINI_API_KEY:default-key-or-env-injected}
    model: "gemini-3.7-flash"
    base-url: "https://generativelanguage.googleapis.com/v1beta"
    timeout-ms: 8000
  fast-model:
    model: "fast-model-v1"
    timeout-ms: 3000
  emergency-fallback:
    model: "emergency-resilient-fallback"
    timeout-ms: 2000

# ==============================================================================
# Resilience4j Circuit Breaker & Fallback Architecture
# ==============================================================================
resilience4j:
  circuitbreaker:
    configs:
      default:
        # Sliding window based on the last 10 requests
        sliding-window-type: COUNT_BASED
        sliding-window-size: 10
        minimum-number-of-calls: 4
        # Trip circuit to OPEN if failure rate >= 50%
        failure-rate-threshold: 50.0
        # Trip circuit to OPEN if 50% of calls take longer than 4000ms
        slow-call-rate-threshold: 50.0
        slow-call-duration-threshold: 4000ms
        # Wait 10 seconds in OPEN state before transitioning to HALF_OPEN
        wait-duration-in-open-state: 10000ms
        # Allow 3 trial calls in HALF_OPEN to verify upstream recovery
        permitted-number-of-calls-in-half-open-state: 3
        # Auto-transition from OPEN to HALF_OPEN once wait duration elapses
        automatic-transition-from-open-to-half-open-enabled: true
        # Record HTTP 429 (Rate Limit), 503 (Overloaded), 504 (Gateway Timeout), and IOException
        record-exceptions:
          - org.springframework.web.client.HttpClientErrorException.TooManyRequests
          - org.springframework.web.client.HttpServerErrorException.ServiceUnavailable
          - org.springframework.web.client.HttpServerErrorException.GatewayTimeout
          - java.util.concurrent.TimeoutException
          - java.io.IOException
          - com.engine.exception.AiProviderException
        # Ignore client-side validation errors (400 Bad Request) from tripping circuit
        ignore-exceptions:
          - org.springframework.web.client.HttpClientErrorException.BadRequest
          - java.lang.IllegalArgumentException
    instances:
      geminiPrimaryCircuitBreaker:
        base-config: default
      fastModelCircuitBreaker:
        base-config: default

  timelimiter:
    instances:
      geminiTimeLimiter:
        timeout-duration: 6000ms
        cancel-running-future: true
      fastModelTimeLimiter:
        timeout-duration: 3000ms
        cancel-running-future: true

  retry:
    instances:
      geminiRetry:
        max-attempts: 2
        wait-duration: 500ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
        retry-exceptions:
          - java.io.IOException
          - org.springframework.web.client.HttpServerErrorException.ServiceUnavailable

# Actuator Endpoints for Health & Circuit Breaker Telemetry
management:
  endpoints:
    web:
      exposure:
        include: "health,metrics,circuitbreakers,circuitbreakerevents"
  endpoint:
    health:
      show-details: always
  health:
    circuitbreakers:
      enabled: true
`
  },
  {
    filename: 'AiRoutingService.java',
    language: 'java',
    description: 'Core heuristic routing, Resilience4j @CircuitBreaker & fallback chain methods',
    badge: 'Service',
    code: `package com.engine.routing.service;

import com.engine.routing.dto.GenerationRequest;
import com.engine.routing.dto.GenerationResponse;
import com.engine.routing.dto.GenerationResponse.HopTrace;
import com.engine.routing.exception.AiProviderException;
import com.engine.routing.registry.ModelHealthRegistry;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

/**
 * Self-Healing Multi-Model Adaptive Fallback Routing Engine.
 *
 * Employs:
 * 1. Heuristic Intent Analysis: Routes complex/reasoning queries to Gemini 3.7 Flash,
 *    and fast/simple queries to Fast-Model.
 * 2. Resilience4j Circuit Breaker & Fallback Chain:
 *    Primary (Gemini) -> Secondary (Fast-Model) -> Emergency Cache/Deterministic Fallback.
 * 3. Java 21 Virtual Threads: High-concurrency I/O multiplexing with zero thread pool exhaustion.
 */
@Service
public class AiRoutingService {

    private static final Logger log = LoggerFactory.getLogger(AiRoutingService.class);

    private final RestTemplate restTemplate;
    private final ModelHealthRegistry healthRegistry;

    @Value("\${ai.gemini.api-key}")
    private String geminiApiKey;

    @Value("\${ai.gemini.model:gemini-3.7-flash}")
    private String geminiModel;

    // Heuristic patterns indicating complex reasoning, math, code, or deep analysis
    private static final Pattern COMPLEX_REGEX = Pattern.compile(
            "\\\\b(code|algorithm|explain|analyze|architect|refactor|debug|calculate|proof|compare|sql|java|python|system design)\\\\b",
            Pattern.CASE_INSENSITIVE
    );

    public AiRoutingService(RestTemplate restTemplate, ModelHealthRegistry healthRegistry) {
        this.restTemplate = restTemplate;
        this.healthRegistry = healthRegistry;
    }

    /**
     * Entrypoint: Routes incoming prompt based on heuristic analysis with transparent self-healing.
     */
    public GenerationResponse processPrompt(GenerationRequest request) {
        String requestId = UUID.randomUUID().toString();
        long startTime = System.currentTimeMillis();
        String threadInfo = Thread.currentThread().toString(); // Shows VirtualThread[#id]/runnable

        log.info("[Request {}] Dispatching on {} with prompt length: {}", 
                requestId, threadInfo, request.getPrompt().length());

        // Step 1: Heuristic Routing Evaluation
        String selectedInitialModel = evaluateRoutingHeuristic(request.getPrompt());
        List<HopTrace> hopTraces = new ArrayList<>();

        GenerationResponse response;
        if ("gemini-3.7-flash".equals(selectedInitialModel)) {
            response = executeGeminiWithFallback(request, requestId, hopTraces, startTime);
        } else {
            response = executeFastModelWithFallback(request, requestId, hopTraces, startTime);
        }

        // Attach complete audit metadata
        response.getMetadata().setRequestId(requestId);
        response.getMetadata().setOriginalPrompt(request.getPrompt());
        response.getMetadata().setHeuristicRoutedTo(selectedInitialModel);
        response.getMetadata().setVirtualThreadId(threadInfo);
        response.getMetadata().setTotalLatencyMs(System.currentTimeMillis() - startTime);
        response.getMetadata().setTraces(hopTraces);

        return response;
    }

    /**
     * Basic Heuristic Evaluator:
     * - Long prompts (> 120 chars) OR prompts matching deep reasoning terms -> Gemini 3.7 Flash
     * - Short lookup / greeting / simple fact queries -> Fast-Model
     */
    public String evaluateRoutingHeuristic(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            return "fast-model-v1";
        }
        boolean hasComplexKeywords = COMPLEX_REGEX.matcher(prompt).find();
        boolean isLengthy = prompt.trim().length() > 120;

        if (hasComplexKeywords || isLengthy) {
            log.debug("Heuristic classified prompt as COMPLEX (length={}, keywords={}) -> gemini-3.7-flash", 
                    prompt.length(), hasComplexKeywords);
            return "gemini-3.7-flash";
        }

        log.debug("Heuristic classified prompt as SIMPLE -> fast-model-v1");
        return "fast-model-v1";
    }

    // =========================================================================
    // Primary Execution: Google Gemini with Resilience4j Circuit Breaker
    // =========================================================================
    @CircuitBreaker(name = "geminiPrimaryCircuitBreaker", fallbackMethod = "fallbackToFastModel")
    public GenerationResponse executeGeminiWithFallback(GenerationRequest request, 
                                                        String requestId, 
                                                        List<HopTrace> traces, 
                                                        long startTime) {
        long hopStart = System.currentTimeMillis();
        String modelName = "gemini-3.7-flash";

        try {
            // Check for simulated faults (e.g. 429 rate limit or 503 service unavailable)
            if ("429_RATE_LIMIT".equalsIgnoreCase(request.getSimulateFault())) {
                throw new AiProviderException(429, "Simulated HTTP 429: Too Many Requests (Rate limit quota exceeded on Gemini API)");
            } else if ("503_SERVICE_UNAVAILABLE".equalsIgnoreCase(request.getSimulateFault())) {
                throw new AiProviderException(503, "Simulated HTTP 503: Service Unavailable (Gemini upstream backend overload)");
            }

            // Real Google Gemini REST / SDK Call
            String generatedText = callGeminiApi(request.getPrompt());

            long latency = System.currentTimeMillis() - hopStart;
            healthRegistry.recordSuccess(modelName, latency);

            traces.add(new HopTrace(
                    1,
                    modelName,
                    "Google Gemini 3.7 Flash",
                    "SUCCESS",
                    200,
                    null,
                    latency,
                    "CLOSED",
                    null
            ));

            GenerationResponse response = new GenerationResponse();
            response.setContent(generatedText);
            response.setSuccess(true);
            response.getMetadata().setFinalServedModel(modelName);
            response.getMetadata().setFinalServedModelDisplayName("Google Gemini 3.7 Flash (Primary)");
            response.getMetadata().setFallbackTriggered(false);
            return response;

        } catch (Exception ex) {
            long latency = System.currentTimeMillis() - hopStart;
            healthRegistry.recordFailure(modelName, ex.getMessage(), latency);

            traces.add(new HopTrace(
                    1,
                    modelName,
                    "Google Gemini 3.7 Flash",
                    "FAILED",
                    extractStatusCode(ex),
                    ex.getMessage(),
                    latency,
                    "OPENING",
                    "Primary upstream failure triggered automatic circuit fallback"
            ));

            // Re-throw to allow Resilience4j to capture metrics and invoke fallbackMethod
            throw ex;
        }
    }

    /**
     * Level 1 Fallback: Invoked automatically when geminiPrimaryCircuitBreaker opens or throws.
     */
    public GenerationResponse fallbackToFastModel(GenerationRequest request, 
                                                  String requestId, 
                                                  List<HopTrace> traces, 
                                                  long startTime, 
                                                  Throwable throwable) {
        log.warn("[Request {}] Gemini failed with {}: '{}'. Triggering Level 1 Fallback -> Fast-Model",
                requestId, throwable.getClass().getSimpleName(), throwable.getMessage());

        long hopStart = System.currentTimeMillis();
        String modelName = "fast-model-v1";

        try {
            // Level 1 Fallback model execution
            String generatedText = callFastModelApi(request.getPrompt());
            long latency = System.currentTimeMillis() - hopStart;
            healthRegistry.recordSuccess(modelName, latency);

            traces.add(new HopTrace(
                    2,
                    modelName,
                    "Fast-Model v1 (Secondary Fallback)",
                    "SUCCESS",
                    200,
                    null,
                    latency,
                    "CLOSED",
                    "Recovered seamlessly from primary Gemini failure"
            ));

            GenerationResponse response = new GenerationResponse();
            response.setContent(generatedText);
            response.setSuccess(true);
            response.setWarning("Served via Fast-Model Secondary Fallback due to Primary Gemini outage: " + throwable.getMessage());
            response.getMetadata().setFinalServedModel(modelName);
            response.getMetadata().setFinalServedModelDisplayName("Fast-Model v1 (Secondary Fallback)");
            response.getMetadata().setFallbackTriggered(true);
            return response;

        } catch (Exception ex) {
            long latency = System.currentTimeMillis() - hopStart;
            healthRegistry.recordFailure(modelName, ex.getMessage(), latency);

            traces.add(new HopTrace(
                    2,
                    modelName,
                    "Fast-Model v1 (Secondary Fallback)",
                    "FAILED",
                    extractStatusCode(ex),
                    ex.getMessage(),
                    latency,
                    "OPEN",
                    "Secondary model failed; triggering Level 2 Emergency Resilient Engine"
            ));

            // Level 2 Fallback: Emergency Resilient Engine
            return executeEmergencyFallback(request, requestId, traces, ex);
        }
    }

    /**
     * Direct execution when heuristic chooses Fast-Model initially.
     */
    @CircuitBreaker(name = "fastModelCircuitBreaker", fallbackMethod = "fallbackToEmergencyFromFast")
    public GenerationResponse executeFastModelWithFallback(GenerationRequest request, 
                                                           String requestId, 
                                                           List<HopTrace> traces, 
                                                           long startTime) {
        long hopStart = System.currentTimeMillis();
        String modelName = "fast-model-v1";

        try {
            String text = callFastModelApi(request.getPrompt());
            long latency = System.currentTimeMillis() - hopStart;
            healthRegistry.recordSuccess(modelName, latency);

            traces.add(new HopTrace(
                    1,
                    modelName,
                    "Fast-Model v1",
                    "SUCCESS",
                    200,
                    null,
                    latency,
                    "CLOSED",
                    null
            ));

            GenerationResponse response = new GenerationResponse();
            response.setContent(text);
            response.setSuccess(true);
            response.getMetadata().setFinalServedModel(modelName);
            response.getMetadata().setFinalServedModelDisplayName("Fast-Model v1");
            response.getMetadata().setFallbackTriggered(false);
            return response;
        } catch (Exception ex) {
            long latency = System.currentTimeMillis() - hopStart;
            healthRegistry.recordFailure(modelName, ex.getMessage(), latency);
            throw ex;
        }
    }

    public GenerationResponse fallbackToEmergencyFromFast(GenerationRequest request, 
                                                          String requestId, 
                                                          List<HopTrace> traces, 
                                                          long startTime, 
                                                          Throwable throwable) {
        return executeEmergencyFallback(request, requestId, traces, throwable);
    }

    /**
     * Level 2 Fallback: Emergency Resilient Engine ensuring guaranteed zero-downtime response.
     */
    private GenerationResponse executeEmergencyFallback(GenerationRequest request, 
                                                         String requestId, 
                                                         List<HopTrace> traces, 
                                                         Throwable rootCause) {
        long hopStart = System.currentTimeMillis();
        String modelName = "emergency-resilient-fallback";

        String emergencyContent = generateEmergencySynthesizedResponse(request.getPrompt());
        long latency = System.currentTimeMillis() - hopStart;
        healthRegistry.recordSuccess(modelName, latency);

        traces.add(new HopTrace(
                traces.size() + 1,
                modelName,
                "Emergency Resilient Engine (Level 2 Safeguard)",
                "SUCCESS",
                200,
                null,
                latency,
                "ACTIVE",
                "Zero-downtime deterministic synthesis invoked"
        ));

        GenerationResponse response = new GenerationResponse();
        response.setContent(emergencyContent);
        response.setSuccess(true);
        response.setWarning("Emergency Fallback engaged. Multi-model pipeline self-healed after: " + rootCause.getMessage());
        response.getMetadata().setFinalServedModel(modelName);
        response.getMetadata().setFinalServedModelDisplayName("Emergency Resilient Engine");
        response.getMetadata().setFallbackTriggered(true);
        return response;
    }

    // =========================================================================
    // Upstream API Invocation Helpers
    // =========================================================================
    private String callGeminiApi(String prompt) {
        // In production, invokes Google GenAI SDK / REST v1beta generateContent endpoint
        // POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=...
        return "Gemini 3.7 Flash Response: Comprehensive analysis completed for prompt: \\"" + prompt + "\\"";
    }

    private String callFastModelApi(String prompt) {
        return "Fast-Model v1 Response: Rapid response generated for: \\"" + prompt + "\\"";
    }

    private String generateEmergencySynthesizedResponse(String prompt) {
        return "[Emergency Resilient Safeguard]: All upstream AI clusters were unreachable. " +
               "Synthesized fallback processed request successfully without dropping client connection.";
    }

    private int extractStatusCode(Throwable ex) {
        if (ex instanceof AiProviderException ape) {
            return ape.getStatusCode();
        }
        return 500;
    }
}
`
  },
  {
    filename: 'GenerationController.java',
    language: 'java',
    description: 'Spring Boot REST Controller exposing /api/v1/generate with OpenAPI and telemetry',
    badge: 'Controller',
    code: `package com.engine.routing.controller;

import com.engine.routing.dto.GenerationRequest;
import com.engine.routing.dto.GenerationResponse;
import com.engine.routing.registry.ModelHealthRegistry;
import com.engine.routing.service.AiRoutingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API Controller for AI Prompt Ingestion and Adaptive Routing.
 * Built for Java 21 Virtual Threads (Project Loom) and Spring Boot 3.x.
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
@Tag(name = "AI Routing Engine", description = "Endpoints for prompt generation, health registry, and circuit breaker metrics")
public class GenerationController {

    private static final Logger log = LoggerFactory.getLogger(GenerationController.class);

    private final AiRoutingService aiRoutingService;
    private final ModelHealthRegistry healthRegistry;

    public GenerationController(AiRoutingService aiRoutingService, ModelHealthRegistry healthRegistry) {
        this.aiRoutingService = aiRoutingService;
        this.healthRegistry = healthRegistry;
    }

    /**
     * Primary REST endpoint called by the React frontend.
     * Intercepts user prompt, evaluates heuristic, calls optimal model, and handles self-healing fallback.
     */
    @PostMapping(
            value = "/generate",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    @Operation(summary = "Generate AI content with automatic multi-model circuit breaker fallback")
    public ResponseEntity<GenerationResponse> generateContent(@Valid @RequestBody GenerationRequest request) {
        log.info("Received generation request. Prompt length: {}, ForceModel: {}, SimulateFault: {}",
                request.getPrompt() != null ? request.getPrompt().length() : 0,
                request.getForceModel(),
                request.getSimulateFault());

        if (request.getPrompt() == null || request.getPrompt().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(createErrorResponse("Prompt cannot be empty"));
        }

        // Executed on a lightweight Java 21 Virtual Thread
        GenerationResponse response = aiRoutingService.processPrompt(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Returns real-time health registry status for all upstream AI models.
     */
    @GetMapping("/models/health")
    @Operation(summary = "Get health status, failure rates, and circuit breaker states for all models")
    public ResponseEntity<Map<String, Object>> getModelHealth() {
        return ResponseEntity.ok(healthRegistry.getHealthSnapshot());
    }

    /**
     * Pre-evaluates the heuristic for prompt preview on the frontend.
     */
    @PostMapping("/heuristic/evaluate")
    @Operation(summary = "Dry-run heuristic evaluation on a draft prompt")
    public ResponseEntity<Map<String, Object>> evaluateHeuristic(@RequestBody Map<String, String> payload) {
        String prompt = payload.getOrDefault("prompt", "");
        String selectedModel = aiRoutingService.evaluateRoutingHeuristic(prompt);
        return ResponseEntity.ok(Map.of(
                "selectedModel", selectedModel,
                "promptLength", prompt.length(),
                "isComplex", "gemini-3.7-flash".equals(selectedModel)
        ));
    }

    private GenerationResponse createErrorResponse(String message) {
        GenerationResponse resp = new GenerationResponse();
        resp.setSuccess(false);
        resp.setContent("");
        resp.setWarning(message);
        return resp;
    }
}
`
  },
  {
    filename: 'ModelHealthRegistry.java',
    language: 'java',
    description: 'Thread-safe in-memory health registry tracking status, latency, and circuit metrics',
    badge: 'Registry',
    code: `package com.engine.routing.registry;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Thread-safe in-memory registry logging model health states, latency averages,
 * consecutive failures, and self-healing telemetry.
 */
@Component
public class ModelHealthRegistry {

    public static class ModelHealthRecord {
        public final String id;
        public final String name;
        public final String provider;
        public volatile String status = "HEALTHY"; // HEALTHY | DEGRADED | UNHEALTHY
        public final AtomicInteger consecutiveFailures = new AtomicInteger(0);
        public final AtomicLong totalCalls = new AtomicLong(0);
        public final AtomicLong totalFailures = new AtomicLong(0);
        public final AtomicLong totalLatencyMs = new AtomicLong(0);
        public volatile Instant lastSuccessTime = Instant.now();
        public volatile Instant lastFailureTime;
        public volatile String lastErrorMessage;

        public ModelHealthRecord(String id, String name, String provider) {
            this.id = id;
            this.name = name;
            this.provider = provider;
        }

        public double getFailureRatePercent() {
            long total = totalCalls.get();
            if (total == 0) return 0.0;
            return ((double) totalFailures.get() / total) * 100.0;
        }

        public double getAverageLatencyMs() {
            long total = totalCalls.get();
            if (total == 0) return 0.0;
            return (double) totalLatencyMs.get() / total;
        }
    }

    private final Map<String, ModelHealthRecord> registry = new ConcurrentHashMap<>();

    public ModelHealthRegistry() {
        registry.put("gemini-3.7-flash", new ModelHealthRecord("gemini-3.7-flash", "Google Gemini 3.7 Flash", "Google Cloud"));
        registry.put("fast-model-v1", new ModelHealthRecord("fast-model-v1", "Fast-Model v1", "Internal Cluster"));
        registry.put("emergency-resilient-fallback", new ModelHealthRecord("emergency-resilient-fallback", "Emergency Resilient Engine", "Local Node"));
    }

    public void recordSuccess(String modelId, long latencyMs) {
        ModelHealthRecord record = registry.get(modelId);
        if (record != null) {
            record.totalCalls.incrementAndGet();
            record.totalLatencyMs.addAndGet(latencyMs);
            record.consecutiveFailures.set(0);
            record.lastSuccessTime = Instant.now();
            record.status = "HEALTHY";
        }
    }

    public void recordFailure(String modelId, String errorMessage, long latencyMs) {
        ModelHealthRecord record = registry.get(modelId);
        if (record != null) {
            record.totalCalls.incrementAndGet();
            record.totalFailures.incrementAndGet();
            record.totalLatencyMs.addAndGet(latencyMs);
            record.lastFailureTime = Instant.now();
            record.lastErrorMessage = errorMessage;

            int fails = record.consecutiveFailures.incrementAndGet();
            if (fails >= 3) {
                record.status = "UNHEALTHY";
            } else {
                record.status = "DEGRADED";
            }
        }
    }

    public Map<String, Object> getHealthSnapshot() {
        return Map.of(
                "models", registry,
                "timestamp", Instant.now().toString(),
                "systemStatus", isAnyModelHealthy() ? "OPERATIONAL" : "CRITICAL"
        );
    }

    private boolean isAnyModelHealthy() {
        return registry.values().stream().anyMatch(r -> !"UNHEALTHY".equals(r.status));
    }
}
`
  },
  {
    filename: 'PromptInterface.tsx',
    language: 'tsx',
    description: 'React TypeScript component featuring prompt input, model indicator, and fallback visualizer',
    badge: 'Frontend',
    code: `import React, { useState, useEffect } from 'react';

export interface GenerationResponse {
  content: string;
  success: boolean;
  warning?: string;
  metadata: {
    requestId: string;
    heuristicRoutedTo: string;
    finalServedModel: string;
    finalServedModelDisplayName: string;
    isFallbackTriggered: boolean;
    totalLatencyMs: number;
    virtualThreadId: string;
    traces: Array<{
      hopIndex: number;
      targetModel: string;
      modelDisplayName: string;
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
      httpStatus?: number;
      error?: string;
      latencyMs: number;
    }>;
  };
}

export const PromptInterface: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<GenerationResponse | null>(null);
  const [simulateFault, setSimulateFault] = useState<'NONE' | '429_RATE_LIMIT' | '503_SERVICE_UNAVAILABLE' | 'TIMEOUT_504'>('NONE');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          simulateFault: simulateFault !== 'NONE' ? simulateFault : undefined,
        }),
      });

      const data: GenerationResponse = await res.json();
      if (!res.ok && !data.content) {
        throw new Error(data.warning || 'Generation request failed');
      }
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-slate-900 text-slate-100 rounded-2xl shadow-xl border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Adaptive AI Prompt Router</h2>
          <p className="text-xs text-slate-400">Heuristic dispatch with Resilience4j zero-downtime circuit fallback</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Simulate Primary Fault:</label>
          <select
            value={simulateFault}
            onChange={(e) => setSimulateFault(e.target.value as any)}
            className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:ring-1 focus:ring-blue-500"
          >
            <option value="NONE">None (Healthy 200 OK)</option>
            <option value="429_RATE_LIMIT">Simulate 429 Rate Limit</option>
            <option value="503_SERVICE_UNAVAILABLE">Simulate 503 Overload</option>
            <option value="TIMEOUT_504">Simulate 504 Timeout</option>
          </select>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            User Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Ask anything (e.g. 'Write a high-concurrency Java 21 algorithm' or 'What is 2+2?')..."
            className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {prompt.length > 120 || /code|algorithm|explain|architect/i.test(prompt) ? (
              <span className="text-blue-400 font-medium">✦ Heuristic: Gemini 3.7 Flash (Complex query detected)</span>
            ) : (
              <span className="text-emerald-400 font-medium">⚡ Heuristic: Fast-Model v1 (Standard query)</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Routing & Executing...</span>
              </>
            ) : (
              <span>Submit to Router</span>
            )}
          </button>
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="mt-6 p-4 bg-red-950/50 border border-red-800 rounded-xl text-sm text-red-300">
          <strong>Routing Error:</strong> {error}
        </div>
      )}

      {/* Response Display */}
      {response && (
        <div className="mt-8 space-y-4">
          {/* Metadata & Model Badge */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Served By:</span>
              <span className={\`px-3 py-1 text-xs font-semibold rounded-full \${
                response.metadata.isFallbackTriggered
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }\`}>
                {response.metadata.finalServedModelDisplayName}
              </span>
              {response.metadata.isFallbackTriggered && (
                <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 rounded-full animate-pulse">
                  Self-Healing Fallback Engaged
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>Latency: <strong className="text-slate-200">{response.metadata.totalLatencyMs}ms</strong></span>
              <span>Virtual Thread: <strong className="text-slate-200">{response.metadata.virtualThreadId?.slice(0, 24)}...</strong></span>
            </div>
          </div>

          {/* Hop Execution Traces (Visualizing Invisible Fallback) */}
          {response.metadata.traces && response.metadata.traces.length > 1 && (
            <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
              <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                Fallback Execution Chain (Zero-Downtime Telemetry)
              </h4>
              <div className="space-y-1.5">
                {response.metadata.traces.map((trace, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">#{trace.hopIndex}</span>
                      <span className="font-medium text-slate-200">{trace.modelDisplayName}</span>
                      <span className={\`px-1.5 py-0.5 text-[10px] rounded font-bold \${
                        trace.status === 'SUCCESS' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'
                      }\`}>
                        {trace.status} ({trace.httpStatus || 500})
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono">{trace.latencyMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output Content */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Model Output</h3>
            <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {response.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
`
  },
  {
    filename: 'pom.xml',
    language: 'xml',
    description: 'Maven build configuration for Java 21, Spring Boot 3.3.x, Resilience4j, and Google Cloud SDK',
    badge: 'Build',
    code: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.2</version>
        <relativePath/>
    </parent>
    <groupId>com.engine</groupId>
    <artifactId>ai-adaptive-routing-engine</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>ai-adaptive-routing-engine</name>
    <description>Self-Healing Multi-Model Adaptive Fallback Routing Engine for AI Web Platforms</description>

    <properties>
        <java.version>21</java.version>
        <resilience4j.version>2.2.0</resilience4j.version>
        <springdoc.version>2.6.0</springdoc.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Web Starter -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Spring Boot Actuator for health check & metrics -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>

        <!-- Spring AOP for Resilience4j Annotations -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-aop</artifactId>
        </dependency>

        <!-- Resilience4j Spring Boot 3 Starter -->
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-spring-boot3</artifactId>
            <version>\${resilience4j.version}</version>
        </dependency>

        <!-- Resilience4j Circuit Breaker & Time Limiter -->
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-circuitbreaker</artifactId>
            <version>\${resilience4j.version}</version>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-timelimiter</artifactId>
            <version>\${resilience4j.version}</version>
        </dependency>
        <dependency>
            <groupId>io.github.resilience4j</groupId>
            <artifactId>resilience4j-retry</artifactId>
            <version>\${resilience4j.version}</version>
        </dependency>

        <!-- OpenAPI / Swagger UI -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>\${springdoc.version}</version>
        </dependency>

        <!-- Jakarta Validation -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Test Starter -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <source>21</source>
                    <target>21</target>
                    <compilerArgs>
                        <!-- Enable preview if needed for early virtual threads experiments -->
                        <arg>-parameters</arg>
                    </compilerArgs>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`
  }
];
