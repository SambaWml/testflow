"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users, FolderOpen, CheckCircle2, XCircle, Mail, Eye, Trash2, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Org = {
  id: string;
  code: number;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  _count: { members: number; projects: number };
  members: { user: { id: string; name: string; email: string } }[];
};

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function generatePassword() {
  return Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase();
}

export default function AdminOrgsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    orgName: "", ownerName: "", ownerEmail: "", plan: "FREE",
    initialPassword: "", autoPassword: true,
  });
  const [result, setResult] = useState<{ tempPassword?: string; emailSent?: boolean; warning?: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Org | null>(null);

  const { data, isLoading } = useQuery<{ orgs: Org[] }>({
    queryKey: ["admin-orgs"],
    queryFn: () => fetch("/api/admin/orgs").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) return; // keep form open on error
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      setResult({ tempPassword: res.tempPassword, emailSent: res.emailSent, warning: res.warning });
      setForm({ orgName: "", ownerName: "", ownerEmail: "", plan: "FREE", initialPassword: "", autoPassword: true });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/orgs/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      setDeleteConfirm(null);
    },
  });

  const orgs = data?.orgs ?? [];
  const slug = generateSlug(form.orgName);

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Organizações</h1>
          <Badge variant="secondary">{orgs.length}</Badge>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Organização
        </Button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando...</div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma organização criada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orgs.map((org) => {
              const owner = org.members[0]?.user;
              return (
                <div key={org.id} className="bg-card border rounded-lg p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">{org.name}</span>
                      <Badge variant={org.isActive ? "default" : "secondary"} className="text-xs">
                        {org.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{org.plan}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                      <Globe className="h-3 w-3" />
                      <span className="font-mono">{org.slug}.testflow.com</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="font-mono text-muted-foreground/60">#{org.code}</span>
                      {owner && <> &nbsp;·&nbsp; Owner: <strong>{owner.name}</strong> ({owner.email})</>}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> {org._count.members}
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-4 w-4" /> {org._count.projects}
                    </span>
                    <span className="text-xs">
                      {formatDistanceToNow(new Date(org.createdAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/admin/orgs/${org.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" /> Detalhes
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteConfirm(org)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Org Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Organização</DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Organização criada com sucesso!
              </div>
              {result.warning && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                  {result.warning}
                </div>
              )}
              {result.tempPassword && (
                <div className="bg-slate-50 dark:bg-slate-900 border rounded-md p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha inicial</p>
                  <p className="font-mono text-sm font-bold text-foreground">{result.tempPassword}</p>
                  <p className="text-xs text-muted-foreground">Anote esta senha — ela não será exibida novamente.</p>
                </div>
              )}
              {result.emailSent && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /> Credenciais enviadas por e-mail.
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setShowCreate(false); setResult(null); }}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  orgName: form.orgName,
                  ownerName: form.ownerName,
                  ownerEmail: form.ownerEmail,
                  plan: form.plan,
                  initialPassword: form.autoPassword ? undefined : form.initialPassword,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label>Nome da organização *</Label>
                <Input
                  value={form.orgName}
                  onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
                  placeholder="Empresa XPTO"
                  required
                />
                {form.orgName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Workspace: <span className="font-mono">{slug}.testflow.com</span>
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Nome do responsável *</Label>
                <Input
                  value={form.ownerName}
                  onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                  placeholder="João Silva"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail do responsável *</Label>
                <Input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                  placeholder="joao@empresa.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Plano *</Label>
                <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Senha inicial *</Label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      autoPassword: !f.autoPassword,
                      initialPassword: !f.autoPassword ? "" : generatePassword(),
                    }))}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {form.autoPassword ? "Definir manualmente" : "Gerar automaticamente"}
                  </button>
                </div>
                {form.autoPassword ? (
                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/40 text-sm text-muted-foreground">
                    <span>Será gerada automaticamente</span>
                  </div>
                ) : (
                  <Input
                    type="text"
                    value={form.initialPassword}
                    onChange={(e) => setForm((f) => ({ ...f, initialPassword: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    required={!form.autoPassword}
                  />
                )}
              </div>
              {createMutation.data?.error && (
                <p className="text-sm text-destructive">{createMutation.data.error}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar & Enviar Credenciais"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover organização</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja remover <strong className="text-foreground">{deleteConfirm?.name}</strong>?
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-xs text-destructive">
              Esta ação é irreversível. Todos os projetos, casos de teste, execuções e relatórios da organização serão permanentemente excluídos.
            </div>
            {deleteMutation.data?.error && (
              <p className="text-sm text-destructive">{deleteMutation.data.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover organização"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
