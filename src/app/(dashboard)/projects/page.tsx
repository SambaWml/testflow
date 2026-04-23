"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { useTerms } from "@/contexts/terms-context";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
// Note: Dialog/Label kept for ItemFormDialog dependency chain
import {
  Plus, Search, Wand2, Pencil, Trash2, ChevronDown, ChevronUp,
  FolderOpen, Folder, FileText, Bug, Zap, BookOpen, GitBranch, CheckSquare,
  TestTube2, FolderCog,
} from "lucide-react";
import { getItemTypes, getPriorities } from "@/lib/enum-config";

const ITEM_TYPES = getItemTypes();
const PRIORITIES  = getPriorities();
function getItemTypeLabel(type: string) { return ITEM_TYPES.find((t) => t.value === type)?.label ?? type; }
import { Tip } from "@/components/ui/hint";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ItemFormDialog } from "../items/item-form-dialog";
import { CaseEditDialog } from "@/components/cases/case-edit-dialog";
import Link from "next/link";

const TYPE_ICONS: Record<string, React.ElementType> = {
  USER_STORY: FileText, BUG: Bug, IMPROVEMENT: Zap,
  REQUIREMENT: BookOpen, FLOW: GitBranch, TASK: CheckSquare,
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800", HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800", LOW: "bg-green-100 text-green-800",
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { t, lang } = useLang();
  const [search, setSearch] = useState("");
  const { terms } = useTerms();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [itemTypeFilter, setItemTypeFilter] = useState<Record<string, string>>({});
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string | undefined>();

  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => fetch(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const projects = (projectsData?.projects ?? []) as {
    id: string; name: string; description: string | null; isActive: boolean;
    _count: { items: number; cases: number; testPlans: number; executions: number; reports: number };
  }[];

  const filtered = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects;

  function toggleProject(id: string) {
    setExpandedProjects((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function openNewItem(projectId: string) {
    setEditingItemId(null);
    setDefaultProjectId(projectId);
    setItemDialogOpen(true);
  }

  function openEditItem(itemId: string) {
    setEditingItemId(itemId);
    setDefaultProjectId(undefined);
    setItemDialogOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title={terms.projeto.plural} subtitle={t.projects.subtitle} />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t.projects.search_placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground self-center ml-auto">
            {filtered.length} {filtered.length === 1 ? terms.projeto.singular.toLowerCase() : terms.projeto.plural.toLowerCase()}
          </p>
        </div>

        {/* Projects list */}
        {loadingProjects ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg border bg-white animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">{t.projects.no_projects_title}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie projetos em <strong>Configurações → Projetos</strong>.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/projects">
                  <FolderCog className="h-4 w-4 mr-1" /> Ir para Configurações de Projetos
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((project) => {
              const expanded = expandedProjects.has(project.id);
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  expanded={expanded}
                  typeFilter={itemTypeFilter[project.id] ?? "ALL"}
                  onToggle={() => toggleProject(project.id)}
                  onTypeFilter={(v) => setItemTypeFilter((prev) => ({ ...prev, [project.id]: v }))}
                  onNewItem={() => openNewItem(project.id)}
                  onEditItem={openEditItem}
                  onDeleteItem={(id) => { if (confirm(t.projects.confirm_delete_item)) deleteItem.mutate(id); }}
                  lang={lang}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Item form dialog */}
      <ItemFormDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        editId={editingItemId}
        defaultProjectId={defaultProjectId}
      />

    </div>
  );
}

function ProjectCard({
  project, expanded, typeFilter,
  onToggle, onTypeFilter, onNewItem, onEditItem, onDeleteItem, lang,
}: {
  project: { id: string; name: string; description: string | null; isActive: boolean; _count: { items: number; cases: number; testPlans: number; executions: number; reports: number } };
  expanded: boolean;
  typeFilter: string;
  onToggle: () => void;
  onTypeFilter: (v: string) => void;
  onNewItem: () => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  lang: string;
}) {
  const { t } = useLang();
  const { terms } = useTerms();
  const [activeTab, setActiveTab] = useState<"items" | "cases">("items");
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["items", project.id, typeFilter],
    queryFn: () => {
      const p = new URLSearchParams({ projectId: project.id, limit: "100" });
      if (typeFilter !== "ALL") p.set("type", typeFilter);
      return fetch(`/api/items?${p}`).then((r) => r.json());
    },
    enabled: expanded,
  });

  const { data: casesData, isLoading: loadingCases } = useQuery({
    queryKey: ["project-cases", project.id],
    queryFn: () => fetch(`/api/cases?projectId=${project.id}&limit=200`).then((r) => r.json()),
    enabled: expanded && activeTab === "cases",
  });

  const items = (data?.items ?? []) as {
    id: string; title: string; type: string; priority: string;
    reference: string | null; _count: { cases: number }; createdAt: string;
    module: { name: string } | null;
  }[];

  const cases = (casesData?.cases ?? []) as {
    id: string; title: string; format: string; priority: string;
    precondition: string | null; createdAt: string;
    item: { title: string } | null;
  }[];

  return (
    <Card className={`overflow-hidden ${!project.isActive ? "opacity-60 bg-muted/30" : ""}`}>
      {/* Project header */}
      <CardHeader
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            {expanded
              ? <FolderOpen className="h-5 w-5 text-primary" />
              : <Folder className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${project.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-sm hover:text-primary hover:underline underline-offset-2 transition-colors"
              >
                {project.name}
              </Link>
              <Badge variant={project.isActive ? "success" : "secondary"} className="text-xs">
                {project.isActive ? t.common.active : t.common.inactive}
              </Badge>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{project._count.items} {project._count.items === 1 ? terms.item.singular.toLowerCase() : terms.item.plural.toLowerCase()}</span>
              <span>·</span>
              <span>{project._count.cases} {project._count.cases === 1 ? terms.casoDeTeste.singular.toLowerCase() : terms.casoDeTeste.plural.toLowerCase()}</span>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {/* Expanded panel */}
      {expanded && (
        <CardContent className="p-0 border-t">
          {/* Tab bar */}
          <div className="flex border-b bg-muted/30">
            <button
              onClick={() => setActiveTab("items")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "items"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              {terms.item.plural}
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {project._count.items}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("cases")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "cases"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <TestTube2 className="h-3.5 w-3.5" />
              {terms.casoDeTeste.plural}
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {project._count.cases}
              </span>
            </button>
          </div>

          {/* Items tab */}
          {activeTab === "items" && (
            <>
              <div className="p-3 flex items-center gap-2 bg-muted/10 border-b">
                <Select value={typeFilter} onValueChange={onTypeFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder={t.projects.all_types} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t.projects.all_types}</SelectItem>
                    {ITEM_TYPES.map((tp) => (
                      <SelectItem key={tp.value} value={tp.value}>{tp.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground flex-1">
                  {isLoading ? t.common.loading : `${items.length} ${items.length === 1 ? terms.item.singular.toLowerCase() : terms.item.plural.toLowerCase()}`}
                </span>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onNewItem}>
                  <Plus className="h-3.5 w-3.5" /> {t.projects.new_item}
                </Button>
              </div>

              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[1, 2].map((i) => <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-40" />
                  <p>{t.projects.no_items}.</p>
                  <button onClick={onNewItem} className="mt-2 text-primary text-xs underline underline-offset-2">
                    {t.projects.no_items_desc}
                  </button>
                </div>
              ) : (
                <div className="divide-y overflow-y-auto" style={{ maxHeight: "305px" }}>
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
                            {item.reference && (
                              <span className="text-xs text-muted-foreground font-mono">{item.reference}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{getItemTypeLabel(item.type)}</Badge>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[item.priority] ?? ""}`}>
                              {PRIORITIES.find((p) => p.value === item.priority)?.label ?? item.priority}
                            </span>
                            {item.module && <span className="text-xs text-muted-foreground">{item.module.name}</span>}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.createdAt), "dd/MM/yyyy", { locale: lang === "pt-BR" ? ptBR : undefined })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {item._count.cases} {item._count.cases === 1 ? terms.casoDeTeste.singular.toLowerCase() : terms.casoDeTeste.plural.toLowerCase()}
                          </Badge>
                          <Tip text={t.projects.generate_ai}><Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link href={`/generator?itemId=${item.id}`}><Wand2 className="h-4 w-4" /></Link></Button></Tip>
                          <Tip text={t.projects.edit_item}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditItem(item.id)}><Pencil className="h-4 w-4" /></Button></Tip>
                          <Tip text={t.projects.delete_item}><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDeleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button></Tip>
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
              <div className="p-3 flex items-center gap-2 bg-muted/10 border-b">
                <span className="text-xs text-muted-foreground flex-1">
                  {loadingCases ? t.common.loading : `${cases.length} ${cases.length === 1 ? terms.casoDeTeste.singular.toLowerCase() : terms.casoDeTeste.plural.toLowerCase()}`}
                </span>
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href={`/generator?projectId=${project.id}`}>
                    <Wand2 className="h-3.5 w-3.5" /> {t.projects.generate_ai}
                  </Link>
                </Button>
              </div>

              {loadingCases ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />)}
                </div>
              ) : cases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
                  <TestTube2 className="h-8 w-8 mb-2 opacity-40" />
                  <p>{t.projects.no_items}.</p>
                  <Link href={`/generator?projectId=${project.id}`} className="mt-2 text-primary text-xs underline underline-offset-2">
                    {t.projects.generate_ai}
                  </Link>
                </div>
              ) : (
                <div className="divide-y overflow-y-auto" style={{ maxHeight: "305px" }}>
                  {cases.map((tc) => (
                    <div key={tc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-50 shrink-0">
                        <TestTube2 className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{tc.title}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{tc.format}</Badge>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[tc.priority] ?? ""}`}>
                            {PRIORITIES.find((p) => p.value === tc.priority)?.label ?? tc.priority}
                          </span>
                          {tc.item && (
                            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {tc.item.title}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(tc.createdAt), "dd/MM/yyyy", { locale: lang === "pt-BR" ? ptBR : undefined })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tip text={t.common.edit}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCaseId(tc.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Tip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}

      <CaseEditDialog
        caseId={editingCaseId}
        open={!!editingCaseId}
        onOpenChange={(o) => { if (!o) setEditingCaseId(null); }}
      />
    </Card>
  );
}
