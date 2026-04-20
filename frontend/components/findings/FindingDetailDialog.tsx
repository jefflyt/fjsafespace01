"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Shield, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { METRIC_CONFIGS, BAND_COLORS } from "./MetricConfig";
import type { Finding } from "./types";

interface FindingDetailDialogProps {
  finding: Finding | null;
  onClose: () => void;
}

const BAND_ICONS: Record<string, React.ElementType> = {
  GOOD: ShieldCheck,
  WATCH: AlertTriangle,
  CRITICAL: AlertCircle,
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "bg-green-100 text-green-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  LOW: "bg-orange-100 text-orange-700",
};

export function FindingDetailDialog({ finding, onClose }: FindingDetailDialogProps) {
  if (!finding) return null;

  const config = METRIC_CONFIGS[finding.metric_name];
  const symbol = config?.symbol || finding.metric_name;
  const BandIcon = BAND_ICONS[finding.threshold_band] || Info;
  const bandColor = BAND_COLORS[finding.threshold_band as keyof typeof BAND_COLORS] || "#94a3b8";

  // Parse citation_unit_ids from JSON string
  let citationIds: string[] = [];
  try {
    citationIds = JSON.parse(finding.citation_unit_ids);
  } catch {
    citationIds = [finding.citation_unit_ids];
  }

  const isAdvisory = finding.source_currency_status !== "CURRENT_VERIFIED";

  return (
    <Dialog open={!!finding} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge style={{ backgroundColor: bandColor }} className="text-white">
              <BandIcon className="h-3 w-3 mr-1" />
              {finding.threshold_band}
            </Badge>
            <DialogTitle className="text-lg">
              {symbol} — {finding.zone_name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {symbol} reading of {finding.metric_value} in {config?.unit || ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Reading */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted p-2">
              <p className="text-xs text-muted-foreground">Value</p>
              <p className="font-heading text-lg font-bold">{finding.metric_value}</p>
              <p className="text-[10px] text-muted-foreground">{config?.unit}</p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className="text-xs text-muted-foreground">Band</p>
              <p className="font-heading text-lg font-bold" style={{ color: bandColor }}>
                {finding.threshold_band}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <Badge variant="outline" className={`text-[10px] mt-1 ${CONFIDENCE_COLORS[finding.confidence_level] || ""}`}>
                {finding.confidence_level}
              </Badge>
            </div>
          </div>

          {/* Interpretation */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold mb-2">Interpretation</h4>
              <p className="text-sm text-muted-foreground">{finding.interpretation_text}</p>
            </CardContent>
          </Card>

          {/* Workforce Impact */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold mb-2">Workforce Impact</h4>
              <p className="text-sm text-muted-foreground">{finding.workforce_impact_text}</p>
            </CardContent>
          </Card>

          {/* Action Suggested */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-primary" />
                Action Suggested
              </h4>
              <p className="text-sm">{finding.recommended_action}</p>
            </CardContent>
          </Card>

          {/* Traceability */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Rule: <code className="bg-muted px-1.5 py-0.5 rounded">{finding.rule_id}</code></span>
            <span>v{finding.rule_version}</span>
            {citationIds.map((id) => (
              <span key={id} className="bg-muted px-1.5 py-0.5 rounded">{id}</span>
            ))}
          </div>

          {/* Advisory Warning */}
          {isAdvisory && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-700">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              Advisory only — source status is {finding.source_currency_status.replace(/_/g, " ").toLowerCase()}.
              Not suitable for certification decisions.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
