"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutDashboard, Check, CheckCircle2 } from "lucide-react";

/* ══════════════════════════════════════════════════════
   Toggle
══════════════════════════════════════════════════════ */
function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   Dashboard Features Card (Owner only)
══════════════════════════════════════════════════════ */
function DashboardFeaturesCard() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const isOwner = (session?.user as { orgRole?: string })?.orgRole === "OWNER";

  const { data, isLoading } = useQuery<{
    overviewEnabled: boolean;
    overviewName: string;
    qaDashboardEnabled: boolean;
    qaDashboardName: string;
  }>({
    queryKey: ["org-features"],
    queryFn: () => fetch("/api/orgs/features").then((r) => r.json()),
  });

  const [overviewNameInput, setOverviewNameInput] = useState("");
  const [qaName, setQaName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data?.overviewName) setOverviewNameInput(data.overviewName);
    if (data?.qaDashboardName) setQaName(data.qaDashboardName);
  }, [data]);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/orgs/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-features"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Apenas o Owner da organização pode gerenciar os dashboards.
        </CardContent>
      </Card>
    );
  }

  const overviewEnabled = data?.overviewEnabled ?? true;
  const qaDashboardEnabled = data?.qaDashboardEnabled ?? true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          Dashboards
        </CardTitle>
        <CardDescription>Controle quais dashboards ficam visíveis para a organização.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Visão Geral toggle + name */}
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Visão Geral</p>
                <p className="text-xs text-muted-foreground mb-3">Dashboard principal com métricas de projetos e testes</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={overviewNameInput}
                    onChange={(e) => setOverviewNameInput(e.target.value)}
                    placeholder="Visão Geral"
                    className="h-8 text-sm max-w-[200px]"
                    disabled={!overviewEnabled || patch.isPending}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={!overviewEnabled || patch.isPending || !overviewNameInput.trim()}
                    onClick={() => patch.mutate({ overviewName: overviewNameInput })}
                  >
                    <Check className="h-3.5 w-3.5" /> Salvar nome
                  </Button>
                </div>
              </div>
              <Toggle
                enabled={overviewEnabled}
                onToggle={() => patch.mutate({ overviewEnabled: !overviewEnabled })}
                disabled={patch.isPending}
              />
            </div>

            <div className="border-t border-border/40" />

            {/* QA Dashboard toggle + name */}
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Dashboard QA</p>
                <p className="text-xs text-muted-foreground mb-3">Atividades dos membros, bugs e execuções (Owner e Admin)</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={qaName}
                    onChange={(e) => setQaName(e.target.value)}
                    placeholder="Dashboard QA"
                    className="h-8 text-sm max-w-[200px]"
                    disabled={!qaDashboardEnabled || patch.isPending}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={!qaDashboardEnabled || patch.isPending || !qaName.trim()}
                    onClick={() => patch.mutate({ qaDashboardName: qaName })}
                  >
                    <Check className="h-3.5 w-3.5" /> Salvar nome
                  </Button>
                </div>
              </div>
              <Toggle
                enabled={qaDashboardEnabled}
                onToggle={() => patch.mutate({ qaDashboardEnabled: !qaDashboardEnabled })}
                disabled={patch.isPending}
              />
            </div>

            {saved && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Configurações salvas
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════ */
export default function SettingsDashboardsPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dashboards" subtitle="Ative ou desative dashboards e personalize seus nomes." />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl">
          <DashboardFeaturesCard />
        </div>
      </div>
    </div>
  );
}
