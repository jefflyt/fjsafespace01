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
import { cn } from "@/lib/utils";

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
  const [uploadSiteId, setUploadSiteId] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [approvingReportId, setApprovingReportId] = useState<string | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "findings" && currentUploadId) {
      api.get<Finding[]>(`/api/uploads/${currentUploadId}/findings`)
        .then((data) => {
          setFindings(data);
          if (data.length > 0 && data[0].site_id) {
            setUploadSiteId(data[0].site_id);
          }
        })
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

  // Zone color palette — systematic HSL distribution for distinct, scalable colors
  const getZoneColor = (index: number): string => {
    const hue = (260 + index * 30) % 360;
    return `hsl(${hue}, 65%, 50%)`;
  };

  // Compute all zones and zone colors from readings
  const allZones = useMemo(() => {
    const zones = new Set<string>();
    for (const r of readings) zones.add(r.zone_name);
    return Array.from(zones).sort();
  }, [readings]);

  const zoneColors = useMemo(() => {
    const colors: Record<string, string> = {};
    allZones.forEach((zone, i) => {
      colors[zone] = getZoneColor(i);
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

  const handleGenerateReport = async () => {
    if (!currentUploadId || !uploadSiteId) return;
    setIsGeneratingReport(true);
    setQaError(null);
    try {
      await api.post("/api/reports", {
        upload_id: currentUploadId,
        site_id: uploadSiteId,
        report_type: "ASSESSMENT",
      });
      // Refresh reports list
      const allReports = await api.get<Report[]>("/api/reports");
      setReports(allReports.filter((r) => r.upload_id === currentUploadId));
    } catch (err) {
      console.error("Failed to generate report:", err);
      alert(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleApproveReport = async (reportId: string) => {
    setApprovingReportId(reportId);
    setQaError(null);
    try {
      const result = await api.post(`/api/reports/${reportId}/approve`, {
        reviewer_name: "Jay Choy",
      });
      if (result.success) {
        const allReports = await api.get<Report[]>("/api/reports");
        setReports(allReports.filter((r) => r.upload_id === currentUploadId));
      } else {
        setQaError(result.error || "QA gates failed");
      }
    } catch (err) {
      console.error("Failed to approve report:", err);
      alert(err instanceof Error ? err.message : "Failed to approve report");
    } finally {
      setApprovingReportId(null);
    }
  };

  const handleViewPdf = async (reportId: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/reports/${reportId}/pdf`;
    window.open(url, "_blank");
  };

  const handlePreviewReport = async (reportId: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/reports/${reportId}/preview`;
    const response = await api.get<{ html: string }>(`/api/reports/${reportId}/preview`);
    const blob = new Blob([response.html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
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
      {/* Page Header with tech accent bar */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Operations</h1>
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37CA37] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#37CA37]"></span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Live</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Upload IAQ scans, review findings, and generate reports</p>
          {/* Accent bar */}
          <div className="h-0.5 w-24 bg-gradient-to-r from-primary to-transparent mt-3 rounded-full"></div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-2 relative">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-2 transition-all duration-200", activeTab === tab.id ? "" : "text-muted-foreground hover:text-foreground")}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
        {/* Scan line effect on active tab bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-primary animate-shimmer w-1/4 rounded-full"></div>
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
              <div className="space-y-4 p-4 rounded-lg bg-card border border-border shadow-sm">
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
              <CardContent className="py-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">No reports generated yet.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isGeneratingReport || !uploadSiteId}
                    onClick={handleGenerateReport}
                  >
                    {isGeneratingReport ? (
                      <>
                        <span className="animate-pulse mr-2">...</span>
                        Generating...
                      </>
                    ) : (
                      <>
                        Generate Report
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("findings")}>
                    Go to Findings
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {qaError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">{qaError}</p>
                </div>
              )}
              {reports.map((report) => {
                const isApproved = report.reviewer_status === "APPROVED";
                const isDraft = report.reviewer_status === "DRAFT_GENERATED" || report.reviewer_status === "IN_REVIEW";
                return (
                  <Card key={report.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <ReportTypeBadge type={report.report_type as "ASSESSMENT" | "INTERVENTION_IMPACT"} />
                        <Badge variant={isApproved ? "default" : "secondary"}>
                          {report.reviewer_status}
                        </Badge>
                        <span className="text-sm text-muted-foreground ml-auto">
                          {new Date(report.generated_at).toLocaleDateString()}
                        </span>
                        {isDraft && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewReport(report.id)}
                          >
                            Preview
                          </Button>
                        )}
                        {isDraft && (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={approvingReportId === report.id}
                            onClick={() => handleApproveReport(report.id)}
                          >
                            {approvingReportId === report.id ? "Approving..." : "Approve"}
                          </Button>
                        )}
                        {isApproved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPdf(report.id)}
                          >
                            View PDF
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isGeneratingReport}
                  onClick={handleGenerateReport}
                >
                  {isGeneratingReport ? "Generating..." : "Generate Another Report"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <FindingDetailDialog finding={selectedFinding} onClose={() => setSelectedFinding(null)} />
    </div>
  );
}
