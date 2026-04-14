"use client";

import { useState, Suspense, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Bug, Loader2, Check, Trash2, ChevronRight, ChevronLeft, Save, RefreshCw,
  AlertCircle, Wifi, WifiOff, Bot, Settings, Sparkles, Brain,
  Search, Lightbulb, ShieldAlert, Zap,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GeneratedBug } from "@/app/api/bugs/generate/route";

const LANGUAGES = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "en",    label: "English" },
  { value: "es",    label: "Español" },
];

const BUG_CATEGORIES = [
  { value: "functional",    label: "Funcional",       icon: Bug },
  { value: "ui",            label: "Interface (UI)",   icon: Lightbulb },
  { value: "performance",   label: "Performance",      icon: Zap },
  { value: "security",      label: "Segurança",        icon: ShieldAlert },
  { value: "integration",   label: "Integração",       icon: Sparkles },
  { value: "data",          label: "Dados",            icon: Search },
  { value: "accessibility", label: "Acessibilidade",   icon: Brain },
];

const PRIORITY_OPTIONS = [
  { value: "mixed",    label: "Variado (automático)" },
  { value: "CRITICAL", label: "Crítica" },
  { value: "HIGH",     label: "Alta" },
  { value: "MEDIUM",   label: "Média" },
  { value: "LOW",      label: "Baixa" },
];

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH:     "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM:   "bg-amber-100 text-amber-800 border-amber-200",
  LOW:      "bg-green-100 text-green-800 border-green-200",
};

const GEN_MESSAGES = [
  { icon: Brain,      text: "Analisando a funcionalidade..." },
  { icon: Search,     text: "Identificando pontos de falha..." },
  { icon: Bug,        text: "Gerando relatórios de bug..." },
  { icon: ShieldAlert,text: "Verificando cenários de risco..." },
  { icon: Lightbulb,  text: "Formulando casos de borda..." },
  { icon: Sparkles,   text: "Finalizando os bugs..." },
];

