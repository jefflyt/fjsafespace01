"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UploadForm, UploadResult } from "@/components/UploadForm";
import { ReportTypeBadge } from "@/components/ReportTypeBadge";
import { CitationBadge } from "@/components/CitationBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, UploadCloud, ListChecks, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface Finding {
  id: string;
  upload_id: string;
  site_id: string;
  zone_name: string;
  metric_name: string;
  threshold_band: string;
  interpretation_text: string;
  workforce_impact_text: string;
  recommended_action: string;
  rule_id: string;
  rule_version: string;
  citation_unit_ids: string;
  confidence_level: string;
  source_currency_status: string;
  benchmark_lane: string;
  created_at: string;
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
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (activeTab === "findings" && currentUploadId) {
      api.get<Finding[]>(`/api/uploads/${currentUploadId}/findings`)
        .then(setFindings)
        .catch(console.error);
    }
    if (activeTab === "reports") {
      api.get<Report[]>("/api/reports")
        .then(setReports)
        .catch(console.error);
    }
  }, [activeTab, currentUploadId]);

  const handleUploadComplete = useCallback((result: UploadResult) => {
    setUploadResult(result);
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
      <div>
        <h1 className="text-2xl font-bold">Operations</h1>
        <p className="text-muted-foreground">Upload, review findings, and generate reports</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2"
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
        <div className="space-y-4">
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
                <p>No findings found for this upload.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {findings.map((finding) => (
                <Card key={finding.id}>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-medium">{finding.metric_name}</span>
                      <Badge variant="outline">{finding.zone_name}</Badge>
                      <Badge
                        variant={
                          finding.threshold_band.includes("CRITICAL")
                            ? "destructive"
                            : finding.threshold_band.includes("WARNING")
                            ? "secondary"
                            : "default"
                        }
                      >
                        {finding.threshold_band}
                      </Badge>
                      <CitationBadge
                        citationUnitId={finding.citation_unit_ids}
                        ruleVersion={finding.rule_version}
                        sourceCurrencyStatus={finding.source_currency_status}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{finding.interpretation_text}</p>
                    {finding.recommended_action && (
                      <p className="text-sm mt-1">
                        <span className="font-medium">Action: </span>
                        {finding.recommended_action}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
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
                      <ReportTypeBadge type={report.report_type} />
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
    </div>
  );
}
