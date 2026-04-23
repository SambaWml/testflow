"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Trash2, Pencil, Shield, Mail, CheckCircle2,
  X, Eye, MoreHorizontal, UserPlus, KeyRound, Copy, Check,
} from "lucide-react";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Topbar } from "@/components/layout/topbar";

/* ─── Types ──────────────────────────────────────────── */
type ProjectRef = { id: string; name: string; role: string };

type Member = {
  id: string;
  role: string;
  status: string;
  skills: string[];
  joinedAt: string | null;
  invitedAt: string;
  user: {
    id: string; name: string; email: string; role: string;
    avatarUrl: string | null; createdAt: string; updatedAt: string;
  };
  projects: ProjectRef[];
};

/* ─── Constants ──────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner", ADMIN: "Admin", MEMBER: "Membro",
};

const ROLE_STYLES: Record<string, string> = {
  OWNER:  "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
  ADMIN:  "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
  MEMBER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return format(new Date(iso), "dd MMM yyyy", { locale: ptBR });
}

/* ─── Avatar ─────────────────────────────────────────── */
const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500",  "bg-rose-500",  "bg-cyan-500",
];

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const colorIdx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const sz = size === "sm" ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs";
  return (
    <div className={`flex items-center justify-center rounded-full text-white font-semibold shrink-0 ${sz} ${AVATAR_COLORS[colorIdx]}`}>
      {initials}
    </div>
  );
}

