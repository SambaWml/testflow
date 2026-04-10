"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderOpen, TestTube2, Wand2, Play, BarChart3, Settings,
  ChevronLeft, ChevronRight, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { getTerms } from "@/lib/term-config";
import { useLang } from "@/contexts/lang-context";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLang();
  const terms = getTerms();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: t.nav.dashboard },
    { href: "/projects", icon: FolderOpen, label: terms.projeto.plural },
    { href: "/generator", icon: Wand2, label: t.nav.ia_generator },
    { href: "/cases", icon: TestTube2, label: terms.casoDeTeste.plural },
    { href: "/executions", icon: Play, label: terms.execucao.plural },
    { href: "/reports", icon: BarChart3, label: terms.relatorio.plural },
    { href: "/settings", icon: Settings, label: t.nav.settings },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-white transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2 px-4 py-5 border-b", collapsed && "justify-center px-2")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shrink-0">
          <FlaskConical className="h-4 w-4" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg text-foreground tracking-tight">TestFlow</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse */}
      <div className="border-t p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
