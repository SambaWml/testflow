"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useLang } from "@/contexts/lang-context";
import { getPriorities } from "@/lib/enum-config";

const PRIORITIES = getPriorities();

interface Step {
  description: string;
  expectedData: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}

export function CaseCreateDialog({ open, onOpenChange, defaultProjectId }: Props) {
  const { t } = useLang();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("BDD");
  const [priority, setPriority] = useState("MEDIUM");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [itemId, setItemId] = useState("");
  const [precondition, setPrecondition] = useState("");
  const [notes, setNotes] = useState("");
  const [bddGiven, setBddGiven] = useState("");
  const [bddWhen, setBddWhen] = useState("");
  const [bddThen, setBddThen] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ description: "", expectedData: "" }]);

  const { data: projectsData } = useQuery({
    queryKey: ["projects", "activeOnly"],
    queryFn: () => fetch("/api/projects?activeOnly=true").then((r) => r.json()),
    enabled: open,
  });

  const { data: itemsData } = useQuery({
    queryKey: ["items", projectId],
    queryFn: () => fetch(`/api/items?projectId=${projectId}&limit=200`).then((r) => r.json()),
    enabled: !!projectId && open,
  });

  const projects = (projectsData?.projects ?? []) as { id: string; name: string }[];
  const items = (itemsData?.items ?? []) as { id: string; title: string }[];

  function reset() {
    setTitle(""); setFormat("BDD"); setPriority("MEDIUM");
    setProjectId(defaultProjectId ?? ""); setItemId("");
    setPrecondition(""); setNotes("");
    setBddGiven(""); setBddWhen(""); setBddThen(""); setExpectedResult("");
    setSteps([{ description: "", expectedData: "" }]);
  }

  function addStep() {
    setSteps((prev) => [...prev, { description: "", expectedData: "" }]);
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  const [savedCount, setSavedCount] = useState(0);

  async function submit(keepOpen: boolean) {
    const body: Record<string, unknown> = {
      title, format, priority, projectId,
      itemId: itemId || undefined,
      precondition: precondition || undefined,
      notes: notes || undefined,
    };
    if (format === "BDD") {
      body.bddGiven = bddGiven;
      body.bddWhen = bddWhen;
      body.bddThen = bddThen;
    } else {
      body.expectedResult = expectedResult;
      body.steps = steps.filter((s: Step) => s.description.trim());
    }
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("error");
    return keepOpen;
  }

  const mutation = useMutation({
    mutationFn: (keepOpen: boolean) => submit(keepOpen),
    onSuccess: (keepOpen) => {
      qc.invalidateQueries({ queryKey: ["cases-all"] });
      qc.invalidateQueries({ queryKey: ["project-cases"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (keepOpen) {
        // keep project/format/priority, reset content fields only
        const savedProject = projectId;
        const savedFormat = format;
        const savedPriority = priority;
        reset();
        setProjectId(savedProject);
        setFormat(savedFormat);
        setPriority(savedPriority);
        setSavedCount((n) => n + 1);
      } else {
        reset();
        setSavedCount(0);
        onOpenChange(false);
      }
    },
  });

  function handleClose() {
    reset();
    setSavedCount(0);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.cases.new_case}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>{t.cases.title} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do caso de teste" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Format */}
            <div className="space-y-1.5">
              <Label>{t.generator.format}</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BDD">BDD</SelectItem>
                  <SelectItem value="STEP_BY_STEP">Step by Step</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label>{t.cases.filter_priority}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Project */}
            <div className="space-y-1.5">
              <Label>{t.cases.filter_project} *</Label>
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setItemId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Item (optional) */}
            <div className="space-y-1.5">
              <Label>Item <span className="text-muted-foreground text-xs">({t.common.optional})</span></Label>
              <Select value={itemId} onValueChange={setItemId} disabled={!projectId || items.length === 0}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Precondition */}
          <div className="space-y-1.5">
            <Label>{t.cases.precondition}</Label>
            <Textarea value={precondition} onChange={(e) => setPrecondition(e.target.value)} rows={2} placeholder="Pré-condição para executar este caso..." />
          </div>

          {/* BDD */}
          {format === "BDD" && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">BDD</p>
              <div className="space-y-1.5">
                <Label className="text-blue-700 font-semibold">{t.cases.given}</Label>
                <Textarea value={bddGiven} onChange={(e) => setBddGiven(e.target.value)} rows={2} placeholder="Dado que..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-purple-700 font-semibold">{t.cases.when}</Label>
                <Textarea value={bddWhen} onChange={(e) => setBddWhen(e.target.value)} rows={2} placeholder="Quando..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-green-700 font-semibold">{t.cases.then}</Label>
                <Textarea value={bddThen} onChange={(e) => setBddThen(e.target.value)} rows={2} placeholder="Então..." />
              </div>
            </div>
          )}

          {/* Step by Step */}
          {format === "STEP_BY_STEP" && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.cases.steps}</p>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addStep}>
                  <Plus className="h-3.5 w-3.5" /> Passo
                </Button>
              </div>
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs shrink-0 mt-2">{idx + 1}</span>
                  <div className="flex-1 space-y-1">
                    <Input
                      value={step.description}
                      onChange={(e) => updateStep(idx, "description", e.target.value)}
                      placeholder={`Passo ${idx + 1}...`}
                    />
                    <Input
                      value={step.expectedData}
                      onChange={(e) => updateStep(idx, "expectedData", e.target.value)}
                      placeholder="Resultado esperado (opcional)"
                      className="text-xs"
                    />
                  </div>
                  {steps.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 mt-1" onClick={() => removeStep(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-green-700 font-semibold">{t.cases.expected_result}</Label>
                <Textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={2} placeholder="Resultado esperado geral..." />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observações adicionais..." />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {savedCount > 0 && (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mr-auto">
              {savedCount} {savedCount === 1 ? t.cases.title?.toLowerCase() ?? "caso" : (t.cases.new_case?.toLowerCase() ?? "casos")} {t.common.save?.toLowerCase() ?? "salvo(s)"}
            </span>
          )}
          <Button variant="outline" onClick={handleClose}>{t.common.cancel}</Button>
          <Button
            variant="secondary"
            onClick={() => mutation.mutate(true)}
            disabled={mutation.isPending || !title.trim() || !projectId}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.cases.save_and_add_another}
          </Button>
          <Button onClick={() => mutation.mutate(false)} disabled={mutation.isPending || !title.trim() || !projectId}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
