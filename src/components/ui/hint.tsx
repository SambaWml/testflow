"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * HintIcon — small ? icon next to a label that shows a tooltip on hover.
 * Usage: <Label>Nome <HintIcon text="Explica o campo" /></Label>
 */
export function HintIcon({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle
          className={cn("inline-block h-3.5 w-3.5 text-muted-foreground/70 cursor-help align-middle ml-1 shrink-0", className)}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Tip — wraps any element (usually an icon button) and adds a tooltip.
 * Usage: <Tip text="Excluir caso"><Button ...>...</Button></Tip>
 */
export function Tip({
  text,
  children,
  side = "top",
}: {
  text: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
