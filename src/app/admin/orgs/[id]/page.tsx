"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, FolderOpen, Plus, Trash2, Mail, CheckCircle2, Globe } from "lucide-react";
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

type OrgDetail = {
  id: string;
  code: number;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  members: {
    id: string;
    role: string;
    joinedAt: string | null;
    user: { id: string; name: string; email: string; role: string; createdAt: string };
  }[];
  projects: { id: string; name: string; isActive: boolean; createdAt: string }[];
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Membro",
  VIEWER: "Visualizador",
};

export default function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "MEMBER" });
  const [addResult, setAddResult] = useState<{ tempPassword?: string; emailSent?: boolean } | null>(null);

  const { data, isLoading } = useQuery<{ org: OrgDetail }>({
    queryKey: ["admin-org", id],
    queryFn: () => fetch(`/api/admin/orgs/${id}`).then((r) => r.json()),
  });

  const addMember = useMutation({
    mutationFn: (body: { name: string; email: string; role: string }) =>
      fetch(`/api/admin/orgs/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-org", id] });
      setAddResult({ tempPassword: res.tempPassword, emailSent: res.emailSent });
      setForm({ name: "", email: "", role: "MEMBER" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) =>
      fetch(`/api/admin/orgs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-org", id] }),
  });

  const deleteOrg = useMutation({
    mutationFn: () => fetch(`/api/admin/orgs/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.success) router.push("/admin");
    },
  });

  const org = data?.org;

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Carregando...</div>;
  if (!org) return <div className="p-6 text-destructive text-sm">Organização não encontrada.</div>;

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/admin">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{org.name}</h1>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              <span className="font-mono">{org.slug}.testflow.com</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-mono text-muted-foreground/60">#{org.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={org.isActive ? "default" : "secondary"}>{org.isActive ? "Ativa" : "Inativa"}</Badge>
          <Badge variant="outline">{org.plan}</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleActive.mutate(!org.isActive)}
            disabled={toggleActive.isPending}
          >
            {org.isActive ? "Desativar" : "Ativar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Members */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Membros ({org.members.length})
            </h2>
            <Button size="sm" onClick={() => { setShowAdd(true); setAddResult(null); }}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Membro
            </Button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">E-mail</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Entrou</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {org.members.map((m) => (
                  <tr key={m.id} className="bg-card hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium text-foreground">{m.user.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.user.email}</td>
                    <td className="px-4 py-2">
                      <Badge variant={m.role === "OWNER" ? "default" : "secondary"} className="text-xs">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {m.joinedAt
                        ? formatDistanceToNow(new Date(m.joinedAt), { addSuffix: true, locale: ptBR })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Projects */}
        <section>
          <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">
            <FolderOpen className="h-4 w-4" /> Projetos ({org.projects.length})
          </h2>
          {org.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum projeto ainda.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Criado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {org.projects.map((p) => (
                    <tr key={p.id} className="bg-card hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">
                          {p.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true, locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Delete Org Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover organização</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja remover <strong className="text-foreground">{org.name}</strong>?
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-xs text-destructive">
              Esta ação é irreversível. Todos os projetos, casos de teste, execuções e relatórios da organização serão permanentemente excluídos.
            </div>
            {deleteOrg.data?.error && (
              <p className="text-sm text-destructive">{deleteOrg.data.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteOrg.isPending}
              onClick={() => deleteOrg.mutate()}
            >
              {deleteOrg.isPending ? "Removendo..." : "Remover organização"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) setAddResult(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
          </DialogHeader>

          {addResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Membro adicionado com sucesso!
              </div>
              {addResult.tempPassword && (
                <div className="bg-slate-50 border rounded-md p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Senha temporária</p>
                  <p className="font-mono text-sm font-bold text-foreground">{addResult.tempPassword}</p>
                  <p className="text-xs text-muted-foreground">Anote esta senha — ela não será exibida novamente.</p>
                </div>
              )}
              {addResult.emailSent && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /> Credenciais enviadas por e-mail.
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setShowAdd(false); setAddResult(null); }}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); addMember.mutate(form); }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Maria Souza"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="maria@empresa.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Papel na organização</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Membro</SelectItem>
                    <SelectItem value="VIEWER">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {addMember.data?.error && (
                <p className="text-sm text-destructive">{addMember.data.error}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
                <Button type="submit" disabled={addMember.isPending}>
                  {addMember.isPending ? "Adicionando..." : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
