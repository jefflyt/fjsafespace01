"use client";

import { Badge } from "@/components/ui/badge";

interface ReportTypeBadgeProps {
  type: "ASSESSMENT" | "INTERVENTION_IMPACT";
}

export function ReportTypeBadge({ type }: ReportTypeBadgeProps) {
  if (type === "ASSESSMENT") {
    return (
      <Badge variant="default" className="bg-blue-600">
        Assessment
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
      Intervention Impact
    </Badge>
  );
}
