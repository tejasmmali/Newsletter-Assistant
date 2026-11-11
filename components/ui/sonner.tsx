"use client";

import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="system"
      position="top-right"
      offset={{ top: "3.75rem", right: "1rem" }}
      toastOptions={{
        className: "!border !border-border !bg-background !text-foreground shadow-none",
      }}
    />
  );
}

export { Toaster };
