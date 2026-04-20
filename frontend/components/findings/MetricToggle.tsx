"use client";

import { METRIC_CONFIGS, METRIC_KEYS } from "./MetricConfig";

interface MetricToggleProps {
  activeMetrics: Set<string>;
  metricsWithData: Set<string>;
  onToggle: (key: string) => void;
}

export function MetricToggle({ activeMetrics, metricsWithData, onToggle }: MetricToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-fj-gray shrink-0">
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
                    ? "text-white border-transparent shadow-sm cursor-pointer"
                    : "text-fj-gray border-[--border] bg-white hover:bg-[--muted] cursor-pointer"
                }
              `}
              style={isActive && hasData ? {
                backgroundColor: config.color,
                borderColor: config.color,
                boxShadow: `0 1px 3px ${config.color}30`,
              } : {}}
            >
              {config.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}
