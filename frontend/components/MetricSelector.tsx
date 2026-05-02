"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { METRIC_CONFIGS } from "@/components/findings/MetricConfig";

interface MetricSelectorProps {
  availableMetrics: string[];
  activeMetrics: string[];
  onToggle: (metric: string) => void;
}

export function MetricSelector({
  availableMetrics,
  activeMetrics,
  onToggle,
}: MetricSelectorProps) {
  return (
    <div className="space-y-2">
      {availableMetrics.map((metric) => {
        const config = METRIC_CONFIGS[metric];
        const isChecked = activeMetrics.includes(metric);

        return (
          <div key={metric} className="flex items-center gap-2">
            <Checkbox
              id={`metric-${metric}`}
              checked={isChecked}
              onCheckedChange={() => onToggle(metric)}
            />
            <label
              htmlFor={`metric-${metric}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {config?.symbol ?? metric}
              {config?.label && config.label !== config.symbol && (
                <span className="ml-1 text-muted-foreground">({config.label})</span>
              )}
            </label>
          </div>
        );
      })}
    </div>
  );
}
