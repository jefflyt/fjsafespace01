"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Info } from "lucide-react";

interface StandardScore {
  sourceId: string;
  title: string;
  score: number | null;
  outcome: string;
}

interface SiteOverviewCardProps {
  siteName: string;
  lastUpdated: string;
  scanMode: "adhoc" | "live";
  lastUploadAgo?: string;
  standardScores: StandardScore[];
  topInsight?: string;
  overallWellness: number | null;
}

function getOutcomeBadge(outcome: string) {
  switch (outcome) {
    case "PASS":
    case "HEALTHY_WORKPLACE_CERTIFIED":
      return {
        icon: ShieldCheck,
        label: "Certified",
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "FAIL":
    case "IMPROVEMENT_REQUIRED":
      return {
        icon: ShieldAlert,
        label: "Action Required",
        color: "text-red-700 bg-red-50 border-red-200",
      };
    case "INSUFFICIENT_EVIDENCE":
      return {
        icon: Info,
        label: "Insufficient Data",
        color: "text-gray-700 bg-gray-50 border-gray-200",
      };
    default:
      return {
        icon: Info,
        label: outcome,
        color: "text-gray-700 bg-gray-50 border-gray-200",
      };
  }
}

function getScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

export function SiteOverviewCard({
  siteName,
  lastUpdated,
  scanMode,
  lastUploadAgo,
  standardScores,
  topInsight,
  overallWellness,
}: SiteOverviewCardProps) {
  const scanModeLabel =
    scanMode === "live"
      ? "Live — connected"
      : lastUploadAgo
        ? `Last uploaded ${lastUploadAgo}`
        : "Adhoc scan";

  const worstOutcome = standardScores.find(
    (s) => s.outcome === "FAIL" || s.outcome === "IMPROVEMENT_REQUIRED"
  );
  const overallBadge = worstOutcome
    ? getOutcomeBadge(worstOutcome.outcome)
    : getOutcomeBadge("PASS");
  const OverallIcon = overallBadge.icon;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div>
            <span className="text-lg font-heading font-bold">{siteName}</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scanModeLabel} &middot; Updated{" "}
              {new Date(lastUpdated).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {overallWellness != null && (
              <span
                className={`font-heading text-3xl font-bold tabular-nums ${getScoreColor(overallWellness)}`}
              >
                {Math.round(overallWellness)}
              </span>
            )}
            <Badge
              variant="outline"
              className={`gap-1 ${overallBadge.color}`}
            >
              <OverallIcon className="h-3 w-3" />
              {overallBadge.label}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Per-standard scores */}
        {standardScores.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Standards
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {standardScores.map((s) => {
                const badge = getOutcomeBadge(s.outcome);
                const BadgeIcon = badge.icon;
                return (
                  <div
                    key={s.sourceId}
                    className="rounded-md border p-3 bg-white"
                  >
                    <p className="text-sm font-semibold">{s.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`font-heading text-xl font-bold tabular-nums ${getScoreColor(s.score)}`}
                      >
                        {s.score != null ? Math.round(s.score) : "N/A"}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs gap-0.5 ${badge.color}`}
                      >
                        <BadgeIcon className="h-2.5 w-2.5" />
                        {badge.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top insight */}
        {topInsight && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm font-semibold text-amber-800">
              Top Insight
            </p>
            <p className="text-sm text-amber-700 mt-0.5">{topInsight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
