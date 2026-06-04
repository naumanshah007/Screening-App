/**
 * AI provider abstraction for CerviGrade.
 *
 * Why this exists:
 * Patient clinical summaries contain identifiable health information.
 * Under the NZ Health Information Privacy Code 2020 and Te Whatu Ora data
 * governance requirements, this data MUST NOT leave the hospital's network.
 *
 * This module provides a provider-agnostic interface so the AI grading assist
 * can run against a LOCAL Ollama instance (on-premises, no internet) without
 * any code changes to the grading pipeline.
 *
 * Supported providers (set via AI_PROVIDER env var):
 *   "ollama"     — Local Ollama server (RECOMMENDED for hospital deployment)
 *   "anthropic"  — Anthropic Claude API (development / evaluation only — NOT for production with patient data)
 *   "stub"       — Deterministic fake output (testing / demo when no AI server is available)
 *
 * Default behaviour:
 *   If AI_PROVIDER is not set, uses Ollama when OLLAMA_BASE_URL is set, otherwise stub.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiInferenceRequest = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
};

export type AiInferenceResult =
  | { ok: true; rawText: string; modelName: string; providerName: string }
  | { ok: false; error: string; code: "UNAVAILABLE" | "CONFIG_MISSING" | "TIMEOUT" | "PARSE_ERROR" };

export interface AiProvider {
  /** Human-readable provider name (stored in AIRecommendation.modelVersion) */
  readonly providerName: string;
  /** Model identifier (stored in AIRecommendation.modelName) */
  readonly modelName: string;
  /** Whether this is a stub / no real inference happens */
  readonly isStub: boolean;
  /** Run inference and return the raw text response */
  infer(request: AiInferenceRequest): Promise<AiInferenceResult>;
}

// ─── Ollama Provider ──────────────────────────────────────────────────────────

/**
 * Calls a locally-hosted Ollama instance.
 *
 * Ollama runs entirely on-premises. Patient data never leaves the server.
 * Data sovereignty: ✅ compliant with NZ Health Information Privacy Code 2020.
 *
 * Setup:
 *   curl -fsSL https://ollama.com/install.sh | sh
 *   ollama pull mistral:7b-instruct
 *   OLLAMA_BASE_URL=http://localhost:11434 OLLAMA_MODEL=mistral:7b-instruct
 *
 * Air-gapped deployment:
 *   Download model on internet-connected machine → copy ~/.ollama to air-gapped server.
 */
class OllamaProvider implements AiProvider {
  readonly providerName = "ollama";
  readonly isStub = false;

  get modelName(): string {
    return process.env.OLLAMA_MODEL ?? "mistral:7b-instruct";
  }

  private get baseUrl(): string {
    return (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
  }

  async infer(req: AiInferenceRequest): Promise<AiInferenceResult> {
    const { systemPrompt, userPrompt, maxTokens = 1024 } = req;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.modelName,
          system: systemPrompt,
          prompt: userPrompt,
          format: "json",    // Ollama enforces valid JSON output in this mode
          stream: false,
          options: {
            temperature: 0.1,   // Low temperature → more deterministic clinical output
            num_predict: maxTokens,
          },
        }),
        // 60 second timeout — local inference is slower than cloud APIs
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          ok: false,
          error: `Ollama returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
          code: "UNAVAILABLE",
        };
      }

      // Ollama non-streaming response: { model, response, done, ... }
      const data = (await response.json()) as { response?: string; done?: boolean };

      if (!data.response) {
        return { ok: false, error: "Ollama returned empty response", code: "PARSE_ERROR" };
      }

      return {
        ok: true,
        rawText: data.response,
        modelName: this.modelName,
        providerName: this.providerName,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return {
          ok: false,
          error: `Ollama inference timed out after 60 seconds. Model may still be loading — try again in a moment.`,
          code: "TIMEOUT",
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      // "ECONNREFUSED" or "fetch failed" means Ollama isn't running
      if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
        return {
          ok: false,
          error: `Cannot reach Ollama at ${this.baseUrl}. Ensure Ollama is running: \`ollama serve\``,
          code: "UNAVAILABLE",
        };
      }
      return { ok: false, error: message, code: "UNAVAILABLE" };
    }
  }
}

