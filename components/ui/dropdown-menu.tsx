"use client";

import type { ReactNode } from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";

function DropdownMenu({ children }: { children: ReactNode }) {
  return <DropdownPrimitive.Root>{children}</DropdownPrimitive.Root>;
}
function DropdownMenuTrigger({ children }: { children: ReactNode }) {
  return <DropdownPrimitive.Trigger asChild>{children}</DropdownPrimitive.Trigger>;
}
function DropdownMenuContent({ children }: { children: ReactNode }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align="end"
        sideOffset={6}
        className="z-50 min-w-40 border border-border bg-popover p-1 text-sm text-popover-foreground"
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}
function DropdownMenuItem({
  children,
  onSelect,
}: {
  children: ReactNode;
  onSelect?: () => void;
}) {
  return (
    <DropdownPrimitive.Item
      className="cursor-pointer px-2 py-1.5 outline-none data-[highlighted]:bg-muted"
      onSelect={onSelect}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
