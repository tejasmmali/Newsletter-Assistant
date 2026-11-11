import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted", className)} />;
}

export { Skeleton };
