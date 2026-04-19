import { Badge } from "@/components/ui/badge";

interface ReportTypeBadgeProps {
  type: "ASSESSMENT" | "INTERVENTION_IMPACT";
}

export function ReportTypeBadge({ type }: ReportTypeBadgeProps) {
  if (type === "ASSESSMENT") {
    return (
      <Badge variant="default" className="bg-primary">
        Assessment
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
      Intervention Impact
    </Badge>
  );
}
