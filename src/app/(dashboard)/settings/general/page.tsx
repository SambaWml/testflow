"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Globe, Building2, FlaskConical, BookOpen, BarChart3, Layers,
  FolderOpen, Wand2, TestTube2, Play, Settings, ChevronRight, Zap, ShieldCheck, Bug,
} from "lucide-react";
import { useLang } from "@/contexts/lang-context";

type OrgInfo = {
  id: string; code: number; name: string; slug: string;
  plan: string; isActive: boolean; createdAt: string;
  _count: { members: number; projects: number };
};

const PLAN_LABELS: Record<string, string> = { FREE: "Free", PRO: "Pro", ENTERPRISE: "Enterprise" };

/* ══════════════════════════════════════════════════════
   Org Info Card
══════════════════════════════════════════════════════ */
function OrgInfoCard() {
  const { data: session } = useSession();
  const orgId = (session?.user as { orgId?: string })?.orgId;

  const { data, isLoading } = useQuery<{ org: OrgInfo }>({
    queryKey: ["org-info"],
    queryFn: () => fetch("/api/orgs/me").then((r) => r.json()),
    enabled: !!orgId,
  });

  if (!orgId) return null;

  const org = data?.org;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4" /> Organização
        </CardTitle>
        <CardDescription className="text-xs">Informações do workspace desta organização</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : org ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Nome</p>
              <p className="font-medium text-foreground">{org.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">ID</p>
              <p className="font-mono text-foreground">#{org.code}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Workspace</p>
              <p className="font-mono text-foreground text-xs">{org.slug}.testflow.com</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Plano</p>
              <Badge variant="outline" className="text-xs">{PLAN_LABELS[org.plan] ?? org.plan}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Membros</p>
              <p className="text-foreground">{org._count.members}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Projetos</p>
              <p className="text-foreground">{org._count.projects}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem organização vinculada.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   Lang Switcher
══════════════════════════════════════════════════════ */
function LangSwitcherRow() {
  const { lang, switchLang, t } = useLang();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        {t.settings.default_lang}
      </Label>
      <div className="flex rounded-lg border overflow-hidden text-sm">
        <button type="button" onClick={() => lang !== "pt-BR" && switchLang("pt-BR")}
          className={`px-4 py-1.5 transition-colors ${lang === "pt-BR" ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>
          PT-BR
        </button>
        <button type="button" onClick={() => lang !== "en-US" && switchLang("en-US")}
          className={`px-4 py-1.5 transition-colors border-l ${lang === "en-US" ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>
          EN-US
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   About Tab
══════════════════════════════════════════════════════ */
function AboutTab() {
  const { t } = useLang();
  const ab = t.settings.about;
  return (
    <div className="max-w-3xl space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shrink-0">
              <FlaskConical className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">TestFlow</h1>
              <p className="text-muted-foreground text-sm">{ab.system_subtitle}</p>
            </div>
            <Badge className="ml-auto shrink-0" variant="secondary">v1.0.0</Badge>
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{ab.hero_desc}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> {ab.what_for_title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
          <p>{ab.what_for_body}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {([Zap, ShieldCheck, BarChart3] as const).map((Icon, i) => (
              <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground text-xs">{ab.features[i].title}</span>
                </div>
                <p className="text-xs leading-relaxed">{ab.features[i].desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" /> {ab.modules_title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { icon: FolderOpen, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
              { icon: Wand2, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
              { icon: TestTube2, color: "text-green-600 bg-green-50 dark:bg-green-950/40" },
              { icon: Play, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40" },
              { icon: Bug, color: "text-red-600 bg-red-50 dark:bg-red-950/40" },
              { icon: BarChart3, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
              { icon: Settings, color: "text-slate-600 bg-slate-50 dark:bg-slate-800/40" },
            ] as const).map(({ icon: Icon, color }, i) => {
              const mod = ab.modules[i];
              if (!mod) return null;
              return (
                <div key={i} className="flex gap-3 p-3 rounded-lg border">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{mod.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{mod.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-400">
            <Zap className="h-4 w-4" /> {ab.tips_title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {ab.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground pb-4">{ab.footer}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════ */
export default function SettingsGeneralPage() {
  const { t } = useLang();
  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.settings.title} subtitle={t.settings.subtitle} />
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="general">
          <TabsList className="mb-6">
            <TabsTrigger value="general">
              <Building2 className="h-4 w-4 mr-1.5" /> Geral
            </TabsTrigger>
            <TabsTrigger value="about">
              <FlaskConical className="h-4 w-4 mr-1.5" /> Sobre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="space-y-4 max-w-xl">
              <OrgInfoCard />
              <Card>
                <CardHeader>
                  <CardTitle>{t.settings.section_system}</CardTitle>
                  <CardDescription>{t.settings.section_system_desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <LangSwitcherRow />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
