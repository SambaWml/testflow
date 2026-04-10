"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { HintIcon, Tip } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Settings, Database, Tag, Loader2, CheckCircle2, Bot, Wifi, WifiOff, RefreshCw, AlertCircle,
  Wand2, Lock, Unlock, Plus, Pencil, Trash2, Check, X, RotateCcw,
  FlaskConical, FolderOpen, TestTube2, Play, BarChart3, BookOpen,
  ArrowRight, Layers, Cpu, Globe, ShieldCheck, Zap, ClipboardList, FileText,
  ChevronRight,
} from "lucide-react";
import {
  getItemTypes, getPriorities, getExecStatuses,
  saveItemTypes, savePriorities, saveExecStatuses,
  resetItemTypes, resetPriorities, resetExecStatuses,
  DEFAULT_ITEM_TYPES, DEFAULT_PRIORITIES, DEFAULT_EXEC_STATUSES,
  COLOR_PRESETS,
  type ItemType, type Priority, type ExecStatus,
} from "@/lib/enum-config";
import {
  getTerms, saveTerms, resetTerms, DEFAULT_TERMS,
  type Terms, type TermEntry,
} from "@/lib/term-config";
import { useLang } from "@/contexts/lang-context";

export default function SettingsPage() {
  const { t } = useLang();
  return (
    <div className="flex flex-col h-full">
      <Topbar title={t.settings.title} subtitle={t.settings.subtitle} />

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="general">
          <TabsList className="mb-6">
            <TabsTrigger value="general"><Settings className="h-4 w-4 mr-1.5" />{t.settings.tab_general}</TabsTrigger>
            <TabsTrigger value="generator"><Wand2 className="h-4 w-4 mr-1.5" />{t.settings.tab_generator}</TabsTrigger>
            <TabsTrigger value="types"><Tag className="h-4 w-4 mr-1.5" />{t.settings.tab_types}</TabsTrigger>
            <TabsTrigger value="about"><Database className="h-4 w-4 mr-1.5" />{t.settings.tab_about}</TabsTrigger>
          </TabsList>

          {/* General tab */}
          <TabsContent value="general">
            <div className="space-y-4 max-w-xl">
              <Card>
                <CardHeader>
                  <CardTitle>{t.settings.section_system}</CardTitle>
                  <CardDescription>{t.settings.section_system_desc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SettingRow label={t.settings.system_name} defaultValue="TestFlow" settingKey="systemName" />
                  <LangSwitcherRow />
                  <SettingRow label={t.settings.default_format} defaultValue="BDD" settingKey="defaultCaseFormat" />
                </CardContent>
              </Card>

              <AIProviderCard />
            </div>
          </TabsContent>

          {/* Generator tab */}
          <TabsContent value="generator">
            <div className="max-w-xl">
              <GeneratorSettingsCard />
            </div>
          </TabsContent>

          {/* Types tab */}
          <TabsContent value="types">
            <div className="grid gap-4 max-w-2xl">
              <TermsCrud />
              <ItemTypesCrud />
              <PrioritiesCrud />
              <StatusesCrud />
            </div>
          </TabsContent>

          {/* About tab */}
          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SettingRow({ label, defaultValue, settingKey: _ }: { label: string; defaultValue: string; settingKey: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-1.5">
        <Label>{label}</Label>
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    </div>
  );
}

function LangSwitcherRow() {
  const { lang, switchLang, t } = useLang();
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        {t.settings.default_lang}
      </Label>
      <div className="flex rounded-lg border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => lang !== "pt-BR" && switchLang("pt-BR")}
          className={`px-4 py-1.5 transition-colors ${
            lang === "pt-BR"
              ? "bg-primary text-primary-foreground font-semibold"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          PT-BR
        </button>
        <button
          type="button"
          onClick={() => lang !== "en-US" && switchLang("en-US")}
          className={`px-4 py-1.5 transition-colors border-l ${
            lang === "en-US"
              ? "bg-primary text-primary-foreground font-semibold"
              : "bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          EN-US
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CRUD components for Tipos e Status
═══════════════════════════════════════════════════════════════════ */

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? "border-foreground scale-110" : "border-transparent"}`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

/* ── Terms ──────────────────────────────────────────────────────── */

const TERM_KEY_IDS: Array<keyof Terms> = [
  "projeto", "item", "casoDeTeste", "planoDeTeste", "execucao",
  "relatorio", "ambiente", "build", "evidencia", "bugRelacionado", "preCondicao",
];

function TermsCrud() {
  const { t } = useLang();
  const termLabels = t.settings.term_labels;
  const termHints = t.settings.term_hints;
  const [terms, setTerms] = useState<Terms>(() => DEFAULT_TERMS);
  const [editKey, setEditKey] = useState<keyof Terms | null>(null);
  const [editSingular, setEditSingular] = useState("");
  const [editPlural, setEditPlural] = useState("");

  useEffect(() => { setTerms(getTerms()); }, []);

  function startEdit(key: keyof Terms) {
    setEditKey(key);
    setEditSingular(terms[key].singular);
    setEditPlural(terms[key].plural);
  }

  function confirmEdit() {
    if (!editKey || !editSingular.trim() || !editPlural.trim()) return;
    const next = { ...terms, [editKey]: { singular: editSingular.trim(), plural: editPlural.trim() } };
    setTerms(next);
    saveTerms(next);
    setEditKey(null);
  }

  function reset() { resetTerms(); setTerms(getTerms()); }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">
              {t.settings.terms_title}{" "}
              <HintIcon text={t.settings.terms_hint} />
            </CardTitle>
            <CardDescription className="text-xs">{t.settings.terms_desc}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-3 w-3 mr-1" /> {t.common.restore_default}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {TERM_KEY_IDS.map((key) => {
          const entry: TermEntry = terms[key];
          const isEditing = editKey === key;
          const label = termLabels[key as keyof typeof termLabels] ?? key;
          const hint = termHints[key as keyof typeof termHints] ?? "";
          return (
            <div key={key} className="flex items-start gap-2 p-2 rounded-md border bg-background">
              <div className="w-32 shrink-0">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                {hint && <HintIcon text={hint} className="ml-1" />}
              </div>
              {isEditing ? (
                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">{t.settings.singular}</p>
                      <Input className="h-7 text-sm" value={editSingular}
                        onChange={(e) => setEditSingular(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditKey(null); }}
                        autoFocus />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">{t.settings.plural}</p>
                      <Input className="h-7 text-sm" value={editPlural}
                        onChange={(e) => setEditPlural(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditKey(null); }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={confirmEdit} className="text-green-600 hover:text-green-700 flex items-center gap-1 text-xs"><Check className="h-3.5 w-3.5" /> {t.common.save}</button>
                    <button onClick={() => setEditKey(null)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"><X className="h-3.5 w-3.5" /> {t.common.cancel}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 flex gap-3 text-sm">
                    <span className="text-foreground">{entry.singular}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-muted-foreground">{entry.plural}</span>
                  </div>
                  <button onClick={() => startEdit(key)} className="text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ── Item Types ─────────────────────────────────────────────────── */
function ItemTypesCrud() {
  const { t } = useLang();
  const [items, setItems] = useState<ItemType[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => { setItems(getItemTypes()); }, []);

  function save(next: ItemType[]) { setItems(next); saveItemTypes(next); }

  function startEdit(i: number) { setEditIdx(i); setEditLabel(items[i].label); }

  function confirmEdit(i: number) {
    if (!editLabel.trim()) return;
    const next = items.map((it, idx) => idx === i ? { ...it, label: editLabel.trim() } : it);
    save(next);
    setEditIdx(null);
  }

  function remove(i: number) {
    if (items.length <= 1) return;
    save(items.filter((_, idx) => idx !== i));
  }

  function add() {
    const v = newValue.trim().toUpperCase().replace(/\s+/g, "_");
    const l = newLabel.trim();
    if (!v || !l || items.some((it) => it.value === v)) return;
    save([...items, { value: v, label: l }]);
    setNewValue(""); setNewLabel("");
  }

  function reset() { resetItemTypes(); setItems(getItemTypes()); }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{t.settings.item_types_title} <HintIcon text={t.settings.item_types_hint} /></CardTitle>
            <CardDescription className="text-xs">{t.settings.item_types_desc}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-3 w-3 mr-1" /> {t.common.restore_default}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={it.value} className="flex items-center gap-2 p-2 rounded-md border bg-background">
            <Badge variant="outline" className="font-mono text-xs shrink-0">{it.value}</Badge>
            {editIdx === i ? (
              <>
                <Input className="h-7 text-sm flex-1" value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(i); if (e.key === "Escape") setEditIdx(null); }}
                  autoFocus />
                <button onClick={() => confirmEdit(i)} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditIdx(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <span className="text-sm flex-1">{it.label}</span>
                <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} disabled={items.length <= 1}
                  className="text-muted-foreground hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        ))}
        <Separator className="my-3" />
        <div className="flex gap-2">
          <Input className="h-8 text-sm w-32" placeholder={t.settings.key_field} value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <Input className="h-8 text-sm flex-1" placeholder={t.settings.label_field} value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <Button size="sm" className="h-8" onClick={add} disabled={!newValue.trim() || !newLabel.trim()}>
            <Plus className="h-4 w-4" /> {t.settings.add_item_type}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.settings.key_hint}</p>
      </CardContent>
    </Card>
  );
}

/* ── Priorities ─────────────────────────────────────────────────── */
function PrioritiesCrud() {
  const { t } = useLang();
  const [items, setItems] = useState<Priority[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);

  useEffect(() => { setItems(getPriorities()); }, []);

  function save(next: Priority[]) { setItems(next); savePriorities(next); }

  function startEdit(i: number) { setEditIdx(i); setEditLabel(items[i].label); setEditColor(items[i].color); }

  function confirmEdit(i: number) {
    if (!editLabel.trim()) return;
    save(items.map((it, idx) => idx === i ? { ...it, label: editLabel.trim(), color: editColor } : it));
    setEditIdx(null);
  }

  function remove(i: number) {
    if (items.length <= 1) return;
    save(items.filter((_, idx) => idx !== i));
  }

  function add() {
    const v = newValue.trim().toUpperCase().replace(/\s+/g, "_");
    const l = newLabel.trim();
    if (!v || !l || items.some((it) => it.value === v)) return;
    save([...items, { value: v, label: l, color: newColor }]);
    setNewValue(""); setNewLabel(""); setNewColor(COLOR_PRESETS[0]);
  }

  function reset() { resetPriorities(); setItems(getPriorities()); }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{t.settings.priorities_title} <HintIcon text={t.settings.priorities_hint} /></CardTitle>
            <CardDescription className="text-xs">{t.settings.priorities_desc}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-3 w-3 mr-1" /> {t.common.restore_default}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={it.value} className="flex items-start gap-2 p-2 rounded-md border bg-background">
            <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: it.color }} />
            <Badge variant="outline" className="font-mono text-xs shrink-0">{it.value}</Badge>
            {editIdx === i ? (
              <div className="flex-1 space-y-2">
                <Input className="h-7 text-sm" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <div className="flex gap-2">
                  <button onClick={() => confirmEdit(i)} className="text-green-600 hover:text-green-700 flex items-center gap-1 text-xs"><Check className="h-3.5 w-3.5" /> {t.common.save}</button>
                  <button onClick={() => setEditIdx(null)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"><X className="h-3.5 w-3.5" /> {t.common.cancel}</button>
                </div>
              </div>
            ) : (
              <>
                <span className="text-sm flex-1">{it.label}</span>
                <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} disabled={items.length <= 1}
                  className="text-muted-foreground hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        ))}
        <Separator className="my-3" />
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input className="h-8 text-sm w-32" placeholder={t.settings.key_field} value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            <Input className="h-8 text-sm flex-1" placeholder={t.settings.label_field} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Button size="sm" className="h-8" onClick={add} disabled={!newValue.trim() || !newLabel.trim()}>
            <Plus className="h-4 w-4 mr-1" /> {t.settings.add_priority}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Execution Statuses ─────────────────────────────────────────── */
function StatusesCrud() {
  const { t } = useLang();
  const [items, setItems] = useState<ExecStatus[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);

  useEffect(() => { setItems(getExecStatuses()); }, []);

  function save(next: ExecStatus[]) { setItems(next); saveExecStatuses(next); }

  function startEdit(i: number) { setEditIdx(i); setEditLabel(items[i].label); setEditColor(items[i].color); }

  function confirmEdit(i: number) {
    if (!editLabel.trim()) return;
    save(items.map((it, idx) => idx === i ? { ...it, label: editLabel.trim(), color: editColor } : it));
    setEditIdx(null);
  }

  function remove(i: number) {
    if (items.length <= 1) return;
    save(items.filter((_, idx) => idx !== i));
  }

  function add() {
    const v = newValue.trim().toUpperCase().replace(/\s+/g, "_");
    const l = newLabel.trim();
    if (!v || !l || items.some((it) => it.value === v)) return;
    save([...items, { value: v, label: l, color: newColor }]);
    setNewValue(""); setNewLabel(""); setNewColor(COLOR_PRESETS[0]);
  }

  function reset() { resetExecStatuses(); setItems(getExecStatuses()); }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{t.settings.statuses_title} <HintIcon text={t.settings.statuses_hint} /></CardTitle>
            <CardDescription className="text-xs">{t.settings.statuses_desc}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-3 w-3 mr-1" /> {t.common.restore_default}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={it.value} className="flex items-start gap-2 p-2 rounded-md border bg-background">
            <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: it.color }} />
            <Badge variant="outline" className="font-mono text-xs shrink-0">{it.value}</Badge>
            {editIdx === i ? (
              <div className="flex-1 space-y-2">
                <Input className="h-7 text-sm" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <div className="flex gap-2">
                  <button onClick={() => confirmEdit(i)} className="text-green-600 hover:text-green-700 flex items-center gap-1 text-xs"><Check className="h-3.5 w-3.5" /> Salvar</button>
                  <button onClick={() => setEditIdx(null)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"><X className="h-3.5 w-3.5" /> Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <span className="text-sm flex-1">{it.label}</span>
                <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} disabled={items.length <= 1}
                  className="text-muted-foreground hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        ))}
        <Separator className="my-3" />
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input className="h-8 text-sm w-32" placeholder={t.settings.key_field} value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            <Input className="h-8 text-sm flex-1" placeholder={t.settings.label_field} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <Button size="sm" className="h-8" onClick={add} disabled={!newValue.trim() || !newLabel.trim()}>
            <Plus className="h-4 w-4 mr-1" /> {t.settings.add_status}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface AIStatus {
  provider: "ollama" | "openai" | "manus" | "mock";
  status: "online" | "offline" | "configured" | "mock";
  url?: string;
  model?: string;
  modelAvailable?: boolean;
  availableModels?: string[];
  error?: string;
}

function AIProviderCard() {
  const { t } = useLang();
  const { data, isLoading, refetch, isRefetching } = useQuery<AIStatus>({
    queryKey: ["ai-status"],
    queryFn: () => fetch("/api/ai-status").then((r) => r.json()),
    refetchInterval: false,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              {t.settings.ai_provider}
            </CardTitle>
            <CardDescription>{t.settings.ai_provider_desc}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.settings.checking_provider}
          </div>
        ) : !data ? null : (
          <>
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${
              data.status === "online" ? "bg-green-50 border-green-200" :
              data.status === "offline" ? "bg-red-50 border-red-200" :
              data.status === "configured" ? "bg-blue-50 border-blue-200" :
              "bg-gray-50 border-gray-200"
            }`}>
              {data.status === "online" && <Wifi className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />}
              {data.status === "offline" && <WifiOff className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
              {data.status === "configured" && <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />}
              {data.status === "mock" && <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">
                  {data.provider === "ollama" && `Ollama — ${data.status === "online" ? t.settings.ollama_online.split(" — ")[1] : t.settings.ollama_offline.split(" — ")[1]}`}
                  {data.provider === "openai" && t.settings.openai_configured}
                  {data.provider === "manus" && t.settings.manus_configured}
                  {data.provider === "mock" && t.settings.mock_no_provider}
                </p>
                {data.url && <p className="text-xs text-muted-foreground mt-0.5">{data.url}</p>}
                {data.error && <p className="text-xs text-red-600 mt-1">{data.error}</p>}
                {data.status === "mock" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.settings.configure_mock}
                  </p>
                )}
              </div>
            </div>

            {data.model && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.settings.active_model}</span>
                <span className="font-mono font-medium flex items-center gap-2">
                  {data.model}
                  {data.modelAvailable === false && (
                    <Badge variant="destructive" className="text-xs">{t.common.not_installed}</Badge>
                  )}
                  {data.modelAvailable === true && (
                    <Badge variant="success" className="text-xs">{t.common.available}</Badge>
                  )}
                </span>
              </div>
            )}

            {data.availableModels && data.availableModels.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t.settings.installed_models}</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.availableModels.map((m) => (
                    <span key={m} className="text-xs font-mono bg-slate-100 border px-2 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md bg-slate-50 border p-3 text-xs space-y-2">
              <p className="font-semibold text-slate-700">Como configurar (.env.local)</p>
              <div className="space-y-1">
                <p className="font-medium">Ollama (local, gratuito):</p>
                <code className="block bg-slate-800 text-green-400 p-2 rounded text-xs">
                  OLLAMA_URL=&quot;http://localhost:11434&quot;<br/>
                  OLLAMA_MODEL=&quot;llama3.2&quot;
                </code>
              </div>
              <div className="space-y-1">
                <p className="font-medium">OpenAI (nuvem):</p>
                <code className="block bg-slate-800 text-green-400 p-2 rounded text-xs">
                  OPENAI_API_KEY=&quot;sk-...&quot;<br/>
                  OPENAI_MODEL=&quot;gpt-4o&quot;
                </code>
              </div>
              <p className="text-muted-foreground">
                Reinicie o servidor após alterar.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const STORAGE_KEY = "testflow_blocked_formats";

function readBlocked(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

function GeneratorSettingsCard() {
  const { t } = useLang();
  const [blocked, setBlocked] = useState<string[]>(readBlocked);

  function toggle(fmt: string) {
    setBlocked((prev) => {
      const next = prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const bothBlocked = blocked.includes("BDD") && blocked.includes("STEP_BY_STEP");

  const formats = [
    { value: "BDD", label: "BDD", desc: t.settings.format_bdd_desc },
    { value: "STEP_BY_STEP", label: "Step by Step", desc: t.settings.format_step_desc },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-4 w-4" />
          {t.settings.formats_title}
        </CardTitle>
        <CardDescription>
          {t.settings.formats_desc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {formats.map(({ value, label, desc }) => {
          const isBlocked = blocked.includes(value);
          const wouldBlockAll = !isBlocked && blocked.filter((f) => f !== value).length === formats.length - 1;
          return (
            <div
              key={value}
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                isBlocked ? "bg-red-50 border-red-200" : "bg-background border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-md ${isBlocked ? "bg-red-100" : "bg-primary/10"}`}>
                  {isBlocked
                    ? <Lock className="h-4 w-4 text-red-600" />
                    : <Unlock className="h-4 w-4 text-primary" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isBlocked ? "text-red-700" : ""}`}>{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={wouldBlockAll}
                onClick={() => toggle(value)}
                title={wouldBlockAll ? t.settings.cannot_block_all : isBlocked ? t.settings.unlock : t.settings.block}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed ${
                  isBlocked ? "bg-red-500" : "bg-input"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    isBlocked ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          );
        })}

        {bothBlocked && (
          <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t.settings.formats_blocked_warning}</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-1">
          {t.settings.formats_saved_locally}
        </p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   About / Documentation tab
═══════════════════════════════════════════════════════════════════ */
function AboutTab() {
  const { t } = useLang();
  const ab = t.settings.about;

  return (
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
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            {ab.hero_desc}
          </p>
        </CardContent>
      </Card>

      {/* Para que serve */}
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

      {/* Fluxo de trabalho */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRight className="h-4 w-4 text-primary" /> {ab.workflow_title}
          </CardTitle>
          <CardDescription>{ab.workflow_subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {([
              { icon: FolderOpen, color: "bg-blue-100 text-blue-700" },
              { icon: FileText, color: "bg-purple-100 text-purple-700" },
              { icon: Wand2, color: "bg-amber-100 text-amber-700" },
              { icon: TestTube2, color: "bg-green-100 text-green-700" },
              { icon: ClipboardList, color: "bg-orange-100 text-orange-700" },
              { icon: BarChart3, color: "bg-rose-100 text-rose-700" },
            ] as const).map(({ icon: Icon, color }, i, arr) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${color}`}>{i + 1}</div>
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-border mt-1 mb-1 min-h-[12px]" />}
                </div>
                <div className="pb-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm">{ab.workflow[i].title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ab.workflow[i].desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Módulos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" /> {ab.modules_title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { icon: FolderOpen, color: "text-blue-600 bg-blue-50" },
              { icon: Wand2, color: "text-amber-600 bg-amber-50" },
              { icon: TestTube2, color: "text-green-600 bg-green-50" },
              { icon: Play, color: "text-orange-600 bg-orange-50" },
              { icon: BarChart3, color: "text-rose-600 bg-rose-50" },
              { icon: Settings, color: "text-slate-600 bg-slate-50" },
            ] as const).map(({ icon: Icon, color }, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg border">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{ab.modules[i].label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{ab.modules[i].desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Glossário */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> {ab.glossary_title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {ab.glossary.map(({ term, def }) => (
              <div key={term} className="py-2.5 flex gap-3">
                <Badge variant="outline" className="font-mono text-xs shrink-0 h-fit mt-0.5">{term}</Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">{def}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tecnologias */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4 text-primary" /> {ab.tech_title}
          </CardTitle>
          <CardDescription>{ab.tech_subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ab.tech.map(({ name, role, badge, color }) => (
              <div key={name} className="flex items-center gap-2.5 p-2.5 rounded-lg border">
                <div className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${color}`}>{badge}</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dicas rápidas */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-amber-900">
            <Zap className="h-4 w-4" /> {ab.tips_title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {ab.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-amber-900 leading-relaxed">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground pb-4">
        {ab.footer}
      </p>
    </div>
  );
}
