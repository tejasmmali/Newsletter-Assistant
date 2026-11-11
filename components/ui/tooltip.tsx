"use client";

import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

function Tooltip({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Root>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TooltipPrimitive.Trigger asChild>
      <span className={className}>{children}</span>
    </TooltipPrimitive.Trigger>
  );
}

function TooltipContent({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={6}
        className={cn(
          "z-50 max-w-xs border border-border bg-popover px-2 py-1.5 text-xs text-popover-foreground"
        )}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
