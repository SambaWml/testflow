"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ListChecks, Wand2 } from "lucide-react";
import { useLang } from "@/contexts/lang-context";

const STORAGE_KEY = "testflow_blocked_formats";

const ALL_FORMATS = [
  { value: "BDD", label: "BDD" },
  { value: "STEP_BY_STEP", label: "Step by Step" },
];

/* ══════════════════════════════════════════════════════
   Formats Card
══════════════════════════════════════════════════════ */
function FormatsCard() {
  const { t } = useLang();
  const s = t.settings;

  const [blocked, setBlocked] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setBlocked(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
    } catch {
      setBlocked([]);
    }
  }, []);

  function toggle(value: string) {
    setBlocked((prev) => {
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];

      // prevent blocking all
      if (next.length === ALL_FORMATS.length) {
        alert(s.cannot_block_all);
        return prev;
      }
      return next;
    });
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocked));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const allBlocked = blocked.length === ALL_FORMATS.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" />
          {s.formats_title}
        </CardTitle>
        <CardDescription>{s.formats_desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mounted ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {ALL_FORMATS.map((fmt) => {
                const isBlocked = blocked.includes(fmt.value);
                const desc = fmt.value === "BDD" ? s.format_bdd_desc : s.format_step_desc;
                return (
                  <div
                    key={fmt.value}
                    className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors ${
                      isBlocked ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${isBlocked ? "line-through text-muted-foreground" : ""}`}>
                        {fmt.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={isBlocked ? "outline" : "destructive"}
                      className="h-7 text-xs shrink-0"
                      onClick={() => toggle(fmt.value)}
                    >
                      {isBlocked ? s.unlock : s.block}
                    </Button>
                  </div>
                );
              })}
            </div>

            {allBlocked && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {s.formats_blocked_warning}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">{s.formats_saved_locally}</p>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Salvo
                  </span>
                )}
                <Button size="sm" className="h-7 text-xs" onClick={save}>
                  Salvar
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════ */
export default function SettingsGeneratorPage() {
  const { t } = useLang();
  return (
    <div className="flex flex-col h-full">
      <Topbar
        title={t.settings.tab_generator}
        subtitle="Configure os formatos disponíveis na geração de casos com IA."
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl">
          <FormatsCard />
        </div>
      </div>
    </div>
  );
}
