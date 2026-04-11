"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getItemTypes, getPriorities } from "@/lib/enum-config";

const ITEM_TYPES = getItemTypes();
const PRIORITIES  = getPriorities();
import { Loader2 } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  description: z.string().optional(),
  type: z.string().min(1),
  priority: z.string().min(1),
  reference: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.string().min(1, "Projeto obrigatório"),
  moduleId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId?: string | null;
  defaultProjectId?: string;
}

export function ItemFormDialog({ open, onOpenChange, editId, defaultProjectId }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editId;

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const { data: editData } = useQuery({
    queryKey: ["item", editId],
    queryFn: () => fetch(`/api/items/${editId}`).then((r) => r.json()),
    enabled: !!editId,
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "USER_STORY", priority: "MEDIUM", projectId: "" },
  });

  const projectId = watch("projectId");

  const { data: modules } = useQuery({
    queryKey: ["modules", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/modules`).then((r) => r.json()),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (editData) {
      reset({
        title: editData.title,
        description: editData.description ?? "",
        type: editData.type,
        priority: editData.priority,
        reference: editData.reference ?? "",
        acceptanceCriteria: editData.acceptanceCriteria ?? "",
        notes: editData.notes ?? "",
        projectId: editData.projectId,
        moduleId: editData.moduleId ?? "",
      });
    } else {
      reset({ type: "USER_STORY", priority: "MEDIUM", projectId: defaultProjectId ?? projects?.projects?.[0]?.id ?? "" });
    }
  }, [editData, open, reset, projects, defaultProjectId]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const url = isEdit ? `/api/items/${editId}` : "/api/items";
      const method = isEdit ? "PATCH" : "POST";
      return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onOpenChange(false);
      reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Item" : "Novo Item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Título *</Label>
              <Input {...register("title")} placeholder="Título do item" />
              {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select defaultValue="USER_STORY" onValueChange={(v) => setValue("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select defaultValue="MEDIUM" onValueChange={(v) => setValue("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Projeto *</Label>
              <Select value={projectId} onValueChange={(v) => setValue("projectId", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(projects?.projects ?? []).map((p: { id: string; name: string }) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.projectId && <p className="text-xs text-red-600">{errors.projectId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Módulo</Label>
              <Select onValueChange={(v) => setValue("moduleId", v)}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {(modules?.modules ?? []).map((m: { id: string; name: string }) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Referência</Label>
              <Input {...register("reference")} placeholder="Ex: JIRA-123, BUG-456" />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <Textarea {...register("description")} placeholder="Descreva o item..." rows={3} />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea {...register("notes")} placeholder="Observações adicionais..." rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