function BugGeneratorContent() {
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [manualDesc, setManualDesc] = useState("");
  const [projectId, setProjectId] = useState("");
  const [language, setLanguage] = useState("pt-BR");
  const [priority, setPriority] = useState("mixed");
  const [bugCategory, setBugCategory] = useState("functional");

  const [generatedBugs, setGeneratedBugs] = useState<GeneratedBug[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<{ message: string; hint?: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!generating) { setElapsed(0); setMsgIdx(0); return; }
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    const rotate = setInterval(() => setMsgIdx((s) => (s + 1) % GEN_MESSAGES.length), 3500);
    return () => { clearInterval(timer); clearInterval(rotate); };
  }, [generating]);

  const { data: aiStatus } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => fetch("/api/ai-status").then((r) => r.json()),
    staleTime: 30_000,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects?activeOnly=true").then((r) => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (bugs: GeneratedBug[]) =>
      fetch("/api/bugs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          bugs: bugs.map((b) => ({
            title: b.title,
            description: b.description,
            priority: b.priority,
            acceptanceCriteria: b.stepsToReproduce,
            notes: [
              b.expectedResult ? `Resultado Esperado:\n${b.expectedResult}` : "",
              b.actualResult   ? `\nResultado Atual:\n${b.actualResult}` : "",
              b.affectedArea   ? `\nÁrea Afetada: ${b.affectedArea}` : "",
              b.notes          ? `\n\nObservações:\n${b.notes}` : "",
            ].join("").trim() || null,
          })),
        }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["bugs"] });
      setGeneratedBugs([]);
      setStep(1);
      alert(`${data.count} bug${data.count !== 1 ? "s" : ""} salvo${data.count !== 1 ? "s" : ""} com sucesso!`);
    },
  });

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/bugs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualDescription: manualDesc || undefined,
          quantity: 1, language, priority, bugCategory, projectId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.bugs) {
        setGeneratedBugs(data.bugs);
        setStep(3);
      } else {
        setGenError({ message: data.error || "Erro ao gerar bugs.", hint: data.hint });
      }
    } catch {
      setGenError({ message: "Erro de conexão com o servidor." });
    } finally {
      setGenerating(false);
    }
  }

  const updateBug = (i: number, field: keyof GeneratedBug, value: string) => {
    setGeneratedBugs((prev) => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  };

  const removeBug = (i: number) => setGeneratedBugs((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Gerador de Bugs IA"
        subtitle="Gere relatórios de bug detalhados com Inteligência Artificial"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/bugs">← Voltar para Bugs</Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* AI Status banner */}
        {aiStatus && (
          <div className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm mb-6",
            aiStatus.status === "online" || aiStatus.status === "configured"
              ? "bg-green-50 border-green-200 text-green-800"
              : aiStatus.status === "offline"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-yellow-50 border-yellow-200 text-yellow-800"
          )}>
            {aiStatus.status === "online" && <Wifi className="h-4 w-4 shrink-0" />}
            {aiStatus.status === "configured" && <Bot className="h-4 w-4 shrink-0" />}
            {aiStatus.status === "offline" && <WifiOff className="h-4 w-4 shrink-0" />}
            {aiStatus.status === "mock" && <AlertCircle className="h-4 w-4 shrink-0" />}
            <span className="flex-1">
              {aiStatus.status === "online" && `IA conectada — ${aiStatus.model}`}
              {aiStatus.status === "configured" && `${aiStatus.provider === "manus" ? "Manus IA" : "OpenAI"} configurado — ${aiStatus.model}`}
              {aiStatus.status === "offline" && `IA offline: ${aiStatus.url}`}
              {aiStatus.status === "mock" && "Nenhum provedor de IA configurado."}
            </span>
            {(aiStatus.status === "offline" || aiStatus.status === "mock") && (
              <Link href="/settings" className="flex items-center gap-1 font-medium underline underline-offset-2 shrink-0">
                <Settings className="h-3.5 w-3.5" /> Configurar
              </Link>
            )}
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: "Contexto" },
            { n: 2, label: "Configurar" },
            { n: 3, label: "Revisar bugs" },
          ].map(({ n, label }, idx) => (
            <div key={n} className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                step >= n ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              )}>
                {step > n ? <Check className="h-4 w-4" /> : n}
              </div>
              <span className={cn("text-sm", step === n ? "font-medium" : "text-muted-foreground")}>{label}</span>
              {idx < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Context ── */}
        {step === 1 && (
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Defina o contexto</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>Descrição da funcionalidade</Label>
                <Textarea
                  placeholder="Descreva detalhadamente a funcionalidade ou área do sistema para a qual deseja gerar bugs. Inclua comportamentos esperados, fluxos principais e regras de negócio..."
                  rows={5}
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Projeto *</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                  <SelectContent>
                    {(projects?.projects ?? []).map((p: { id: string; name: string }) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  if (!manualDesc.trim() || !projectId) {
                    alert("Forneça uma descrição e selecione um projeto.");
                    return;
                  }
                  setStep(2);
                }}
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Loading ── */}
        {generating && (
          <div className="flex flex-col items-center justify-center py-16 max-w-md mx-auto text-center">
            <div className="relative mb-8">
              <div className="h-24 w-24 rounded-full border-4 border-primary/20 animate-pulse" />
              <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                {(() => { const Icon = GEN_MESSAGES[msgIdx].icon; return <Icon className="h-9 w-9 text-primary" />; })()}
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Gerando relatórios de bug...</h2>
            <p key={msgIdx} className="text-sm text-muted-foreground mb-6 animate-pulse">
              {GEN_MESSAGES[msgIdx].text}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{Math.floor(elapsed / 60) > 0 ? `${Math.floor(elapsed / 60)}min ` : ""}{elapsed % 60}s aguardando...</span>
            </div>
            <div className="flex gap-1.5 mb-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-2 w-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Configure ── */}
        {step === 2 && !generating && (
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Configurar geração</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Language */}
                <div className="space-y-1.5">
                  <Label>Idioma do relatório</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="col-span-2 space-y-1.5">
                  <Label>Prioridade dos bugs</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Bug category */}
              <div className="space-y-2">
                <Label>Categoria de bugs</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BUG_CATEGORIES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBugCategory(value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all",
                        bugCategory === value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background hover:bg-accent border-border"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {genError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{genError.message}</p>
                  </div>
                  {genError.hint && <p className="text-xs text-red-600 pl-6">{genError.hint}</p>}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={generate}
                  disabled={generating || aiStatus?.status === "mock"}
                  title={aiStatus?.status === "mock" ? "Configure um provedor de IA primeiro" : undefined}
                >
                  {aiStatus?.status === "mock" ? (
                    <><AlertCircle className="h-4 w-4" /> Configure a IA</>
                  ) : (
                    <><Bug className="h-4 w-4" /> Gerar bug</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="space-y-4 max-w-3xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold">Bugs gerados</h2>
                <p className="text-sm text-muted-foreground">{generatedBugs.length} relatório{generatedBugs.length !== 1 ? "s" : ""} de bug — revise e edite antes de salvar</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep(2); setGeneratedBugs([]); }}>
                  <RefreshCw className="h-4 w-4" /> Regerar
                </Button>
                <Button onClick={() => saveMutation.mutate(generatedBugs)} disabled={saveMutation.isPending || generatedBugs.length === 0}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar {generatedBugs.length} bug{generatedBugs.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>

            {generatedBugs.map((bug, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Bug header */}
                  <div className="flex items-start gap-3 p-4 border-b border-border/60 bg-muted/20">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Input
                        value={bug.title}
                        onChange={(e) => updateBug(i, "title", e.target.value)}
                        className="font-semibold border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="Título do bug"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={bug.priority} onValueChange={(v) => updateBug(i, "priority", v)}>
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue>
                            <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", PRIORITY_STYLES[bug.priority] ?? "bg-muted")}>{bug.priority}</span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.filter((p) => p.value !== "mixed").map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeBug(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Bug body */}
                  <div className="p-4 space-y-4">
                    {bug.affectedArea && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Área afetada</Label>
                        <Input value={bug.affectedArea} onChange={(e) => updateBug(i, "affectedArea", e.target.value)} className="mt-1 h-8 text-sm" />
                      </div>
                    )}

                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Descrição</Label>
                      <Textarea value={bug.description} onChange={(e) => updateBug(i, "description", e.target.value)} rows={2} className="mt-1 text-sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Resultado esperado</Label>
                        <Textarea value={bug.expectedResult} onChange={(e) => updateBug(i, "expectedResult", e.target.value)} rows={2} className="mt-1 text-sm" />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Resultado atual</Label>
                        <Textarea value={bug.actualResult} onChange={(e) => updateBug(i, "actualResult", e.target.value)} rows={2} className="mt-1 text-sm" />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Passos para reproduzir</Label>
                      <Textarea value={bug.stepsToReproduce} onChange={(e) => updateBug(i, "stepsToReproduce", e.target.value)} rows={3} className="mt-1 text-sm font-mono text-xs" />
                    </div>

                    {bug.notes !== null && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Observações</Label>
                        <Textarea value={bug.notes ?? ""} onChange={(e) => updateBug(i, "notes", e.target.value)} rows={2} className="mt-1 text-sm" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {generatedBugs.length > 0 && (
              <Button size="lg" className="w-full" onClick={() => saveMutation.mutate(generatedBugs)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar {generatedBugs.length} bug{generatedBugs.length !== 1 ? "s" : ""} no sistema
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BugGeneratorPage() {
  return (
    <Suspense>
      <BugGeneratorContent />
    </Suspense>
  );
}
