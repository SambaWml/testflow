"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/layout/topbar";
import { HintIcon } from "@/components/ui/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Pencil, Trash2, Check, X, RotateCcw,
} from "lucide-react";
import {
  getItemTypes, getPriorities, getExecStatuses,
  saveItemTypes, savePriorities, saveExecStatuses,
  resetItemTypes, resetPriorities, resetExecStatuses,
  COLOR_PRESETS,
  type ItemType, type Priority, type ExecStatus,
} from "@/lib/enum-config";
import { type Terms, type TermEntry } from "@/lib/term-config";
import { useTerms } from "@/contexts/terms-context";
import { useLang } from "@/contexts/lang-context";

const TERM_GROUPS: Array<{ label: string; keys: Array<keyof Terms> }> = [
  {
    label: "Módulos principais",
    keys: ["projeto", "bug", "relatorio", "execucao", "casoDeTeste", "planoDeTeste"],
  },
  {
    label: "Entidades internas",
    keys: ["item", "membro"],
  },
  {
    label: "Campos de execução e relatório",
    keys: ["ambiente", "build", "evidencia", "bugRelacionado", "preCondicao"],
  },
  {
    label: "Abas do Dashboard QA",
    keys: ["qaOverview", "porQA", "porProjeto", "porBug"],
  },
];

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
function TermsCrud() {
  const { t } = useLang();
  const termLabels = t.settings.term_labels;
  const termHints = t.settings.term_hints;
  const { terms, saveTerms, resetTerms } = useTerms();
  const [editKey, setEditKey] = useState<keyof Terms | null>(null);
  const [editSingular, setEditSingular] = useState("");
  const [editPlural, setEditPlural] = useState("");

  function startEdit(key: keyof Terms) { setEditKey(key); setEditSingular(terms[key].singular); setEditPlural(terms[key].plural); }

  function confirmEdit() {
    if (!editKey || !editSingular.trim() || !editPlural.trim()) return;
    const next = { ...terms, [editKey]: { singular: editSingular.trim(), plural: editPlural.trim() } };
    saveTerms(next); setEditKey(null);
  }

  function reset() { resetTerms(); }

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
      <CardContent className="space-y-4">
        {TERM_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">{group.label}</p>
            <div className="space-y-1.5">
              {group.keys.map((key) => {
                const entry: TermEntry = terms[key];
                const isEditing = editKey === key;
                const label = (termLabels as Record<string, string>)[key as string] ?? key;
                const hint = (termHints as Record<string, string>)[key as string] ?? "";
                return (
                  <div key={key} className="flex items-start gap-2 p-2 rounded-md border bg-background">
                    <div className="w-36 shrink-0">
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
            </div>
          </div>
        ))}
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
   Main Page
══════════════════════════════════════════════════════ */
export default function SettingsTermsPage() {
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Termos" subtitle="Personalize os rótulos usados em toda a plataforma." />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4 max-w-2xl">
          <TermsCrud />
          <ItemTypesCrud />
          <PrioritiesCrud />
          <StatusesCrud />
        </div>
      </div>
    </div>
  );
}
