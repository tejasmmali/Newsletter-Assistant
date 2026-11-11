"use client";

import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="system"
      position="top-center"
      offset={{ top: "3.5rem" }}
      toastOptions={{
        className: "!border !border-border !bg-background !text-foreground shadow-none",
      }}
    />
  );
}

export { Toaster };
