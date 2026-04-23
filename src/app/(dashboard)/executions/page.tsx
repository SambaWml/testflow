"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  Play, CheckCircle2, XCircle, AlertTriangle, Clock, SkipForward, RefreshCw,
  Upload, Link2, Trash2, Loader2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  History, Bug, Plus, ClipboardList, ArrowLeft, Flag,
} from "lucide-react";
import { getExecStatuses, getPriorities } from "@/lib/enum-config";
import { useTerms } from "@/contexts/terms-context";

const EXECUTION_STATUSES = getExecStatuses();
const PRIORITIES = getPriorities();
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Types ───────────────────────────────────────────────────────── */
interface PlanCase {
  id: string;
  order: number;
  case: {
    id: string; title: string; format: string; priority: string;
    precondition: string | null; bddGiven: string | null; bddWhen: string | null; bddThen: string | null;
    expectedResult: string | null;
    steps: { id: string; order: number; description: string }[];
  };
}

interface TestPlan {
  id: string; name: string; status: string; result: string | null;
  environment: string; buildVersion: string | null; notes: string | null;
  startedAt: string | null; completedAt: string | null; createdAt: string;
  project: { id: string; name: string };
  creator: { name: string };
  items: PlanCase[];
  executions: { id: string; caseId: string; status: string; notes: string | null; relatedBugRef: string | null; case: { title: string; format: string } | null; evidence: { id: string; linkUrl: string | null; fileName: string; type: string; storageKey: string | null }[] }[];
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  PASS: CheckCircle2, FAIL: XCircle, BLOCKED: AlertTriangle,
  NOT_EXECUTED: Clock, RETEST: RefreshCw, SKIPPED: SkipForward,
};
const STATUS_COLORS: Record<string, string> = {
  PASS: "text-green-600 bg-green-50 border-green-200",
  FAIL: "text-red-600 bg-red-50 border-red-200",
  BLOCKED: "text-orange-600 bg-orange-50 border-orange-200",
  NOT_EXECUTED: "text-gray-500 bg-gray-50 border-gray-200",
  RETEST: "text-blue-600 bg-blue-50 border-blue-200",
  SKIPPED: "text-purple-600 bg-purple-50 border-purple-200",
};
const STATUS_BADGE: Record<string, string> = {
  PASS: "bg-green-100 text-green-800", FAIL: "bg-red-100 text-red-800",
  BLOCKED: "bg-orange-100 text-orange-800", NOT_EXECUTED: "bg-gray-100 text-gray-600",
  RETEST: "bg-blue-100 text-blue-800", SKIPPED: "bg-purple-100 text-purple-800",
};
// Labels come from custom config; fall back to value key for unknown statuses
const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  EXECUTION_STATUSES.map((s) => [s.value, s.label])
);
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800", HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800", LOW: "bg-green-100 text-green-800",
};

