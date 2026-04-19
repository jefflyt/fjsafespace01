"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Shield, ShieldCheck, AlertTriangle, Info } from "lucide-react";

const OUTCOME_CONFIG = {
  HEALTHY_WORKPLACE_CERTIFIED: {
    label: "Certified",
    icon: ShieldCheck,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  HEALTHY_SPACE_VERIFIED: {
    label: "Verified",
    icon: Shield,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  IMPROVEMENT_REQUIRED: {
    label: "Improvement Needed",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient Evidence",
    icon: Info,
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
  },
};

function getScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function getTrendIcon(trend: "up" | "down" | "stable" | undefined) {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case "down":
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

interface WellnessIndexCardProps {
  siteName: string;
  wellnessIndexScore: number | null;
  certificationOutcome: string | null;
  lastScanDate?: string | null;
  trend?: "up" | "down" | "stable";
}

export function WellnessIndexCard({
  siteName,
  wellnessIndexScore,
  certificationOutcome,
  lastScanDate,
  trend = "stable",
}: WellnessIndexCardProps) {
  const outcomeKey = certificationOutcome as keyof typeof OUTCOME_CONFIG;
  const config = OUTCOME_CONFIG[outcomeKey] ?? OUTCOME_CONFIG.INSUFFICIENT_EVIDENCE;
  const OutcomeIcon = config.icon;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-heading font-semibold">{siteName}</span>
          <Badge variant="outline" className={`${config.color} ${config.border}`}>
            <OutcomeIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          {lastScanDate ? `Last scan: ${new Date(lastScanDate).toLocaleDateString()}` : "No scan data"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span
            className={`font-heading text-4xl font-bold tabular-nums tracking-tight ${getScoreColor(wellnessIndexScore)}`}
          >
            {wellnessIndexScore != null ? `${Math.round(wellnessIndexScore)}` : "N/A"}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          {getTrendIcon(trend)}
        </div>
        {wellnessIndexScore != null && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${wellnessIndexScore}%`,
                background:
                  wellnessIndexScore >= 80
                    ? "linear-gradient(90deg, #16a34a, #22c55e)"
                    : wellnessIndexScore >= 60
                    ? "linear-gradient(90deg, #2563eb, #60a5fa)"
                    : wellnessIndexScore >= 40
                    ? "linear-gradient(90deg, #ca8a04, #fbbf24)"
                    : "linear-gradient(90deg, #dc2626, #f87171)",
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
