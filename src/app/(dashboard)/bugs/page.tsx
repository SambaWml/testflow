"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bug, Plus, Trash2, Pencil, Wand2, Search,
  ChevronDown, AlertTriangle, Loader2, X, ExternalLink, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Topbar } from "@/components/layout/topbar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTerms } from "@/contexts/terms-context";

/* ─── Types ──────────────────────────────────────────────────────────── */
type BugItem = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  reference: string | null;
  acceptanceCriteria: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  author: { id: string; name: string };
};

/* ─── Constants ──────────────────────────────────────────────────────── */
const PRIORITIES = [
  { value: "CRITICAL", label: "Crítica" },
  { value: "HIGH",     label: "Alta" },
  { value: "MEDIUM",   label: "Média" },
  { value: "LOW",      label: "Baixa" },
];

const BUG_STATUSES = [
  { value: "OPEN",        label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em análise" },
  { value: "RESOLVED",    label: "Resolvido" },
  { value: "CLOSED",      label: "Fechado" },
  { value: "BLOCKED",     label: "Bloqueado" },
];

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH:     "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM:   "bg-amber-100 text-amber-800 border-amber-200",
  LOW:      "bg-green-100 text-green-800 border-green-200",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN:        "bg-red-50 text-red-700 border-red-200",
  IN_PROGRESS: "bg-orange-50 text-orange-700 border-orange-200",
  RESOLVED:    "bg-green-50 text-green-700 border-green-200",
  CLOSED:      "bg-slate-100 text-slate-600 border-slate-200",
  BLOCKED:     "bg-purple-50 text-purple-700 border-purple-200",
};

function PriorityBadge({ priority }: { priority: string }) {
  const label = PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", PRIORITY_STYLES[priority] ?? "bg-muted text-muted-foreground")}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = BUG_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", STATUS_STYLES[status] ?? "bg-muted text-muted-foreground")}>
      {label}
    </span>
  );
}

// Inline select that looks like a badge — used directly in table cells
function InlinePrioritySelect({ bugId, value, onChange }: { bugId: string; value: string; onChange: (id: string, field: string, val: string) => void }) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(bugId, "priority", e.target.value)}
        className={cn(
          "appearance-none cursor-pointer rounded border text-xs font-medium px-2 py-0.5 pr-5 transition-colors",
          PRIORITY_STYLES[value] ?? "bg-muted text-muted-foreground",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 opacity-60" />
    </div>
  );
}

function InlineStatusSelect({ bugId, value, onChange }: { bugId: string; value: string; onChange: (id: string, field: string, val: string) => void }) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(bugId, "status", e.target.value)}
        className={cn(
          "appearance-none cursor-pointer rounded border text-xs font-medium px-2 py-0.5 pr-5 transition-colors",
          STATUS_STYLES[value] ?? "bg-muted text-muted-foreground",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {BUG_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 opacity-60" />
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="border-b border-border/40">
      {[48, 20, 16, 16, 24, 20].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className={`h-3.5 rounded bg-muted animate-pulse w-${w}`} />
        </td>
      ))}
      <td className="px-4 py-3.5 w-28" />
    </tr>
  );
}

