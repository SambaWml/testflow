"use client";

import { useEffect, useState } from "react";
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

interface Props {
  caseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Step {
  id?: string;
  order: number;
  description: string;
  expectedData?: string;
}

export function CaseEditDialog({ caseId, open, onOpenChange }: Props) {
  const { t } = useLang();
  const qc = useQueryClient();

  const { data: tc, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetch(`/api/cases/${caseId}`).then((r) => r.json()),
    enabled: !!caseId && open,
  });

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [precondition, setPrecondition] = useState("");
  const [notes, setNotes] = useState("");
  const [bddGiven, setBddGiven] = useState("");
  const [bddWhen, setBddWhen] = useState("");
  const [bddThen, setBddThen] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);

  const format = tc?.format ?? "BDD";

  useEffect(() => {
    if (tc) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(tc.title ?? "");
      setPriority(tc.priority ?? "MEDIUM");
      setPrecondition(tc.precondition ?? "");
      setNotes(tc.notes ?? "");
      setBddGiven(tc.bddGiven ?? "");
      setBddWhen(tc.bddWhen ?? "");
      setBddThen(tc.bddThen ?? "");
      setExpectedResult(tc.expectedResult ?? "");
      setSteps(tc.steps?.length ? tc.steps : [{ order: 1, description: "" }]);
    }
  }, [tc]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { title, priority, precondition, notes };
      if (format === "BDD") {
        body.bddGiven = bddGiven;
        body.bddWhen = bddWhen;
        body.bddThen = bddThen;
      } else {
        body.expectedResult = expectedResult;
        body.steps = steps.filter((s) => s.description.trim());
      }
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("error");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      qc.invalidateQueries({ queryKey: ["project-cases"] });
      qc.invalidateQueries({ queryKey: ["cases-all"] });
      onOpenChange(false);
    },
  });

  function addStep() {
    setSteps((prev) => [...prev, { order: prev.length + 1, description: "" }]);
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  }

  function updateStep(idx: number, field: "description" | "expectedData", value: string) {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.cases.edit_case ?? "Editar Caso de Teste"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>{t.cases.title ?? "Título"} *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do caso de teste" />
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
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs shrink-0 mt-2">{step.order}</span>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={step.description}
                        onChange={(e) => updateStep(idx, "description", e.target.value)}
                        placeholder={`Passo ${step.order}...`}
                      />
                      <Input
                        value={step.expectedData ?? ""}
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !title.trim()}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
