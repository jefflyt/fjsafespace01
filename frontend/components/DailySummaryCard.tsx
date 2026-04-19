"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Calendar } from "lucide-react";

interface RiskItem {
  metric: string;
  zone: string;
  severity: "CRITICAL" | "MODERATE" | "GOOD";
  value: string;
}

interface ActionItem {
  action: string;
  zone: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface DailySummaryCardProps {
  topRisks?: RiskItem[];
  topActions?: ActionItem[];
  dataAsOf?: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  MODERATE: "bg-yellow-100 text-yellow-700 border-yellow-200",
  GOOD: "bg-green-100 text-green-700 border-green-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};

export function DailySummaryCard({
  topRisks = [],
  topActions = [],
  dataAsOf,
}: DailySummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Daily Summary
        </CardTitle>
        <CardDescription className="text-xs">
          {dataAsOf ? `Data as of ${new Date(dataAsOf).toLocaleString()}` : "No data available"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Risks */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            Top Risks
          </h4>
          {topRisks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No critical risks identified.</p>
          ) : (
            <div className="space-y-2">
              {topRisks.map((risk, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                  <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold uppercase ${SEVERITY_COLORS[risk.severity] ?? "bg-gray-100 text-gray-700"}`}>
                    {risk.severity}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{risk.metric}</p>
                    <p className="text-xs text-muted-foreground">{risk.zone} — {risk.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Actions */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            Recommended Actions
          </h4>
          {topActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions required at this time.</p>
          ) : (
            <div className="space-y-2">
              {topActions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                  <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold uppercase ${PRIORITY_COLORS[action.priority] ?? "bg-gray-100 text-gray-700"}`}>
                    {action.priority}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{action.action}</p>
                    <p className="text-xs text-muted-foreground">{action.zone}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
