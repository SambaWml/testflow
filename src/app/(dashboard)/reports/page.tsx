"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { useTerms } from "@/contexts/terms-context";
import { Topbar } from "@/components/layout/topbar";
import { HintIcon } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, Plus, Download, Trash2, CheckCircle2, XCircle,
  Loader2, Eye, Calendar, Copy, Check,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  PASS: "#22c55e", FAIL: "#ef4444", BLOCKED: "#f97316",
  NOT_EXECUTED: "#94a3b8", RETEST: "#3b82f6", SKIPPED: "#a855f7",
};

const STATUS_LABELS: Record<string, string> = {
  PASS: "Pass", FAIL: "Fail", BLOCKED: "Blocked",
  NOT_EXECUTED: "Não Exec.", RETEST: "Retest", SKIPPED: "Skipped",
};

function buildMarkdown(
  report: {
    title: string; environment: string | null; buildVersion: string | null;
    generatedAt: string; notes: string | null;
    project: { name: string }; author: { name: string };
    items: {
      execution: {
        status: string; notes: string | null; relatedBugRef: string | null;
        executor: { name: string }; executedAt: string | null;
        evidence: { type: string; storageKey: string | null; linkUrl: string | null }[];
        case: {
          title: string; format: string; precondition: string | null; priority: string;
          bddGiven: string | null; bddWhen: string | null; bddThen: string | null;
          expectedResult: string | null;
          steps: { order: number; description: string; expectedData: string | null }[];
        };
      };
    }[];
  },
  terms: import("@/lib/term-config").Terms,
  t: import("@/lib/i18n").Translation,
  lang: import("@/lib/i18n").Lang,
) {
  const STATUS_EMOJI: Record<string, string> = {
    PASS: "✅", FAIL: "❌", BLOCKED: "🚫", NOT_EXECUTED: "⏸️", RETEST: "🔁", SKIPPED: "⏭️",
  };
  const locale = lang === "pt-BR" ? ptBR : undefined;
  const dateStr = format(new Date(report.generatedAt), lang === "pt-BR" ? "dd/MM/yyyy 'às' HH:mm" : "MM/dd/yyyy 'at' HH:mm", { locale });

  const lines: string[] = [
    `# ${report.title}`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **${terms.projeto.singular}** | ${report.project.name} |`,
    `| **${t.reports.responsible}** | ${report.author.name} |`,
    `| **${t.reports.generated_at}** | ${dateStr} |`,
    ...(report.environment ? [`| **${terms.ambiente.singular}** | ${report.environment} |`] : []),
    ...(report.buildVersion ? [`| **${terms.build.singular}** | ${report.buildVersion} |`] : []),
    `| **${terms.casoDeTeste.plural}** | ${report.items.length} |`,
    ``,
    `---`,
    ``,
    `## ${terms.casoDeTeste.plural}`,
    ``,
  ];

  report.items.forEach(({ execution: ex }, i) => {
    const emoji = STATUS_EMOJI[ex.status] ?? "❓";
    const label = STATUS_LABELS[ex.status] ?? ex.status;

    lines.push(`### ${i + 1}. ${ex.case.title}`);
    lines.push(``);
    lines.push(`| | |`);
    lines.push(`|--|--|`);
    lines.push(`| **Status** | ${emoji} ${label} |`);
    lines.push(`| **Formato** | ${ex.case.format === "BDD" ? "BDD" : "Step by Step"} |`);
    lines.push(`| **Prioridade** | ${ex.case.priority} |`);
    if (ex.executor?.name) lines.push(`| **${t.reports.responsible}** | ${ex.executor.name} |`);
    if (ex.executedAt) lines.push(`| **${t.reports.date}** | ${format(new Date(ex.executedAt), "dd/MM/yyyy HH:mm", { locale })} |`);
    if (ex.relatedBugRef) lines.push(`| **${terms.bugRelacionado.singular}** | 🐛 ${ex.relatedBugRef} |`);
    lines.push(``);

    if (ex.case.precondition) {
      lines.push(`**${terms.preCondicao.singular}:** ${ex.case.precondition}`);
      lines.push(``);
    }

    if (ex.case.format === "BDD") {
      if (ex.case.bddGiven) lines.push(`> **${t.cases.given}** ${ex.case.bddGiven}`);
      if (ex.case.bddWhen)  lines.push(`> **${t.cases.when}** ${ex.case.bddWhen}`);
      if (ex.case.bddThen)  lines.push(`> **${t.cases.then}** ${ex.case.bddThen}`);
      lines.push(``);
    } else if (ex.case.steps.length > 0) {
      lines.push(`| # | Passo | ${t.cases.expected_result} |`);
      lines.push(`|---|-------|--------------------|`);
      ex.case.steps.forEach((s) => {
        lines.push(`| ${s.order} | ${s.description} | ${s.expectedData ?? "—"} |`);
      });
      lines.push(``);
      if (ex.case.expectedResult) {
        lines.push(`**${t.cases.expected_result}:** ${ex.case.expectedResult}`);
        lines.push(``);
      }
    }

    if (ex.notes) {
      lines.push(`> 📝 *${ex.notes}*`);
      lines.push(``);
    }

    const allEvidence = ex.evidence ?? [];
    if (allEvidence.length > 0) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      lines.push(`**Evidências:**`);
      lines.push(``);
      allEvidence.forEach((ev, idx) => {
        const label = `Evidência ${idx + 1}`;
        if (ev.type === "IMAGE" && ev.storageKey) {
          lines.push(`- [${label} (imagem)](${origin}${ev.storageKey})`);
        } else if (ev.type === "LINK" && ev.linkUrl) {
          lines.push(`- [${label} (link)](${ev.linkUrl})`);
        } else if (ev.storageKey) {
          lines.push(`- [${label}](${origin}${ev.storageKey})`);
        }
      });
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(``);
  });

  if (report.notes) {
    lines.push(`## ${t.reports.final_notes}`);
    lines.push(``);
    lines.push(report.notes);
    lines.push(``);
  }

  return lines.join("\n");
}

