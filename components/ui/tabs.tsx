"use client";

import type { ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      {children}
    </TabsPrimitive.Root>
  );
}

function TabsList({ children }: { children: ReactNode }) {
  return (
    <TabsPrimitive.List className="flex gap-1 border-b border-border">{children}</TabsPrimitive.List>
  );
}

function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "border border-transparent px-3 py-1.5 text-sm text-muted-foreground data-[state=active]:border-border data-[state=active]:border-b-background data-[state=active]:text-foreground"
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Content value={value} className={className}>
      {children}
    </TabsPrimitive.Content>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
