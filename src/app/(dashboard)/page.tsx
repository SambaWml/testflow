"use client";

import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, TestTube2, Play, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Clock,
  Wand2, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { getTerms } from "@/lib/term-config";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  PASS: "#22c55e",
  FAIL: "#ef4444",
  BLOCKED: "#f97316",
  NOT_EXECUTED: "#94a3b8",
  RETEST: "#3b82f6",
  SKIPPED: "#a855f7",
};

export default function DashboardPage() {
  const { t } = useLang();
  const terms = getTerms();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
  });

  const stats = data?.stats ?? { items: 0, cases: 0, executions: 0, passRate: 0 };
  const statusData = data?.statusDistribution ?? [];
  const recentReports = data?.recentReports ?? [];
  const recentPlans = data?.recentPlans ?? [];

  const quickActions = [
    { href: "/projects", icon: FileText, label: t.dashboard.register_item, desc: t.dashboard.register_item_desc },
    { href: "/generator", icon: Wand2, label: t.dashboard.generate_ia, desc: t.dashboard.generate_ia_desc },
    { href: "/executions", icon: Play, label: t.dashboard.start_execution, desc: t.dashboard.start_execution_desc },
    { href: "/reports", icon: TrendingUp, label: t.dashboard.generate_report, desc: t.dashboard.generate_report_desc },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={t.dashboard.title}
        subtitle={t.dashboard.subtitle}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText} label={t.dashboard.total_items} value={stats.items} color="text-blue-600" bg="bg-blue-50" loading={isLoading} />
          <StatCard icon={TestTube2} label={terms.casoDeTeste.plural} value={stats.cases} color="text-purple-600" bg="bg-purple-50" loading={isLoading} />
          <StatCard icon={Play} label={terms.execucao.plural} value={stats.executions} color="text-orange-600" bg="bg-orange-50" loading={isLoading} />
          <StatCard icon={TrendingUp} label={t.dashboard.pass_rate} value={`${stats.passRate}%`} color="text-green-600" bg="bg-green-50" loading={isLoading} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Status distribution */}
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

          {/* Quick actions */}
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

        {/* Recent test plans */}
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

        {/* Recent reports */}
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
    </div>
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
