import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ITEM_TYPES = [
  { value: "USER_STORY", label: "User Story" },
  { value: "BUG", label: "Bug" },
  { value: "IMPROVEMENT", label: "Melhoria" },
  { value: "REQUIREMENT", label: "Requisito" },
  { value: "FLOW", label: "Fluxo" },
  { value: "TASK", label: "Tarefa" },
];

export const PRIORITIES = [
  { value: "CRITICAL", label: "Crítica", color: "bg-red-500" },
  { value: "HIGH", label: "Alta", color: "bg-orange-500" },
  { value: "MEDIUM", label: "Média", color: "bg-yellow-500" },
  { value: "LOW", label: "Baixa", color: "bg-green-500" },
];

export const EXECUTION_STATUSES = [
  { value: "PASS", label: "Pass", color: "bg-green-500", text: "text-green-700" },
  { value: "FAIL", label: "Fail", color: "bg-red-500", text: "text-red-700" },
  { value: "BLOCKED", label: "Blocked", color: "bg-orange-500", text: "text-orange-700" },
  { value: "NOT_EXECUTED", label: "Not Executed", color: "bg-gray-400", text: "text-gray-600" },
  { value: "RETEST", label: "Retest", color: "bg-blue-500", text: "text-blue-700" },
  { value: "SKIPPED", label: "Skipped", color: "bg-purple-500", text: "text-purple-700" },
];

export const CASE_FORMATS = [
  { value: "BDD", label: "BDD" },
  { value: "STEP_BY_STEP", label: "Step by Step" },
];

export const LANGUAGES = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export const COVERAGE_LEVELS = [
  { value: "basic", label: "Básica" },
  { value: "standard", label: "Padrão" },
  { value: "comprehensive", label: "Abrangente" },
];

export const TEST_TYPES = [
  { value: "functional", label: "Funcional" },
  { value: "regression", label: "Regressão" },
  { value: "smoke", label: "Smoke" },
  { value: "e2e", label: "End-to-End" },
  { value: "negative", label: "Negativo" },
  { value: "performance", label: "Performance" },
];

export function getStatusConfig(status: string) {
  return EXECUTION_STATUSES.find((s) => s.value === status) ?? EXECUTION_STATUSES[3];
}

export function getPriorityConfig(priority: string) {
  return PRIORITIES.find((p) => p.value === priority) ?? PRIORITIES[2];
}

export function getItemTypeLabel(type: string) {
  return ITEM_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