/* ─── Status dot ─────────────────────────────────────── */
function StatusDot({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"}`} />
      <span className={`text-xs ${active ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
        {active ? "Ativo" : "Inativo"}
      </span>
    </span>
  );
}

/* ─── Skill chips (editor) ───────────────────────────── */
function SkillChips({ skills, onChange }: { skills: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const val = input.trim();
    if (!val || skills.includes(val)) { setInput(""); return; }
    onChange([...skills, val]);
    setInput("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !input && skills.length) onChange(skills.slice(0, -1));
  }

  return (
    <div className="flex flex-wrap gap-1.5 min-h-9 px-3 py-2 rounded-md border border-input bg-background items-center">
      {skills.map((s) => (
        <span key={s} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
          {s}
          <button type="button" onClick={() => onChange(skills.filter((x) => x !== s))} className="hover:text-primary/70">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-20 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={skills.length === 0 ? "Adicionar skill..." : ""}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
      />
    </div>
  );
}

/* ─── Skills display (compact) ──────────────────────── */
function SkillsCell({ skills }: { skills: string[] }) {
  if (skills.length === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const visible = skills.slice(0, 2);
  const rest = skills.length - 2;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((s) => (
        <span key={s} className="bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-full font-medium">{s}</span>
      ))}
      {rest > 0 && (
        <span className="text-muted-foreground text-[11px] px-1.5">+{rest}</span>
      )}
    </div>
  );
}

/* ─── Projects display (compact) ────────────────────── */
function ProjectsCell({ projects }: { projects: ProjectRef[] }) {
  if (projects.length === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const visible = projects.slice(0, 2);
  const rest = projects.length - 2;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((p) => (
        <span key={p.id} className="bg-muted text-muted-foreground text-[11px] px-2 py-0.5 rounded-full">{p.name}</span>
      ))}
      {rest > 0 && (
        <span className="text-muted-foreground text-[11px] px-1">+{rest}</span>
      )}
    </div>
  );
}

/* ─── Loading skeleton ───────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="border-b border-border/40">
      {[40, 32, 20, 24, 16, 20, 16, 16].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className={`h-3.5 rounded bg-muted animate-pulse w-${w}`} />
        </td>
      ))}
      <td className="px-4 py-3.5" />
    </tr>
  );
}

/* ─── Edit Modal ─────────────────────────────────────── */
function EditMemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const [skills, setSkills] = useState<string[]>(member.skills);

  const update = useMutation({
    mutationFn: (body: { role?: string; skills?: string[]; status?: string }) =>
      fetch(`/api/orgs/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["org-members"] }); onClose(); },
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={member.user.name} size="md" />
            <div>
              <DialogTitle className="text-base">{member.user.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">{member.user.email}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={role} onValueChange={setRole} disabled={member.role === "OWNER"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Membro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Ativo</SelectItem>
                <SelectItem value="INACTIVE">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Skills</Label>
            <SkillChips skills={skills} onChange={setSkills} />
            <p className="text-[11px] text-muted-foreground">Enter para adicionar, Backspace para remover a última</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => update.mutate({ role, status, skills })} disabled={update.isPending}>
            {update.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── View Modal ─────────────────────────────────────── */
function ViewMemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={member.user.name} size="md" />
            <div>
              <DialogTitle className="text-base">{member.user.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">{member.user.email}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Papel</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLES[member.role] ?? ROLE_STYLES.MEMBER}`}>
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Status</p>
              <StatusDot status={member.status} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Entrou em</p>
              <p className="text-sm">{fmtDate(member.joinedAt)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Criado em</p>
              <p className="text-sm">{fmtDate(member.user.createdAt)}</p>
            </div>
          </div>

          {member.projects.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Projetos</p>
              <div className="flex flex-wrap gap-1.5">
                {member.projects.map((p) => (
                  <span key={p.id} className="bg-muted text-foreground text-xs px-2.5 py-1 rounded-full">{p.name}</span>
                ))}
              </div>
            </div>
          )}

          {member.skills.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {member.skills.map((s) => (
                  <span key={s} className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wide">Criado</p>
              <p className="text-xs text-foreground">{fmtDate(member.user.createdAt)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5 font-medium uppercase tracking-wide">Atualizado</p>
              <p className="text-xs text-foreground">{fmtDate(member.user.updatedAt)}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reset Password Modal ───────────────────────────────────── */
function ResetPasswordModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ tempPassword: string; emailSent: boolean; member: { name: string; email: string } } | null>(null);

  const reset = useMutation({
    mutationFn: () =>
      fetch(`/api/orgs/members/${member.id}/reset-password`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.tempPassword) setResult(data);
    },
  });

  function copyPassword() {
    if (!result) return;
    navigator.clipboard.writeText(result.tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-500" />
            Redefinir senha
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
                <Avatar name={member.user.name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Uma nova senha temporária será gerada e enviada ao e-mail do membro. A senha atual será invalidada imediatamente.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-400">
                A senha gerada também será exibida aqui para que você possa repassá-la manualmente caso o e-mail não chegue.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={reset.isPending}>Cancelar</Button>
              <Button onClick={() => reset.mutate()} disabled={reset.isPending} className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> {reset.isPending ? "Redefinindo..." : "Redefinir senha"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Senha redefinida com sucesso!
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Nova senha temporária — {result.member.name}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-base font-bold tracking-wider text-foreground bg-background border rounded-md px-3 py-2 select-all">
                    {result.tempPassword}
                  </code>
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={copyPassword}>
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Anote agora — não será exibida novamente.</p>
              </div>
              {result.emailSent ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 text-emerald-500" />
                  <span>E-mail com a nova senha enviado para <strong>{result.member.email}</strong>.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-400">
                  <Mail className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>O envio de e-mail falhou. Repasse a senha exibida acima manualmente ao membro.</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Concluir</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Invite Modal ───────────────────────────────────── */
function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", role: "MEMBER" });
  const [result, setResult] = useState<{ tempPassword?: string; emailSent?: boolean } | null>(null);

  const invite = useMutation({
    mutationFn: (body: typeof form) =>
      fetch("/api/orgs/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["org-members"] });
      setResult({ tempPassword: res.tempPassword, emailSent: res.emailSent });
      setForm({ name: "", email: "", role: "MEMBER" });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Convidar membro
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> Membro adicionado com sucesso!
            </div>
            {result.tempPassword && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Senha temporária</p>
                <p className="font-mono text-sm font-bold tracking-wider text-foreground">{result.tempPassword}</p>
                <p className="text-xs text-muted-foreground">Anote agora — não será exibida novamente.</p>
              </div>
            )}
            {result.emailSent && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" /> Credenciais enviadas por e-mail.
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setResult(null)}>Convidar outro</Button>
              <Button onClick={onClose}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); invite.mutate(form); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="João Silva" required />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="joao@empresa.com" required />
            </div>
            <div className="space-y-1.5">
              <Label>Papel inicial</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Membro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {invite.data?.error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{invite.data.error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Convidando..." : "Convidar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Page ───────────────────────────────────────────── */
export default function MembersPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const myRole = (session?.user as { orgRole?: string })?.orgRole ?? "";
  const isOwner = myRole === "OWNER";

  const [showInvite, setShowInvite] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [resetMember, setResetMember] = useState<Member | null>(null);

  const { data, isLoading } = useQuery<{ members: Member[] }>({
    queryKey: ["org-members"],
    queryFn: () => fetch("/api/orgs/members").then((r) => r.json()),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      fetch(`/api/orgs/members/${memberId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members"] }),
  });

  // Role names
  const { data: roleNamesData } = useQuery<{ roleNames: Record<string, string> }>({
    queryKey: ["role-names"],
    queryFn: () => fetch("/api/orgs/role-names").then((r) => r.json()),
  });
  const [roleNameInputs, setRoleNameInputs] = useState({ OWNER: "", ADMIN: "", MEMBER: "" });
  const [roleNamesSaved, setRoleNamesSaved] = useState(false);

  useEffect(() => {
    if (roleNamesData?.roleNames) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoleNameInputs({
        OWNER: roleNamesData.roleNames.OWNER ?? "Owner",
        ADMIN: roleNamesData.roleNames.ADMIN ?? "Admin",
        MEMBER: roleNamesData.roleNames.MEMBER ?? "Membro",
      });
    }
  }, [roleNamesData]);

  const saveRoleNames = useMutation({
    mutationFn: () =>
      fetch("/api/orgs/role-names", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleNameInputs),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-names"] });
      setRoleNamesSaved(true);
      setTimeout(() => setRoleNamesSaved(false), 2500);
    },
  });

  const members = data?.members ?? [];

  return (
    <div className="flex flex-col h-full">
      <Topbar
        title="Membros"
        subtitle={isLoading ? "Carregando..." : `${members.length} ${members.length === 1 ? "membro" : "membros"} na organização`}
        actions={isOwner ? (
          <Button onClick={() => setShowInvite(true)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Convidar membro
          </Button>
        ) : undefined}
      />

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Head */}
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  {[
                    "Membro", "E-mail", "Perfil", "Projeto(s)",
                    "Status", "Skills", "Criado em", "Atualizado em", "",
                  ].map((col, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap ${i === 8 ? "w-12" : ""}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                          <Users className="h-6 w-6 opacity-40" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">Nenhum membro encontrado</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isOwner ? "Convide membros para começar a colaborar." : "Você ainda não tem acesso a membros desta organização."}
                          </p>
                        </div>
                        {isOwner && (
                          <Button size="sm" variant="outline" onClick={() => setShowInvite(true)} className="gap-1.5 mt-1">
                            <UserPlus className="h-3.5 w-3.5" /> Convidar membro
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr
                      key={m.id}
                      className="group border-b border-border/40 hover:bg-muted/30 transition-colors"
                    >
                      {/* Membro */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.user.name} size="sm" />
                          <span className="font-medium text-foreground whitespace-nowrap">{m.user.name}</span>
                        </div>
                      </td>

                      {/* E-mail */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{m.user.email}</span>
                      </td>

                      {/* Perfil */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_STYLES[m.role] ?? ROLE_STYLES.MEMBER}`}>
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      </td>

                      {/* Projetos */}
                      <td className="px-4 py-3.5 max-w-[160px]">
                        <ProjectsCell projects={m.projects} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusDot status={m.status} />
                      </td>

                      {/* Skills */}
                      <td className="px-4 py-3.5 max-w-[160px]">
                        <SkillsCell skills={m.skills} />
                      </td>

                      {/* Criado em */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">{fmtDate(m.user.createdAt)}</span>
                      </td>

                      {/* Atualizado em */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">{fmtDate(m.user.updatedAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => setViewMember(m)}>
                              <Eye className="h-3.5 w-3.5 mr-2" /> Visualizar
                            </DropdownMenuItem>
                            {isOwner && (
                              <>
                                <DropdownMenuItem onClick={() => setEditMember(m)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                                </DropdownMenuItem>
                                {m.role !== "OWNER" && (
                                  <>
                                    <DropdownMenuItem onClick={() => setResetMember(m)}>
                                      <KeyRound className="h-3.5 w-3.5 mr-2" /> Redefinir senha
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        if (confirm(`Remover ${m.user.name} da organização?`))
                                          removeMember.mutate(m.id);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!isLoading && members.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {members.length} {members.length === 1 ? "registro" : "registros"}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {!isOwner && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Visualização restrita por projetos
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role legend */}
        <div className="mt-5 rounded-lg border border-border/50 bg-muted/20 px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Shield className="h-3 w-3" /> Níveis de acesso
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              { role: "OWNER",  desc: "Acesso total, gerencia todos os membros" },
              { role: "ADMIN",  desc: "Gerencia membros e projetos da organização" },
              { role: "MEMBER", desc: "Cria e executa casos nos projetos atribuídos" },
            ].map(({ role, desc }) => (
              <div key={role} className="flex items-start gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${ROLE_STYLES[role]}`}>
                  {roleNamesData?.roleNames?.[role] ?? ROLE_LABELS[role]}
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Role renaming (Owner only) ── */}
        {isOwner && (
          <div className="mt-5 rounded-lg border border-border/60 bg-card px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Pencil className="h-3 w-3" /> Renomear cargos
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Personalize os nomes exibidos para cada nível de acesso na sua organização.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {(["OWNER", "ADMIN", "MEMBER"] as const).map((role) => (
                <div key={role} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ROLE_STYLES[role]}`}>
                      {role}
                    </span>
                  </label>
                  <Input
                    value={roleNameInputs[role]}
                    onChange={(e) => setRoleNameInputs((prev) => ({ ...prev, [role]: e.target.value }))}
                    disabled={role === "OWNER"}
                    placeholder={ROLE_LABELS[role]}
                    className="h-8 text-sm"
                  />
                  {role === "OWNER" && (
                    <p className="text-[10px] text-muted-foreground">Não editável</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => saveRoleNames.mutate()}
                disabled={saveRoleNames.isPending}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {saveRoleNames.isPending ? "Salvando..." : "Salvar nomes"}
              </Button>
              {roleNamesSaved && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Nomes salvos com sucesso
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {editMember && <EditMemberModal member={editMember} onClose={() => setEditMember(null)} />}
      {viewMember && <ViewMemberModal member={viewMember} onClose={() => setViewMember(null)} />}
      {resetMember && <ResetPasswordModal member={resetMember} onClose={() => setResetMember(null)} />}
    </div>
  );
}
