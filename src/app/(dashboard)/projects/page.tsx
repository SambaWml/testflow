"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTerms } from "@/lib/term-config";
import { useLang } from "@/contexts/lang-context";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Wand2, Pencil, Trash2, ChevronDown, ChevronUp,
  FolderOpen, Folder, FileText, Bug, Zap, BookOpen, GitBranch, CheckSquare, Loader2,
  AlertTriangle, TestTube2, Eye,
} from "lucide-react";
import { getItemTypes, getPriorities } from "@/lib/enum-config";

const ITEM_TYPES = getItemTypes();
const PRIORITIES  = getPriorities();
function getItemTypeLabel(type: string) { return ITEM_TYPES.find((t) => t.value === type)?.label ?? type; }
import { Tip } from "@/components/ui/hint";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ItemFormDialog } from "../items/item-form-dialog";
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
  const [terms, setTerms] = useState(() => getTerms());
  useEffect(() => { setTerms(getTerms()); }, []);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [itemTypeFilter, setItemTypeFilter] = useState<Record<string, string>>({});
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string | undefined>();
  const [projectDialog, setProjectDialog] = useState(false);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [deletingProject, setDeletingProject] = useState<{
    id: string; name: string;
    _count: { items: number; cases: number; testPlans: number; executions: number; reports: number };
  } | null>(null);

  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const createProject = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setProjectDialog(false);
      setProjName(""); setProjDesc("");
      setEditingProject(null);
    },
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => fetch(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
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

  function openProjectDialog(proj?: { id: string; name: string; description: string | null }) {
    if (proj) {
      setEditingProject(proj);
      setProjName(proj.name);
      setProjDesc(proj.description ?? "");
    } else {
      setEditingProject(null);
      setProjName(""); setProjDesc("");
    }
    setProjectDialog(true);
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={terms.projeto.plural}
        subtitle={t.projects.subtitle}
        actions={
          <Button size="sm" onClick={() => openProjectDialog()}>
            <Plus className="h-4 w-4" /> {t.common.new} {terms.projeto.singular}
          </Button>
        }
      />

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
              <p className="text-sm text-muted-foreground mb-4">{t.projects.no_projects_desc}</p>
              <Button onClick={() => openProjectDialog()}>
                <Plus className="h-4 w-4" /> {t.projects.create_project}
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
                  onEditProject={() => openProjectDialog(project)}
                  onDeleteProject={() => setDeletingProject(project)}
                  lang={lang}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Delete project confirmation dialog */}
      <Dialog open={!!deletingProject} onOpenChange={(o) => { if (!o) setDeletingProject(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t.projects.confirm_delete_project}
            </DialogTitle>
          </DialogHeader>
          {deletingProject && (() => {
            const c = deletingProject._count;
            const total = c.items + c.cases + c.testPlans + c.executions + c.reports;
            const rows = [
              { label: terms.item.plural, count: c.items },
              { label: terms.casoDeTeste.plural, count: c.cases },
              { label: terms.planoDeTeste.plural, count: c.testPlans },
              { label: terms.execucao.plural, count: c.executions },
              { label: terms.relatorio.plural, count: c.reports },
            ].filter((r) => r.count > 0);
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t.projects.delete_warning_prefix}{" "}
                  <span className="font-semibold text-foreground">"{deletingProject.name}"</span>{" "}
                  {t.projects.delete_warning_suffix}
                </p>
                {rows.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1.5">
                    {rows.map(({ label, count }) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-red-700">{label}</span>
                        <span className="font-semibold text-red-800">{count}</span>
                      </div>
                    ))}
                    <div className="border-t border-red-200 pt-1.5 flex items-center justify-between text-sm font-semibold">
                      <span className="text-red-800">{t.projects.delete_total}</span>
                      <span className="text-red-900">{total}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t.projects.delete_irreversible}</p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProject(null)}>{t.common.cancel}</Button>
            <Button
              variant="destructive"
              disabled={deleteProject.isPending}
              onClick={() => { if (deletingProject) { deleteProject.mutate(deletingProject.id); setDeletingProject(null); } }}
            >
              {deleteProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t.common.yes_delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item form dialog */}
      <ItemFormDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        editId={editingItemId}
        defaultProjectId={defaultProjectId}
      />

      {/* Project create/edit dialog */}
      <Dialog open={projectDialog} onOpenChange={(o) => { setProjectDialog(o); if (!o) { setEditingProject(null); setProjName(""); setProjDesc(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? `${t.common.edit} ${terms.projeto.singular}` : t.projects.create_project}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.projects.project_name_label} *</Label>
              <Input placeholder={t.projects.project_name_placeholder} value={projName} onChange={(e) => setProjName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.projects.project_desc_label}</Label>
              <Input placeholder={t.projects.project_desc_placeholder} value={projDesc} onChange={(e) => setProjDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialog(false)}>{t.common.cancel}</Button>
            <Button
              disabled={!projName || createProject.isPending}
              onClick={() => createProject.mutate({ name: projName, description: projDesc })}
            >
              {createProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingProject ? t.common.save : t.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectCard({
  project, expanded, typeFilter,
  onToggle, onTypeFilter, onNewItem, onEditItem, onDeleteItem, onEditProject, onDeleteProject, lang,
}: {
  project: { id: string; name: string; description: string | null; isActive: boolean; _count: { items: number; cases: number; testPlans: number; executions: number; reports: number } };
  expanded: boolean;
  typeFilter: string;
  onToggle: () => void;
  onTypeFilter: (v: string) => void;
  onNewItem: () => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onEditProject: () => void;
  onDeleteProject: () => void;
  lang: string;
}) {
  const { t } = useLang();
  const terms = getTerms();
  const [activeTab, setActiveTab] = useState<"items" | "cases">("items");

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
    <Card className="overflow-hidden">
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
              <span className="font-semibold text-sm">{project.name}</span>
              <Badge variant={project.isActive ? "success" : "secondary"} className="text-xs">
                {project.isActive ? t.common.active : t.common.inactive}
              </Badge>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>{project._count.items} {project._count.items === 1 ? terms.item.singular.toLowerCase() : terms.item.plural.toLowerCase()}</span>
              <span>·</span>
              <span>{project._count.cases} {project._count.cases === 1 ? terms.casoDeTeste.singular.toLowerCase() : terms.casoDeTeste.plural.toLowerCase()}</span>
            </div>
            <Tip text={t.projects.edit_project}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditProject}><Pencil className="h-3.5 w-3.5" /></Button></Tip>
            <Tip text={t.projects.delete_project}><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDeleteProject}><Trash2 className="h-3.5 w-3.5" /></Button></Tip>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={`/cases?highlight=${tc.id}`}><Eye className="h-4 w-4" /></Link>
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
    </Card>
  );
}
