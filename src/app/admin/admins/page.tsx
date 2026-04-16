"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ShieldCheck, Plus, Trash2, Loader2, Check, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Admin = { id: string; name: string; email: string; createdAt: string };

function generatePassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function AdminsPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const me = session?.user as { id?: string } | undefined;

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: generatePassword() });
  const [showPass, setShowPass] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data, isLoading } = useQuery<{ admins: Admin[] }>({
    queryKey: ["superadmins"],
    queryFn: () => fetch("/api/admin/superadmins").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/admin/superadmins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        setFeedback({ type: "error", msg: res.error });
        return;
      }
      qc.invalidateQueries({ queryKey: ["superadmins"] });
      setShowCreate(false);
      setForm({ name: "", email: "", password: generatePassword() });
      setFeedback({
        type: "success",
        msg: res.promoted
          ? `${res.admin.email} promovido a super admin.`
          : `Super admin ${res.admin.name} criado com sucesso.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/superadmins/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        setFeedback({ type: "error", msg: res.error });
        return;
      }
      qc.invalidateQueries({ queryKey: ["superadmins"] });
      setDeleteTarget(null);
      setFeedback({
        type: "success",
        msg: res.revoked ? "Privilégio removido. Usuário mantido no sistema." : "Super admin excluído.",
      });
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  const admins = data?.admins ?? [];

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b bg-background px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Super Admins</h1>
          <Badge variant="secondary">{admins.length}</Badge>
        </div>
        <Button size="sm" onClick={() => { setFeedback(null); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Super Admin
        </Button>
      </div>

      <div className="p-6 max-w-2xl space-y-4">
        {feedback && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
          }`}>
            {feedback.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {feedback.msg}
          </div>
        )}

        <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 border">
          Super admins têm acesso total ao painel de administração, incluindo gerenciamento de organizações e configuração de IA.
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-2">
            {admins.map((admin) => {
              const isMe = me?.id === admin.id;
              return (
                <div key={admin.id} className="flex items-center gap-3 bg-card border rounded-lg px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {admin.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{admin.name}</span>
                      {isMe && <Badge variant="outline" className="text-xs">você</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(admin.createdAt), { addSuffix: true, locale: ptBR })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={isMe}
                    title={isMe ? "Não é possível remover a si mesmo" : "Remover super admin"}
                    onClick={() => setDeleteTarget(admin)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Super Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {feedback?.type === "error" && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {feedback.msg}
              </div>
            )}
            <div>
              <Label htmlFor="sa-name">Nome</Label>
              <Input
                id="sa-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Maria Silva"
              />
            </div>
            <div>
              <Label htmlFor="sa-email">E-mail</Label>
              <Input
                id="sa-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="maria@empresa.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se o e-mail já existir, o usuário será promovido a super admin.
              </p>
            </div>
            <div>
              <Label htmlFor="sa-pass">Senha inicial</Label>
              <div className="relative">
                <Input
                  id="sa-pass"
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                className="text-xs text-primary mt-1 hover:underline"
                onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
              >
                Gerar nova senha
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || !form.email || !form.password}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover super admin</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover privilégio de <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?
            Se o usuário não pertencer a nenhuma organização, ele será excluído do sistema.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
