"use client";

import { useMemo } from "react";
import { METRIC_CONFIGS } from "@/components/findings/MetricConfig";
import { cn } from "@/lib/utils";

interface MetricSelectorBarProps {
  readings: Array<{
    metric_name: string;
    zone_name: string;
    timestamp: string;
    metric_value: number;
    is_outlier: boolean;
  }>;
  activeMetric: string;
  onSelectMetric: (metric: string) => void;
}

function getStatusColor(
  metricKey: string,
  value: number,
): "GOOD" | "WATCH" | "CRITICAL" {
  const config = METRIC_CONFIGS[metricKey];
  if (!config) return "WATCH";

  const inRange = (v: number, band: [number, number]) => v >= band[0] && v <= band[1];
  if (inRange(value, config.goodBand)) return "GOOD";

  for (const band of config.watchBand) {
    if (inRange(value, band)) return "WATCH";
  }

  for (const band of config.criticalBand) {
    if (band[0] > 0 && inRange(value, band)) return "CRITICAL";
  }

  return "CRITICAL";
}

const DOT_COLORS: Record<string, string> = {
  GOOD: "bg-green-500",
  WATCH: "bg-yellow-500",
  CRITICAL: "bg-red-500",
};

export function MetricSelectorBar({
  readings,
  activeMetric,
  onSelectMetric,
}: MetricSelectorBarProps) {
  // Get latest value per metric (latest timestamp wins)
  const latestValues = useMemo(() => {
    const values: Record<string, number> = {};
    const timestamps: Record<string, string> = {};
    for (const r of readings) {
      if (!timestamps[r.metric_name] || new Date(r.timestamp) > new Date(timestamps[r.metric_name])) {
        values[r.metric_name] = r.metric_value;
        timestamps[r.metric_name] = r.timestamp;
      }
    }
    return values;
  }, [readings]);

  // Only show metrics that have actual data in the readings
  const metrics = useMemo(() => {
    const present = new Set(readings.map((r) => r.metric_name));
    return Object.keys(METRIC_CONFIGS).filter((key) => present.has(key));
  }, [readings]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {metrics.map((key) => {
        const config = METRIC_CONFIGS[key];
        const value = latestValues[key];
        const status = getStatusColor(key, value);

        return (
          <button
            key={key}
            onClick={() => onSelectMetric(key)}
            className={cn(
              "flex flex-col items-center gap-0.5 min-w-[68px] rounded-lg border px-3 py-2 text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
              activeMetric === key
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/30",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", DOT_COLORS[status])} />
              <span className="text-xs font-semibold text-muted-foreground">
                {config.symbol}
              </span>
            </div>
            <span className="text-sm font-mono font-bold tabular-nums">
              {value % 1 === 0 ? value : value.toFixed(1)}
            </span>
            <span className="text-[10px] text-muted-foreground">{config.unit}</span>
          </button>
        );
      })}
    </div>
  );
}
