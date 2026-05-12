"use client";

import { AnomalyEntry } from "@/lib/api";
import { AlertTriangle, ArrowDownCircle, AlertCircle } from "lucide-react";

interface AnomalySummaryProps {
  anomalies: AnomalyEntry[];
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  spike: ArrowDownCircle,
  drop: ArrowDownCircle,
  outlier: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  spike: "text-red-600",
  drop: "text-blue-600",
  outlier: "text-yellow-600",
};

export function AnomalySummary({ anomalies }: AnomalySummaryProps) {
  if (anomalies.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700">
          No anomalies detected — all readings are within expected ranges.
        </span>
      </div>
    );
  }

  // Group by zone
  const byZone: Record<string, AnomalyEntry[]> = {};
  for (const a of anomalies) {
    const zone = a.zone_name || "Unknown";
    if (!byZone[zone]) byZone[zone] = [];
    byZone[zone].push(a);
  }

  return (
    <div className="space-y-3">
      {Object.entries(byZone).map(([zone, zoneAnomalies]) => (
        <div key={zone} className="rounded-lg border p-3">
          <h4 className="text-sm font-semibold mb-2">
            {zone}{" "}
            <span className="text-muted-foreground font-normal">
              ({zoneAnomalies.length} anomal{zoneAnomalies.length === 1 ? "y" : "ies"})
            </span>
          </h4>
          <ul className="space-y-1.5">
            {zoneAnomalies.map((a, i) => {
              const Icon = TYPE_ICONS[a.type] ?? AlertCircle;
              return (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", TYPE_COLORS[a.type])} />
                  <span>{a.description}</span>
                  {a.value !== undefined && (
                    <span className="text-muted-foreground tabular-nums">
                      — value: {formatValue(a.value)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function formatValue(v: number): string {
  return v % 1 === 0 ? v.toLocaleString() : v.toFixed(1);
}

// Need cn utility inline since it's imported from @/lib/utils
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
