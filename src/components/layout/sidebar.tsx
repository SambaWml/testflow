"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, TestTube2, Wand2, Play, BarChart3,
  Settings, ChevronLeft, ChevronRight, FlaskConical, Users, ShieldCheck,
  ChevronDown, ChevronUp, FolderCog, SlidersHorizontal, Bug, Tag, WandSparkles, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useLang } from "@/contexts/lang-context";
import { useTerms } from "@/contexts/terms-context";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

const SETTINGS_SUBMENUS = [
  { href: "/settings/members", icon: Users, label: "Membros", ownerOnly: false },
  { href: "/settings/projects", icon: FolderCog, label: "Projetos", ownerOnly: true },
  { href: "/settings/general", icon: SlidersHorizontal, label: "Geral", ownerOnly: false },
  { href: "/settings/dashboards", icon: LayoutDashboard, label: "Dashboards", ownerOnly: true },
  { href: "/settings/terms", icon: Tag, label: "Termos", ownerOnly: true },
  { href: "/settings/generator", icon: WandSparkles, label: "Gerador IA", ownerOnly: false },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner", ADMIN: "Admin", MEMBER: "Membro",
};

function NavItem({
  href, icon: Icon, label, collapsed, exact = false,
}: {
  href: string; icon: React.ElementType; label: string; collapsed: boolean; exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg py-2 text-sm transition-all duration-150",
        collapsed ? "justify-center w-9 mx-auto px-0" : "px-3",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLang();
  const { terms } = useTerms();
  const { data: session } = useSession();
  const user = session?.user as {
    isSuperAdmin?: boolean; orgRole?: string; name?: string; email?: string;
  } | undefined;

  // Orgs can rename roles (e.g. "OWNER" → "QA Lead"); fall back to defaults if not configured.
  const { data: roleNamesData } = useQuery<{ roleNames: Record<string, string> }>({
    queryKey: ["role-names"],
    queryFn: () => fetch("/api/orgs/role-names").then((r) => r.json()),
    enabled: !!user?.orgRole,
    staleTime: 5 * 60 * 1000,
  });
  const roleNames = roleNamesData?.roleNames ?? ROLE_LABELS;

  const isSettingsActive = pathname.startsWith("/settings");
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);
  const canManageSettings = user?.orgRole === "OWNER" || user?.orgRole === "ADMIN";

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: t.nav.dashboard, exact: true },
    { href: "/projects", icon: FolderOpen, label: terms.projeto.plural },
    { href: "/bugs", icon: Bug, label: terms.bug.plural },
    { href: "/generator", icon: Wand2, label: t.nav.ia_generator },
    { href: "/cases", icon: TestTube2, label: terms.casoDeTeste.plural },
    { href: "/executions", icon: Play, label: terms.execucao.plural },
    { href: "/reports", icon: BarChart3, label: terms.relatorio.plural },
  ];

  return (
    <aside
      className={cn(
        "tf-sidebar flex flex-col border-r transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* ── Logo ── */}
      <div className={cn(
        "flex items-center gap-2.5 h-14 border-b border-border/60 shrink-0",
        collapsed ? "justify-center" : "px-4"
      )}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shrink-0">
          <FlaskConical className="h-3.5 w-3.5" />
        </div>
        {!collapsed && (
          <span className="font-bold text-[15px] tracking-tight text-foreground">TestFlow</span>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Workspace
          </p>
        )}

        {navItems.map((item) => (
          <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} collapsed={collapsed} exact={item.exact} />
        ))}

        <div className={cn("my-3 border-t border-border/40", collapsed && "mx-2")} />

        {!collapsed && (
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            Sistema
          </p>
        )}

        {/* Settings toggle */}
        <button
          onClick={() => !collapsed && setSettingsOpen((o) => !o)}
          title={collapsed ? "Configurações" : undefined}
          className={cn(
            "relative w-full flex items-center gap-2.5 rounded-lg py-2 text-sm transition-all duration-150",
            collapsed ? "justify-center w-9 mx-auto px-0" : "px-3",
            isSettingsActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          {isSettingsActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
          )}
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Configurações</span>
              {settingsOpen
                ? <ChevronUp className="h-3 w-3 opacity-50" />
                : <ChevronDown className="h-3 w-3 opacity-50" />}
            </>
          )}
        </button>

        {/* Submenus — expanded */}
        {settingsOpen && !collapsed && (
          <div className="ml-5 border-l border-border/50 pl-3 space-y-0.5 mt-0.5">
            {SETTINGS_SUBMENUS.map((sub) => {
              if (sub.ownerOnly && !canManageSettings) return null;
              const active = pathname.startsWith(sub.href);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    active
                      ? "text-primary font-medium bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <sub.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{sub.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Submenus — collapsed */}
        {collapsed && (
          <div className="mt-0.5 space-y-0.5">
            {SETTINGS_SUBMENUS.map((sub) => {
              if (sub.ownerOnly && !canManageSettings) return null;
              const active = pathname.startsWith(sub.href);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  title={sub.label}
                  className={cn(
                    "flex items-center justify-center rounded-md w-9 mx-auto py-1.5 transition-colors",
                    active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <sub.icon className="h-3.5 w-3.5" />
                </Link>
              );
            })}
          </div>
        )}

        {/* API Docs only shown to users who can manage settings or super admins —
            members shouldn't see integration docs they can't act on. */}
        {(canManageSettings || user?.isSuperAdmin) && (
          <a
            href="/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? "API Docs" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors text-muted-foreground hover:bg-muted/60 hover:text-foreground mt-0.5",
              collapsed ? "justify-center w-9 mx-auto px-0" : "px-3"
            )}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            {!collapsed && <span>API Docs</span>}
          </a>
        )}

        {/* Admin link */}
        {user?.isSuperAdmin && (
          <Link
            href="/admin"
            title={collapsed ? "Painel Admin" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors text-muted-foreground hover:bg-muted/60 hover:text-foreground mt-0.5",
              collapsed ? "justify-center w-9 mx-auto px-0" : "px-3"
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            {!collapsed && <span>Painel Admin</span>}
          </Link>
        )}
      </nav>

      {/* ── User section + collapse ── */}
      <div className="border-t border-border/60 p-2">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user?.name ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {user?.orgRole ? (roleNames[user.orgRole] ?? user.orgRole) : (user?.email ?? "")}
              </p>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              title="Recolher sidebar"
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
              {initials}
            </div>
            <button
              onClick={() => setCollapsed(false)}
              title="Expandir sidebar"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
