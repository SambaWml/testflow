"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import { useTerms } from "@/contexts/terms-context";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { Trash2, Pencil, ChevronDown, ChevronUp, TestTube2, LayoutGrid, List, CheckSquare, Square, AlertTriangle, X, Plus } from "lucide-react";
import { CaseEditDialog } from "@/components/cases/case-edit-dialog";
import { CaseCreateDialog } from "@/components/cases/case-create-dialog";
import { getPriorities } from "@/lib/enum-config";
import { Tip } from "@/components/ui/hint";

const PRIORITIES = getPriorities();
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800", HIGH: "bg-orange-100 text-orange-800",
  MEDIUM: "bg-yellow-100 text-yellow-800", LOW: "bg-green-100 text-green-800",
};

type ViewMode = "list" | "grid";

type TestCase = {
  id: string; title: string; format: string; priority: string; reference: string | null;
  item: { title: string } | null; project: { id: string; name: string } | null;
  createdAt: string; bddGiven: string | null; bddWhen: string | null;
  bddThen: string | null; steps: { id: string; order: number; description: string }[];
  precondition: string | null; expectedResult: string | null; notes: string | null;
};

export default function CasesPage() {
  const qc = useQueryClient();
  const { t } = useLang();
  const { terms } = useTerms();
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string[]>>({
    project: [], format: [], priority: [],
  });

  // Fetch todos os projetos para popular o filtro
  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects?activeOnly=true").then((r) => r.json()),
  });

  // Fetch todos os casos (sem filtro de API — filtramos no client)
  const { data, isLoading } = useQuery({
    queryKey: ["cases-all"],
    queryFn: () => fetch("/api/cases?limit=500").then((r) => r.json()),
  });


  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/cases/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cases-all"] }),
  });

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => setSelected(new Set(cases.map((tc) => tc.id)));
  const clearSelect = () => setSelected(new Set());

  async function confirmBulkDelete() {
    setBulkDeleting(true);
    try {
      await fetch("/api/cases/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      qc.invalidateQueries({ queryKey: ["cases-all"] });
      setSelected(new Set());
      setBulkConfirm(false);
    } finally {
      setBulkDeleting(false);
    }
  }

  // Filtro client-side
  const cases = useMemo(() => {
    const allCases: TestCase[] = data?.cases ?? [];
    return allCases.filter((tc) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!tc.title.toLowerCase().includes(q) &&
            !(tc.item?.title ?? "").toLowerCase().includes(q)) return false;
      }
      if (filters.project.length && !filters.project.includes(tc.project?.id ?? "")) return false;
      if (filters.format.length && !filters.format.includes(tc.format)) return false;
      if (filters.priority.length && !filters.priority.includes(tc.priority)) return false;
      return true;
    });
  }, [data?.cases, search, filters]);

  // Grupos de filtro
  const projects = (projectsData?.projects ?? []) as { id: string; name: string }[];
  const filterGroups = [
    {
      key: "project",
      label: t.cases.filter_project,
      options: projects.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      key: "format",
      label: t.cases.filter_format,
      options: [
        { value: "BDD", label: "BDD" },
        { value: "STEP_BY_STEP", label: "Step by Step" },
      ],
    },
    {
      key: "priority",
      label: t.cases.filter_priority,
      options: PRIORITIES.map((p) => ({
        value: p.value,
        label: p.label,
        color: p.value === "CRITICAL" ? "bg-red-500" : p.value === "HIGH" ? "bg-orange-500" : p.value === "MEDIUM" ? "bg-yellow-500" : "bg-green-500",
      })),
    },
  ];

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleFilterChange = (key: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={terms.casoDeTeste.plural}
        subtitle={t.cases.subtitle}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t.cases.new_case}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <FilterBar
              groups={filterGroups}
              selected={filters}
              onChange={handleFilterChange}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t.cases.search_placeholder}
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              {cases.length} {cases.length === 1 ? terms.casoDeTeste.singular.toLowerCase() : terms.casoDeTeste.plural.toLowerCase()}
            </p>
            {/* View toggle */}
            <div className="flex items-center border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                  viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"
                }`}
                title={t.cases.list_view}
              >
                <List className="h-4 w-4" />
                {t.cases.list_view}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l ${
                  viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent"
                }`}
                title={t.cases.grid_view}
              >
                <LayoutGrid className="h-4 w-4" />
                {t.cases.grid_view}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 flex-1">
              <CheckSquare className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                {t.cases.x_selected.replace("{n}", String(selected.size)).replace("{s}", selected.size !== 1 ? "s" : "").replace("{s}", selected.size !== 1 ? "s" : "")}
              </span>
            </div>
            <button onClick={selectAll} className="text-xs text-red-700 underline hover:no-underline">
              {t.cases.select_all.replace("{n}", String(cases.length))}
            </button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8"
              onClick={() => setBulkConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t.cases.delete_x.replace("{n}", String(selected.size)).replace("{s}", selected.size !== 1 ? "s" : "")}
            </Button>
            <button onClick={clearSelect} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg border bg-white animate-pulse" />)}
          </div>
        ) : cases.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <TestTube2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">{t.cases.no_cases}</h3>
              <p className="text-sm text-muted-foreground">{t.cases.no_cases_desc}</p>
            </CardContent>
          </Card>
        ) : viewMode === "list" ? (
          <ListView
            cases={cases}
            expandedCards={expandedCards}
            onToggleExpand={toggleExpand}
            onViewDetail={setEditingCase}
            onDelete={(id) => { if (confirm(t.cases.single_delete_confirm)) deleteMutation.mutate(id); }}
            selected={selected}
            onToggleSelect={toggleSelect}
          />
        ) : (
          <GridView
            cases={cases}
            expandedCards={expandedCards}
            onToggleExpand={toggleExpand}
            onViewDetail={setEditingCase}
            onDelete={(id) => { if (confirm(t.cases.single_delete_confirm)) deleteMutation.mutate(id); }}
            selected={selected}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>

      <CaseEditDialog
        caseId={editingCase}
        open={!!editingCase}
        onOpenChange={(o) => { if (!o) setEditingCase(null); }}
      />
      <CaseCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkConfirm} onOpenChange={(o) => { if (!o && !bulkDeleting) setBulkConfirm(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t.cases.bulk_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                {t.cases.bulk_warning_about.replace("{n}", String(selected.size)).replace("{s}", selected.size !== 1 ? "s" : "")}
              </p>
              <p className="text-sm text-red-700" dangerouslySetInnerHTML={{ __html: t.cases.bulk_warning_irreversible.replace("não pode ser desfeita", "<strong>não pode ser desfeita</strong>").replace("cannot be undone", "<strong>cannot be undone</strong>") }} />
              <p className="text-sm text-red-700" dangerouslySetInnerHTML={{ __html: t.cases.bulk_warning_reuse.replace("não poderão ser reutilizados", "<strong>não poderão ser reutilizados</strong>").replace("cannot be reused", "<strong>cannot be reused</strong>") }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t.common.confirm_proceed}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirm(false)} disabled={bulkDeleting}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? (
                <>{t.cases.deleting}</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-1" /> {t.cases.delete_x.replace("{n}", String(selected.size)).replace("{s}", selected.size !== 1 ? "s" : "")}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── List view ──────────────────────────────────────────────────── */
function ListView({ cases, expandedCards, onToggleExpand, onViewDetail, onDelete, selected, onToggleSelect }: {
  cases: TestCase[]; expandedCards: Set<string>;
  onToggleExpand: (id: string) => void; onViewDetail: (id: string) => void; onDelete: (id: string) => void;
  selected: Set<string>; onToggleSelect: (id: string) => void;
}) {
  const { t, lang } = useLang();
  return (
    <div className="space-y-2">
      {cases.map((tc) => {
        const expanded = expandedCards.has(tc.id);
        const isSelected = selected.has(tc.id);
        return (
          <Card key={tc.id} className={`hover:shadow-sm transition-shadow ${isSelected ? "ring-2 ring-red-300 bg-red-50/30" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => onToggleSelect(tc.id)}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-red-600 transition-colors"
                  title={isSelected ? t.cases.deselect : t.cases.select_for_bulk}
                >
                  {isSelected ? <CheckSquare className="h-4 w-4 text-red-600" /> : <Square className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={tc.format === "BDD" ? "info" : "secondary"} className="text-xs">
                      {tc.format === "BDD" ? "BDD" : "Step by Step"}
                    </Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[tc.priority] ?? ""}`}>
                      {PRIORITIES.find((p) => p.value === tc.priority)?.label ?? tc.priority}
                    </span>
                    {tc.project && <span className="text-xs text-muted-foreground">📁 {tc.project.name}</span>}
                    {tc.item && <span className="text-xs text-muted-foreground truncate">📎 {tc.item.title}</span>}
                  </div>
                  <p className="font-medium text-sm">{tc.title}</p>
                  {expanded && <CaseBody tc={tc} />}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground mr-2">
                    {format(new Date(tc.createdAt), "dd/MM/yy", { locale: lang === "pt-BR" ? ptBR : undefined })}
                  </span>
                  <Tip text={expanded ? t.cases.collapse : t.cases.expand}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleExpand(tc.id)}>
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </Tip>
                  <Tip text={t.cases.edit_case}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDetail(tc.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Tip>
                  <Tip text={t.cases.delete_tip}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(tc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Tip>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Grid view (agrupado por projeto) ──────────────────────────── */
function GridView({ cases, expandedCards, onToggleExpand, onViewDetail, onDelete, selected, onToggleSelect }: {
  cases: TestCase[]; expandedCards: Set<string>;
  onToggleExpand: (id: string) => void; onViewDetail: (id: string) => void; onDelete: (id: string) => void;
  selected: Set<string>; onToggleSelect: (id: string) => void;
}) {
  const { t, lang } = useLang();
  const groups: { projectId: string; projectName: string; cases: TestCase[] }[] = [];
  const seen = new Map<string, number>();
  for (const tc of cases) {
    const pid = tc.project?.id ?? "__none__";
    const pname = tc.project?.name ?? t.common.no_project;
    if (!seen.has(pid)) { seen.set(pid, groups.length); groups.push({ projectId: pid, projectName: pname, cases: [] }); }
    groups[seen.get(pid)!].cases.push(tc);
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.projectId}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
              <TestTube2 className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">{group.projectName}</h3>
            <span className="text-xs text-muted-foreground">{group.cases.length} {t.cases.count.replace("{n}", String(group.cases.length)).replace("{s}", group.cases.length !== 1 ? "s" : "")}</span>
            <div className="flex-1 border-t ml-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.cases.map((tc) => {
              const expanded = expandedCards.has(tc.id);
              const isSelected = selected.has(tc.id);
              return (
                <Card key={tc.id} className={`hover:shadow-md transition-shadow flex flex-col ${isSelected ? "ring-2 ring-red-300 bg-red-50/30" : ""}`}>
                  <CardContent className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1">
                        <Badge variant={tc.format === "BDD" ? "info" : "secondary"} className="text-xs">
                          {tc.format === "BDD" ? "BDD" : "Step by Step"}
                        </Badge>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[tc.priority] ?? ""}`}>
                          {PRIORITIES.find((p) => p.value === tc.priority)?.label ?? tc.priority}
                        </span>
                      </div>
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => onToggleSelect(tc.id)}
                        className="shrink-0 text-muted-foreground hover:text-red-600 transition-colors"
                        title={isSelected ? t.cases.deselect : t.cases.select_for_bulk}
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4 text-red-600" /> : <Square className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="font-semibold text-sm leading-snug flex-1">{tc.title}</p>
                    {tc.item && <p className="text-xs text-muted-foreground mt-1 truncate">📎 {tc.item.title}</p>}
                    {expanded && <div className="mt-3 border-t pt-3"><CaseBody tc={tc} /></div>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">{format(new Date(tc.createdAt), "dd/MM/yy", { locale: lang === "pt-BR" ? ptBR : undefined })}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleExpand(tc.id)}>
                          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDetail(tc.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(tc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Shared expanded body ───────────────────────────────────────── */
function CaseBody({ tc }: { tc: TestCase }) {
  const { t } = useLang();
  return (
    <div className="mt-3 space-y-3 text-sm">
      {tc.precondition && (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase">{t.cases.precondition}</span>
          <p className="mt-1 text-slate-700">{tc.precondition}</p>
        </div>
      )}
      {tc.format === "BDD" ? (
        <div className="space-y-2">
          {tc.bddGiven && <BDDBlock label={t.cases.given} text={tc.bddGiven} color="bg-blue-50 border-blue-200" />}
          {tc.bddWhen && <BDDBlock label={t.cases.when} text={tc.bddWhen} color="bg-purple-50 border-purple-200" />}
          {tc.bddThen && <BDDBlock label={t.cases.then} text={tc.bddThen} color="bg-green-50 border-green-200" />}
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase">{t.cases.steps}</span>
          {tc.steps.map((step) => (
            <div key={step.id} className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs shrink-0 mt-0.5">{step.order}</span>
              <p className="text-slate-700">{step.description}</p>
            </div>
          ))}
          {tc.expectedResult && (
            <div className="mt-2 p-2 rounded-md bg-green-50 border border-green-200">
              <span className="text-xs font-semibold text-green-800">{t.cases.expected_result}: </span>
              <span className="text-sm text-green-900">{tc.expectedResult}</span>
            </div>
          )}
        </div>
      )}
      {tc.notes && (
        <div className="p-2 rounded-md bg-amber-50 border border-amber-200">
          <span className="text-xs font-semibold text-amber-800">Obs: </span>
          <span className="text-xs text-amber-900">{tc.notes}</span>
        </div>
      )}
    </div>
  );
}

function BDDBlock({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div className={`p-3 rounded-md border ${color}`}>
      <span className="text-xs font-bold uppercase mr-2">{label}</span>
      <span className="text-sm">{text}</span>
    </div>
  );
}

