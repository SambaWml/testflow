"use client";

import { Bell, Eye, EyeOff, Pencil, Loader2, User, LogOut, Moon, Sun, AlertCircle, AlertTriangle, Info, ChevronRight, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLang } from "@/contexts/lang-context";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  body: string;
  href: string;
};

const NOTIF_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const NOTIF_COLORS = {
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: session } = useSession();
  const { t } = useLang();
  const { theme, toggleTheme } = useTheme();

  // Poll every 60s so the bell badge stays fresh without a WebSocket connection.
  // staleTime of 30s prevents redundant refetches when the user switches tabs quickly.
  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/notifications").then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const notifications: Notification[] = notifData?.notifications ?? [];
  const notifCount: number = notifData?.total ?? 0;

  const initials = (session?.user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 mr-2">
        {actions}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === "dark" ? "Modo claro" : "Modo escuro"}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="font-semibold text-sm">Notificações</p>
              {notifCount > 0 && (
                <span className="text-xs text-muted-foreground">{notifCount} nova{notifCount > 1 ? "s" : ""}</span>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Tudo em dia!</p>
              </div>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {notifications.map((n) => {
                  const Icon = NOTIF_ICONS[n.type];
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                    >
                      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", NOTIF_COLORS[n.type])} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    </Link>
                  );
                })}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {session?.user?.name && (
                <span className="text-sm font-medium text-foreground hidden md:block">
                  {session.user.name}
                </span>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">
                {initials}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <User className="h-4 w-4 mr-2" /> {t.nav.profile}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-2" /> {t.nav.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}

function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  const { data: session, update: updateSession } = useSession();

  const { data } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => fetch("/api/user/profile").then((r) => r.json()),
    enabled: open,
  });

  const user = data?.user;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const displayName = name !== "" ? name : (user?.name ?? session?.user?.name ?? "");
  const displayEmail = email !== "" ? email : (user?.email ?? session?.user?.email ?? "");
  const isChangingEmail = !!user && email !== "" && email !== user.email;

  const mutation = useMutation({
    mutationFn: async () => {
      if (newPw && newPw !== confirmPw) throw new Error("mismatch");
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName,
          ...(isChangingEmail && { email: displayEmail }),
          ...(newPw && { currentPassword: currentPw, newPassword: newPw }),
          ...((isChangingEmail && !newPw) && { currentPassword: currentPw }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "error");
      return json;
    },
    onSuccess: async (json) => {
      await updateSession({ name: json.user.name });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setError("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: Error) => {
      if (err.message === "mismatch") setError(t.nav.profile_passwords_mismatch);
      else if (err.message === "wrong_password") setError(t.nav.profile_wrong_password);
      else if (err.message === "email_taken") setError("Este e-mail já está em uso.");
      else setError(err.message);
    },
  });

  function handleClose() {
    setName(""); setEmail(""); setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setError(""); setSuccess(false);
    onClose();
  }

  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> {t.nav.profile}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-xl font-bold shrink-0">
              {initials || "?"}
            </div>
            <div>
              <p className="font-semibold">{displayName || user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email ?? session?.user?.email}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.nav.profile_name}</Label>
            <Input
              value={displayName}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.nav.profile_name}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t.nav.profile_email}</Label>
            <Input
              type="email"
              value={displayEmail}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.nav.profile_email}
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t.nav.profile_change_password}
              </p>
              {isChangingEmail && (
                <p className="text-xs text-amber-600">Obrigatório ao alterar e-mail</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t.nav.profile_current_password}</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrent((v) => !v)}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.nav.profile_new_password}</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.nav.profile_confirm_password}</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">{t.nav.profile_saved}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t.common.cancel}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
