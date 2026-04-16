"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cpu, Check, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AIConfig = {
  activeProvider: "openai" | "manus" | "claude" | "none";
  openai: { configured: boolean; maskedKey: string; model: string };
  manus: { configured: boolean; maskedKey: string; baseUrl: string; model: string };
  claude: { configured: boolean; maskedKey: string; model: string };
};

const CLAUDE_MODELS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6 (mais poderoso)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (recomendado)" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (mais rápido)" },
];

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o (recomendado)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (mais rápido)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
];

function KeyInput({
  id, placeholder, value, onChange,
}: { id: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10 font-mono text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AdminAIPage() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");
  const [manusKey, setManusKey] = useState("");
  const [manusBaseUrl, setManusBaseUrl] = useState("https://api.manus.ai");
  const [claudeKey, setClaudeKey] = useState("");
  const [claudeModel, setClaudeModel] = useState("claude-sonnet-4-6");
  const [activeProvider, setActiveProvider] = useState<"openai" | "manus" | "claude" | "none">("none");

  const { data: config, isLoading } = useQuery<AIConfig>({
    queryKey: ["ai-config"],
    queryFn: (): Promise<AIConfig> => fetch("/api/settings/ai").then((r) => r.json()),
  });

  useEffect(() => {
    if (!config) return;
    setActiveProvider(config.activeProvider);
    setOpenaiModel(config.openai.model);
    setManusBaseUrl(config.manus.baseUrl);
    setClaudeModel(config.claude.model);
  }, [config]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/settings/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-config"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSave() {
    save({
      activeProvider,
      openai: { apiKey: openaiKey, model: openaiModel },
      manus: { apiKey: manusKey, baseUrl: manusBaseUrl, model: "claude-sonnet-4-5" },
      claude: { apiKey: claudeKey, model: claudeModel },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const providers = [
    {
      id: "claude" as const,
      name: "Claude (Anthropic)",
      description: "Modelos Claude Opus, Sonnet e Haiku. Alta qualidade para geração de casos de teste.",
      badge: "Recomendado",
      badgeVariant: "default" as const,
      configured: config?.claude.configured,
      maskedKey: config?.claude.maskedKey,
      fields: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="claudeKey">API Key</Label>
            <KeyInput
              id="claudeKey"
              placeholder={config?.claude.configured ? config.claude.maskedKey : "sk-ant-..."}
              value={claudeKey}
              onChange={setClaudeKey}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Obtenha em{" "}
              <span className="font-mono">console.anthropic.com</span>
            </p>
          </div>
          <div>
            <Label htmlFor="claudeModel">Modelo</Label>
            <Select value={claudeModel} onValueChange={setClaudeModel}>
              <SelectTrigger id="claudeModel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAUDE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      id: "openai" as const,
      name: "OpenAI",
      description: "Modelos GPT-4o e GPT-4 Turbo. Compatível com qualquer provider OpenAI-compatible.",
      badge: null,
      badgeVariant: "secondary" as const,
      configured: config?.openai.configured,
      maskedKey: config?.openai.maskedKey,
      fields: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="openaiKey">API Key</Label>
            <KeyInput
              id="openaiKey"
              placeholder={config?.openai.configured ? config.openai.maskedKey : "sk-..."}
              value={openaiKey}
              onChange={setOpenaiKey}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Obtenha em <span className="font-mono">platform.openai.com</span>
            </p>
          </div>
          <div>
            <Label htmlFor="openaiModel">Modelo</Label>
            <Select value={openaiModel} onValueChange={setOpenaiModel}>
              <SelectTrigger id="openaiModel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPENAI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ),
    },
    {
      id: "manus" as const,
      name: "Manus IA",
      description: "Agente de IA com API assíncrona baseada em tarefas.",
      badge: null,
      badgeVariant: "secondary" as const,
      configured: config?.manus.configured,
      maskedKey: config?.manus.maskedKey,
      fields: (
        <div className="space-y-3">
          <div>
            <Label htmlFor="manusKey">API Key</Label>
            <KeyInput
              id="manusKey"
              placeholder={config?.manus.configured ? config.manus.maskedKey : "sk-..."}
              value={manusKey}
              onChange={setManusKey}
            />
          </div>
          <div>
            <Label htmlFor="manusUrl">Base URL</Label>
            <Input
              id="manusUrl"
              value={manusBaseUrl}
              onChange={(e) => setManusBaseUrl(e.target.value)}
              placeholder="https://api.manus.ai"
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Configuração de IA</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Escolha o provedor de IA e configure as credenciais. As chaves ficam armazenadas no banco de dados de forma segura.
        </p>
      </div>

      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Apenas um provedor pode estar ativo por vez. Selecione o card para ativá-lo.</span>
      </div>

      <div className="space-y-3">
        {providers.map((p) => {
          const isActive = activeProvider === p.id;
          return (
            <Card
              key={p.id}
              onClick={() => setActiveProvider(p.id)}
              className={`cursor-pointer transition-all ${
                isActive
                  ? "border-primary ring-1 ring-primary"
                  : "hover:border-muted-foreground/40"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isActive ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}>
                      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.badge && <Badge variant={p.badgeVariant}>{p.badge}</Badge>}
                    {p.configured && (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        <Check className="h-3 w-3 mr-1" />Configurado
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="ml-6">{p.description}</CardDescription>
              </CardHeader>
              {isActive && (
                <CardContent onClick={(e) => e.stopPropagation()}>
                  {p.fields}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Salvar configuração
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Salvo com sucesso
          </span>
        )}
      </div>
    </div>
  );
}
