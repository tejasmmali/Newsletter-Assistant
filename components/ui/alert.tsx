import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Alert({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & { variant?: "default" | "destructive" }) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "rounded-lg border p-3 text-sm",
        variant === "destructive"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-border bg-muted/40",
        className
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-1 font-medium", className)} {...props} />;
}

function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-sm", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
