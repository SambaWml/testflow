"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { FlaskConical, Building2, LogOut, Sun, Moon, Cpu, ShieldCheck } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-full min-h-screen">
      {/* Admin Sidebar */}
      <aside className="flex flex-col w-56 border-r bg-background shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shrink-0">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-foreground block tracking-tight">TestFlow</span>
            <span className="text-xs text-muted-foreground">Super Admin</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <span>Organizações</span>
          </Link>
          <Link
            href="/admin/admins"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith("/admin/admins")
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Super Admins</span>
          </Link>
          <Link
            href="/admin/ai"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith("/admin/ai")
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Cpu className="h-4 w-4 shrink-0" />
            <span>Configuração IA</span>
          </Link>
        </nav>

        <div className="border-t p-2 space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
