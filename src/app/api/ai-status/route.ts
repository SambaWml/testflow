import { NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai-config";

export async function GET() {
  const config = await getAIConfig();
  const { activeProvider, openai, manus } = config;

  if (activeProvider === "manus" && manus.apiKey) {
    return NextResponse.json({
      provider: "manus",
      status: "configured",
      model: manus.model,
      url: manus.baseUrl,
    });
  }

  if (activeProvider === "openai" && openai.apiKey) {
    return NextResponse.json({
      provider: "openai",
      status: "configured",
      model: openai.model,
    });
  }

  return NextResponse.json({ provider: "mock", status: "mock" });
}
