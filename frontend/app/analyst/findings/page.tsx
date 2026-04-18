"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Search, AlertTriangle } from "lucide-react";
import { CitationBadge } from "@/components/CitationBadge";
import { api } from "@/lib/api";

interface UploadSummary {
  id: string;
  file_name: string;
  site_id: string;
  parse_status: string;
  parse_outcome: string | null;
  uploaded_at: string;
}

interface Finding {
  id: string;
  upload_id: string;
  site_id: string;
  zone_name: string;
  metric_name: string;
  threshold_band: "GOOD" | "WATCH" | "CRITICAL";
  interpretation_text: string;
  workforce_impact_text: string;
  recommended_action: string;
  rule_id: string;
  rule_version: string;
  citation_unit_ids: string;
  confidence_level: "HIGH" | "MEDIUM" | "LOW";
  source_currency_status: "CURRENT_VERIFIED" | "PARTIAL_EXTRACT" | "VERSION_UNVERIFIED" | "SUPERSEDED";
  benchmark_lane: string;
  created_at: string;
}

const BAND_COLORS = {
  GOOD: "bg-green-100 text-green-700 border-green-200",
  WATCH: "bg-yellow-100 text-yellow-700 border-yellow-200",
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
};

const CONFIDENCE_ICONS = {
  HIGH: "●",
  MEDIUM: "◐",
  LOW: "○",
};

function parseCitationIds(raw: string): string[] {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.includes("[") ? [] : [raw];
  }
}

export default function FindingsPanelPage() {
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string>("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupByZone, setGroupByZone] = useState(true);

  useEffect(() => {
    api.get<UploadSummary[]>("/api/uploads")
      .then((data) => setUploads(data))
      .catch(() => {});
  }, []);

  const fetchFindings = async (uploadId: string) => {
    if (!uploadId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<Finding[]>(`/api/uploads/${uploadId}/findings`);
      setFindings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch findings";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSelect = (uploadId: string) => {
    setSelectedUploadId(uploadId);
    fetchFindings(uploadId);
  };

  const warningCount = findings.filter(
    (f) => f.source_currency_status !== "CURRENT_VERIFIED"
  ).length;

  const criticalCount = findings.filter(
    (f) => f.threshold_band === "CRITICAL"
  ).length;

  if (uploads.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Findings Panel</h1>
          <p className="text-muted-foreground">
            Review rule-based findings and citations for uploaded data.
          </p>
        </div>
        <div className="rounded-md border bg-white p-8 text-center text-muted-foreground">
          <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No uploads available. Upload a CSV first to generate findings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Findings Panel</h1>
        <p className="text-muted-foreground">
          Review rule-based findings and citations for uploaded data.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={selectedUploadId} onValueChange={handleUploadSelect}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Select an upload" />
            </SelectTrigger>
            <SelectContent>
              {uploads.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.file_name} — {u.site_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {findings.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant={criticalCount > 0 ? "destructive" : "default"}>
              {criticalCount} Critical
            </Badge>
            {warningCount > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {warningCount} Advisory
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="rounded-md border bg-white p-8 text-center text-muted-foreground">
          Loading findings...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border bg-white p-8">
          <div className="flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Empty state after selection */}
      {selectedUploadId && !isLoading && !error && findings.length === 0 && (
        <div className="rounded-md border bg-white p-8 text-center text-muted-foreground">
          <p>No findings generated for this upload.</p>
        </div>
      )}

      {/* Findings Table */}
      {findings.length > 0 && (
        <div className="rounded-md border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Band</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Interpretation</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Citations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((finding) => (
                <TableRow
                  key={finding.id}
                  className={
                    finding.threshold_band === "CRITICAL"
                      ? "bg-red-50/30"
                      : undefined
                  }
                >
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={BAND_COLORS[finding.threshold_band]}
                    >
                      {finding.threshold_band}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {finding.zone_name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {finding.metric_name}
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    {finding.interpretation_text}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span title={`${finding.confidence_level} confidence`}>
                      {CONFIDENCE_ICONS[finding.confidence_level]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CitationBadge
                      citationUnitIds={parseCitationIds(finding.citation_unit_ids)}
                      ruleId={finding.rule_id}
                      ruleVersion={finding.rule_version}
                      sourceCurrencyStatus={finding.source_currency_status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
