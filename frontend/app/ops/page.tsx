"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UploadForm, UploadResult } from "@/components/UploadForm";
import { ReportTypeBadge } from "@/components/ReportTypeBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, UploadCloud, ListChecks, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

import { FindingsSummaryBar } from "@/components/findings/FindingsSummaryBar";
import { ZoneToggle } from "@/components/findings/ZoneToggle";
import { TimeSeriesChart } from "@/components/findings/TimeSeriesChart";
import { MetricToggle } from "@/components/findings/MetricToggle";
import { FindingDetailDialog } from "@/components/findings/FindingDetailDialog";
import { ActionList } from "@/components/findings/ActionList";
import { METRIC_KEYS } from "@/components/findings/MetricConfig";
import type { Finding } from "@/components/findings/types";

interface Reading {
  metric_name: string;
  zone_name: string;
  timestamp: string;
  metric_value: number;
  is_outlier: boolean;
}

interface Report {
  id: string;
  report_type: string;
  upload_id: string;
  site_id: string;
  reviewer_name: string | null;
  reviewer_status: string;
  generated_at: string;
}

const TABS = [
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "findings", label: "Findings", icon: ListChecks },
  { id: "reports", label: "Reports", icon: FileText },
] as const;

export default function OpsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "upload";
  const currentUploadId = searchParams.get("uploadId") || null;

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [activeZones, setActiveZones] = useState<Set<string>>(new Set());
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(METRIC_KEYS));

  useEffect(() => {
    if (activeTab === "findings" && currentUploadId) {
      api.get<Finding[]>(`/api/uploads/${currentUploadId}/findings`)
        .then(setFindings)
        .catch(console.error);
      api.get<{ metrics: Record<string, Reading[]> }>(`/api/uploads/${currentUploadId}/readings`)
        .then((data) => {
          const allReadings: Reading[] = [];
          for (const [metricName, readings] of Object.entries(data.metrics)) {
            for (const r of readings) {
              allReadings.push({ ...r, metric_name: metricName });
            }
          }
          setReadings(allReadings);
        })
        .catch(console.error);
    }
    if (activeTab === "reports" && currentUploadId) {
      api.get<Report[]>("/api/reports")
        .then((allReports) => setReports(allReports.filter((r) => r.upload_id === currentUploadId)))
        .catch(console.error);
    }
  }, [activeTab, currentUploadId]);

  // Zone color palette — FJ brand-aligned distinct colors
  const ZONE_COLORS = [
    "#8700E3", // FJ Purple
    "#37CA37", // FJ Green
    "#188BF6", // FJ Blue
    "#F6AD55", // Warning amber
    "#059669", // Teal
    "#0891B2", // Cyan
    "#6366f1", // Indigo
    "#e11d48", // Rose
    "#f59e0b", // Amber
    "#8b5cf6", // Violet
    "#14b8a6", // Teal alt
    "#3b82f6", // Blue alt
    "#dc2626", // Red
    "#a855f7", // Purple alt
    "#64748b", // Slate
    "#84cc16", // Lime
  ];

  // Compute all zones and zone colors from readings
  const allZones = useMemo(() => {
    const zones = new Set<string>();
    for (const r of readings) zones.add(r.zone_name);
    return Array.from(zones).sort();
  }, [readings]);

  const zoneColors = useMemo(() => {
    const colors: Record<string, string> = {};
    allZones.forEach((zone, i) => {
      colors[zone] = ZONE_COLORS[i % ZONE_COLORS.length];
    });
    return colors;
  }, [allZones]);

  const zonesWithData = useMemo(() => {
    const zones = new Set<string>();
    for (const r of readings) zones.add(r.zone_name);
    return zones;
  }, [readings]);

  // Compute metrics with data
  const metricsWithData = useMemo(() => {
    const metrics = new Set<string>();
    for (const r of readings) metrics.add(r.metric_name);
    return metrics;
  }, [readings]);

  // Sync activeZones when readings load
  useEffect(() => {
    if (allZones.length > 0 && activeZones.size === 0) {
      setActiveZones(new Set(allZones));
    }
  }, [allZones, activeZones]);

  const toggleZone = (zone: string) => {
    setActiveZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  };

  const toggleMetric = (key: string) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleUploadComplete = useCallback((result: UploadResult) => {
    setUploadResult(result);
    api.get<{ warnings: string | null }>(`/api/uploads/${result.upload_id}`)
      .then((details) => {
        if (details.warnings) {
          setUploadWarnings(details.warnings.split(", ").filter(Boolean));
        }
      })
      .catch(console.error);
    const params = new URLSearchParams();
    params.set("tab", "findings");
    params.set("uploadId", result.upload_id);
    router.push(`/ops?${params.toString()}`);
  }, [router]);

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (currentUploadId) params.set("uploadId", currentUploadId);
    router.push(`/ops?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[--fj-dark]">Operations</h1>
          <p className="text-sm text-fj-gray mt-1">Upload IAQ scans, review findings, and generate reports</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-[--border] pb-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 ${activeTab === tab.id ? "" : "text-fj-gray"}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <div className="space-y-4">
          <UploadForm onUploadComplete={handleUploadComplete} />

          {uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Upload Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">File:</span>
                  <span className="text-sm font-medium">{uploadResult.file_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Report Type:</span>
                  <ReportTypeBadge type={uploadResult.report_type} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Parse Outcome:</span>
                  <Badge variant={uploadResult.parse_outcome === "FAIL" ? "destructive" : "secondary"}>
                    {uploadResult.parse_outcome || "N/A"}
                  </Badge>
                </div>
                {uploadWarnings.length > 0 && (
                  <div className="mt-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive mb-1">Parse Warnings:</p>
                    <ul className="text-sm text-destructive/90 space-y-1">
                      {uploadWarnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("tab", "findings");
                    params.set("uploadId", uploadResult.upload_id);
                    router.push(`/ops?${params.toString()}`);
                  }}
                  className="mt-2"
                >
                  View Findings
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Findings Tab */}
      {activeTab === "findings" && (
        <div className="space-y-6">
          {!currentUploadId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p>No upload selected. Upload a CSV first to see findings.</p>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("upload")} className="mt-4">
                  Go to Upload
                </Button>
              </CardContent>
            </Card>
          ) : findings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p>No findings found for this upload.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <FindingsSummaryBar findings={findings} />

              {/* Selector controls */}
              <div className="space-y-3 p-4 rounded-xl bg-white border border-[--border] shadow-sm">
                <ZoneToggle
                  zones={allZones}
                  activeZones={activeZones}
                  zonesWithData={zonesWithData}
                  zoneColors={zoneColors}
                  onToggle={toggleZone}
                />
                <MetricToggle
                  activeMetrics={activeMetrics}
                  metricsWithData={metricsWithData}
                  onToggle={toggleMetric}
                />
              </div>

              {/* Time-series charts per active metric */}
              <div className="space-y-6">
                {METRIC_KEYS.map((key) => {
                  if (!activeMetrics.has(key)) return null;
                  const metricReadings = readings.filter(
                    (r) => r.metric_name === key
                  );
                  // Show chart even if no data (empty state)
                  return (
                    <TimeSeriesChart
                      key={key}
                      metricKey={key}
                      readings={metricReadings}
                      activeZones={activeZones}
                      zoneColors={zoneColors}
                      onReadingClick={() => {
                        // Find closest finding for this zone+metric
                        const finding = findings.find(
                          (f) => f.metric_name === key
                        );
                        if (finding) setSelectedFinding(finding);
                      }}
                    />
                  );
                })}
              </div>

              <ActionList findings={findings} onActionClick={(f) => setSelectedFinding(f)} />
            </>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p>No reports generated yet.</p>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("findings")} className="mt-4">
                  Go to Findings
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <ReportTypeBadge type={report.report_type as "ASSESSMENT" | "INTERVENTION_IMPACT"} />
                      <Badge variant={report.reviewer_status === "approved" ? "default" : "secondary"}>
                        {report.reviewer_status}
                      </Badge>
                      <span className="text-sm text-muted-foreground ml-auto">
                        {new Date(report.generated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <FindingDetailDialog finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
    </div>
  );
}
