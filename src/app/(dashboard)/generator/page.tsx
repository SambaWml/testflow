"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Wand2, Loader2, Check, Trash2, ChevronRight, ChevronLeft, Save, RefreshCw, Plus, Minus,
  AlertCircle, Wifi, WifiOff, Bot, Settings, Sparkles, Brain, FileCheck, ListChecks, Lightbulb,
  ClipboardList, Bug, Search, ShieldAlert, Zap,
} from "lucide-react";
import { LANGUAGES } from "@/lib/utils";
import { getPriorities } from "@/lib/enum-config";
import { HintIcon } from "@/components/ui/hint";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { GeneratedBug } from "@/app/api/bugs/generate/route";

const PRIORITIES = getPriorities();

/* ── Bug generator constants ──────────────────────────────────────── */
const BUG_CATEGORIES = [
  { value: "functional",    label: "Funcional",      icon: Bug },
  { value: "ui",            label: "Interface (UI)",  icon: Lightbulb },
  { value: "performance",   label: "Performance",     icon: Zap },
  { value: "security",      label: "Segurança",       icon: ShieldAlert },
  { value: "integration",   label: "Integração",      icon: Sparkles },
  { value: "data",          label: "Dados",           icon: Search },
  { value: "accessibility", label: "Acessibilidade",  icon: Brain },
];

