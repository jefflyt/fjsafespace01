"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Finding } from "./types";

interface FindingsSummaryBarProps {
  findings: Finding[];
}

const SEGMENT_COLORS = {
  CRITICAL: "#E93D3D",
  WATCH: "#F6AD55",
  GOOD: "#37CA37",
};

export function FindingsSummaryBar({ findings }: FindingsSummaryBarProps) {
  const counts = useMemo(() => {
    const c = { CRITICAL: 0, WATCH: 0, GOOD: 0 };
    for (const f of findings) {
      if (f.threshold_band in c) {
        c[f.threshold_band as keyof typeof c]++;
      }
    }
    return c;
  }, [findings]);

  const total = counts.CRITICAL + counts.WATCH + counts.GOOD;
  if (total === 0) return null;

  return (
    <Card className="shadow-sm animate-fade-in">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Finding Summary</span>
          <span className="text-xs font-mono tabular-nums text-muted-foreground">{total} total</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
          {(["CRITICAL", "WATCH", "GOOD"] as const).map((band) => {
            const count = counts[band];
            const pct = total > 0 ? (count / total) * 100 : 0;
            if (count === 0) return null;
            return (
              <div
                key={band}
                className="transition-all"
                style={{ width: `${pct}%`, backgroundColor: SEGMENT_COLORS[band] }}
              />
            );
          })}
        </div>
        <div className="flex gap-4 mt-3">
          {(["CRITICAL", "WATCH", "GOOD"] as const).map((band) => (
            <div key={band} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[band] }} />
              <span className="text-xs font-medium text-muted-foreground">
                {band.charAt(0) + band.slice(1).toLowerCase()} ({counts[band]})
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
