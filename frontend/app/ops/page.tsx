"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UploadForm, UploadResult } from "@/components/UploadForm";
import { SiteOverviewCard } from "@/components/SiteOverviewCard";
import { ZoneDetailView } from "@/components/ZoneDetailView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, UploadCloud, ListChecks, ArrowRight, Loader2 } from "lucide-react";
import { api, apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Finding } from "@/components/findings/types";
import type { SiteStandard, MetricPreferences, SiteStandard as SiteStandardType } from "@/lib/api";

const TABS = [
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "findings", label: "Findings", icon: ListChecks },
  { id: "reports", label: "Reports", icon: FileText },
] as const;

interface Reading {
  metric_name: string;
  zone_name: string;
  timestamp: string;
  metric_value: number;
  is_outlier: boolean;
}

function OpsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "upload";
  const currentUploadId = searchParams.get("uploadId") || null;

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  // R1-05: Findings tab state
  const [findings, setFindings] = useState<Finding[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [standards, setStandards] = useState<SiteStandard[]>([]);
  const [metricPreferences, setMetricPreferences] = useState<MetricPreferences>({
    site_id: "",
    active_metrics: [],
    alert_threshold_overrides: {},
  });
  const [loadingFindings, setLoadingFindings] = useState(false);

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (currentUploadId) params.set("uploadId", currentUploadId);
    router.push(`/ops?${params.toString()}`);
  };

  const handleUploadComplete = useCallback(
    (result: UploadResult) => {
      setUploadResult(result);
      api
        .get<{ warnings: string | null }>(`/api/uploads/${result.upload_id}`)
        .then((details) => {
          if (details.warnings) {
            setUploadWarnings(
              details.warnings.split(", ").filter(Boolean)
            );
          }
        })
        .catch(console.error);
      const params = new URLSearchParams();
      params.set("tab", "findings");
      params.set("uploadId", result.upload_id);
      router.push(`/ops?${params.toString()}`);
    },
    [router]
  );

  // R1-05: Fetch findings data when on findings tab
  useEffect(() => {
    if (activeTab !== "findings" || !currentUploadId) return;

    setLoadingFindings(true);

    Promise.all([
      api.get<{ findings: Finding[] }>(`/api/uploads/${currentUploadId}/findings`),
      api.get<{ readings: Reading[] }>(`/api/uploads/${currentUploadId}/readings`),
    ])
      .then(([findingsRes, readingsRes]) => {
        setFindings(findingsRes.findings || []);
        setReadings(readingsRes.readings || []);

        // Get site_id from first finding
        if (findingsRes.findings && findingsRes.findings.length > 0) {
          const siteId = findingsRes.findings[0].site_id;
          return Promise.all([
            apiClient.getSitesStandards(siteId),
            apiClient.getSitesMetricPreferences(siteId),
          ]).then(([standardsRes, prefsRes]) => {
            if (standardsRes) setStandards(standardsRes.standards || []);
            if (prefsRes) setMetricPreferences(prefsRes);
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoadingFindings(false));
  }, [activeTab, currentUploadId]);

  // Group findings by zone
  const zones = [...new Set(findings.map((f) => f.zone_name))];

  // Derive site overview from findings
  const siteOverview = (() => {
    if (findings.length === 0) return null;

    const siteName = "Site"; // Could be fetched from site API
    const lastUpdated = findings[0]?.created_at ?? new Date().toISOString();

    // Group standard scores
    const standardScoresMap: Record<string, { scores: number[]; outcomes: string[]; title: string }> = {};
    for (const f of findings) {
      const stdId = f.standard_id ?? "default";
      if (!standardScoresMap[stdId]) {
        standardScoresMap[stdId] = { scores: [], outcomes: [], title: f.standard_title ?? "Standard" };
      }
      // Simple score: GOOD=100, WATCH=50, CRITICAL=0
      const score = f.threshold_band === "GOOD" ? 100 : f.threshold_band === "WATCH" ? 50 : 0;
      standardScoresMap[stdId].scores.push(score);
      standardScoresMap[stdId].outcomes.push(f.threshold_band === "GOOD" ? "PASS" : f.threshold_band === "WATCH" ? "INSUFFICIENT_EVIDENCE" : "FAIL");
    }

    const standardScores = Object.entries(standardScoresMap).map(([sourceId, data]) => ({
      sourceId,
      title: data.title,
      score: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : null,
      outcome: data.outcomes.includes("FAIL") ? "FAIL" : data.outcomes.every((o) => o === "PASS") ? "PASS" : "INSUFFICIENT_EVIDENCE",
    }));

    const overallWellness = standardScores.length > 0
      ? standardScores.reduce((sum, s) => sum + (s.score ?? 0), 0) / standardScores.length
      : null;

    // Top insight: first CRITICAL finding
    const topInsight = findings.find((f) => f.threshold_band === "CRITICAL")
      ? `${findings.find((f) => f.threshold_band === "CRITICAL")!.metric_name} elevated in ${findings.find((f) => f.threshold_band === "CRITICAL")!.zone_name}`
      : undefined;

    return { siteName, lastUpdated, standardScores, overallWellness, topInsight };
  })();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload IAQ scans and review site health
          </p>
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
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              activeTab === tab.id
                ? ""
                : "text-muted-foreground hover:text-foreground"
            )}
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
                  <span className="text-sm font-medium">
                    {uploadResult.file_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Report Type:
                  </span>
                  <Badge variant="secondary">
                    {uploadResult.report_type || "N/A"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Parse Outcome:
                  </span>
                  <Badge
                    variant={
                      uploadResult.parse_outcome === "FAIL"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {uploadResult.parse_outcome || "N/A"}
                  </Badge>
                </div>
                {uploadResult.standards_evaluated && uploadResult.standards_evaluated.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Standards:
                    </span>
                    <div className="flex gap-1">
                      {uploadResult.standards_evaluated.map((id) => (
                        <Badge key={id} variant="outline" className="text-xs">
                          {standards.find((s) => s.source_id === id)?.title ?? id.slice(0, 8)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {uploadWarnings.length > 0 && (
                  <div className="mt-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive mb-1">
                      Parse Warnings:
                    </p>
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
                  View Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Findings Tab — R1-05: Human-friendly dashboard */}
      {activeTab === "findings" && (
        <div className="space-y-6">
          {loadingFindings ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Loading dashboard...</p>
              </CardContent>
            </Card>
          ) : !currentUploadId ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">No scan selected</p>
                <p className="text-sm mt-2">
                  Upload a CSV to get started.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("upload")}
                  className="mt-4"
                >
                  Go to Upload
                </Button>
              </CardContent>
            </Card>
          ) : findings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">No findings for this scan</p>
                <p className="text-sm mt-2">
                  All metrics are within acceptable ranges.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Site Overview */}
              {siteOverview && (
                <SiteOverviewCard
                  siteName={siteOverview.siteName}
                  lastUpdated={siteOverview.lastUpdated}
                  scanMode="adhoc"
                  standardScores={siteOverview.standardScores}
                  topInsight={siteOverview.topInsight}
                  overallWellness={siteOverview.overallWellness}
                />
              )}

              {/* Zone Details */}
              {zones.map((zone) => (
                <ZoneDetailView
                  key={zone}
                  zoneName={zone}
                  findings={findings}
                  readings={readings}
                  standards={standards}
                  siteId={findings[0]?.site_id ?? ""}
                  metricPreferences={metricPreferences}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Reports Tab — placeholder (planned for R3) */}
      {activeTab === "reports" && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Reports under construction</p>
            <p className="text-sm mt-2">
              PDF report generation is planned for R3.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("upload")}
              className="mt-4"
            >
              Go to Upload
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function OpsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <OpsContent />
    </Suspense>
  );
}