interface TestPlanOption {
  id: string; name: string; status: string; result: string | null;
  environment: string; buildVersion: string | null; notes: string | null;
  project: { id: string; name: string };
  _count?: { executions: number };
  executions: { id: string; status: string }[];
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const { t, lang } = useLang();
  const { terms } = useTerms();
  const [buildingReport, setBuildingReport] = useState(false);
  const [viewingReport, setViewingReport] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => fetch("/api/reports").then((r) => r.json()),
  });

  const { data: plansData } = useQuery({
    queryKey: ["test-plans-completed"],
    queryFn: () => fetch("/api/test-plans").then((r) => r.json()),
    enabled: buildingReport,
  });

  const { data: reportDetail } = useQuery({
    queryKey: ["report", viewingReport],
    queryFn: () => fetch(`/api/reports/${viewingReport}`).then((r) => r.json()),
    enabled: !!viewingReport,
  });

  const completedPlans: TestPlanOption[] = (plansData?.plans ?? []).filter(
    (p: TestPlanOption) => p.status === "COMPLETED"
  );

  const selectedPlan = completedPlans.find((p) => p.id === selectedPlanId) ?? null;

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testPlanId: selectedPlanId, title, notes }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`);
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      setBuildingReport(false);
      setSelectedPlanId(""); setTitle(""); setNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/reports/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });

  async function copyAsMarkdown(reportId: string) {
    const data = await fetch(`/api/reports/${reportId}`).then((r) => r.json());
    const md = buildMarkdown(data, terms, t, lang);
    await navigator.clipboard.writeText(md);
    setCopiedId(reportId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const reportsList = reports?.reports ?? [];

  const computeStats = (items: { execution: { status: string } }[]) => {
    const counts: Record<string, number> = {};
    items.forEach(({ execution: ex }) => {
      counts[ex.status] = (counts[ex.status] ?? 0) + 1;
    });
    const total = items.length;
    const pass = counts.PASS ?? 0;
    const executed = total - (counts.NOT_EXECUTED ?? 0) - (counts.SKIPPED ?? 0);
    const passRate = executed > 0 ? Math.round((pass / executed) * 100) : 0;
    return { counts, total, passRate };
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={terms.relatorio.plural}
        subtitle={t.reports.subtitle}
        actions={
          <Button onClick={() => setBuildingReport(true)} size="sm">
            <Plus className="h-4 w-4" /> {t.common.new} {terms.relatorio.singular}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-28 rounded-lg border bg-white animate-pulse" />)}
          </div>
        ) : reportsList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">{t.reports.no_reports}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t.reports.no_reports_desc}</p>
              <Button onClick={() => setBuildingReport(true)}><Plus className="h-4 w-4" /> {t.common.new} {terms.relatorio.singular}</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reportsList.map((r: {
              id: string; title: string; environment: string | null; buildVersion: string | null;
              generatedAt: string; metadata: string; project: { name: string };
              _count: { items: number };
            }) => {
              const meta = JSON.parse(r.metadata || "{}");
              return (
                <Card key={r.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold">{r.title}</h3>
                          <Badge variant="secondary">{r.project.name}</Badge>
                          {meta.testPlanName && meta.testPlanName !== r.title && (
                            <Badge variant="outline" className="text-xs">📋 {meta.testPlanName}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {r.environment && <span>🖥 {r.environment}</span>}
                          {r.buildVersion && <span>🏷 {r.buildVersion}</span>}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(r.generatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          <span>{r._count.items} {r._count.items === 1 ? t.reports.case_singular : t.reports.case_plural}</span>
                        </div>
                        {meta.passRate !== undefined && (
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1.5 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="font-semibold text-green-700">{meta.counts?.PASS ?? 0} Pass</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm">
                              <XCircle className="h-4 w-4 text-red-500" />
                              <span className="font-semibold text-red-700">{meta.counts?.FAIL ?? 0} Fail</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="font-semibold text-orange-700">{meta.counts?.BLOCKED ?? 0} Blocked</span>
                            </div>
                            <Badge variant={meta.passRate >= 80 ? "success" : meta.passRate >= 50 ? "warning" : "destructive"} className="ml-2">
                              {meta.passRate}%
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setViewingReport(r.id)}>
                          <Eye className="h-4 w-4" /> {t.reports.view}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.open(`/api/reports/${r.id}/pdf`, "_blank")}>
                          <Download className="h-4 w-4" /> PDF
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => copyAsMarkdown(r.id)}
                          className={copiedId === r.id ? "text-green-600 border-green-300 bg-green-50" : ""}
                        >
                          {copiedId === r.id
                            ? <><Check className="h-4 w-4" /> {t.reports.copied}</>
                            : <><Copy className="h-4 w-4" /> {t.reports.copy_md}</>
                          }
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500"
                          onClick={() => { if (confirm(t.reports.delete)) deleteMutation.mutate(r.id); }}>
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

      {/* Build Report Dialog */}
      <Dialog open={buildingReport} onOpenChange={(o) => { if (!o) { setBuildingReport(false); setSelectedPlanId(""); setTitle(""); setNotes(""); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.common.new} {terms.relatorio.singular}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{terms.planoDeTeste.singular} *</Label>
              {completedPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-md border p-3 bg-muted/40">
                  {t.reports.no_completed_plans}
                </p>
              ) : (
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano concluído..." /></SelectTrigger>
                  <SelectContent>
                    {completedPlans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedPlan && (
              <>
                {/* Plan preview */}
                <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>📁 {selectedPlan.project.name}</span>
                    {selectedPlan.environment && <span>🖥 {selectedPlan.environment}</span>}
                    {selectedPlan.buildVersion && <span>🏷 {selectedPlan.buildVersion}</span>}
                    <span>✅ {selectedPlan.executions.length} {selectedPlan.executions.length === 1 ? t.reports.case_singular : t.reports.case_plural}</span>
                  </div>
                  {/* mini status summary */}
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(
                      selectedPlan.executions.reduce<Record<string, number>>((acc, e) => {
                        acc[e.status] = (acc[e.status] ?? 0) + 1; return acc;
                      }, {})
                    ).map(([st, count]) => (
                      <StatusBadge key={st} status={st} count={count} />
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label>{t.reports.report_title} <HintIcon text={t.reports.report_title_hint} /></Label>
                  <Input
                    placeholder={selectedPlan.name}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t.reports.notes}</Label>
                  <Textarea
                    placeholder={t.reports.notes_placeholder}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}

            {createMutation.isError && (
              <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                {(createMutation.error as Error)?.message ?? "Erro ao gerar relatório"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuildingReport(false)}>{t.common.cancel}</Button>
            <Button
              disabled={!selectedPlanId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              {createMutation.isPending ? t.reports.creating : t.reports.create_btn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Report Dialog */}
      <Dialog open={!!viewingReport} onOpenChange={(o) => !o && setViewingReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reportDetail?.title ?? terms.relatorio.singular}</DialogTitle>
          </DialogHeader>
          {reportDetail && <ReportView report={reportDetail} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.open(`/api/reports/${viewingReport}/pdf`, "_blank")}>
              <Download className="h-4 w-4" /> PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status, count }: { status: string; count?: number }) {
  const colors: Record<string, string> = {
    PASS: "bg-green-100 text-green-800", FAIL: "bg-red-100 text-red-800",
    BLOCKED: "bg-orange-100 text-orange-800", NOT_EXECUTED: "bg-gray-100 text-gray-700",
    RETEST: "bg-blue-100 text-blue-800", SKIPPED: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {STATUS_LABELS[status] ?? status}{count !== undefined ? ` (${count})` : ""}
    </span>
  );
}

function ReportView({ report }: { report: {
  title: string; environment: string | null; buildVersion: string | null; generatedAt: string;
  notes: string | null; project: { name: string }; author: { name: string };
  items: {
    execution: {
      status: string; notes: string | null; relatedBugRef: string | null;
      executor: { name: string }; executedAt: string | null;
      case: { title: string; format: string };
      evidence: { type: string; fileName: string; linkUrl: string | null; publicUrl: string | null; storageKey: string | null }[];
    };
  }[];
} }) {
  const { t, lang } = useLang();
  const { terms } = useTerms();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const locale = lang === "pt-BR" ? ptBR : undefined;

  const { counts, total, passRate } = (() => {
    const c: Record<string, number> = {};
    report.items.forEach(({ execution: ex }) => { c[ex.status] = (c[ex.status] ?? 0) + 1; });
    const tot = report.items.length;
    const p = c.PASS ?? 0;
    const exec = tot - (c.NOT_EXECUTED ?? 0) - (c.SKIPPED ?? 0);
    return { counts: c, total: tot, passRate: exec > 0 ? Math.round((p / exec) * 100) : 0 };
  })();

  const chartData = Object.entries(counts).map(([name, value]) => ({ name: STATUS_LABELS[name] ?? name, value }));
  const bugs = report.items.filter(({ execution: ex }) => ex.relatedBugRef).map(({ execution: ex }) => ex.relatedBugRef!);

  return (
    <div className="space-y-6 text-sm">
      {/* Header */}
      <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border">
        <div><p className="text-xs text-muted-foreground">{terms.projeto.singular}</p><p className="font-medium">{report.project.name}</p></div>
        <div><p className="text-xs text-muted-foreground">{t.reports.responsible}</p><p className="font-medium">{report.author.name}</p></div>
        {report.environment && <div><p className="text-xs text-muted-foreground">{terms.ambiente.singular}</p><p className="font-medium">{report.environment}</p></div>}
        {report.buildVersion && <div><p className="text-xs text-muted-foreground">{terms.build.singular}</p><p className="font-medium">{report.buildVersion}</p></div>}
        <div><p className="text-xs text-muted-foreground">{t.reports.date}</p><p className="font-medium">{format(new Date(report.generatedAt), "dd/MM/yyyy HH:mm", { locale })}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">{terms.casoDeTeste.plural}</p>
          <p className="font-medium">{total}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="font-semibold">{t.reports.status_summary}</p>
          {Object.entries(counts).map(([s, v]) => (
            <div key={s} className="flex items-center justify-between">
              <StatusBadge status={s} />
              <span className="font-medium">{v} ({Math.round((v / total) * 100)}%)</span>
            </div>
          ))}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between font-semibold">
              <span>{t.reports.pass_rate_label}</span>
              <span className={passRate >= 80 ? "text-green-600" : passRate >= 50 ? "text-yellow-600" : "text-red-600"}>
                {passRate}%
              </span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
              {chartData.map((entry) => {
                const key = Object.keys(STATUS_LABELS).find((k) => STATUS_LABELS[k] === entry.name) ?? entry.name;
                return <Cell key={entry.name} fill={STATUS_COLORS[key] ?? "#94a3b8"} />;
              })}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <Separator />

      {/* Cases table */}
      <div>
        <p className="font-semibold mb-3">{t.reports.cases_executed}</p>
        <div className="space-y-2">
          {report.items.map(({ execution: ex }, i) => (
            <div key={i} className="p-3 rounded-md border flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs">{ex.case.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{ex.executor.name}</span>
                  {ex.executedAt && <span className="text-xs text-muted-foreground">{format(new Date(ex.executedAt), "dd/MM HH:mm", { locale })}</span>}
                  {ex.relatedBugRef && <span className="text-xs font-mono text-red-600">🐛 {ex.relatedBugRef}</span>}
                </div>
                {ex.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{ex.notes}"</p>}
                {ex.evidence.filter((ev) => ev.type === "IMAGE" && ev.storageKey).length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {ex.evidence.filter((ev) => ev.type === "IMAGE" && ev.storageKey).map((ev, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={ev.storageKey!}
                        alt={`evidência ${i + 1}`}
                        className="h-12 w-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewUrl(ev.storageKey!)}
                      />
                    ))}
                  </div>
                )}
                {ex.evidence.filter((ev) => ev.type === "LINK" && ev.linkUrl).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ex.evidence.filter((ev) => ev.type === "LINK" && ev.linkUrl).map((ev, i) => (
                      <a key={i} href={ev.linkUrl!} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline truncate max-w-[160px]">
                        🔗 {ev.fileName || ev.linkUrl}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <StatusBadge status={ex.status} />
            </div>
          ))}
        </div>
      </div>

      {bugs.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="font-semibold mb-2">{t.reports.bugs_found}</p>
            <div className="flex flex-wrap gap-2">
              {[...new Set(bugs)].map((b) => (
                <span key={b} className="text-xs font-mono bg-red-50 text-red-800 border border-red-200 px-2 py-1 rounded">🐛 {b}</span>
              ))}
            </div>
          </div>
        </>
      )}

      {report.notes && (
        <>
          <Separator />
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
            <p className="font-semibold text-amber-900 mb-1">{t.reports.final_notes}</p>
            <p className="text-amber-800">{report.notes}</p>
          </div>
        </>
      )}

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