/* ─── Bug Form Dialog (create + edit) ───────────────────────────────── */
function BugFormDialog({
  bug,
  projects,
  onClose,
}: {
  bug?: BugItem;
  projects: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: bug?.title ?? "",
    description: bug?.description ?? "",
    priority: bug?.priority ?? "MEDIUM",
    status: bug?.status ?? "OPEN",
    projectId: bug?.project.id ?? "",
    reference: bug?.reference ?? "",
    acceptanceCriteria: bug?.acceptanceCriteria ?? "",
    notes: bug?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (bug) {
        return fetch(`/api/items/${bug.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }).then((r) => r.json());
      }
      return fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bugs"] });
      onClose();
    },
  });

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-red-500" />
            {bug ? "Editar bug" : "Novo bug"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Title — full width */}
          <div className="col-span-2 space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Botão de salvar não responde ao clicar" autoFocus />
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label>Projeto *</Label>
            <Select value={form.projectId} onValueChange={(v) => set("projectId", v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Status (only when editing) */}
          {bug && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUG_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reference */}
          <div className="space-y-1.5">
            <Label>Referência</Label>
            <Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="JIRA-123, #456..." />
          </div>

          {/* Description — full width */}
          <div className="col-span-2 space-y-1.5">
            <Label>Descrição do bug</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Descreva o comportamento incorreto observado..." />
          </div>

          {/* Steps to reproduce */}
          <div className="col-span-2 space-y-1.5">
            <Label>Passos para reproduzir</Label>
            <Textarea value={form.acceptanceCriteria} onChange={(e) => set("acceptanceCriteria", e.target.value)} rows={4} placeholder={"1. Acessar a tela X\n2. Clicar em Y\n3. Observar o comportamento"} />
          </div>

          {/* Notes (expected/actual result) */}
          <div className="col-span-2 space-y-1.5">
            <Label>Resultado esperado / Resultado atual / Observações</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder={"Resultado Esperado: O sistema deve...\n\nResultado Atual: O sistema...\n\nObservações: Ocorre apenas em..."} />
          </div>
        </div>

        {save.data?.error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{save.data.error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!form.title.trim() || !form.projectId || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bug className="h-4 w-4 mr-1" />}
            {bug ? "Salvar" : "Criar bug"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Bug to Markdown ────────────────────────────────────────────────── */
function bugToMarkdown(bug: BugItem): string {
  const priorityLabel = PRIORITIES.find((p) => p.value === bug.priority)?.label ?? bug.priority;
  const statusLabel   = BUG_STATUSES.find((s) => s.value === bug.status)?.label ?? bug.status;
  const createdAt     = format(new Date(bug.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR });

  const lines: string[] = [];
  lines.push(`# ${bug.title}`);
  lines.push("");
  lines.push(`**Prioridade:** ${priorityLabel} | **Status:** ${statusLabel} | **Projeto:** ${bug.project.name}`);
  if (bug.reference) lines.push(`**Referência:** ${bug.reference}`);
  lines.push("");
  if (bug.description) {
    lines.push("## Descrição");
    lines.push(bug.description);
    lines.push("");
  }
  if (bug.acceptanceCriteria) {
    lines.push("## Passos para Reproduzir");
    lines.push(bug.acceptanceCriteria);
    lines.push("");
  }
  if (bug.notes) {
    lines.push("## Resultado Esperado / Atual / Observações");
    lines.push(bug.notes);
    lines.push("");
  }
  lines.push("---");
  lines.push(`*Autor: ${bug.author.name} | Criado em: ${createdAt}*`);
  return lines.join("\n");
}

/* ─── Bug Detail Dialog ──────────────────────────────────────────────── */
function BugDetailDialog({ bug, onClose }: { bug: BugItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyMarkdown() {
    navigator.clipboard.writeText(bugToMarkdown(bug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base leading-snug pr-8">
            <Bug className="h-4 w-4 text-red-500 shrink-0" />
            {bug.title}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <PriorityBadge priority={bug.priority} />
            <StatusBadge status={bug.status} />
            <span className="text-xs text-muted-foreground">{bug.project.name}</span>
            {bug.reference && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{bug.reference}</span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {bug.description && (
            <Section title="Descrição" content={bug.description} />
          )}
          {bug.acceptanceCriteria && (
            <Section title="Passos para Reproduzir" content={bug.acceptanceCriteria} />
          )}
          {bug.notes && (
            <Section title="Resultado Esperado / Atual / Observações" content={bug.notes} />
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40 text-xs text-muted-foreground">
            <div>
              <p className="font-medium uppercase tracking-wide mb-0.5">Autor</p>
              <p className="text-foreground">{bug.author.name}</p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-wide mb-0.5">Projeto</p>
              <p className="text-foreground">{bug.project.name}</p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-wide mb-0.5">Criado em</p>
              <p className="text-foreground">{format(new Date(bug.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-wide mb-0.5">Atualizado em</p>
              <p className="text-foreground">{format(new Date(bug.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copyMarkdown}>
            {copied ? <Check className="h-4 w-4 mr-1.5 text-green-600" /> : <Copy className="h-4 w-4 mr-1.5" />}
            {copied ? "Copiado!" : "Copiar MD"}
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}

/* ─── Delete dialog ──────────────────────────────────────────────────── */
function DeleteDialog({ bug, onClose }: { bug: BugItem; onClose: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => fetch(`/api/items/${bug.id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bugs"] }); onClose(); },
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Excluir bug
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Excluir <span className="font-semibold text-foreground">"{bug.title}"</span>? Esta ação é irreversível.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" disabled={del.isPending} onClick={() => del.mutate()}>
            {del.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function BugsPage() {
  const { terms } = useTerms();
  // All authenticated org members can create and manage bugs
  const { data: session } = useSession();
  const myRole = (session?.user as { orgRole?: string })?.orgRole ?? "";
  const canCreate = !!myRole;

  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [editBug, setEditBug] = useState<BugItem | null>(null);
  const [deleteBug, setDeleteBug] = useState<BugItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (filterProject !== "all") params.set("projectId", filterProject);
  if (filterPriority !== "all") params.set("priority", filterPriority);
  if (filterStatus !== "all") params.set("status", filterStatus);

  const qc = useQueryClient();

  const updateField = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: string }) =>
      fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bugs"] }),
  });

  function handleFieldChange(id: string, field: string, value: string) {
    updateField.mutate({ id, field, value });
  }

  function copyMd(bug: BugItem) {
    navigator.clipboard.writeText(bugToMarkdown(bug));
    setCopiedId(bug.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const { data, isLoading } = useQuery<{ bugs: BugItem[] }>({
    queryKey: ["bugs", search, filterProject, filterPriority, filterStatus],
    queryFn: () => fetch(`/api/bugs?${params}`).then((r) => r.json()),
  });

  const { data: projectsData } = useQuery<{ projects: { id: string; name: string }[] }>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects?activeOnly=true").then((r) => r.json()),
  });

  const bugs = data?.bugs ?? [];
  const projects = projectsData?.projects ?? [];

  // Counts for summary
  const openCount = bugs.filter((b) => b.status === "OPEN").length;
  const inProgressCount = bugs.filter((b) => b.status === "IN_PROGRESS").length;
  const resolvedCount = bugs.filter((b) => b.status === "RESOLVED" || b.status === "CLOSED").length;
  const criticalCount = bugs.filter((b) => b.priority === "CRITICAL").length;

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={terms.bug.plural}
        subtitle={`Gerencie e acompanhe os ${terms.bug.plural.toLowerCase()} do sistema`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/generator/bugs" className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Gerar com IA
              </Link>
            </Button>
            {canCreate && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Novo {terms.bug.singular.toLowerCase()}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Abertos", value: openCount, color: "text-red-600", bg: "bg-red-50" },
            { label: "Em análise", value: inProgressCount, color: "text-orange-600", bg: "bg-orange-50" },
            { label: "Resolvidos", value: resolvedCount, color: "text-green-600", bg: "bg-green-50" },
            { label: "Críticos", value: criticalCount, color: "text-red-700", bg: "bg-red-100" },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", card.bg)}>
                <Bug className={cn("h-4 w-4", card.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={cn("text-2xl font-bold", isLoading ? "text-muted-foreground animate-pulse" : "")}>{isLoading ? "—" : card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${terms.bug.plural.toLowerCase()}...`}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <FilterSelect label={terms.projeto.singular} value={filterProject} onChange={setFilterProject}>
            <option value="all">Todos os projetos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FilterSelect>

          <FilterSelect label="Prioridade" value={filterPriority} onChange={setFilterPriority}>
            <option value="all">Todas as prioridades</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </FilterSelect>

          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus}>
            <option value="all">Todos os status</option>
            {BUG_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </FilterSelect>

          {(filterProject !== "all" || filterPriority !== "all" || filterStatus !== "all" || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterProject("all"); setFilterPriority("all"); setFilterStatus("all"); setSearch(""); }}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {["Título", "Projeto", "Prioridade", "Status", "Autor", "Criado em", ""].map((col, i) => (
                    <th key={i} className={cn("px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap", i === 6 && "w-28")}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : bugs.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                          <Bug className="h-6 w-6 opacity-40" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">Nenhum bug encontrado</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {search || filterProject !== "all" || filterPriority !== "all" || filterStatus !== "all"
                              ? "Tente ajustar os filtros de busca."
                              : "Use o gerador de IA para criar bugs automaticamente."}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href="/generator/bugs" className="gap-1.5">
                              <Wand2 className="h-3.5 w-3.5" /> Gerar com IA
                            </Link>
                          </Button>
                          {canCreate && (
                            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                              <Plus className="h-3.5 w-3.5" /> Novo bug
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bugs.map((bug) => (
                    <tr key={bug.id} className="group border-b border-border/40 hover:bg-muted/30 transition-colors">
                      {/* Title */}
                      <td className="px-4 py-3.5 max-w-[300px]">
                        <button
                          className="text-left font-medium text-foreground hover:text-primary transition-colors truncate block max-w-full"
                          onClick={() => setEditBug(bug)}
                        >
                          {bug.title}
                        </button>
                        {bug.reference && (
                          <span className="text-[11px] font-mono text-muted-foreground">{bug.reference}</span>
                        )}
                      </td>
                      {/* Project */}
                      <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                        {bug.project.name}
                      </td>
                      {/* Priority — inline editable */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <InlinePrioritySelect bugId={bug.id} value={bug.priority} onChange={handleFieldChange} />
                      </td>
                      {/* Status — inline editable */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <InlineStatusSelect bugId={bug.id} value={bug.status} onChange={handleFieldChange} />
                      </td>
                      {/* Author */}
                      <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                        {bug.author.name}
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(bug.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditBug(bug)}
                            title="Editar"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteBug(bug)}
                            title="Excluir"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => copyMd(bug)}
                            title="Copiar Markdown"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            {copiedId === bug.id
                              ? <Check className="h-3.5 w-3.5 text-green-600" />
                              : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && bugs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {bugs.length} {bugs.length === 1 ? "bug" : "bugs"}
              </p>
              <Link href="/generator/bugs" className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Wand2 className="h-3 w-3" /> Gerar bugs com IA
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {createOpen && <BugFormDialog projects={projects} onClose={() => setCreateOpen(false)} />}
      {editBug && <BugFormDialog bug={editBug} projects={projects} onClose={() => setEditBug(null)} />}
      {deleteBug && <DeleteDialog bug={deleteBug} onClose={() => setDeleteBug(null)} />}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, children,
}: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-3 pr-8 text-sm rounded-lg border bg-card appearance-none cursor-pointer text-foreground"
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}