// ─── Anthropic Provider ───────────────────────────────────────────────────────

/**
 * Calls the Anthropic Claude API.
 *
 * ⚠️  WARNING: This provider sends data to Anthropic's cloud servers.
 * DO NOT use with real patient data in production.
 * Permitted uses: development, evaluation on synthetic/anonymised data.
 *
 * Set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY in .env.local for dev.
 */
class AnthropicProvider implements AiProvider {
  readonly providerName = "anthropic";
  readonly modelName = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  readonly isStub = false;

  async infer(req: AiInferenceRequest): Promise<AiInferenceResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error: "ANTHROPIC_API_KEY is not set. Set AI_PROVIDER=ollama for on-premises inference.",
        code: "CONFIG_MISSING",
      };
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: req.maxTokens ?? 1024,
          system: req.systemPrompt,
          messages: [{ role: "user", content: req.userPrompt }],
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          ok: false,
          error: `Anthropic API error ${response.status}: ${detail.slice(0, 200)}`,
          code: "UNAVAILABLE",
        };
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      const rawText = data.content.find((b) => b.type === "text")?.text ?? "";

      if (!rawText) {
        return { ok: false, error: "Anthropic returned empty content", code: "PARSE_ERROR" };
      }

      return {
        ok: true,
        rawText,
        modelName: this.modelName,
        providerName: this.providerName,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return { ok: false, error: "Anthropic API request timed out", code: "TIMEOUT" };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        code: "UNAVAILABLE",
      };
    }
  }
}

// ─── Stub Provider ────────────────────────────────────────────────────────────

/**
 * Returns a deterministic fake recommendation.
 * Used when no AI provider is configured — prevents crashes in demo/test environments.
 * Always includes a clear "STUB" marker so graders know it's not a real recommendation.
 */
class StubProvider implements AiProvider {
  readonly providerName = "stub";
  readonly modelName = "stub";
  readonly isStub = true;

  async infer(): Promise<AiInferenceResult> {
    // Deterministic: return a valid JSON string that matches GradingOutput schema
    const stub = {
      suggestedPriority: "INFO_REQUIRED",
      suggestedCategory: "Stub mode — no AI provider configured",
      suggestedOutcome: "Configure AI_PROVIDER=ollama and start Ollama to enable AI grading assist.",
      rationale:
        "This is a stub response. No real AI inference was performed. " +
        "The deterministic rule engine recommendation above is the clinically validated guidance.",
      confidence: 0,
      citations: [],
      concordantWithRule: true,
      reasoning:
        "Stub mode active. Set AI_PROVIDER=ollama and OLLAMA_BASE_URL=http://localhost:11434 " +
        "to enable local on-premises AI inference. No patient data will leave the hospital network.",
    };
    return {
      ok: true,
      rawText: JSON.stringify(stub),
      modelName: this.modelName,
      providerName: this.providerName,
    };
  }
}

// ─── Factory & Singleton ──────────────────────────────────────────────────────

function createAiProvider(): AiProvider {
  const providerType = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();

  if (providerType === "anthropic") {
    return new AnthropicProvider();
  }

  if (providerType === "stub") {
    return new StubProvider();
  }

  // "ollama" (explicit) or default: use Ollama when base URL is configured
  if (providerType === "ollama" || process.env.OLLAMA_BASE_URL) {
    return new OllamaProvider();
  }

  // Nothing configured — fall back to stub so the app doesn't crash
  return new StubProvider();
}

/** Singleton AI provider — initialised once per process from environment variables. */
export const aiProvider: AiProvider = createAiProvider();

/** Returns a status object suitable for health-check endpoints */
export function getAiProviderStatus(): {
  provider: string;
  model: string;
  isStub: boolean;
  ollamaBaseUrl: string | null;
} {
  return {
    provider: aiProvider.providerName,
    model: aiProvider.modelName,
    isStub: aiProvider.isStub,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? null,
  };
}
