"use client";

import { METRIC_CONFIGS, METRIC_KEYS } from "./MetricConfig";

interface MetricToggleProps {
  activeMetrics: Set<string>;
  metricsWithData: Set<string>;
  onToggle: (key: string) => void;
}

export function MetricToggle({ activeMetrics, metricsWithData, onToggle }: MetricToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
        Metrics
      </span>
      <div className="flex flex-wrap gap-2">
        {METRIC_KEYS.map((key) => {
          const config = METRIC_CONFIGS[key];
          const hasData = metricsWithData.has(key);
          const isActive = activeMetrics.has(key);

          return (
            <button
              key={key}
              disabled={!hasData}
              onClick={() => hasData && onToggle(key)}
              className={`
                inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full border transition-all
                ${!hasData
                  ? "text-gray-300 border-gray-200 bg-gray-50 cursor-not-allowed"
                  : isActive
                    ? "bg-primary text-primary-foreground border-transparent shadow-sm cursor-pointer"
                    : "text-muted-foreground border-border bg-card hover:bg-muted cursor-pointer"
                }
              `}
            >
              {config.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}
