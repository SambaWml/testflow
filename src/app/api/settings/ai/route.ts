import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAIConfig, saveAIConfig, maskKey } from "@/lib/ai-config";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { isSuperAdmin?: boolean };
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    claude: {
      configured: !!config.claude.apiKey,
      maskedKey: maskKey(config.claude.apiKey),
      model: config.claude.model,
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { isSuperAdmin?: boolean };
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  await saveAIConfig(body);
  return NextResponse.json({ ok: true });
}
