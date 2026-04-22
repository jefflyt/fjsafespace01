"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Finding } from "./types";

interface ActionListProps {
  findings: Finding[];
  onActionClick: (finding: Finding) => void;
}

export function ActionList({ findings, onActionClick }: ActionListProps) {
  const actions = useMemo(() => {
    // Group findings by (zone_name, metric_name) and pick the latest (highest value) for each group
    const dedupe = (list: Finding[]) => {
      const byKey = new Map<string, Finding>();
      for (const f of list) {
        const key = `${f.zone_name}|${f.metric_name}`;
        const existing = byKey.get(key);
        if (!existing || f.metric_value > existing.metric_value) {
          byKey.set(key, f);
        }
      }
      return Array.from(byKey.values());
    };

    const critical = dedupe(findings.filter((f) => f.threshold_band === "CRITICAL"));
    const watch = dedupe(findings.filter((f) => f.threshold_band === "WATCH"));
    return { critical, watch };
  }, [findings]);

  if (actions.critical.length === 0 && actions.watch.length === 0) {
    return (
      <Card className="shadow-sm animate-fade-in">
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-[#37CA37] mb-2" />
          <p className="text-sm font-medium text-[#37CA37]">No actions needed</p>
          <p className="text-xs text-muted-foreground mt-0.5">All readings are within acceptable ranges.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recommended Actions</h3>

      {actions.critical.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-[#E93D3D]" />
            <span className="text-xs font-semibold text-[#E93D3D] uppercase tracking-wide">
              Critical ({actions.critical.length})
            </span>
          </div>
          <div className="space-y-2">
            {actions.critical.map((f) => (
              <ActionCard key={f.id} finding={f} onClick={() => onActionClick(f)} color="#E93D3D" />
            ))}
          </div>
        </div>
      )}

      {actions.watch.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-[#F6AD55]" />
            <span className="text-xs font-semibold text-[#F6AD55] uppercase tracking-wide">
              Watch ({actions.watch.length})
            </span>
          </div>
          <div className="space-y-2">
            {actions.watch.map((f) => (
              <ActionCard key={f.id} finding={f} onClick={() => onActionClick(f)} color="#F6AD55" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCard({
  finding,
  onClick,
  color,
}: {
  finding: Finding;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-all bg-white"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {finding.zone_name} — {finding.metric_name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {finding.recommended_action}
          </p>
        </div>
      </div>
    </button>
  );
}
