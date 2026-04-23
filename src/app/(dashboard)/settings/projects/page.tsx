"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Users, ChevronDown, ChevronUp, Plus, Trash2,
  Pencil, Power, PowerOff, AlertTriangle, Loader2, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Topbar } from "@/components/layout/topbar";
import { useTerms } from "@/contexts/terms-context";

type Project = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isActive: boolean;
  createdAt: string;
  _count: { items: number; cases: number; executions: number; testPlans: number };
};

type ProjectMember = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

type OrgMember = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner", ADMIN: "Admin", MEMBER: "Membro",
};

/* ─── Project form dialog (create / edit) ────────────── */
function ProjectFormDialog({
  project,
  onClose,
}: {
  project?: Project;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");

  const save = useMutation({
    mutationFn: (body: { name: string; description: string }) => {
      if (project) {
        return fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => r.json());
      }
      return fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-projects"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Portal do Cliente"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o objetivo do projeto"
            />
          </div>
        </div>
        {save.data?.error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{save.data.error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate({ name: name.trim(), description: description.trim() })}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {project ? "Salvar" : "Criar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Delete confirmation dialog ─────────────────────── */
function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { terms } = useTerms();
  const [error, setError] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "error");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-projects"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const c = project._count;
  const total = c.items + c.cases + c.testPlans + c.executions;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Excluir projeto
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <span className="font-semibold text-foreground">&ldquo;{project.name}&rdquo;</span>?
            Esta ação é irreversível.
          </p>
          {total > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-destructive mb-1">Dados que serão removidos:</p>
              {[
                { label: terms.item.plural, count: c.items },
                { label: terms.casoDeTeste.plural, count: c.cases },
                { label: terms.planoDeTeste.plural, count: c.testPlans },
                { label: terms.execucao.plural, count: c.executions },
              ].filter((r) => r.count > 0).map(({ label, count }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
          )}
        </div>
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

/* ─── Project row (expandable with QA members) ───────── */
function ProjectRow({
  project,
  orgMembers,
  canManage,
}: {
  project: Project;
  orgMembers: OrgMember[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState("MEMBER");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery<{ members: ProjectMember[] }>({
    queryKey: ["project-members", project.id],
    queryFn: () => fetch(`/api/orgs/projects/${project.id}/members`).then((r) => r.json()),
    enabled: expanded,
  });

  const addMember = useMutation({
    mutationFn: (body: { userId: string; role: string }) =>
      fetch(`/api/orgs/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", project.id] });
      setAddUserId("");
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/orgs/projects/${project.id}/members?userId=${userId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-members", project.id] }),
  });

  const toggleActive = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !project.isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-projects"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const projectMemberIds = new Set(data?.members?.map((m) => m.user.id) ?? []);
  const availableToAdd = orgMembers.filter((m) => !projectMemberIds.has(m.user.id));

  return (
    <>
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        {/* Row header */}
        <div className="flex items-center gap-4 p-4">
          {/* Clickable area — expand/collapse */}
          <button
            className="flex-1 flex items-center gap-3 text-left min-w-0"
            onClick={() => setExpanded((e) => !e)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-sm text-foreground truncate">{project.name}</span>
                <Badge
                  variant={project.isActive ? "default" : "secondary"}
                  className="text-xs shrink-0"
                >
                  {project.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate">{project.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{project._count.cases} casos</span>
                <span>{project._count.executions} execuções</span>
                <span>{project._count.testPlans} planos</span>
                <span>Criado {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true, locale: ptBR })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {data?.members?.length ?? "—"}
              </span>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {/* Project management actions (Owner/Admin only) */}
          {canManage && (
            <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-border/60">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Editar projeto"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${project.isActive ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"}`}
                title={project.isActive ? "Desativar" : "Ativar"}
                onClick={() => toggleActive.mutate()}
                disabled={toggleActive.isPending}
              >
                {project.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Excluir projeto"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Expanded: QA members */}
        {expanded && (
          <div className="border-t bg-muted/10 p-4 space-y-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> QA vinculados ao projeto
            </h3>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {(data?.members ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum QA vinculado ainda.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Nome</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">E-mail</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Papel</th>
                          {canManage && <th className="px-3 py-2 w-10" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data?.members?.map((m) => (
                          <tr key={m.id} className="bg-card">
                            <td className="px-3 py-2 font-medium text-foreground">{m.user.name}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{m.user.email}</td>
                            <td className="px-3 py-2">
                              <Badge variant="secondary" className="text-xs">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                            </td>
                            {canManage && (
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                                  onClick={() => removeMember.mutate(m.user.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add QA (Owner/Admin only) */}
                {canManage && availableToAdd.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Select value={addUserId} onValueChange={setAddUserId}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Selecionar membro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableToAdd.map((m) => (
                          <SelectItem key={m.user.id} value={m.user.id}>
                            {m.user.name} — {ROLE_LABELS[m.role] ?? m.role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={addRole} onValueChange={setAddRole}>
                      <SelectTrigger className="h-8 text-xs w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1"
                      disabled={!addUserId || addMember.isPending}
                      onClick={() => addMember.mutate({ userId: addUserId, role: addRole })}
                    >
                      <Plus className="h-3.5 w-3.5" /> Vincular
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {editOpen && <ProjectFormDialog project={project} onClose={() => setEditOpen(false)} />}
      {deleteOpen && <DeleteProjectDialog project={project} onClose={() => setDeleteOpen(false)} />}
    </>
  );
}

/* ─── Page ───────────────────────────────────────────── */
export default function SettingsProjectsPage() {
  const { data: session } = useSession();
  const myRole = (session?.user as { orgRole?: string })?.orgRole ?? "";
  // Owner: full CRUD. Admin: view-only (can see all projects, cannot create/edit/delete/toggle).
  const canManage = myRole === "OWNER";

  const [createOpen, setCreateOpen] = useState(false);

  const { data: projectsData, isLoading: loadingProjects } = useQuery<{ projects: Project[] }>({
    queryKey: ["settings-projects"],
    queryFn: () => fetch("/api/projects?all=true").then((r) => r.json()),
  });

  const { data: membersData } = useQuery<{ members: OrgMember[] }>({
    queryKey: ["org-members"],
    queryFn: () => fetch("/api/orgs/members").then((r) => r.json()),
  });

  const projects = projectsData?.projects ?? [];
  const orgMembers = membersData?.members ?? [];

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Projetos"
        subtitle={loadingProjects ? "Carregando..." : `${projects.length} ${projects.length === 1 ? "projeto" : "projetos"} · gerencie projetos e vincule membros`}
        actions={canManage ? (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo projeto
          </Button>
        ) : undefined}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-3">
        {loadingProjects ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border bg-card animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-6 w-6 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Nenhum projeto encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Crie o primeiro projeto para começar.</p>
            </div>
            {canManage && (
              <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Criar projeto
              </Button>
            )}
          </div>
        ) : (
          projects.map((p) => (
            <ProjectRow key={p.id} project={p} orgMembers={orgMembers} canManage={canManage} />
          ))
        )}
      </div>

      {createOpen && <ProjectFormDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
