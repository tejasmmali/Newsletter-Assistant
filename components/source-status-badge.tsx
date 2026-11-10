import { Badge } from "@/components/ui/badge";
import type { SourceStatus } from "@/lib/schemas";

const labels: Record<SourceStatus, string> = {
  ok: "Ready",
  needs_manual_text: "Needs manual text",
  error: "Error",
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  if (status === "ok") {
    return (
      <Badge variant="secondary" className="font-normal">
        {labels[status]}
      </Badge>
    );
  }

  if (status === "needs_manual_text") {
    return (
      <Badge
        variant="outline"
        className="border-amber-600 text-amber-800 font-normal"
      >
        {labels[status]}
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="font-normal">
      {labels[status]}
    </Badge>
  );
}
