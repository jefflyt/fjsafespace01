"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle, AlertCircle, Info } from "lucide-react";

interface CitationBadgeProps {
  citationUnitIds: string[];
  ruleId: string;
  ruleVersion: string;
  sourceCurrencyStatus: "CURRENT_VERIFIED" | "PARTIAL_EXTRACT" | "VERSION_UNVERIFIED" | "SUPERSEDED";
}

const STATUS_CONFIG = {
  CURRENT_VERIFIED: {
    label: "Verified",
    icon: Check,
    variant: "default" as const,
    color: "text-[#37CA37]",
  },
  PARTIAL_EXTRACT: {
    label: "Partial",
    icon: AlertTriangle,
    variant: "secondary" as const,
    color: "text-[#F6AD55]",
  },
  VERSION_UNVERIFIED: {
    label: "Unverified",
    icon: AlertCircle,
    variant: "outline" as const,
    color: "text-[#F6AD55]",
  },
  SUPERSEDED: {
    label: "Superseded",
    icon: Info,
    variant: "destructive" as const,
    color: "text-[#E93D3D]",
  },
};

export function CitationBadge({
  citationUnitIds,
  ruleId,
  ruleVersion,
  sourceCurrencyStatus,
}: CitationBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const config = STATUS_CONFIG[sourceCurrencyStatus] ?? STATUS_CONFIG.VERSION_UNVERIFIED;
  const StatusIcon = config.icon;

  return (
    <div className="relative inline-block">
      <Badge
        variant={config.variant}
        className="cursor-pointer select-none flex items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        <StatusIcon className={`h-3 w-3 ${config.color}`} />
        {ruleId}
      </Badge>

      {isOpen && (
        <div
          className="fixed z-50 w-72 rounded-lg border bg-popover p-4 shadow-lg animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: "calc(50% + 1.5rem)",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{ruleId}</h4>
              <Badge variant="outline" className="text-xs">
                v{ruleVersion}
              </Badge>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-3.5 w-3.5 ${config.color}`} />
                <span className="font-medium">Currency Status</span>
              </div>
              <p className="text-muted-foreground pl-5">{config.label}</p>
            </div>

            <div className="space-y-1 text-xs">
              <span className="font-medium">Citation Units</span>
              <div className="flex flex-wrap gap-1 pl-1">
                {citationUnitIds.map((id) => (
                  <code key={id} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                    {id}
                  </code>
                ))}
              </div>
            </div>

            {sourceCurrencyStatus !== "CURRENT_VERIFIED" && (
              <div className="rounded-md bg-yellow-50 p-2 text-[11px] text-yellow-700 border border-yellow-200">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                Advisory only — not suitable for certification decisions
              </div>
            )}
          </div>

          <button
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsOpen(false)}
          >
            <span className="sr-only">Close</span>×
          </button>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
