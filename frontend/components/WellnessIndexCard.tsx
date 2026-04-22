"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Shield, ShieldCheck, AlertTriangle, Info } from "lucide-react";

const OUTCOME_CONFIG = {
  HEALTHY_WORKPLACE_CERTIFIED: {
    label: "Certified",
    icon: ShieldCheck,
    color: "text-[#37CA37]",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  HEALTHY_SPACE_VERIFIED: {
    label: "Verified",
    icon: Shield,
    color: "text-[#F6AD55]",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  IMPROVEMENT_REQUIRED: {
    label: "Improvement Needed",
    icon: AlertTriangle,
    color: "text-[#E93D3D]",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient Evidence",
    icon: Info,
    color: "text-muted-foreground",
    bg: "bg-gray-50",
    border: "border-gray-200",
  },
};

function getScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-[#37CA37]";
  if (score >= 60) return "text-[#F6AD55]";
  if (score >= 40) return "text-[#F6AD55]";
  return "text-[#E93D3D]";
}

function getTrendIcon(trend: "up" | "down" | "stable" | undefined) {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-[#37CA37]" />;
    case "down":
      return <TrendingDown className="h-4 w-4 text-[#E93D3D]" />;
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
                    ? "linear-gradient(90deg, #2da82d, #37CA37)"
                    : wellnessIndexScore >= 60
                    ? "linear-gradient(90deg, #d4940a, #F6AD55)"
                    : wellnessIndexScore >= 40
                    ? "linear-gradient(90deg, #d4940a, #F6AD55)"
                    : "linear-gradient(90deg, #c93030, #E93D3D)",
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