const BUG_PRIORITY_OPTIONS = [
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

/* ── Types ─────────────────────────────────────────────────────────── */
interface GeneratedCase {
  title: string;
  precondition: string;
  priority: string;
  format: string;
  bddGiven?: string;
  bddWhen?: string;
  bddThen?: string;
  steps?: { order: number; description: string }[];
  expectedResult?: string;
  notes?: string;
}

type Mode = "cases" | "bugs";

/* ── Shared loading animation ────────────────────────────────────── */
function GeneratingAnimation({ elapsed, msgIdx, messages, title }: {
  elapsed: number;
  msgIdx: number;
  messages: { icon: React.ElementType; text: string }[];
  title: string;
}) {
  const Icon = messages[msgIdx].icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 max-w-md mx-auto text-center">
      <div className="relative mb-8">
        <div className="h-24 w-24 rounded-full border-4 border-primary/20 animate-pulse" />
        <div className="absolute inset-0 h-24 w-24 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-9 w-9 text-primary transition-all duration-500" />
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p key={msgIdx} className="text-sm text-muted-foreground mb-6 animate-pulse">{messages[msgIdx].text}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{Math.floor(elapsed / 60) > 0 ? `${Math.floor(elapsed / 60)}min ` : ""}{elapsed % 60}s aguardando...</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2 w-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
function GeneratorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLang();
  const preItemId = searchParams.get("itemId");

  const [mode, setMode] = useState<Mode>("cases");

  /* ── Test case state ──────────────────────────────────────────── */
  const [step, setStep] = useState(1);
  const [itemId, setItemId] = useState(preItemId ?? "");
  const [manualDesc, setManualDesc] = useState("");
  const [quantity, setQuantity] = useState(5);
  const allFormats = [
    { value: "BDD", label: "BDD" },
    { value: "STEP_BY_STEP", label: "Step by Step" },
  ];
  const blockedFormats: string[] = (() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("testflow_blocked_formats") ?? "[]"); } catch { return []; }
  })();
  const availableFormats = allFormats.filter((f) => !blockedFormats.includes(f.value));
  const [format, setFormat] = useState(() => availableFormats[0]?.value ?? "BDD");
  const [language, setLanguage] = useState("pt-BR");
  const [coverage, setCoverage] = useState("standard");
  const [testType, setTestType] = useState("functional");
  const [projectId, setProjectId] = useState("");
  const [generatedCases, setGeneratedCases] = useState<GeneratedCase[]>([]);
  const [caseGenerating, setCaseGenerating] = useState(false);
  const [caseGenError, setCaseGenError] = useState<{ message: string; hint?: string } | null>(null);
  const [caseElapsed, setCaseElapsed] = useState(0);
  const [caseMsgIdx, setCaseMsgIdx] = useState(0);
  const [planDialog, setPlanDialog] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planEnv, setPlanEnv] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);

  /* ── Bug state ────────────────────────────────────────────────── */
  const [bugStep, setBugStep] = useState(1);
  const [bugDesc, setBugDesc] = useState("");
  const [bugProjectId, setBugProjectId] = useState("");
  const [bugLanguage, setBugLanguage] = useState("pt-BR");
  const [bugPriority, setBugPriority] = useState("mixed");
  const [bugCategory, setBugCategory] = useState("functional");
  const [bugQuantity, setBugQuantity] = useState(3);
  const [generatedBugs, setGeneratedBugs] = useState<GeneratedBug[]>([]);
  const [bugGenerating, setBugGenerating] = useState(false);
  const [bugGenError, setBugGenError] = useState<{ message: string; hint?: string } | null>(null);
  const [bugElapsed, setBugElapsed] = useState(0);
  const [bugMsgIdx, setBugMsgIdx] = useState(0);

  /* ── Shared queries ───────────────────────────────────────────── */
  const { data: aiStatus } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => fetch("/api/ai-status").then((r) => r.json()),
    staleTime: 30_000,
  });
  const { data: items } = useQuery({
    queryKey: ["items-all"],
    queryFn: () => fetch("/api/items?limit=100").then((r) => r.json()),
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects?activeOnly=true").then((r) => r.json()),
  });
  const { data: selectedItem } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => fetch(`/api/items/${itemId}`).then((r) => r.json()),
    enabled: !!itemId,
  });

  useEffect(() => {
    if (selectedItem?.projectId) setProjectId(selectedItem.projectId);
  }, [selectedItem]);

  /* ── Generation messages ──────────────────────────────────────── */
  const CASE_MESSAGES = [
    { icon: Brain,      text: t.generator.gen_messages[0] },
    { icon: Lightbulb,  text: t.generator.gen_messages[1] },
    { icon: Wand2,      text: t.generator.gen_messages[2] },
    { icon: ListChecks, text: t.generator.gen_messages[3] },
    { icon: FileCheck,  text: t.generator.gen_messages[4] },
    { icon: Sparkles,   text: t.generator.gen_messages[5] },
  ];
  const BUG_MESSAGES = [
    { icon: Brain,       text: "Analisando a funcionalidade..." },
    { icon: Search,      text: "Identificando pontos de falha..." },
    { icon: Bug,         text: "Gerando relatórios de bug..." },
    { icon: ShieldAlert, text: "Verificando cenários de risco..." },
    { icon: Lightbulb,   text: "Formulando casos de borda..." },
    { icon: Sparkles,    text: "Finalizando os bugs..." },
  ];

  useEffect(() => {
    if (!caseGenerating) { setCaseElapsed(0); setCaseMsgIdx(0); return; }
    const timer = setInterval(() => setCaseElapsed((s) => s + 1), 1000);
    const rotate = setInterval(() => setCaseMsgIdx((s) => (s + 1) % CASE_MESSAGES.length), 3500);
    return () => { clearInterval(timer); clearInterval(rotate); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseGenerating]);

  useEffect(() => {
    if (!bugGenerating) { setBugElapsed(0); setBugMsgIdx(0); return; }
    const timer = setInterval(() => setBugElapsed((s) => s + 1), 1000);
    const rotate = setInterval(() => setBugMsgIdx((s) => (s + 1) % BUG_MESSAGES.length), 3500);
    return () => { clearInterval(timer); clearInterval(rotate); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugGenerating]);

  /* ── Test case actions ────────────────────────────────────────── */
  const saveCasesMutation = useMutation({
    mutationFn: (cases: GeneratedCase[]) =>
      fetch("/api/cases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases, itemId: itemId || undefined, projectId }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setGeneratedCases([]);
      setStep(1);
      alert(t.generator.saved_alert);
    },
  });

  async function saveAndCreatePlan() {
    setCreatingPlan(true);
    try {
      const res = await fetch("/api/cases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases: generatedCases, itemId: itemId || undefined, projectId }),
      });
      const data = await res.json();
      const caseIds: string[] = (data.created ?? []).map((c: { id: string }) => c.id);
      await fetch("/api/test-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: planName, projectId, caseIds, environment: planEnv }),
      });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["test-plans-pending"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setPlanDialog(false);
      setPlanName(""); setPlanEnv("");
      setGeneratedCases([]);
      setStep(1);
      alert(t.generator.plan_created_alert);
      router.push("/executions");
    } finally {
      setCreatingPlan(false);
    }
  }

  async function generateCases() {
    setCaseGenerating(true);
    setCaseGenError(null);
    try {
      const res = await fetch("/api/cases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: itemId || undefined, manualDescription: manualDesc || undefined, quantity, format, language, coverageLevel: coverage, testType, projectId }),
      });
      const data = await res.json();
      if (res.ok && data.cases) { setGeneratedCases(data.cases); setStep(3); }
      else setCaseGenError({ message: data.error || t.generator.error_generate, hint: data.hint });
    } catch { setCaseGenError({ message: t.generator.error_connection }); }
    finally { setCaseGenerating(false); }
  }

  const updateCase = (i: number, field: string, value: string) =>
    setGeneratedCases((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  const removeCase = (i: number) =>
    setGeneratedCases((prev) => prev.filter((_, idx) => idx !== i));

  /* ── Bug actions ──────────────────────────────────────────────── */
  const saveBugsMutation = useMutation({
    mutationFn: (bugs: GeneratedBug[]) =>
      fetch("/api/bugs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: bugProjectId,
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
      setBugStep(1);
      alert(`${data.count} bug${data.count !== 1 ? "s" : ""} salvo${data.count !== 1 ? "s" : ""} com sucesso!`);
    },
  });

  async function generateBugs() {
    setBugGenerating(true);
    setBugGenError(null);
    try {
      const res = await fetch("/api/bugs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualDescription: bugDesc || undefined, quantity: bugQuantity, language: bugLanguage, priority: bugPriority, bugCategory, projectId: bugProjectId }),
      });
      const data = await res.json();
      if (res.ok && data.bugs) { setGeneratedBugs(data.bugs); setBugStep(3); }
      else setBugGenError({ message: data.error || "Erro ao gerar bugs.", hint: data.hint });
    } catch { setBugGenError({ message: "Erro de conexão com o servidor." }); }
    finally { setBugGenerating(false); }
  }

  const updateBug = (i: number, field: keyof GeneratedBug, value: string) =>
    setGeneratedBugs((prev) => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  const removeBug = (i: number) =>
    setGeneratedBugs((prev) => prev.filter((_, idx) => idx !== i));

  /* ── Step labels per mode ─────────────────────────────────────── */
  const currentStep = mode === "cases" ? step : bugStep;
  const STEP_LABELS = mode === "cases"
    ? [t.generator.step1_label, t.generator.step2_label, t.generator.step3_label]
    : ["Contexto", "Configurar", "Revisar bugs"];

  /* ── AI status banner ─────────────────────────────────────────── */
  const AIBanner = aiStatus ? (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm mb-6 ${
      aiStatus.status === "online" || aiStatus.status === "configured"
        ? "bg-green-50 border-green-200 text-green-800"
        : aiStatus.status === "offline"
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-yellow-50 border-yellow-200 text-yellow-800"
    }`}>
      {aiStatus.status === "online"     && <Wifi className="h-4 w-4 shrink-0" />}
      {aiStatus.status === "configured" && <Bot className="h-4 w-4 shrink-0" />}
      {aiStatus.status === "offline"    && <WifiOff className="h-4 w-4 shrink-0" />}
      {aiStatus.status === "mock"       && <AlertCircle className="h-4 w-4 shrink-0" />}
      <span className="flex-1">
        {aiStatus.status === "online"     && t.generator.ai_connected.replace("{model}", aiStatus.model)}
        {aiStatus.status === "configured" && t.generator.ai_configured.replace("{provider}", aiStatus.provider === "manus" ? "Manus IA" : "OpenAI").replace("{model}", aiStatus.model)}
        {aiStatus.status === "offline"    && t.generator.ai_offline.replace("{url}", aiStatus.url)}
        {aiStatus.status === "mock"       && t.generator.ai_no_provider}
      </span>
      {(aiStatus.status === "offline" || aiStatus.status === "mock") && (
        <Link href="/settings" className="flex items-center gap-1 font-medium underline underline-offset-2 shrink-0">
          <Settings className="h-3.5 w-3.5" /> {t.common.configure}
        </Link>
      )}
    </div>
  ) : null;

  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.generator.title} subtitle={t.generator.subtitle} />

      <div className="flex-1 overflow-y-auto p-6">
        {AIBanner}

        {/* Mode selector */}
        <div className="flex gap-2 mb-8 max-w-2xl">
          {([
            { value: "cases" as Mode, label: "Casos de Teste", icon: FileCheck },
            { value: "bugs"  as Mode, label: "Bugs",           icon: Bug },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all",
                mode === value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background hover:bg-accent border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEP_LABELS.map((label, idx) => {
            const n = idx + 1;
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${currentStep >= n ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                  {currentStep > n ? <Check className="h-4 w-4" /> : n}
                </div>
                <span className={`text-sm ${currentStep === n ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
                {idx < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
              </div>
            );
          })}
        </div>

        {/* ══════════════ TEST CASE WIZARD ══════════════ */}
        {mode === "cases" && (
          <>
            {step === 1 && (
              <Card className="max-w-2xl">
                <CardHeader><CardTitle>{t.generator.step1_title}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t.generator.registered_item} <HintIcon text={t.generator.registered_item_hint} /></Label>
                    <Select value={itemId} onValueChange={setItemId}>
                      <SelectTrigger><SelectValue placeholder={t.generator.search_item} /></SelectTrigger>
                      <SelectContent>
                        {(items?.items ?? []).map((it: { id: string; title: string }) => (
                          <SelectItem key={it.id} value={it.id}>{it.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItem && (
                    <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm space-y-1">
                      <p className="font-medium text-blue-900">{selectedItem.title}</p>
                      {selectedItem.description && <p className="text-blue-800">{selectedItem.description}</p>}
                      {selectedItem.acceptanceCriteria && <p className="text-blue-700 text-xs mt-2">AC: {selectedItem.acceptanceCriteria}</p>}
                    </div>
                  )}

                  <Separator />
                  <div className="space-y-1.5">
                    <Label>{t.generator.manual_desc} <HintIcon text={t.generator.manual_desc_hint} /></Label>
                    <Textarea placeholder={t.generator.manual_desc_placeholder} rows={5} value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.generator.project_required}</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger><SelectValue placeholder={t.generator.select_project} /></SelectTrigger>
                      <SelectContent>
                        {(projects?.projects ?? []).map((p: { id: string; name: string }) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full" onClick={() => {
                    if ((!itemId && !manualDesc.trim()) || !projectId) { alert(t.generator.step1_validation); return; }
                    setStep(2);
                  }}>
                    {t.common.next} <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {caseGenerating && (
              <GeneratingAnimation elapsed={caseElapsed} msgIdx={caseMsgIdx} messages={CASE_MESSAGES} title={t.generator.generating_title} />
            )}

            {step === 2 && !caseGenerating && (
              <Card className="max-w-2xl">
                <CardHeader><CardTitle>{t.generator.step2_title}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>{t.generator.quantity} <HintIcon text={t.generator.quantity_hint} /></Label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-3 w-3" /></Button>
                        <Input type="number" min={1} max={30} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="text-center w-16" />
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setQuantity(Math.min(30, quantity + 1))}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>

                    {availableFormats.length > 1 && (
                      <div className="space-y-1.5">
                        <Label>{t.generator.format} <HintIcon text={t.generator.format_hint} /></Label>
                        <div className="flex gap-2">
                          {availableFormats.map((f) => (
                            <button key={f.value} onClick={() => setFormat(f.value)}
                              className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${format === f.value ? "bg-primary text-white border-primary" : "bg-background hover:bg-accent"}`}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {availableFormats.length === 1 && (
                      <div className="space-y-1.5">
                        <Label>{t.generator.format}</Label>
                        <div className="flex items-center gap-2 py-2 px-3 rounded-md border bg-muted text-sm font-medium text-muted-foreground">
                          {availableFormats[0].label}
                          <span className="text-xs ml-auto">({t.common.only_available})</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label>{t.generator.language_label}</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t.generator.coverage} <HintIcon text={t.generator.coverage_hint} /></Label>
                      <Select value={coverage} onValueChange={setCoverage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{t.generator.coverage_levels.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <Label>{t.generator.test_type} <HintIcon text={t.generator.test_type_hint} /></Label>
                      <div className="flex flex-wrap gap-2">
                        {t.generator.test_types.map((tt) => (
                          <button key={tt.value} onClick={() => setTestType(tt.value)}
                            className={`py-1.5 px-3 rounded-full border text-xs font-medium transition-colors ${testType === tt.value ? "bg-primary text-white border-primary" : "bg-background hover:bg-accent"}`}>
                            {tt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {caseGenError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1">
                      <div className="flex items-start gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="text-sm font-medium">{caseGenError.message}</p>
                      </div>
                      {caseGenError.hint && <p className="text-xs text-red-600 pl-6">{caseGenError.hint}</p>}
                      <div className="pl-6 pt-1">
                        <Link href="/settings" className="text-xs text-red-700 font-medium underline underline-offset-2">{t.generator.go_to_settings}</Link>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" /> {t.common.back}</Button>
                    <Button className="flex-1" onClick={generateCases} disabled={caseGenerating || aiStatus?.status === "mock"}>
                      {aiStatus?.status === "mock"
                        ? <><AlertCircle className="h-4 w-4" /> {t.generator.configure_ia_btn}</>
                        : <><Wand2 className="h-4 w-4" /> {t.generator.generate_btn.replace("{n}", String(quantity))}</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{t.generator.step3_title}</h2>
                    <p className="text-sm text-muted-foreground">{t.generator.cases_generated.replace("{n}", String(generatedCases.length))}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => { setStep(2); setGeneratedCases([]); }}><RefreshCw className="h-4 w-4" /> {t.generator.regenerate}</Button>
                    <Button variant="outline" onClick={() => saveCasesMutation.mutate(generatedCases)} disabled={saveCasesMutation.isPending}>
                      {saveCasesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t.generator.save_btn.replace("{n}", String(generatedCases.length))}
                    </Button>
                    <Button onClick={() => { setPlanName(""); setPlanEnv(""); setPlanDialog(true); }} disabled={saveCasesMutation.isPending}>
                      <ClipboardList className="h-4 w-4" /> {t.generator.save_and_plan}
                    </Button>
                  </div>
                </div>

                {generatedCases.map((tc, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">{i + 1}</span>
                          <Input value={tc.title} onChange={(e) => updateCase(i, "title", e.target.value)}
                            className="font-medium border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder={t.generator.case_title_placeholder} />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Select value={tc.priority} onValueChange={(v) => updateCase(i, "priority", v)}>
                            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeCase(i)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>

                      {tc.precondition && (
                        <div>
                          <Label className="text-xs text-muted-foreground">{t.generator.precondition}</Label>
                          <Textarea value={tc.precondition} onChange={(e) => updateCase(i, "precondition", e.target.value)} rows={1} className="mt-1 text-sm" />
                        </div>
                      )}

                      {format === "BDD" ? (
                        <div className="space-y-2">
                          {(["bddGiven", "bddWhen", "bddThen"] as const).map((field, fi) => {
                            const labels = [t.cases.given, t.cases.when, t.cases.then];
                            const colors = ["bg-blue-50 border-blue-200", "bg-purple-50 border-purple-200", "bg-green-50 border-green-200"];
                            return (
                              <div key={field} className={`p-2 rounded-md border ${colors[fi]}`}>
                                <Label className="text-xs font-bold uppercase">{labels[fi]}</Label>
                                <Textarea value={(tc as unknown as Record<string, string>)[field] ?? ""} onChange={(e) => updateCase(i, field, e.target.value)}
                                  rows={1} className="mt-1 text-sm bg-transparent border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0" />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t.generator.steps}</Label>
                          {(tc.steps ?? []).map((s, si) => (
                            <div key={si} className="flex gap-2 items-start">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs shrink-0 mt-1.5">{s.order}</span>
                              <Input value={s.description} onChange={(e) => {
                                const newSteps = [...(tc.steps ?? [])];
                                newSteps[si] = { ...newSteps[si], description: e.target.value };
                                setGeneratedCases((prev) => prev.map((c, idx) => idx === i ? { ...c, steps: newSteps } : c));
                              }} className="text-sm" />
                            </div>
                          ))}
                          {tc.expectedResult && (
                            <div>
                              <Label className="text-xs text-muted-foreground">{t.generator.expected_result}</Label>
                              <Textarea value={tc.expectedResult} onChange={(e) => updateCase(i, "expectedResult", e.target.value)} rows={1} className="mt-1 text-sm" />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {generatedCases.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button variant="outline" size="lg" onClick={() => saveCasesMutation.mutate(generatedCases)} disabled={saveCasesMutation.isPending}>
                      {saveCasesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t.generator.save_all_btn.replace("{n}", String(generatedCases.length))}
                    </Button>
                    <Button size="lg" onClick={() => { setPlanName(""); setPlanEnv(""); setPlanDialog(true); }} disabled={saveCasesMutation.isPending}>
                      <ClipboardList className="h-4 w-4" /> {t.generator.save_and_plan}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════ BUG WIZARD ══════════════ */}
        {mode === "bugs" && (
          <>
            {bugStep === 1 && (
              <Card className="max-w-2xl">
                <CardHeader><CardTitle>Defina o contexto</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1.5">
                    <Label>Descrição da funcionalidade</Label>
                    <Textarea
                      placeholder="Descreva a funcionalidade ou área do sistema. Inclua comportamentos esperados, fluxos e regras de negócio..."
                      rows={5} value={bugDesc} onChange={(e) => setBugDesc(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Projeto *</Label>
                    <Select value={bugProjectId} onValueChange={setBugProjectId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                      <SelectContent>
                        {(projects?.projects ?? []).map((p: { id: string; name: string }) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!bugDesc.trim() || !bugProjectId) { alert("Forneça uma descrição e selecione um projeto."); return; }
                    setBugStep(2);
                  }}>
                    Próximo <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {bugGenerating && (
              <GeneratingAnimation elapsed={bugElapsed} msgIdx={bugMsgIdx} messages={BUG_MESSAGES} title="Gerando relatórios de bug..." />
            )}

            {bugStep === 2 && !bugGenerating && (
              <Card className="max-w-2xl">
                <CardHeader><CardTitle>Configurar geração</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Quantidade</Label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setBugQuantity(Math.max(1, bugQuantity - 1))}><Minus className="h-3 w-3" /></Button>
                        <Input type="number" min={1} max={20} value={bugQuantity} onChange={(e) => setBugQuantity(Number(e.target.value))} className="text-center w-16" />
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setBugQuantity(Math.min(20, bugQuantity + 1))}><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Idioma do relatório</Label>
                      <Select value={bugLanguage} onValueChange={setBugLanguage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2 space-y-1.5">
                      <Label>Prioridade dos bugs</Label>
                      <Select value={bugPriority} onValueChange={setBugPriority}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{BUG_PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria de bugs</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {BUG_CATEGORIES.map(({ value, label, icon: Icon }) => (
                        <button key={value} onClick={() => setBugCategory(value)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all",
                            bugCategory === value ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background hover:bg-accent border-border"
                          )}>
                          <Icon className="h-4 w-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {bugGenError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1">
                      <div className="flex items-start gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="text-sm font-medium">{bugGenError.message}</p>
                      </div>
                      {bugGenError.hint && <p className="text-xs text-red-600 pl-6">{bugGenError.hint}</p>}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setBugStep(1)}><ChevronLeft className="h-4 w-4" /> Voltar</Button>
                    <Button className="flex-1" onClick={generateBugs} disabled={bugGenerating || aiStatus?.status === "mock"}>
                      {aiStatus?.status === "mock"
                        ? <><AlertCircle className="h-4 w-4" /> Configure a IA</>
                        : <><Bug className="h-4 w-4" /> Gerar {bugQuantity} bug{bugQuantity !== 1 ? "s" : ""}</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {bugStep === 3 && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Bugs gerados</h2>
                    <p className="text-sm text-muted-foreground">{generatedBugs.length} relatório{generatedBugs.length !== 1 ? "s" : ""} — revise e edite antes de salvar</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setBugStep(2); setGeneratedBugs([]); }}><RefreshCw className="h-4 w-4" /> Regerar</Button>
                    <Button onClick={() => saveBugsMutation.mutate(generatedBugs)} disabled={saveBugsMutation.isPending || generatedBugs.length === 0}>
                      {saveBugsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar {generatedBugs.length} bug{generatedBugs.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>

                {generatedBugs.map((bug, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-3 p-4 border-b border-border/60 bg-muted/20">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <Input value={bug.title} onChange={(e) => updateBug(i, "title", e.target.value)}
                            className="font-semibold border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            placeholder="Título do bug" />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Select value={bug.priority} onValueChange={(v) => updateBug(i, "priority", v)}>
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue>
                                <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", PRIORITY_STYLES[bug.priority] ?? "bg-muted")}>{bug.priority}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {BUG_PRIORITY_OPTIONS.filter((p) => p.value !== "mixed").map((p) => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeBug(i)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

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
                  <Button size="lg" className="w-full" onClick={() => saveBugsMutation.mutate(generatedBugs)} disabled={saveBugsMutation.isPending}>
                    {saveBugsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar {generatedBugs.length} bug{generatedBugs.length !== 1 ? "s" : ""} no sistema
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create plan dialog (cases mode) */}
      <Dialog open={planDialog} onOpenChange={(o) => { if (!creatingPlan) setPlanDialog(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {t.generator.create_plan_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">{t.generator.create_plan_desc.replace("{n}", String(generatedCases.length))}</p>
            <div className="space-y-1.5">
              <Label>{t.generator.plan_name_label} *</Label>
              <Input placeholder={t.generator.plan_name_placeholder} value={planName} onChange={(e) => setPlanName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>{t.generator.plan_environment_label}</Label>
              <Input placeholder={t.generator.plan_environment_placeholder} value={planEnv} onChange={(e) => setPlanEnv(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)} disabled={creatingPlan}>{t.common.cancel}</Button>
            <Button onClick={saveAndCreatePlan} disabled={!planName.trim() || creatingPlan}>
              {creatingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              {t.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GeneratorPage() {
  return (
    <Suspense>
      <GeneratorContent />
    </Suspense>
  );
}
