"use client";

import { useEffect, useRef } from "react";
import { X, BookOpen, Link, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CitationDrawerProps {
  open: boolean;
  onClose: () => void;
  finding: {
    ruleId: string;
    ruleVersion: string;
    citationUnitIds: string[];
    sourceCurrencyStatus: string;
    interpretationText?: string;
    thresholdBand?: string;
  };
}

export function CitationDrawer({ open, onClose, finding }: CitationDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const statusColors: Record<string, string> = {
    CURRENT_VERIFIED: "bg-green-100 text-green-800",
    PARTIAL_EXTRACT: "bg-yellow-100 text-yellow-800",
    VERSION_UNVERIFIED: "bg-orange-100 text-orange-800",
    SUPERSEDED: "bg-red-100 text-red-800",
  };

  const bandColors: Record<string, string> = {
    CRITICAL: "destructive",
    MODERATE: "default",
    GOOD: "secondary",
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative z-50 w-full max-w-md bg-background border-l shadow-xl animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-lg font-semibold">Citation Details</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 p-6">
          {/* Rule Reference */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Rule Reference
            </h4>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-sm font-semibold">{finding.ruleId}</code>
              <Badge variant="outline">v{finding.ruleVersion}</Badge>
            </div>
          </div>

          {/* Citation Units */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Link className="h-4 w-4" />
              Citation Units
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {finding.citationUnitIds.map((id) => (
                <code key={id} className="rounded bg-muted px-2 py-1 text-xs">{id}</code>
              ))}
              {finding.citationUnitIds.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No citations linked</span>
              )}
            </div>
          </div>

          {/* Source Currency */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Source Currency Status</h4>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[finding.sourceCurrencyStatus] ?? "bg-gray-100 text-gray-800"}`}>
              {finding.sourceCurrencyStatus}
            </span>
            {finding.sourceCurrencyStatus !== "CURRENT_VERIFIED" && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mt-1">
                Advisory only — not suitable for certification decisions
              </p>
            )}
          </div>

          {/* Interpretation */}
          {finding.interpretationText && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Interpretation</h4>
              <p className="text-sm leading-relaxed">{finding.interpretationText}</p>
            </div>
          )}

          {/* Threshold Band */}
          {finding.thresholdBand && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Threshold Band</h4>
              <Badge variant={(bandColors as any)[finding.thresholdBand] ?? "secondary"}>
                {finding.thresholdBand}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
