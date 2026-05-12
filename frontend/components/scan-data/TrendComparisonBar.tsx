"use client";

import { METRIC_CONFIGS } from "@/components/findings/MetricConfig";
import { TrendComparisonMetric } from "@/lib/api";

interface TrendComparisonBarProps {
  metrics: Record<string, TrendComparisonMetric>;
}

// Whether a higher value is better for this metric
const HIGHER_IS_BETTER = new Set(["humidity_rh", "pressure_hpa"]);

export function TrendComparisonBar({ metrics }: TrendComparisonBarProps) {
  const entries = Object.entries(metrics).filter(
    ([, m]) => m.pct_change !== undefined,
  );

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No previous scan available for comparison.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([key, data]) => {
        const config = METRIC_CONFIGS[key];
        if (!config) return null;

        const change = data.pct_change ?? 0;
        const higherIsBetter = HIGHER_IS_BETTER.has(key);

        // For most metrics, lower = better (less pollution)
        // For humidity/pressure, being closer to good band center is better
        const isImprovement = higherIsBetter
          ? change > 0
          : change < 0;

        const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
        const color = isImprovement
          ? "text-green-600"
          : change === 0
            ? "text-muted-foreground"
            : "text-red-600";

        return (
          <div key={key} className="flex items-center gap-1 text-sm">
            <span className="font-medium">{config.symbol}</span>
            <span className={color}>
              {arrow} {Math.abs(change).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
