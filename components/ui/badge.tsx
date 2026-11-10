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
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs",
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
