import { NextResponse } from "next/server";

export async function GET() {
  const ollamaUrl = process.env.OLLAMA_URL;
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";
  const openaiKey = process.env.OPENAI_API_KEY;
  const manusKey = process.env.MANUS_API_KEY;
  const manusModel = process.env.MANUS_MODEL ?? "claude-sonnet-4-5";

  if (manusKey) {
    return NextResponse.json({
      provider: "manus",
      status: "configured",
      model: manusModel,
      url: process.env.MANUS_BASE_URL,
    });
  }

  // Check Ollama
  if (ollamaUrl) {
    try {
      const res = await fetch(`${ollamaUrl.replace(/\/$/, "")}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        const models: string[] = (data.models ?? []).map((m: { name: string }) => m.name);
        const modelAvailable = models.some((m) => m.startsWith(ollamaModel.split(":")[0]));
        return NextResponse.json({
          provider: "ollama",
          status: "online",
          url: ollamaUrl,
          model: ollamaModel,
          modelAvailable,
          availableModels: models,
        });
      }
    } catch {
      return NextResponse.json({
        provider: "ollama",
        status: "offline",
        url: ollamaUrl,
        model: ollamaModel,
        error: "Ollama não está acessível em " + ollamaUrl,
      });
    }
  }

  if (openaiKey) {
    return NextResponse.json({
      provider: "openai",
      status: "configured",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
    });
  }

  return NextResponse.json({ provider: "mock", status: "mock" });
}
