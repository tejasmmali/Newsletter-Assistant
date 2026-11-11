"use client";

import type { ReactNode } from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

function Collapsible({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </CollapsiblePrimitive.Root>
  );
}

function CollapsibleTrigger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <CollapsiblePrimitive.Trigger className={className}>{children}</CollapsiblePrimitive.Trigger>
  );
}

function CollapsibleContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <CollapsiblePrimitive.Content className={className}>{children}</CollapsiblePrimitive.Content>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
