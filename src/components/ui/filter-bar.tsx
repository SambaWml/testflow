"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, SlidersHorizontal } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
  color?: string; // optional dot color class e.g. "bg-red-500"
}

export interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  groups: FilterGroup[];
  selected: Record<string, string[]>; // { [groupKey]: string[] }
  onChange: (groupKey: string, values: string[]) => void;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
}

export function FilterBar({
  groups, selected, onChange,
  search, onSearchChange, searchPlaceholder = "Buscar...",
}: FilterBarProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const activeCount = Object.values(selected).flat().length;

  function toggle(groupKey: string, value: string) {
    const current = selected[groupKey] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange(groupKey, next);
  }

  function clearGroup(groupKey: string) {
    onChange(groupKey, []);
  }

  function clearAll() {
    groups.forEach((g) => onChange(g.key, []));
    setOpenGroup(null);
  }

  return (
    <div className="space-y-2">
      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        {onSearchChange !== undefined && (
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={searchPlaceholder}
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        {/* Filter icon label */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtrar por:</span>
        </div>

        {/* Group buttons */}
        {groups.map((group) => {
          const sel = selected[group.key] ?? [];
          const isOpen = openGroup === group.key;
          return (
            <FilterDropdown
              key={group.key}
              group={group}
              selected={sel}
              isOpen={isOpen}
              onOpen={() => setOpenGroup(isOpen ? null : group.key)}
              onClose={() => setOpenGroup(null)}
              onToggle={(v) => toggle(group.key, v)}
              onClear={() => clearGroup(group.key)}
            />
          );
        })}

        {/* Clear all */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Active chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {groups.flatMap((group) =>
            (selected[group.key] ?? []).map((val) => {
              const opt = group.options.find((o) => o.value === val);
              return (
                <span
                  key={`${group.key}-${val}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-primary/5 border-primary/20 text-xs font-medium text-foreground"
                >
                  {opt?.color && (
                    <span className={`h-2 w-2 rounded-full shrink-0 ${opt.color}`} />
                  )}
                  <span className="text-muted-foreground">{group.label}:</span>
                  {opt?.label ?? val}
                  <button
                    type="button"
                    onClick={() => toggle(group.key, val)}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function FilterDropdown({ group, selected, isOpen, onOpen, onClose, onToggle, onClear }: {
  group: FilterGroup;
  selected: string[];
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
          selected.length > 0
            ? "border-primary bg-primary/5 text-primary"
            : "border-border bg-background text-foreground hover:bg-accent"
        }`}
      >
        {group.label}
        {selected.length > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1.5 left-0 min-w-[180px] bg-background border rounded-lg shadow-lg p-1.5">
          {group.options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer hover:bg-accent transition-colors text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt.value)}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                {opt.color && (
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${opt.color}`} />
                )}
                <span>{opt.label}</span>
              </label>
            );
          })}
          {selected.length > 0 && (
            <>
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={onClear}
                className="w-full text-left px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
              >
                Limpar seleção
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
