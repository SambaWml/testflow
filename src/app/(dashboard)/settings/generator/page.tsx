"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, ListChecks, SlidersHorizontal } from "lucide-react";
import { useLang } from "@/contexts/lang-context";

// Persisted in localStorage so defaults survive page reloads without a DB round-trip.
const STORAGE_KEY = "testflow_blocked_formats";
const DEFAULTS_KEY = "testflow_generator_defaults";

interface GeneratorDefaults {
  language: string;
  quantity: string;
  coverage: string;
  testType: string;
  priority: string;
}

const DEFAULT_DEFAULTS: GeneratorDefaults = {
  language: "pt-BR",
  quantity: "5",
  coverage: "normal",
  testType: "functional",
  priority: "MEDIUM",
};

function DefaultsCard() {
  const [defaults, setDefaults] = useState<GeneratorDefaults>(DEFAULT_DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      const stored = localStorage.getItem(DEFAULTS_KEY);
      // Merge with DEFAULT_DEFAULTS so new fields added later get their initial value.
      if (stored) setDefaults({ ...DEFAULT_DEFAULTS, ...JSON.parse(stored) });
    } catch { /* corrupt localStorage — fall back to built-in defaults */ }
  }, []);

  function set(key: keyof GeneratorDefaults, value: string) {
    setDefaults((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // Render a skeleton until the component mounts so the SSR pass doesn't read localStorage
  // (which doesn't exist on the server) and cause a hydration mismatch.
  if (!mounted) return <div className="h-64 rounded-lg bg-muted animate-pulse" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Padrões de Geração
        </CardTitle>
        <CardDescription>
          Valores pré-selecionados ao abrir o gerador de casos e bugs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Idioma padrão</Label>
            <Select value={defaults.language} onValueChange={(v) => set("language", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (BR)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quantidade padrão</Label>
            <Select value={defaults.quantity} onValueChange={(v) => set("quantity", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["3", "5", "8", "10", "15", "20"].map((n) => (
                  <SelectItem key={n} value={n}>{n} casos</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cobertura padrão</Label>
            <Select value={defaults.coverage} onValueChange={(v) => set("coverage", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smoke">Smoke — caminho feliz</SelectItem>
                <SelectItem value="normal">Normal — fluxos principais</SelectItem>
                <SelectItem value="edge">Edge — casos extremos</SelectItem>
                <SelectItem value="regression">Regressão — cobertura total</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de teste padrão</Label>
            <Select value={defaults.testType} onValueChange={(v) => set("testType", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="functional">Funcional</SelectItem>
                <SelectItem value="non-functional">Não funcional</SelectItem>
                <SelectItem value="regression">Regressão</SelectItem>
                <SelectItem value="exploratory">Exploratório</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade padrão</Label>
            <Select value={defaults.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CRITICAL">Crítica</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Média</SelectItem>
                <SelectItem value="LOW">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">Salvo localmente no navegador.</p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Salvo
              </span>
            )}
            <Button size="sm" className="h-7 text-xs" onClick={save}>Salvar</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        subtitle="Configure os padrões e formatos disponíveis na geração com IA."
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl space-y-4">
          <DefaultsCard />
          <FormatsCard />
        </div>
      </div>
    </div>
  );
}
