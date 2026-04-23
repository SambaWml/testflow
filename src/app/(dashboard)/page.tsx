"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, TestTube2, Play, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Clock,
  Wand2, ArrowRight, Bug, BarChart3, Users, FolderOpen, ChevronDown, ShieldOff, X,
} from "lucide-react";
import Link from "next/link";
import { useTerms } from "@/contexts/terms-context";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PASS: "#22c55e",
  FAIL: "#ef4444",
  BLOCKED: "#f97316",
  NOT_EXECUTED: "#94a3b8",
  RETEST: "#3b82f6",
  SKIPPED: "#a855f7",
};

const BUG_STATUS_COLORS: Record<string, string> = {
  OPEN: "#ef4444",
  IN_PROGRESS: "#f97316",
  RESOLVED: "#22c55e",
  CLOSED: "#94a3b8",
  BLOCKED: "#a855f7",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#22c55e",
};

const PERIODS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
];

type QAView = "overview" | "byQA" | "byProject" | "byBug";

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useLang();
  const { terms } = useTerms();
  const user = session?.user as {
    isSuperAdmin?: boolean; orgRole?: string; name?: string; email?: string;
  } | undefined;


  const [qaView, setQaView] = useState<QAView>("overview");
  const [period, setPeriod] = useState(30);
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterBugStatus, setFilterBugStatus] = useState("");
  const [filterBugPriority, setFilterBugPriority] = useState("");

  const activeFilterCount = [filterProjectId, filterUserId, filterBugStatus, filterBugPriority].filter(Boolean).length;

  function clearAllFilters() {
    setFilterProjectId("");
    setFilterUserId("");
    setFilterBugStatus("");
    setFilterBugPriority("");
  }

  const canAccessQA = user?.orgRole === "OWNER" || user?.orgRole === "ADMIN";

  // Org feature flags
  const { data: features } = useQuery<{
    overviewEnabled: boolean;
    overviewName: string;
    qaDashboardEnabled: boolean;
    qaDashboardName: string;
  }>({
    queryKey: ["org-features"],
    queryFn: () => fetch("/api/orgs/features").then((r) => r.json()),
    staleTime: 60_000,
  });

  const overviewEnabled = features?.overviewEnabled ?? true;
  const overviewName = features?.overviewName ?? "Visão Geral";
  const qaDashboardEnabled = features?.qaDashboardEnabled ?? true;
  const qaDashboardName = features?.qaDashboardName ?? "Dashboard QA";

  const QA_VIEWS = [
    { key: "overview" as const, label: terms.qaOverview.singular, icon: BarChart3 },
    { key: "byQA" as const, label: terms.porQA.singular, icon: Users },
    { key: "byProject" as const, label: terms.porProjeto.singular, icon: FolderOpen },
    { key: "byBug" as const, label: terms.porBug.singular, icon: Bug },
  ];

  // Determine which tab is active — auto-redirect if the saved tab is now disabled
  const defaultTab = overviewEnabled ? "geral" : (canAccessQA && qaDashboardEnabled ? "qa" : "geral");
  const [activeTab, setActiveTab] = useState<"geral" | "qa">(defaultTab);

  // Keep activeTab in sync when features load
  useEffect(() => {
    if (activeTab === "geral" && !overviewEnabled && canAccessQA && qaDashboardEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("qa");
    } else if (activeTab === "qa" && !qaDashboardEnabled && overviewEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("geral");
    }
  }, [overviewEnabled, qaDashboardEnabled, canAccessQA, activeTab]);

  // Super Admin não acessa o dashboard — vai para /admin
  useEffect(() => {
    if ((session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin) {
      router.replace("/admin");
    }
  }, [session, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
  });

  const qaParams = new URLSearchParams({ period: String(period) });
  if (filterProjectId)  qaParams.set("projectId",   filterProjectId);
  if (filterUserId)     qaParams.set("userId",       filterUserId);
  if (filterBugStatus)  qaParams.set("bugStatus",    filterBugStatus);
  if (filterBugPriority) qaParams.set("bugPriority", filterBugPriority);

  const { data: qaData, isLoading: qaLoading } = useQuery({
    queryKey: ["dashboard-qa", period, filterProjectId, filterUserId, filterBugStatus, filterBugPriority],
    queryFn: () => fetch(`/api/dashboard/qa?${qaParams}`).then((r) => r.json()),
    enabled: canAccessQA && activeTab === "qa",
  });

  const stats = data?.stats ?? { items: 0, cases: 0, executions: 0, passRate: 0 };
  const statusData = data?.statusDistribution ?? [];
  const recentReports = data?.recentReports ?? [];
  const recentPlans = data?.recentPlans ?? [];

  const qaStats = qaData?.stats ?? { bugs: 0, plans: 0, reports: 0 };
  const bugDistribution = qaData?.bugDistribution ?? [];
  const bugByPriority = qaData?.bugByPriority ?? [];
  const byProject = qaData?.byProject ?? [];
  const byQA = qaData?.byQA ?? [];
  const recentBugs = qaData?.recentBugs ?? [];
  const qaRecentPlans = qaData?.recentPlans ?? [];
  const members = qaData?.members ?? [];
  const projects = qaData?.projects ?? [];

  const quickActions = [
    { href: "/projects", icon: FileText, label: t.dashboard.register_item, desc: t.dashboard.register_item_desc },
    { href: "/generator", icon: Wand2, label: t.dashboard.generate_ia, desc: t.dashboard.generate_ia_desc },
    { href: "/executions", icon: Play, label: t.dashboard.start_execution, desc: t.dashboard.start_execution_desc },
    { href: "/reports", icon: TrendingUp, label: t.dashboard.generate_report, desc: t.dashboard.generate_report_desc },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      {/* Tab bar — only render if at least one tab is visible */}
      {(overviewEnabled || (canAccessQA && qaDashboardEnabled)) && (
        <div className="border-b border-border/60 px-6 shrink-0">
          <div className="flex gap-0">
            {overviewEnabled && (
              <TabButton active={activeTab === "geral"} onClick={() => setActiveTab("geral")}>
                Visão Geral
              </TabButton>
            )}
            {canAccessQA && qaDashboardEnabled && (
              <TabButton active={activeTab === "qa"} onClick={() => setActiveTab("qa")}>
                {qaDashboardName}
              </TabButton>
            )}
          </div>
        </div>
      )}

      {/* ── Visão Geral ── */}
      {activeTab === "geral" && overviewEnabled && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={FileText} label={t.dashboard.total_items} value={stats.items} color="text-blue-600" bg="bg-blue-50" loading={isLoading} />
            <StatCard icon={TestTube2} label={terms.casoDeTeste.plural} value={stats.cases} color="text-purple-600" bg="bg-purple-50" loading={isLoading} />
            <StatCard icon={Play} label={terms.execucao.plural} value={stats.executions} color="text-orange-600" bg="bg-orange-50" loading={isLoading} />
            <StatCard icon={TrendingUp} label={t.dashboard.pass_rate} value={`${stats.passRate}%`} color="text-green-600" bg="bg-green-50" loading={isLoading} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.dashboard.status_distribution}</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                        {statusData.map((entry: { name: string; value: number }) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                    {t.dashboard.no_executions}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.dashboard.quick_actions}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickActions.map((action) => (
                  <Link key={action.href} href={action.href} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent transition-colors group">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                      <action.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {recentPlans.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t.dashboard.recent_executions}</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/executions">{t.dashboard.see_all} <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentPlans.map((plan: {
                    id: string; name: string; status: string; result: string | null;
                    environment: string; createdAt: string; project: { name: string };
                    totalCases: number; passRate: number | null;
                  }) => (
                    <div key={plan.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <PlanStatusIcon status={plan.status} result={plan.result} />
                        <div>
                          <p className="text-sm font-medium truncate max-w-xs">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {plan.project.name}
                            {plan.environment && ` · ${plan.environment}`}
                            {" · "}{format(new Date(plan.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{plan.totalCases} casos</span>
                        {plan.passRate !== null
                          ? <Badge variant={plan.passRate >= 80 ? "success" : plan.passRate >= 50 ? "warning" : "destructive"}>{plan.passRate}% Pass</Badge>
                          : <PlanStatusBadge status={plan.status} />
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recentReports.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t.dashboard.recent_reports}</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/reports">{t.dashboard.see_all_reports} <ArrowRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentReports.map((r: { id: string; title: string; environment: string | null; generatedAt: string; metadata: string }) => {
                    const meta = JSON.parse(r.metadata || "{}");
                    return (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.environment ?? "—"} · {format(new Date(r.generatedAt), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        {meta.passRate !== undefined && (
                          <Badge variant={meta.passRate >= 80 ? "success" : meta.passRate >= 50 ? "warning" : "destructive"}>
                            {meta.passRate}% Pass
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Dashboard QA ── */}
      {activeTab === "qa" && qaDashboardEnabled && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sub-view selector */}
          <div className="flex rounded-lg border bg-card p-0.5 gap-0.5 self-start">
            {QA_VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setQaView(v.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  qaView === v.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>

          {/* Filter bar — Jira-style labeled dropdowns */}
          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card/60 px-4 py-3">
            {/* Period */}
            <FilterSelect
              label="Período"
              value={String(period)}
              onChange={(v) => setPeriod(Number(v))}
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </FilterSelect>

            {/* Project */}
            <FilterSelect
              label={terms.projeto.singular}
              value={filterProjectId}
              onChange={setFilterProjectId}
              active={!!filterProjectId}
            >
              <option value="">Todos os {terms.projeto.plural.toLowerCase()}</option>
              {projects.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </FilterSelect>

            {/* Member */}
            <FilterSelect
              label={terms.membro.singular}
              value={filterUserId}
              onChange={setFilterUserId}
              active={!!filterUserId}
            >
              <option value="">Todos os {terms.membro.plural.toLowerCase()}</option>
              {members.map((m: { id: string; name: string }) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </FilterSelect>

            {/* Bug Status */}
            <FilterSelect
              label={`Status do ${terms.bug.singular.toLowerCase()}`}
              value={filterBugStatus}
              onChange={setFilterBugStatus}
              active={!!filterBugStatus}
            >
              <option value="">Todos os status</option>
              <option value="OPEN">Aberto</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="RESOLVED">Resolvido</option>
              <option value="CLOSED">Fechado</option>
              <option value="BLOCKED">Bloqueado</option>
            </FilterSelect>

            {/* Bug Priority */}
            <FilterSelect
              label="Prioridade"
              value={filterBugPriority}
              onChange={setFilterBugPriority}
              active={!!filterBugPriority}
            >
              <option value="">Todas as prioridades</option>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Média</option>
              <option value="LOW">Baixa</option>
            </FilterSelect>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
              >
                <X className="h-3 w-3" />
                Limpar filtros
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
                  {activeFilterCount}
                </span>
              </button>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={Bug} label={`${terms.bug.plural} criados`} value={qaStats.bugs} color="text-red-600" bg="bg-red-50" loading={qaLoading} />
            <StatCard icon={Play} label={`${terms.planoDeTeste.plural} executados`} value={qaStats.plans} color="text-orange-600" bg="bg-orange-50" loading={qaLoading} />
            <StatCard icon={BarChart3} label={`${terms.relatorio.plural} gerados`} value={qaStats.reports} color="text-blue-600" bg="bg-blue-50" loading={qaLoading} />
          </div>

          {/* ── Visão Geral ── */}
          {qaView === "overview" && (
            <div className="grid lg:grid-cols-2 gap-5">
              {/* Bug distribution by status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição de {terms.bug.plural} por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {bugDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={bugDistribution.map((b: { status: string; count: number }) => ({ name: b.status, value: b.count }))} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                          {bugDistribution.map((b: { status: string; count: number }) => (
                            <Cell key={b.status} fill={BUG_STATUS_COLORS[b.status] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="Nenhum bug registrado neste período" />
                  )}
                </CardContent>
              </Card>

              {/* Bug distribution by priority */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{terms.bug.plural} por Prioridade</CardTitle>
                </CardHeader>
                <CardContent>
                  {bugByPriority.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={bugByPriority.map((b: { priority: string; count: number }) => ({ name: b.priority, bugs: b.count }))} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="bugs" name={terms.bug.plural} radius={[4, 4, 0, 0]}>
                          {bugByPriority.map((b: { priority: string; count: number }) => (
                            <Cell key={b.priority} fill={PRIORITY_COLORS[b.priority] ?? "#94a3b8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="Nenhum bug neste período" />
                  )}
                </CardContent>
              </Card>

              {/* Recent test plans */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">{terms.planoDeTeste.plural} Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {qaRecentPlans.length > 0 ? (
                    <div className="space-y-2">
                      {qaRecentPlans.slice(0, 6).map((plan: {
                        id: string; name: string; status: string; result: string | null;
                        createdAt: string; project: { name: string }; qa: { name: string };
                        totalCases: number; passRate: number | null;
                      }) => (
                        <div key={plan.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <PlanStatusIcon status={plan.status} result={plan.result} />
                            <div>
                              <p className="text-sm font-medium truncate max-w-xs">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {plan.project.name} · {plan.qa.name} · {format(new Date(plan.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{plan.totalCases} casos</span>
                            {plan.passRate !== null
                              ? <Badge variant={plan.passRate >= 80 ? "success" : plan.passRate >= 50 ? "warning" : "destructive"}>{plan.passRate}% Pass</Badge>
                              : <PlanStatusBadge status={plan.status} />
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma execução neste período</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Por QA ── */}
          {qaView === "byQA" && (
            <div className="space-y-4">
              {/* Grouped bar chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Atividade dos Membros</CardTitle>
                </CardHeader>
                <CardContent>
                  {byQA.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={byQA.map((qa: { id: string; name: string; bugs: number; plans: number; reports: number }) => ({
                          name: qa.name.split(" ")[0],
                          fullName: qa.name,
                          bugs: qa.bugs,
                          planos: qa.plans,
                          relatorios: qa.reports,
                        }))}
                        barCategoryGap="25%"
                        barGap={3}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          formatter={(value, name) => [value, name]}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                          contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="bugs" name={terms.bug.plural} fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          <LabelList dataKey="bugs" position="top" style={{ fontSize: 11, fill: "#ef4444", fontWeight: 600 }} />
                        </Bar>
                        <Bar dataKey="planos" name={terms.planoDeTeste.plural} fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          <LabelList dataKey="planos" position="top" style={{ fontSize: 11, fill: "#f97316", fontWeight: 600 }} />
                        </Bar>
                        <Bar dataKey="relatorios" name={terms.relatorio.plural} fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          <LabelList dataKey="relatorios" position="top" style={{ fontSize: 11, fill: "#3b82f6", fontWeight: 600 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="Nenhuma atividade registrada neste período" />
                  )}
                </CardContent>
              </Card>

              {/* Detail table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalhamento por Membro</CardTitle>
                </CardHeader>
                <CardContent>
                  {byQA.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Membro</th>
                            <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">{terms.bug.plural}</th>
                            <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">{terms.planoDeTeste.plural}</th>
                            <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">{terms.relatorio.plural}</th>
                            <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byQA
                            .slice()
                            .sort((a: { bugs: number; plans: number; reports: number }, b: { bugs: number; plans: number; reports: number }) =>
                              (b.bugs + b.plans + b.reports) - (a.bugs + a.plans + a.reports)
                            )
                            .map((qa: { id: string; name: string; bugs: number; plans: number; reports: number }) => {
                              const total = qa.bugs + qa.plans + qa.reports;
                              return (
                                <tr key={qa.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                  <td className="py-2.5 px-3 font-medium">{qa.name}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={cn("inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded text-xs font-semibold", qa.bugs > 0 ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "text-muted-foreground")}>{qa.bugs}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={cn("inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded text-xs font-semibold", qa.plans > 0 ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" : "text-muted-foreground")}>{qa.plans}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={cn("inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded text-xs font-semibold", qa.reports > 0 ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "text-muted-foreground")}>{qa.reports}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className={cn("inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded text-xs font-bold", total > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground")}>{total}</span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada neste período</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Por Projeto ── */}
          {qaView === "byProject" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Atividade por Projeto</CardTitle>
              </CardHeader>
              <CardContent>
                {byProject.length > 0 ? (
                  <div className="space-y-3">
                    {byProject.map((proj: { id: string; name: string; bugs: number; plans: number; reports: number }) => {
                      const total = proj.bugs + proj.plans + proj.reports;
                      return (
                        <div key={proj.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-medium text-sm">{proj.name}</p>
                            <span className="text-xs text-muted-foreground">{total} atividade{total !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="text-center">
                              <p className="text-xl font-bold text-red-600">{proj.bugs}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{terms.bug.plural}</p>
                            </div>
                            <div className="text-center border-x border-border">
                              <p className="text-xl font-bold text-orange-600">{proj.plans}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{terms.planoDeTeste.plural}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-blue-600">{proj.reports}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{terms.relatorio.plural}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade por projeto neste período</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Por Bugs ── */}
          {qaView === "byBug" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{terms.bug.plural} Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                {recentBugs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Título</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">{terms.projeto.singular}</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Autor</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Prioridade</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Status</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBugs.map((bug: {
                          id: string; title: string; status: string; priority: string; createdAt: string;
                          project: { name: string }; author: { name: string };
                        }) => (
                          <tr key={bug.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 font-medium truncate max-w-[200px]">{bug.title}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{bug.project.name}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{bug.author.name}</td>
                            <td className="py-2.5 px-3">
                              <PriorityBadge priority={bug.priority} />
                            </td>
                            <td className="py-2.5 px-3">
                              <BugStatusBadge status={bug.status} />
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs">
                              {format(new Date(bug.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum bug registrado neste período</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Member with no QA access trying to view QA tab (shouldn't happen due to conditional tab rendering) */}
      {activeTab === "qa" && !canAccessQA && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <ShieldOff className="h-12 w-12 opacity-30" />
          <p className="text-sm">Você não tem permissão para acessar o Dashboard QA.</p>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
      )}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  active = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("text-[10px] font-semibold uppercase tracking-wide", active ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-8 pl-3 pr-8 text-sm rounded-lg border appearance-none cursor-pointer bg-background text-foreground transition-colors",
            active ? "border-primary/60 bg-primary/5 text-primary font-medium" : "border-border"
          )}
        >
          {children}
        </select>
        <ChevronDown className={cn("pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5", active ? "text-primary" : "text-muted-foreground")} />
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">{label}</div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg, loading }: { icon: React.ElementType; label: string; value: string | number; color: string; bg: string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${loading ? "animate-pulse text-muted-foreground" : ""}`}>
              {loading ? "—" : value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanStatusIcon({ status, result }: { status: string; result: string | null }) {
  if (status === "COMPLETED") {
    if (result === "PASS") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    if (result === "FAIL") return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    return <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />;
  }
  if (status === "IN_PROGRESS") return <Play className="h-4 w-4 text-orange-500 shrink-0" />;
  return <Clock className="h-4 w-4 text-gray-400 shrink-0" />;
}

function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" | "info" }> = {
    PENDING:     { label: "Pendente",     variant: "secondary" },
    IN_PROGRESS: { label: "Em andamento", variant: "info" },
    COMPLETED:   { label: "Concluído",    variant: "success" },
    CANCELLED:   { label: "Cancelado",    variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; className: string }> = {
    CRITICAL: { label: "Crítico",  className: "bg-red-50 text-red-700 border-red-200" },
    HIGH:     { label: "Alta",     className: "bg-red-50 text-red-600 border-red-200" },
    MEDIUM:   { label: "Média",    className: "bg-amber-50 text-amber-700 border-amber-200" },
    LOW:      { label: "Baixa",    className: "bg-green-50 text-green-700 border-green-200" },
  };
  const { label, className } = map[priority] ?? { label: priority, className: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", className)}>{label}</span>;
}

function BugStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    OPEN:        { label: "Aberto",      className: "bg-red-50 text-red-700 border-red-200" },
    IN_PROGRESS: { label: "Em análise",  className: "bg-orange-50 text-orange-700 border-orange-200" },
    RESOLVED:    { label: "Resolvido",   className: "bg-green-50 text-green-700 border-green-200" },
    CLOSED:      { label: "Fechado",     className: "bg-slate-50 text-slate-600 border-slate-200" },
    BLOCKED:     { label: "Bloqueado",   className: "bg-purple-50 text-purple-700 border-purple-200" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", className)}>{label}</span>;
}
