/**
 * Configurable enums — stored in localStorage, falling back to built-in defaults.
 * Values (keys) stored in the DB are plain strings, so custom entries just work.
 */

export type ItemType = { value: string; label: string };
export type Priority  = { value: string; label: string; color: string }; // hex
export type ExecStatus = { value: string; label: string; color: string }; // hex

/* ── Built-in defaults ──────────────────────────────────────────── */
export const DEFAULT_ITEM_TYPES: ItemType[] = [
  { value: "USER_STORY",  label: "User Story" },
  { value: "BUG",         label: "Bug" },
  { value: "IMPROVEMENT", label: "Melhoria" },
  { value: "REQUIREMENT", label: "Requisito" },
  { value: "FLOW",        label: "Fluxo" },
  { value: "TASK",        label: "Tarefa" },
];

export const DEFAULT_PRIORITIES: Priority[] = [
  { value: "CRITICAL", label: "Crítica", color: "#ef4444" },
  { value: "HIGH",     label: "Alta",    color: "#f97316" },
  { value: "MEDIUM",   label: "Média",   color: "#eab308" },
  { value: "LOW",      label: "Baixa",   color: "#22c55e" },
];

export const DEFAULT_EXEC_STATUSES: ExecStatus[] = [
  { value: "PASS",         label: "Pass",         color: "#22c55e" },
  { value: "FAIL",         label: "Fail",         color: "#ef4444" },
  { value: "BLOCKED",      label: "Blocked",      color: "#f97316" },
  { value: "NOT_EXECUTED", label: "Not Executed", color: "#94a3b8" },
  { value: "RETEST",       label: "Retest",       color: "#3b82f6" },
  { value: "SKIPPED",      label: "Skipped",      color: "#a855f7" },
];

/* ── Storage keys ───────────────────────────────────────────────── */
const KEYS = {
  itemTypes: "testflow_item_types",
  priorities: "testflow_priorities",
  statuses:   "testflow_exec_statuses",
} as const;

function read<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

/* ── Public API ─────────────────────────────────────────────────── */
export const getItemTypes    = (): ItemType[]   => read(KEYS.itemTypes,  DEFAULT_ITEM_TYPES);
export const getPriorities   = (): Priority[]   => read(KEYS.priorities, DEFAULT_PRIORITIES);
export const getExecStatuses = (): ExecStatus[] => read(KEYS.statuses,   DEFAULT_EXEC_STATUSES);

export const saveItemTypes    = (v: ItemType[])   => write(KEYS.itemTypes,  v);
export const savePriorities   = (v: Priority[])   => write(KEYS.priorities, v);
export const saveExecStatuses = (v: ExecStatus[]) => write(KEYS.statuses,   v);

/** Reset one group back to defaults */
export function resetItemTypes()    { localStorage.removeItem(KEYS.itemTypes); }
export function resetPriorities()   { localStorage.removeItem(KEYS.priorities); }
export function resetExecStatuses() { localStorage.removeItem(KEYS.statuses); }

/* ── Color presets shown in the picker ─────────────────────────── */
export const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#6366f1", "#a855f7",
  "#ec4899", "#94a3b8", "#78716c", "#0f172a",
];
