import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "outline"> = {
  pending: "warning",
  approved: "success",
  active: "success",
  rejected: "destructive",
  failed: "destructive",
  completed: "success",
  sold: "info",
  paid: "success",
  processing: "info",
  available: "success",
  reserved: "warning",
  archived: "outline",
  draft: "outline",
  fundraising: "info",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const s = status ?? "—";
  const variant = STATUS_VARIANT[s.toLowerCase()] ?? "secondary";
  return <Badge variant={variant}>{s.toUpperCase()}</Badge>;
}
