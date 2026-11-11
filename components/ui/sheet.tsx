"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

function SheetContent({ title, children }: { title: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/20" />
      <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col border-t border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <DialogPrimitive.Title className="text-sm font-medium">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="text-xs text-muted-foreground">Close</DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetContent };
