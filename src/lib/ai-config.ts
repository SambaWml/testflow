import { prisma } from "@/lib/prisma";

const SETTING_KEY = "ai_provider_config";

export interface AIProviderConfig {
  activeProvider: "openai" | "manus" | "none";
  openai: { apiKey: string; model: string };
  manus: { apiKey: string; baseUrl: string; model: string };
}

const DEFAULTS: AIProviderConfig = {
  activeProvider: "none",
  openai: { apiKey: "", model: "gpt-4o" },
  manus: { apiKey: "", baseUrl: "https://api.manus.ai", model: "claude-sonnet-4-5" },
};

export async function getAIConfig(): Promise<AIProviderConfig> {
  // 1. Try DB
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value) as AIProviderConfig;
      return { ...DEFAULTS, ...parsed };
    } catch { /* ignore */ }
  }

  // 2. Fall back to env vars
  const manusKey = process.env.MANUS_API_KEY ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? "";

  return {
    activeProvider: manusKey ? "manus" : openaiKey ? "openai" : "none",
    openai: { apiKey: openaiKey, model: process.env.OPENAI_MODEL ?? "gpt-4o" },
    manus: {
      apiKey: manusKey,
      baseUrl: process.env.MANUS_BASE_URL ?? "https://api.manus.ai",
      model: process.env.MANUS_MODEL ?? "claude-sonnet-4-5",
    },
  };
}

export async function saveAIConfig(patch: Partial<AIProviderConfig>): Promise<void> {
  const current = await getAIConfig();
  const next: AIProviderConfig = {
    activeProvider: patch.activeProvider ?? current.activeProvider,
    openai: { ...current.openai, ...patch.openai },
    manus: { ...current.manus, ...patch.manus },
  };

  // Never overwrite a saved key with an empty string (user left field blank)
  if (!patch.openai?.apiKey) next.openai.apiKey = current.openai.apiKey;
  if (!patch.manus?.apiKey) next.manus.apiKey = current.manus.apiKey;

  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
}

/** Mask key for frontend: sk-abc...xyz → sk-••••xyz */
export function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? "••••••••" : "";
  return `${key.slice(0, 4)}${"•".repeat(8)}${key.slice(-4)}`;
}
