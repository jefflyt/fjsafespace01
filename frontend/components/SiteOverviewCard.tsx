"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOutcomeConfig, getScoreColor } from "@/lib/constants";
import { BAND_TAILWIND } from "@/lib/constants";

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

function buildBadgeClasses(outcome: string): string {
  const cfg = getOutcomeConfig(outcome);
  return `${cfg.color} ${cfg.bg ?? ""} ${cfg.border}`.trim();
}

function buildBadgeLabel(outcome: string): string {
  const cfg = getOutcomeConfig(outcome);
  return cfg.label;
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
    (s) => {
      const cfg = getOutcomeConfig(s.outcome);
      return cfg.label.includes("Improvement") || cfg.label === "Fail";
    }
  );
  const worstCfg = worstOutcome ? getOutcomeConfig(worstOutcome.outcome) : getOutcomeConfig("PASS");
  const OverallIcon = worstCfg.icon;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-lg font-heading font-bold">{siteName}</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scanModeLabel} · Updated{" "}
              {new Date(lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {overallWellness != null && (
              <span
                className={`font-heading text-3xl font-bold tabular-nums ${getScoreColor(overallWellness)}`}
              >
                {Math.round(overallWellness)}
              </span>
            )}
            <Badge
              variant="outline"
              className={`gap-1 ${buildBadgeClasses(worstOutcome?.outcome ?? "PASS")}`}
            >
              <OverallIcon className="h-3 w-3" />
              {buildBadgeLabel(worstOutcome?.outcome ?? "PASS")}
            </Badge>
          </div>
        </div>
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
                const badgeClasses = buildBadgeClasses(s.outcome);
                const badgeLabel = buildBadgeLabel(s.outcome);
                const BadgeIcon = getOutcomeConfig(s.outcome).icon;
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
                        className={`text-xs gap-0.5 ${badgeClasses}`}
                      >
                        <BadgeIcon className="h-2.5 w-2.5" />
                        {badgeLabel}
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
          <div className={`rounded-md border p-3 ${BAND_TAILWIND.WATCH.bg} ${BAND_TAILWIND.WATCH.border}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${BAND_TAILWIND.WATCH.color.replace('text-', 'text-').replace('700', '800')}`}>
              Key Finding
            </p>
            <p className={`text-sm mt-0.5 ${BAND_TAILWIND.WATCH.color}`}>{topInsight}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
