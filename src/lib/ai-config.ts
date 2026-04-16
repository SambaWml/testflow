import { prisma } from "@/lib/prisma";

const SETTING_KEY = "ai_provider_config";

export interface AIProviderConfig {
  activeProvider: "openai" | "manus" | "claude" | "none";
  openai: { apiKey: string; model: string };
  manus: { apiKey: string; baseUrl: string; model: string };
  claude: { apiKey: string; model: string };
}

const DEFAULTS: AIProviderConfig = {
  activeProvider: "none",
  openai: { apiKey: "", model: "gpt-4o" },
  manus: { apiKey: "", baseUrl: "https://api.manus.ai", model: "claude-sonnet-4-5" },
  claude: { apiKey: "", model: "claude-sonnet-4-6" },
};

export async function getAIConfig(): Promise<AIProviderConfig> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value) as AIProviderConfig;
      return {
        ...DEFAULTS,
        ...parsed,
        openai: { ...DEFAULTS.openai, ...parsed.openai },
        manus: { ...DEFAULTS.manus, ...parsed.manus },
        claude: { ...DEFAULTS.claude, ...parsed.claude },
      };
    } catch { /* ignore */ }
  }

  // Fall back to env vars
  const manusKey = process.env.MANUS_API_KEY ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const claudeKey = process.env.ANTHROPIC_API_KEY ?? "";

  return {
    activeProvider: claudeKey ? "claude" : manusKey ? "manus" : openaiKey ? "openai" : "none",
    openai: { apiKey: openaiKey, model: process.env.OPENAI_MODEL ?? "gpt-4o" },
    manus: {
      apiKey: manusKey,
      baseUrl: process.env.MANUS_BASE_URL ?? "https://api.manus.ai",
      model: process.env.MANUS_MODEL ?? "claude-sonnet-4-5",
    },
    claude: {
      apiKey: claudeKey,
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    },
  };
}

export async function saveAIConfig(patch: Partial<AIProviderConfig>): Promise<void> {
  const current = await getAIConfig();
  const next: AIProviderConfig = {
    activeProvider: patch.activeProvider ?? current.activeProvider,
    openai: { ...current.openai, ...patch.openai },
    manus: { ...current.manus, ...patch.manus },
    claude: { ...current.claude, ...patch.claude },
  };

  // Never overwrite a saved key with an empty string
  if (!patch.openai?.apiKey) next.openai.apiKey = current.openai.apiKey;
  if (!patch.manus?.apiKey) next.manus.apiKey = current.manus.apiKey;
  if (!patch.claude?.apiKey) next.claude.apiKey = current.claude.apiKey;

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
