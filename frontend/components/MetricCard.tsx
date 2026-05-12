"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { METRIC_CONFIGS } from "@/components/findings/MetricConfig";
import { BAND_TAILWIND } from "@/lib/constants";

interface MetricCardProps {
  metricName: string;
  metricValue: number;
  metricUnit: string;
  thresholdBand: "GOOD" | "WATCH" | "CRITICAL";
  interpretationText: string;
  recommendedAction: string;
  workforceImpactText?: string;
}

export function MetricCard({
  metricName,
  metricValue,
  metricUnit,
  thresholdBand,
  interpretationText,
  recommendedAction,
  workforceImpactText,
}: MetricCardProps) {
  const config = METRIC_CONFIGS[metricName];
  const band = BAND_TAILWIND[thresholdBand] ?? BAND_TAILWIND.WATCH;
  const BandIcon = band.icon;

  return (
    <Card className={`transition-shadow hover:shadow-md ${band.border}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {config?.symbol ?? metricName}
          </span>
          <Badge variant="outline" className={`gap-1 ${band.bg} ${band.color} ${band.border}`}>
            <BandIcon className="h-3 w-3" />
            {band.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className={`font-heading text-3xl font-bold tabular-nums ${band.color}`}>
            {metricValue}
          </span>
          <span className="text-sm text-muted-foreground">{metricUnit}</span>
        </div>

        <p className="text-sm text-foreground">{interpretationText}</p>

        <div className="rounded-md bg-accent/50 p-2 text-xs">
          <span className="font-semibold">Recommended action:</span>{" "}
          {recommendedAction}
        </div>

        {workforceImpactText && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Impact:</span> {workforceImpactText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
