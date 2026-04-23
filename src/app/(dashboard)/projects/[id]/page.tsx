"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, FolderOpen, FileText, TestTube2, Play, Bug, Wand2,
  Plus, Pencil, Trash2, ChevronRight, BarChart3, BookOpen, GitBranch,
  CheckSquare, Zap, Calendar, Tag,
} from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useLang } from "@/contexts/lang-context";
import { useTerms } from "@/contexts/terms-context";
import { ItemFormDialog } from "../../items/item-form-dialog";
import { CaseEditDialog } from "@/components/cases/case-edit-dialog";
import { getPriorities, getItemTypes } from "@/lib/enum-config";
import { cn } from "@/lib/utils";

const PRIORITIES = getPriorities();
const ITEM_TYPES = getItemTypes();

const TYPE_ICONS: Record<string, React.ElementType> = {
  USER_STORY: FileText, BUG: Bug, IMPROVEMENT: Zap,
  REQUIREMENT: BookOpen, FLOW: GitBranch, TASK: CheckSquare,
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  LOW: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  ABORTED: "bg-red-100 text-red-700",
};

type Tab = "items" | "cases" | "plans" | "bugs";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { lang } = useLang();
  const { terms } = useTerms();
  const [activeTab, setActiveTab] = useState<Tab>("items");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  const { data: projectData, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => r.json()),
  });

  // Tab data is fetched lazily — only when the user activates that tab.
  // This keeps the initial page load fast even for large projects.
  const { data: itemsData } = useQuery({
    queryKey: ["project-items", id],
    queryFn: () => fetch(`/api/items?projectId=${id}&limit=200`).then((r) => r.json()),
    enabled: activeTab === "items",
  });

  const { data: casesData } = useQuery({
    queryKey: ["project-cases", id],
    queryFn: () => fetch(`/api/cases?projectId=${id}&limit=200`).then((r) => r.json()),
    enabled: activeTab === "cases",
  });

  const { data: plansData } = useQuery({
    queryKey: ["project-plans", id],
    queryFn: () => fetch(`/api/test-plans?projectId=${id}`).then((r) => r.json()),
    enabled: activeTab === "plans",
  });

  const { data: bugsData } = useQuery({
    queryKey: ["project-bugs", id],
    queryFn: () => fetch(`/api/bugs?projectId=${id}&limit=200`).then((r) => r.json()),
    enabled: activeTab === "bugs",
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => fetch(`/api/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-items", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  const project = projectData?.project;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Projeto" />
        <div className="flex-1 p-6 space-y-4">
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
          <div className="h-64 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Projeto" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Projeto não encontrado</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const items = (itemsData?.items ?? []) as {
    id: string; title: string; type: string; priority: string;
    reference: string | null; _count: { cases: number }; createdAt: string;
    module: { name: string } | null;
  }[];

  const cases = (casesData?.cases ?? []) as {
    id: string; title: string; format: string; priority: string; createdAt: string;
    item: { title: string } | null;
  }[];

  // API may return `plans` or `testPlans` depending on the route version — normalise here.
  const plans = (plansData?.plans ?? plansData?.testPlans ?? []) as {
    id: string; name: string; status: string; environment: string;
    buildVersion: string | null; createdAt: string;
    _count?: { executions: number };
  }[];

  // Bugs endpoint may wrap under `items` or `bugs` — normalise similarly.
  const bugs = (bugsData?.items ?? bugsData?.bugs ?? []) as {
    id: string; title: string; priority: string; status: string; createdAt: string;
  }[];

  const stats = [
    { label: terms.item.plural, value: project._count?.items ?? items.length, icon: FileText, tab: "items" as Tab },
    { label: terms.casoDeTeste.plural, value: project._count?.cases ?? cases.length, icon: TestTube2, tab: "cases" as Tab },
    { label: "Planos", value: project._count?.testPlans ?? plans.length, icon: Play, tab: "plans" as Tab },
    { label: terms.bug.plural, value: bugs.length, icon: Bug, tab: "bugs" as Tab },
  ];

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "items", label: terms.item.plural, icon: FileText, count: items.length },
    { key: "cases", label: terms.casoDeTeste.plural, icon: TestTube2, count: cases.length },
    { key: "plans", label: "Planos de Teste", icon: Play, count: plans.length },
    { key: "bugs", label: terms.bug.plural, icon: Bug, count: bugs.length },
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={project.name}
        subtitle={project.description ?? undefined}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4 mr-1" /> Projetos
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <button
              key={s.tab}
              onClick={() => setActiveTab(s.tab)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                activeTab === s.tab
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "bg-card hover:bg-accent/50"
              )}
            >
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                activeTab === s.tab ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <Card>
          {/* Tab bar */}
          <div className="flex border-b overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Items tab */}
          {activeTab === "items" && (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
                <p className="text-sm text-muted-foreground flex-1">{items.length} {terms.item.plural.toLowerCase()}</p>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditingItemId(null); setItemDialogOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" /> Novo
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href={`/generator?projectId=${id}`}>
                    <Wand2 className="h-3.5 w-3.5" /> Gerar com IA
                  </Link>
                </Button>
              </div>
              {items.length === 0 ? (
                <EmptyState icon={FileText} label={`Nenhum ${terms.item.singular.toLowerCase()} ainda`} action={{ label: `Criar ${terms.item.singular}`, onClick: () => { setEditingItemId(null); setItemDialogOpen(true); } }} />
              ) : (
                <div className="divide-y">
                  {items.map((item) => {
                    const Icon = TYPE_ICONS[item.type] ?? FileText;
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{item.title}</span>
                            {item.reference && <span className="text-xs text-muted-foreground font-mono">{item.reference}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{ITEM_TYPES.find((t) => t.value === item.type)?.label ?? item.type}</Badge>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[item.priority] ?? ""}`}>
                              {PRIORITIES.find((p) => p.value === item.priority)?.label ?? item.priority}
                            </span>
                            {item.module && <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" />{item.module.name}</span>}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(item.createdAt), "dd/MM/yyyy", { locale: lang === "pt-BR" ? ptBR : undefined })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className="text-xs">{item._count.cases} casos</Badge>
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={`/generator?itemId=${item.id}`} title="Gerar casos com IA"><Wand2 className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setEditingItemId(item.id); setItemDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" title="Excluir"
                            onClick={() => { if (confirm("Excluir este item?")) deleteItem.mutate(item.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Cases tab */}
          {activeTab === "cases" && (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
                <p className="text-sm text-muted-foreground flex-1">{cases.length} {terms.casoDeTeste.plural.toLowerCase()}</p>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href={`/generator?projectId=${id}`}><Wand2 className="h-3.5 w-3.5" /> Gerar com IA</Link>
                </Button>
              </div>
              {cases.length === 0 ? (
                <EmptyState icon={TestTube2} label={`Nenhum ${terms.casoDeTeste.singular.toLowerCase()} ainda`} action={{ label: "Gerar com IA", href: `/generator?projectId=${id}` }} />
              ) : (
                <div className="divide-y">
                  {cases.map((tc) => (
                    <div key={tc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-900/20 shrink-0">
                        <TestTube2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{tc.title}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{tc.format}</Badge>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[tc.priority] ?? ""}`}>
                            {PRIORITIES.find((p) => p.value === tc.priority)?.label ?? tc.priority}
                          </span>
                          {tc.item && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{tc.item.title}</span>}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(tc.createdAt), "dd/MM/yyyy", { locale: lang === "pt-BR" ? ptBR : undefined })}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Editar" onClick={() => setEditingCaseId(tc.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Plans tab */}
          {activeTab === "plans" && (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
                <p className="text-sm text-muted-foreground flex-1">{plans.length} planos</p>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href="/executions"><Play className="h-3.5 w-3.5" /> Ver execuções</Link>
                </Button>
              </div>
              {plans.length === 0 ? (
                <EmptyState icon={Play} label="Nenhum plano de teste ainda" action={{ label: "Ver execuções", href: "/executions" }} />
              ) : (
                <div className="divide-y">
                  {plans.map((plan) => (
                    <div key={plan.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/20 shrink-0">
                        <Play className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{plan.name}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[plan.status] ?? "bg-muted text-muted-foreground"}`}>
                            {plan.status}
                          </span>
                          {plan.environment && <Badge variant="outline" className="text-xs">{plan.environment}</Badge>}
                          {plan.buildVersion && <span className="text-xs text-muted-foreground font-mono">v{plan.buildVersion}</span>}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(plan.createdAt), "dd/MM/yyyy", { locale: lang === "pt-BR" ? ptBR : undefined })}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                        <Link href="/executions" title="Ver execuções"><ChevronRight className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Bugs tab */}
          {activeTab === "bugs" && (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
                <p className="text-sm text-muted-foreground flex-1">{bugs.length} {terms.bug.plural.toLowerCase()}</p>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href={`/generator/bugs?projectId=${id}`}><Wand2 className="h-3.5 w-3.5" /> Gerar bugs IA</Link>
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href="/bugs"><BarChart3 className="h-3.5 w-3.5" /> Ver todos</Link>
                </Button>
              </div>
              {bugs.length === 0 ? (
                <EmptyState icon={Bug} label={`Nenhum ${terms.bug.singular.toLowerCase()} ainda`} action={{ label: "Gerar com IA", href: `/generator/bugs?projectId=${id}` }} />
              ) : (
                <div className="divide-y">
                  {bugs.map((bug) => (
                    <div key={bug.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 dark:bg-red-900/20 shrink-0">
                        <Bug className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{bug.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[bug.priority] ?? ""}`}>
                            {PRIORITIES.find((p) => p.value === bug.priority)?.label ?? bug.priority}
                          </span>
                          <Badge variant="outline" className="text-xs">{bug.status}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(bug.createdAt), "dd/MM/yyyy", { locale: lang === "pt-BR" ? ptBR : undefined })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <ItemFormDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        editId={editingItemId}
        defaultProjectId={id}
      />

      <CaseEditDialog
        caseId={editingCaseId}
        open={!!editingCaseId}
        onOpenChange={(o) => { if (!o) setEditingCaseId(null); }}
      />
    </div>
  );
}

function EmptyState({
  icon: Icon, label, action,
}: {
  icon: React.ElementType;
  label: string;
  action?: { label: string; onClick?: () => void; href?: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{label}</p>
      {action && (
        action.href ? (
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
