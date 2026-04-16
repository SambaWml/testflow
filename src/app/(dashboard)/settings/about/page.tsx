"use client";

import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical, BookOpen, BarChart3, Layers, FolderOpen, Wand2,
  TestTube2, Play, Settings, ChevronRight, Zap, ShieldCheck, Bug,
} from "lucide-react";
import { useLang } from "@/contexts/lang-context";

export default function SettingsAboutPage() {
  const { t } = useLang();
  const ab = t.settings.about;

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Sobre" subtitle="Informações sobre o TestFlow e seus módulos." />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl space-y-6">

          {/* Hero */}
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

          {/* What it's for */}
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

          {/* Modules */}
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

          {/* Tips */}
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
      </div>
    </div>
  );
}
