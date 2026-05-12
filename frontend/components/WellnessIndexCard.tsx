"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OUTCOME_CONFIG, getOutcomeConfig, getScoreColor } from "@/lib/constants";

interface StandardScore {
  title: string;
  score: number | null;
  outcome: string;
}

interface WellnessIndexCardProps {
  siteName: string;
  wellnessIndexScore: number | null;
  certificationOutcome: string | null;
  lastScanDate?: string | null;
  trend?: "up" | "down" | "stable";
  // R1-05: per-standard scores
  standardScores?: StandardScore[];
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

export function WellnessIndexCard({
  siteName,
  wellnessIndexScore,
  certificationOutcome,
  lastScanDate,
  trend = "stable",
  standardScores,
}: WellnessIndexCardProps) {
  const config = getOutcomeConfig(certificationOutcome);
  const OutcomeIcon = config.icon;

  return (
    <Card className="transition-shadow hover:shadow-md">
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

        {/* R1-05: Per-standard scores */}
        {standardScores && standardScores.length > 0 && (
          <div className="mt-4 space-y-2">
            {standardScores.map((s) => {
              const sConfig = getOutcomeConfig(s.outcome);
              const SIcon = sConfig.icon;
              return (
                <div key={s.title} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm font-medium">{s.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-heading text-lg font-bold tabular-nums ${getScoreColor(s.score)}`}>
                      {s.score != null ? Math.round(s.score) : "N/A"}
                    </span>
                    <Badge variant="outline" className={`text-xs gap-0.5 ${sConfig.color} ${sConfig.border}`}>
                      <SIcon className="h-2.5 w-2.5" />
                      {sConfig.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
