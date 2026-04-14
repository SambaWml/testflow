"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { HintIcon } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Settings, Database, Tag, Loader2,
  Wand2, Plus, Pencil, Trash2, Check, X, RotateCcw,
  FlaskConical, FolderOpen, TestTube2, Play, BarChart3, BookOpen,
  ArrowRight, Layers, Cpu, Globe, ShieldCheck, Zap, ClipboardList, FileText,
  ChevronRight, Building2, LayoutDashboard, CheckCircle2,
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
   Color Picker
══════════════════════════════════════════════════════ */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_PRESETS.map((c) => (
        <button key={c} type="button"
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? "border-foreground scale-110" : "border-transparent"}`}
          style={{ backgroundColor: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Terms CRUD
══════════════════════════════════════════════════════ */
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

  function startEdit(key: keyof Terms) { setEditKey(key); setEditSingular(terms[key].singular); setEditPlural(terms[key].plural); }

  function confirmEdit() {
    if (!editKey || !editSingular.trim() || !editPlural.trim()) return;
    const next = { ...terms, [editKey]: { singular: editSingular.trim(), plural: editPlural.trim() } };
    setTerms(next); saveTerms(next); setEditKey(null); window.location.reload();
  }

  function reset() { resetTerms(); window.location.reload(); }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">{t.settings.terms_title} <HintIcon text={t.settings.terms_hint} /></CardTitle>
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
                      <Input className="h-7 text-sm" value={editSingular} onChange={(e) => setEditSingular(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditKey(null); }} autoFocus />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">{t.settings.plural}</p>
                      <Input className="h-7 text-sm" value={editPlural} onChange={(e) => setEditPlural(e.target.value)}
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
                  <button onClick={() => startEdit(key)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   Item Types CRUD
══════════════════════════════════════════════════════ */
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
    save(items.map((it, idx) => idx === i ? { ...it, label: editLabel.trim() } : it));
    setEditIdx(null);
  }
  function remove(i: number) { if (items.length <= 1) return; save(items.filter((_, idx) => idx !== i)); }
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
                  onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(i); if (e.key === "Escape") setEditIdx(null); }} autoFocus />
                <button onClick={() => confirmEdit(i)} className="text-green-600 hover:text-green-700"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditIdx(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <span className="text-sm flex-1">{it.label}</span>
                <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} disabled={items.length <= 1} className="text-muted-foreground hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        ))}
        <Separator className="my-3" />
        <div className="flex gap-2">
          <Input className="h-8 text-sm w-32" placeholder={t.settings.key_field} value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <Input className="h-8 text-sm flex-1" placeholder={t.settings.label_field} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <Button size="sm" className="h-8" onClick={add} disabled={!newValue.trim() || !newLabel.trim()}>
            <Plus className="h-4 w-4" /> {t.settings.add_item_type}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.settings.key_hint}</p>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   Priorities CRUD
══════════════════════════════════════════════════════ */
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
  function remove(i: number) { if (items.length <= 1) return; save(items.filter((_, idx) => idx !== i)); }
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
                  <button onClick={() => setEditIdx(null)} className="text-muted-foreground flex items-center gap-1 text-xs"><X className="h-3.5 w-3.5" /> {t.common.cancel}</button>
                </div>
              </div>
            ) : (
              <>
                <span className="text-sm flex-1">{it.label}</span>
                <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} disabled={items.length <= 1} className="text-muted-foreground hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
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

/* ══════════════════════════════════════════════════════
   Statuses CRUD
══════════════════════════════════════════════════════ */
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
  function remove(i: number) { if (items.length <= 1) return; save(items.filter((_, idx) => idx !== i)); }
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
                  <button onClick={() => confirmEdit(i)} className="text-green-600 flex items-center gap-1 text-xs"><Check className="h-3.5 w-3.5" /> Salvar</button>
                  <button onClick={() => setEditIdx(null)} className="text-muted-foreground flex items-center gap-1 text-xs"><X className="h-3.5 w-3.5" /> Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <span className="text-sm flex-1">{it.label}</span>
                <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => remove(i)} disabled={items.length <= 1} className="text-muted-foreground hover:text-red-600 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shrink-0"><FlaskConical className="h-7 w-7" /></div>
            <div><h1 className="text-2xl font-bold tracking-tight">TestFlow</h1><p className="text-muted-foreground text-sm">{ab.system_subtitle}</p></div>
            <Badge className="ml-auto shrink-0" variant="secondary">v1.0.0</Badge>
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{ab.hero_desc}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> {ab.what_for_title}</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
          <p>{ab.what_for_body}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {([Zap, ShieldCheck, BarChart3] as const).map((Icon, i) => (
              <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary shrink-0" /><span className="font-semibold text-foreground text-xs">{ab.features[i].title}</span></div>
                <p className="text-xs leading-relaxed">{ab.features[i].desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4 text-primary" /> {ab.modules_title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { icon: FolderOpen, color: "text-blue-600 bg-blue-50" }, { icon: Wand2, color: "text-amber-600 bg-amber-50" },
              { icon: TestTube2, color: "text-green-600 bg-green-50" }, { icon: Play, color: "text-orange-600 bg-orange-50" },
              { icon: BarChart3, color: "text-rose-600 bg-rose-50" }, { icon: Settings, color: "text-slate-600 bg-slate-50" },
            ] as const).map(({ icon: Icon, color }, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg border">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${color}`}><Icon className="h-4 w-4" /></div>
                <div className="min-w-0"><p className="font-semibold text-sm">{ab.modules[i].label}</p><p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{ab.modules[i].desc}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4 text-primary" /> {ab.tech_title}</CardTitle><CardDescription>{ab.tech_subtitle}</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {ab.tech.map(({ name, role, badge, color }) => (
              <div key={name} className="flex items-center gap-2.5 p-2.5 rounded-lg border">
                <div className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${color}`}>{badge}</div>
                <div className="min-w-0"><p className="text-xs font-semibold truncate">{name}</p><p className="text-xs text-muted-foreground truncate">{role}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-amber-900"><Zap className="h-4 w-4" /> {ab.tips_title}</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {ab.tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-amber-900 leading-relaxed">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />{tip}
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
   Toggle component (no Switch dep needed)
══════════════════════════════════════════════════════ */
function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   Dashboard Features Card (Owner only)
══════════════════════════════════════════════════════ */
function DashboardFeaturesCard() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const isOwner = (session?.user as { orgRole?: string })?.orgRole === "OWNER";

  const { data, isLoading } = useQuery<{
    overviewEnabled: boolean;
    qaDashboardEnabled: boolean;
    qaDashboardName: string;
  }>({
    queryKey: ["org-features"],
    queryFn: () => fetch("/api/orgs/features").then((r) => r.json()),
  });

  const [qaName, setQaName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.qaDashboardName) setQaName(data.qaDashboardName);
  }, [data]);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/orgs/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-features"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (!isOwner) return null;

  const overviewEnabled = data?.overviewEnabled ?? true;
  const qaDashboardEnabled = data?.qaDashboardEnabled ?? true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          Dashboards
        </CardTitle>
        <CardDescription>Controle quais dashboards ficam visíveis para a organização.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Visão Geral toggle */}
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="min-w-0">
                <p className="text-sm font-medium">Visão Geral</p>
                <p className="text-xs text-muted-foreground">Dashboard principal com métricas de projetos e testes</p>
              </div>
              <Toggle
                enabled={overviewEnabled}
                onToggle={() => patch.mutate({ overviewEnabled: !overviewEnabled })}
                disabled={patch.isPending}
              />
            </div>

            <div className="border-t border-border/40" />

            {/* QA Dashboard toggle + name */}
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Dashboard QA</p>
                <p className="text-xs text-muted-foreground mb-3">Atividades dos membros, bugs e execuções (Owner e Admin)</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={qaName}
                    onChange={(e) => setQaName(e.target.value)}
                    placeholder="Dashboard QA"
                    className="h-8 text-sm max-w-[200px]"
                    disabled={!qaDashboardEnabled || patch.isPending}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    disabled={!qaDashboardEnabled || patch.isPending || !qaName.trim()}
                    onClick={() => patch.mutate({ qaDashboardName: qaName })}
                  >
                    <Check className="h-3.5 w-3.5" /> Salvar nome
                  </Button>
                </div>
              </div>
              <Toggle
                enabled={qaDashboardEnabled}
                onToggle={() => patch.mutate({ qaDashboardEnabled: !qaDashboardEnabled })}
                disabled={patch.isPending}
              />
            </div>

            {saved && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Configurações salvas
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
            <TabsTrigger value="general"><Settings className="h-4 w-4 mr-1.5" />{t.settings.tab_general}</TabsTrigger>
            <TabsTrigger value="types"><Tag className="h-4 w-4 mr-1.5" />{t.settings.tab_types}</TabsTrigger>
            <TabsTrigger value="about"><Database className="h-4 w-4 mr-1.5" />{t.settings.tab_about}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="space-y-4 max-w-xl">
              <OrgInfoCard />
              <DashboardFeaturesCard />
              <Card>
                <CardHeader>
                  <CardTitle>{t.settings.section_system}</CardTitle>
                  <CardDescription>{t.settings.section_system_desc}</CardDescription>
                </CardHeader>
                <CardContent><LangSwitcherRow /></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="types">
            <div className="grid gap-4 max-w-2xl">
              <TermsCrud /><ItemTypesCrud /><PrioritiesCrud /><StatusesCrud />
            </div>
          </TabsContent>

          <TabsContent value="about"><AboutTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
