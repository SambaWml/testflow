import { NextResponse } from "next/server";
import { getAIConfig, saveAIConfig, maskKey } from "@/lib/ai-config";

export async function GET() {
  const config = await getAIConfig();
  return NextResponse.json({
    activeProvider: config.activeProvider,
    openai: {
      configured: !!config.openai.apiKey,
      maskedKey: maskKey(config.openai.apiKey),
      model: config.openai.model,
    },
    manus: {
      configured: !!config.manus.apiKey,
      maskedKey: maskKey(config.manus.apiKey),
      baseUrl: config.manus.baseUrl,
      model: config.manus.model,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  await saveAIConfig(body);
  return NextResponse.json({ ok: true });
}