/* ── Page ────────────────────────────────────────────────────────── */
export default function ExecutionsPage() {
  const { t } = useLang();
  const { terms } = useTerms();
  return (
    <div className="flex flex-col h-full">
      <Topbar title={terms.execucao.plural} subtitle={t.executions.subtitle} />
      <Tabs defaultValue="run" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 pt-2">
          <TabsList>
            <TabsTrigger value="run"><ClipboardList className="h-4 w-4 mr-1.5" />{t.executions.run_tab}</TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4 mr-1.5" />{t.executions.history_tab}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="run" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <RunTab />
        </TabsContent>
        <TabsContent value="history" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Run Tab — 3 sub-views: list | create | execute
═══════════════════════════════════════════════════════════════════ */
type RunView = "list" | "create" | "execute";

function RunTab() {
  const [view, setView] = useState<RunView>("list");
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  function startExecution(planId: string) {
    setActivePlanId(planId);
    setView("execute");
  }

  if (view === "create") {
    return <CreatePlanView onBack={() => setView("list")} onCreate={() => setView("list")} />;
  }
  if (view === "execute" && activePlanId) {
    return <ExecutePlanView planId={activePlanId} onDone={() => { setActivePlanId(null); setView("list"); }} />;
  }
  return <PlanListView onNew={() => setView("create")} onRun={startExecution} />;
}

/* ── Plan list ───────────────────────────────────────────────────── */
function PlanListView({ onNew, onRun }: { onNew: () => void; onRun: (id: string) => void }) {
  const qc = useQueryClient();
  const { t } = useLang();
  const { terms } = useTerms();

  const { data, isLoading } = useQuery({
    queryKey: ["test-plans-pending"],
    queryFn: () => fetch("/api/test-plans").then((r) => r.json()),
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => fetch(`/api/test-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test-plans-pending"] }),
  });

  const startPlan = useMutation({
    mutationFn: (id: string) => fetch(`/api/test-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["test-plans-pending"] });
      onRun(id);
    },
  });

  const plans: TestPlan[] = (data?.plans ?? []).filter((p: TestPlan) => ["PENDING", "IN_PROGRESS"].includes(p.status));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{terms.planoDeTeste.plural}</h2>
          <p className="text-sm text-muted-foreground">{t.executions.subtitle}</p>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus className="h-4 w-4" /> {t.executions.new_plan}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg border animate-pulse bg-white" />)}</div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium mb-1">{t.executions.no_plans}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.executions.no_plans_desc}</p>
            <Button onClick={onNew}><Plus className="h-4 w-4" /> {t.executions.create_plan}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const done = plan.executions.length;
            const total = plan.items.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={plan.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{plan.name}</span>
                        <Badge variant={plan.status === "IN_PROGRESS" ? "info" : "secondary"} className="text-xs">
                          {plan.status === "IN_PROGRESS" ? t.executions.plan_status_in_progress : t.executions.plan_status_planning}
                        </Badge>
                        <span className="text-xs text-muted-foreground">📁 {plan.project.name}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>{terms.ambiente.singular}: {plan.environment || "—"}</span>
                        {plan.buildVersion && <span>{terms.build.singular}: {plan.buildVersion}</span>}
                        <span>{total} {total === 1 ? t.executions.case_singular : t.executions.case_plural}</span>
                        <span>{t.executions.creator.replace("{name}", plan.creator.name)}</span>
                      </div>
                      {plan.status === "IN_PROGRESS" && total > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progresso</span><span>{done}/{total} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (plan.status === "IN_PROGRESS") onRun(plan.id);
                          else startPlan.mutate(plan.id);
                        }}
                        disabled={startPlan.isPending}
                      >
                        {startPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {plan.status === "IN_PROGRESS" ? t.common.next : t.executions.start}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => { if (confirm(t.executions.delete_plan_confirm)) deletePlan.mutate(plan.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Create plan ─────────────────────────────────────────────────── */
function CreatePlanView({ onBack, onCreate }: { onBack: () => void; onCreate: () => void }) {
  const qc = useQueryClient();
  const { t } = useLang();
  const { terms } = useTerms();
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [environment, setEnvironment] = useState("");
  const [buildVersion, setBuildVersion] = useState("");
  const [selectedCases, setSelectedCases] = useState<string[]>([]);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects?activeOnly=true").then((r) => r.json()),
  });

  const { data: casesData } = useQuery({
    queryKey: ["cases-for-plan", projectId],
    queryFn: () => fetch(`/api/cases?projectId=${projectId}&limit=200`).then((r) => r.json()),
    enabled: !!projectId,
  });

  const cases = casesData?.cases ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/test-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, projectId, environment, buildVersion, caseIds: selectedCases }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`);
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-plans-pending"] });
      onCreate();
    },
  });

  function toggleCase(id: string) {
    setSelectedCases((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelectedCases((prev) =>
      prev.length === cases.length ? [] : cases.map((c: { id: string }) => c.id)
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-base font-semibold">{t.common.new} {terms.planoDeTeste.singular}</h2>
            <p className="text-sm text-muted-foreground">{t.executions.subtitle}</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">{terms.planoDeTeste.singular}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.executions.plan_name} *</Label>
              <Input placeholder={t.executions.plan_name_placeholder} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.executions.project} *</Label>
                <Select value={projectId} onValueChange={(v) => { setProjectId(v); setSelectedCases([]); }}>
                  <SelectTrigger><SelectValue placeholder={t.executions.select_project} /></SelectTrigger>
                  <SelectContent>
                    {(projects?.projects ?? []).map((p: { id: string; name: string }) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{terms.ambiente.singular}</Label>
                <Input placeholder="QA, Staging..." value={environment} onChange={(e) => setEnvironment(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{terms.build.singular}</Label>
              <Input placeholder="v2.1.0, build-1234..." value={buildVersion} onChange={(e) => setBuildVersion(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {projectId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {t.executions.cases_label}
                  {selectedCases.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{selectedCases.length} {selectedCases.length === 1 ? t.executions.case_singular : t.executions.case_plural}</span>
                  )}
                </CardTitle>
                {cases.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                    {selectedCases.length === cases.length ? t.common.cancel : t.executions.select_cases}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {cases.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">{t.cases.no_cases}.</p>
              ) : (
                <div className="divide-y max-h-80 overflow-y-auto">
                  {cases.map((tc: { id: string; title: string; format: string; priority: string; item: { title: string } | null }) => {
                    const checked = selectedCases.includes(tc.id);
                    return (
                      <label key={tc.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCase(tc.id)}
                          className="h-4 w-4 rounded accent-primary shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">{tc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={tc.format === "BDD" ? "info" : "secondary"} className="text-xs">{tc.format === "BDD" ? "BDD" : "Step by Step"}</Badge>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[tc.priority] ?? ""}`}>
                              {PRIORITIES.find((p) => p.value === tc.priority)?.label ?? tc.priority}
                            </span>
                            {tc.item && <span className="text-xs text-muted-foreground truncate">📎 {tc.item.title}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {createMutation.isError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {(createMutation.error as Error)?.message ?? "Erro ao criar plano"}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>{t.common.cancel}</Button>
          <Button
            className="flex-1"
            disabled={!name || !projectId || selectedCases.length === 0 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            {t.executions.create_plan} ({selectedCases.length} {selectedCases.length === 1 ? t.executions.case_singular : t.executions.case_plural})
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Execute plan ────────────────────────────────────────────────── */
interface CaseDraft { status: string; notes: string; bugRef: string; links: string[]; images: string[] }
const emptyDraft = (): CaseDraft => ({ status: "NOT_EXECUTED", notes: "", bugRef: "", links: [""], images: [] });

function ExecutePlanView({ planId, onDone }: { planId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { t } = useLang();
  const { terms } = useTerms();
  const [activeIdx, setActiveIdx] = useState(0);
  // Per-case draft storage: caseId → draft values
  const [drafts, setDrafts] = useState<Record<string, CaseDraft>>({});
  const [saving, setSaving] = useState(false);
  const [finishDialog, setFinishDialog] = useState(false);
  const [planResult, setPlanResult] = useState("PASS");
  const [planNotes, setPlanNotes] = useState("");
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["test-plan", planId],
    queryFn: () => fetch(`/api/test-plans/${planId}`).then((r) => r.json()),
  });

  const plan: TestPlan | undefined = data?.plan;
  const cases = plan?.items ?? [];
  const executedIds = new Set(plan?.executions?.map((e) => e.caseId) ?? []);
  const activeItem = cases[activeIdx];
  const activeCaseId = activeItem?.case.id ?? "";

  // resultado já registrado para o caso ativo
  const existingResult = plan?.executions?.find((e) => e.caseId === activeCaseId);

  // Draft for active case — if no draft yet, seed from existing result or empty
  const activeDraft: CaseDraft = drafts[activeCaseId] ?? (existingResult
    ? {
        status: existingResult.status,
        notes: existingResult.notes ?? "",
        bugRef: existingResult.relatedBugRef ?? "",
        links: existingResult.evidence?.filter((ev) => ev.linkUrl).map((ev) => ev.linkUrl!) ?? [""],
        images: existingResult.evidence?.filter((ev) => ev.type === "IMAGE").map((ev) => ev.storageKey) ?? [],
      }
    : emptyDraft());

  function setDraft(patch: Partial<CaseDraft>) {
    setDrafts((prev) => ({ ...prev, [activeCaseId]: { ...activeDraft, ...patch } }));
  }

  function navigateTo(idx: number) {
    if (idx < 0 || idx >= cases.length) return;
    setActiveIdx(idx);
  }

  const completePlan = useMutation({
    mutationFn: () => fetch(`/api/test-plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", result: planResult, notes: planNotes }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-plans-pending"] });
      qc.invalidateQueries({ queryKey: ["test-plans-history"] });
      onDone();
    },
  });

  const removeCaseMutation = useMutation({
    mutationFn: (itemId: string) =>
      fetch(`/api/test-plans/${planId}/items/${itemId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: async (_, itemId) => {
      setRemoveItemId(null);
      // Move active index back if needed to avoid going out of bounds
      const removedIdx = cases.findIndex((c) => c.id === itemId);
      if (removedIdx !== -1 && activeIdx >= removedIdx && activeIdx > 0) {
        setActiveIdx((i) => i - 1);
      }
      await refetch();
    },
  });

  async function saveCase() {
    if (!activeItem || !plan) return;
    setSaving(true);
    try {
      const execRes = await fetch("/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: activeCaseId,
          projectId: plan.project.id,
          testPlanId: planId,
          status: activeDraft.status,
          environment: plan.environment,
          buildVersion: plan.buildVersion,
          notes: activeDraft.notes,
          relatedBugRef: activeDraft.bugRef,
          executedAt: new Date().toISOString(),
        }),
      });
      const execJson = await execRes.json();
      const validLinks = activeDraft.links.map((l) => l.trim()).filter(Boolean);
      const validImages = activeDraft.images ?? [];
      if (validLinks.length > 0 || validImages.length > 0) {
        const lastId = execJson.execution?.id;
        if (lastId) {
          await Promise.all([
            ...validLinks.map((url) =>
              fetch("/api/evidence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ executionId: lastId, type: "LINK", fileName: url, storageKey: url, linkUrl: url }),
              })
            ),
            ...validImages.map((storageKey) =>
              fetch("/api/evidence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  executionId: lastId,
                  type: "IMAGE",
                  fileName: storageKey.split("/").pop() ?? storageKey,
                  storageKey,
                  publicUrl: storageKey,
                }),
              })
            ),
          ]);
        }
      }
      // Clear draft for this case after saving
      setDrafts((prev) => { const next = { ...prev }; delete next[activeCaseId]; return next; });
      await refetch();

      // Advance to next unexecuted case
      const updatedExecutedIds = new Set([...executedIds, activeCaseId]);
      const nextIdx = cases.findIndex((c, i) => i > activeIdx && !updatedExecutedIds.has(c.case.id));
      if (nextIdx !== -1) {
        setActiveIdx(nextIdx);
      } else if (cases.every((c) => updatedExecutedIds.has(c.case.id))) {
        setFinishDialog(true);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!plan) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Queue */}
      <div className="w-72 border-r bg-white flex flex-col shrink-0">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <button onClick={onDone} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{plan.name}</p>
              <p className="text-xs text-muted-foreground">{plan.environment}{plan.buildVersion ? ` · ${plan.buildVersion}` : ""}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="text-green-600 font-medium">{plan.executions.filter((e) => e.status === "PASS").length} ✓</span>
            <span className="text-red-600 font-medium">{plan.executions.filter((e) => e.status === "FAIL").length} ✗</span>
            <span className="text-muted-foreground">/ {cases.length}</span>
          </div>
          {cases.length > 0 && (
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((plan.executions.length / cases.length) * 100)}%` }} />
            </div>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {cases.map((item, i) => {
              const exec = plan.executions.find((e) => e.caseId === item.case.id);
              const Icon = STATUS_ICONS[exec?.status ?? "NOT_EXECUTED"];
              const isActive = i === activeIdx;
              return (
                <div
                  key={item.id}
                  className={`group flex items-start gap-2 p-2.5 rounded-md transition-colors ${isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-accent"}`}
                >
                  <button
                    onClick={() => navigateTo(i)}
                    className="flex items-start gap-2 flex-1 min-w-0 text-left"
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${exec ? STATUS_COLORS[exec.status].split(" ")[0] : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-snug line-clamp-2">{item.case.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.case.format}</p>
                    </div>
                    {isActive && <ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRemoveItemId(item.id); }}
                    className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600"
                    title="Remover do plano"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeItem ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Selecione um caso para executar</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6 max-w-2xl">
              {/* Case card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{activeItem.case.title}</CardTitle>
                    <Badge variant="secondary">{activeItem.case.format}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {activeItem.case.precondition && (
                    <div className="p-2.5 rounded-md bg-slate-50 border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{terms.preCondicao.singular}</p>
                      <p>{activeItem.case.precondition}</p>
                    </div>
                  )}
                  {activeItem.case.format === "BDD" ? (
                    <div className="space-y-2">
                      {activeItem.case.bddGiven && <div className="p-2.5 rounded-md bg-blue-50 border border-blue-200"><span className="font-bold text-blue-900 text-xs uppercase mr-2">{t.cases.given}</span>{activeItem.case.bddGiven}</div>}
                      {activeItem.case.bddWhen && <div className="p-2.5 rounded-md bg-purple-50 border border-purple-200"><span className="font-bold text-purple-900 text-xs uppercase mr-2">{t.cases.when}</span>{activeItem.case.bddWhen}</div>}
                      {activeItem.case.bddThen && <div className="p-2.5 rounded-md bg-green-50 border border-green-200"><span className="font-bold text-green-900 text-xs uppercase mr-2">{t.cases.then}</span>{activeItem.case.bddThen}</div>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeItem.case.steps.map((s) => (
                        <div key={s.id} className="flex gap-2 p-2 rounded-md border">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs shrink-0">{s.order}</span>
                          <p>{s.description}</p>
                        </div>
                      ))}
                      {activeItem.case.expectedResult && (
                        <div className="p-2.5 rounded-md bg-green-50 border border-green-200">
                          <p className="text-xs font-bold text-green-800 mb-1">{t.executions.expected_result}</p>
                          <p>{activeItem.case.expectedResult}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Record result */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">{t.executions.save_result}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {existingResult && (
                    <div className={`flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium ${STATUS_COLORS[existingResult.status]}`}>
                      {(() => { const Icon = STATUS_ICONS[existingResult.status]; return <Icon className="h-4 w-4 shrink-0" />; })()}
                      {STATUS_LABELS[existingResult.status]}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {EXECUTION_STATUSES.map((s) => {
                        const Icon = STATUS_ICONS[s.value] ?? Clock;
                        const selected = activeDraft.status === s.value;
                        return (
                          <button key={s.value} onClick={() => setDraft({ status: s.value })}
                            className="flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium transition-colors hover:bg-accent"
                            style={selected ? { backgroundColor: `${s.color}20`, borderColor: s.color, color: s.color } : undefined}>
                            <Icon className="h-4 w-4 shrink-0" />{s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{terms.bugRelacionado.singular}</Label>
                    <Input placeholder="BUG-123, JIRA-456" value={activeDraft.bugRef} onChange={(e) => setDraft({ bugRef: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t.executions.observations}</Label>
                    <Textarea placeholder={t.executions.obs_placeholder} value={activeDraft.notes} onChange={(e) => setDraft({ notes: e.target.value })} rows={3} />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{terms.evidencia.singular} — Links</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDraft({ links: [...activeDraft.links, ""] })}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {activeDraft.links.map((url, li) => (
                        <div key={li} className="flex gap-2">
                          <div className="relative flex-1">
                            <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              className="pl-8"
                              placeholder="https://..."
                              value={url}
                              onChange={(e) => setDraft({ links: activeDraft.links.map((v, j) => j === li ? e.target.value : v) })}
                            />
                          </div>
                          {activeDraft.links.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0 text-muted-foreground hover:text-red-600"
                              onClick={() => setDraft({ links: activeDraft.links.filter((_, j) => j !== li) })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <ImageUploadField
                    images={activeDraft.images ?? []}
                    onChange={(imgs) => setDraft({ images: imgs })}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigateTo(activeIdx - 1)}
                      disabled={activeIdx === 0 || saving}
                      className="flex-1"
                    >
                      <ChevronLeft className="h-4 w-4" /> {t.common.back}
                    </Button>
                    <Button className="flex-[2]" onClick={saveCase} disabled={saving || activeDraft.status === "NOT_EXECUTED"}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {t.executions.save_result}
                      {activeIdx < cases.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Remove case dialog */}
      {removeItemId && (() => {
        const item = cases.find((c) => c.id === removeItemId);
        const hasExec = !!plan.executions.find((e) => e.caseId === item?.case.id);
        return (
          <Dialog open onOpenChange={() => setRemoveItemId(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" /> Remover do plano
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Remover <strong className="text-foreground">{item?.case.title}</strong> deste plano?</p>
                {hasExec && (
                  <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs">
                    O resultado já registrado para este caso também será removido.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRemoveItemId(null)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  disabled={removeCaseMutation.isPending}
                  onClick={() => removeCaseMutation.mutate(removeItemId)}
                >
                  {removeCaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Remover
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Finish dialog */}
      <Dialog open={finishDialog} onOpenChange={setFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              {t.executions.complete}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t.executions.complete_confirm}
            </p>
            <div className="space-y-2">
              <Label>Status *</Label>
              <div className="grid grid-cols-3 gap-2">
                {EXECUTION_STATUSES.filter((s) => s.value !== "NOT_EXECUTED").map((s) => {
                  const Icon = STATUS_ICONS[s.value] ?? Clock;
                  const selected = planResult === s.value;
                  return (
                    <button key={s.value} onClick={() => setPlanResult(s.value)}
                      className="flex items-center gap-2 p-2.5 rounded-md border text-sm font-medium transition-colors hover:bg-accent"
                      style={selected ? { backgroundColor: `${s.color}20`, borderColor: s.color, color: s.color } : undefined}>
                      <Icon className="h-4 w-4 shrink-0" />{s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.executions.observations}</Label>
              <Textarea placeholder={t.executions.obs_placeholder} value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishDialog(false)}>{t.common.cancel}</Button>
            <Button onClick={() => completePlan.mutate()} disabled={completePlan.isPending}>
              {completePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              {t.executions.complete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   History Tab
═══════════════════════════════════════════════════════════════════ */
function HistoryTab() {
  const qc = useQueryClient();
  const { t } = useLang();
  const { terms } = useTerms();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({ project: [], result: [] });
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects?activeOnly=true").then((r) => r.json()),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["test-plans-history"],
    queryFn: () => fetch("/api/test-plans").then((r) => r.json()),
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => fetch(`/api/test-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test-plans-history"] }),
  });

  const projects = (projectsData?.projects ?? []) as { id: string; name: string }[];

  const filterGroups = [
    {
      key: "project",
      label: t.cases.filter_project,
      options: projects.map((p) => ({ value: p.name, label: p.name })),
    },
    {
      key: "result",
      label: t.cases.filter_format,
      options: [
        { value: "PASS",    label: "Pass",    color: "bg-green-500" },
        { value: "FAIL",    label: "Fail",    color: "bg-red-500" },
        { value: "BLOCKED", label: "Blocked", color: "bg-orange-500" },
        { value: "RETEST",  label: "Retest",  color: "bg-blue-500" },
        { value: "SKIPPED", label: "Skipped", color: "bg-purple-500" },
        { value: "ABORTED", label: "Aborted", color: "bg-gray-400" },
      ],
    },
  ];

  const handleFilterChange = useCallback((key: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }, []);

  const allPlans: TestPlan[] = (data?.plans ?? []).filter((p: TestPlan) =>
    ["COMPLETED", "ABORTED"].includes(p.status)
  );

  const filtered = useMemo(() => {
    return allPlans.filter((plan) => {
      if (filters.project.length && !filters.project.includes(plan.project.name)) return false;
      if (filters.result.length && !filters.result.includes(plan.result ?? "")) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!plan.name.toLowerCase().includes(q) &&
            !plan.project.name.toLowerCase().includes(q) &&
            !plan.environment.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allPlans, filters, search]);

  function toggleExpand(id: string) {
    setExpandedPlans((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <FilterBar
            groups={filterGroups}
            selected={filters}
            onChange={handleFilterChange}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.projects.search_placeholder}
          />
        </div>
        <p className="text-sm text-muted-foreground whitespace-nowrap self-center">
          {filtered.length} {filtered.length === 1 ? terms.execucao.singular.toLowerCase() : terms.execucao.plural.toLowerCase()}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg border bg-white animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-medium mb-1">{t.executions.no_history}</h3>
            <p className="text-sm text-muted-foreground">{t.executions.no_plans_desc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((plan) => {
            const expanded = expandedPlans.has(plan.id);
            const counts = plan.executions.reduce<Record<string, number>>((acc, e) => {
              acc[e.status] = (acc[e.status] ?? 0) + 1; return acc;
            }, {});
            const passRate = counts["PASS"] ? Math.round((counts["PASS"] / plan.executions.length) * 100) : 0;
            const ResultIcon = STATUS_ICONS[plan.result ?? "NOT_EXECUTED"] ?? Clock;

            return (
              <Card key={plan.id} className="overflow-hidden">
                {/* Plan header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/40 transition-colors"
                  onClick={() => toggleExpand(plan.id)}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg border shrink-0 ${STATUS_COLORS[plan.result ?? "NOT_EXECUTED"]}`}>
                    <ResultIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{plan.name}</span>
                      <Badge variant="outline" className="text-xs">{plan.project.name}</Badge>
                      {plan.environment && <Badge variant="secondary" className="text-xs">{plan.environment}</Badge>}
                      {plan.buildVersion && <span className="text-xs font-mono text-muted-foreground">{plan.buildVersion}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {plan.completedAt && <span>{format(new Date(plan.completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>}
                      <span>·</span>
                      <span>{plan.creator.name}</span>
                      <span>·</span>
                      <span>{plan.executions.length} {plan.executions.length === 1 ? t.executions.case_singular : t.executions.case_plural}</span>
                    </div>
                  </div>

                  {/* Status counts + pass rate */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0" onClick={(e) => e.stopPropagation()}>
                    {EXECUTION_STATUSES.filter((s) => counts[s.value]).map((s) => {
                      const Icon = STATUS_ICONS[s.value];
                      return (
                        <div key={s.value} className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${STATUS_COLORS[s.value]}`}>
                          <Icon className="h-3 w-3" />{counts[s.value]}
                        </div>
                      );
                    })}
                    {counts["PASS"] !== undefined && (
                      <div className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                        {passRate}%
                      </div>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { if (confirm(t.executions.delete_plan_confirm)) deletePlan.mutate(plan.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>

                {/* Expanded case results */}
                {expanded && (
                  <div className="border-t divide-y">
                    {plan.executions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t.cases.no_cases}.</p>
                    ) : (
                      plan.executions.map((ex) => {
                        const Icon = STATUS_ICONS[ex.status] ?? Clock;
                        return (
                          <div key={ex.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full border shrink-0 mt-0.5 ${STATUS_COLORS[ex.status]}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{ex.case?.title ?? ex.caseId}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ex.status]}`}>{STATUS_LABELS[ex.status]}</span>
                                {ex.case && <Badge variant="secondary" className="text-xs">{ex.case.format}</Badge>}
                              </div>
                              {ex.relatedBugRef && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                                  <Bug className="h-3 w-3" /> {ex.relatedBugRef}
                                </div>
                              )}
                              {ex.notes && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{ex.notes}</p>}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {plan.notes && (
                      <div className="px-4 py-3 bg-amber-50 border-t">
                        <p className="text-xs font-semibold text-amber-800 mb-1">Observações finais</p>
                        <p className="text-xs text-amber-900">{plan.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── ImageUploadField ─────────────────────────────────────────────── */
function ImageUploadField({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const json = await res.json();
          uploaded.push(json.url as string);
        }
      }
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    onChange(images.filter((u) => u !== url));
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Evidências (imagens)</Label>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="evidência"
                className="h-16 w-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setPreviewUrl(url)}
              />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        <span className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Enviando..." : "Adicionar imagem"}
        </span>
      </label>

      {previewUrl && (
        <Dialog open onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-3xl p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="preview" className="w-full rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
