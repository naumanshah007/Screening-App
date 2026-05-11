/**
 * GET /api/ai/health
 *
 * Returns the health and configuration status of the configured AI provider.
 * Does NOT send any patient data — only pings the model server to check connectivity.
 *
 * Used by the AiAssistButton to show a connectivity indicator before the grader
 * clicks "Run AI Assist", avoiding a confusing timeout mid-workflow.
 *
 * Response shape:
 * {
 *   provider: "ollama" | "anthropic" | "stub"
 *   model: "mistral:7b-instruct" | ...
 *   isStub: boolean
 *   healthy: boolean
 *   latencyMs: number | null
 *   message: string
 *   ollamaBaseUrl: string | null
 * }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getApiPermissionError } from "@/lib/auth/api-permissions";
import { getAiProviderStatus, aiProvider } from "@/lib/ai/provider";

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const permissionError = getApiPermissionError(user, "ai:recommend");
  if (permissionError) {
    return NextResponse.json(permissionError.body, { status: permissionError.status });
  }

  const status = getAiProviderStatus();

  // Stub — healthy by definition (it never fails), but not real AI
  if (status.isStub) {
    return NextResponse.json({
      ...status,
      healthy: true,
      latencyMs: null,
      message:
        "Stub mode — no AI provider configured. " +
        "Set AI_PROVIDER=ollama and OLLAMA_BASE_URL=http://localhost:11434 to enable local inference.",
    });
  }

  // For Ollama: ping the /api/tags endpoint to check connectivity without inference cost
  if (status.provider === "ollama") {
    const ollamaBase = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
    const t0 = Date.now();

    try {
      const res = await fetch(`${ollamaBase}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: "application/json" },
      });
      const latencyMs = Date.now() - t0;

      if (!res.ok) {
        return NextResponse.json({
          ...status,
          healthy: false,
          latencyMs,
          message: `Ollama returned HTTP ${res.status}. Check that Ollama is running.`,
        });
      }

      // Check if the required model is pulled
      type TagsResponse = { models?: Array<{ name: string }> };
      const tags = (await res.json()) as TagsResponse;
      const pulledModels = tags.models?.map((m) => m.name) ?? [];
      const modelName = aiProvider.modelName;
      const modelPulled = pulledModels.some(
        (n) => n === modelName || n.startsWith(modelName.split(":")[0])
      );

      return NextResponse.json({
        ...status,
        healthy: true,
        latencyMs,
        modelPulled,
        pulledModels,
        message: modelPulled
          ? `Ollama is running and model ${modelName} is ready.`
          : `Ollama is running but model ${modelName} is not pulled. Run: ollama pull ${modelName}`,
      });
    } catch (err) {
      const latencyMs = Date.now() - t0;
      const message = err instanceof Error ? err.message : String(err);
      const isConnRefused =
        message.includes("ECONNREFUSED") || message.includes("fetch failed");
      return NextResponse.json({
        ...status,
        healthy: false,
        latencyMs,
        message: isConnRefused
          ? `Cannot connect to Ollama at ${ollamaBase}. Run: ollama serve`
          : `Ollama health check failed: ${message}`,
      });
    }
  }

  // For Anthropic: just check the API key is set (don't make an API call — costs money)
  if (status.provider === "anthropic") {
    const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
    return NextResponse.json({
      ...status,
      healthy: hasKey,
      latencyMs: null,
      message: hasKey
        ? "Anthropic API key is configured. Note: patient data will be sent to Anthropic's cloud."
        : "ANTHROPIC_API_KEY is not set. Set AI_PROVIDER=ollama for on-premises inference.",
    });
  }

  return NextResponse.json({
    ...status,
    healthy: false,
    latencyMs: null,
    message: "Unknown provider configuration.",
  });
}
