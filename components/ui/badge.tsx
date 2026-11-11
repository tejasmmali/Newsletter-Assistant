import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "outline" | "destructive";
}) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-none border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase",
        variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
        variant === "outline" && "text-foreground",
        variant === "destructive" && "border-transparent bg-destructive text-white",
        variant === "default" && "border-transparent bg-primary text-primary-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
