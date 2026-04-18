"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { ReportTypeBadge } from "@/components/ReportTypeBadge";
import { QAChecklist } from "@/components/QAChecklist";

interface Report {
  id: string;
  report_type: "ASSESSMENT" | "INTERVENTION_IMPACT";
  upload_id: string;
  site_id: string;
  report_version: number;
  rule_version_used: string;
  citation_ids_used: string;
  reviewer_name: string | null;
  reviewer_status: string;
  reviewer_approved_at: string | null;
  qa_checks: string;
  data_quality_statement: string | null;
  certification_outcome: string | null;
  pdf_url: string | null;
  generated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT_GENERATED: "Draft",
  IN_REVIEW: "In Review",
  REVISION_REQUIRED: "Revision Required",
  APPROVED: "Approved",
  EXPORTED: "Exported",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT_GENERATED: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-blue-100 text-blue-700",
  REVISION_REQUIRED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  EXPORTED: "bg-purple-100 text-purple-700",
};

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  async function fetchReport() {
    try {
      const data = await api.get<Report>(`/api/reports/${reportId}`);
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }

  const qaChecks = report ? JSON.parse(report.qa_checks || "{}") : {};

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error || "Report not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/analyst/reports")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Report {report.id.slice(0, 8)}</h1>
          <div className="flex items-center gap-2 mt-1">
            <ReportTypeBadge type={report.report_type} />
            <Badge className={STATUS_COLORS[report.reviewer_status]}>
              {STATUS_LABELS[report.reviewer_status] || report.reviewer_status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Report Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Upload ID</span>
              <span className="font-mono">{report.upload_id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Site ID</span>
              <span className="font-mono">{report.site_id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Report Version</span>
              <span>{report.report_version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rule Version</span>
              <span className="font-mono">{report.rule_version_used}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Generated At</span>
              <span>{new Date(report.generated_at).toLocaleDateString()}</span>
            </div>
            {report.reviewer_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reviewer</span>
                <span>{report.reviewer_name}</span>
              </div>
            )}
            {report.reviewer_approved_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved At</span>
                <span>{new Date(report.reviewer_approved_at).toLocaleDateString()}</span>
              </div>
            )}
            {report.certification_outcome && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outcome</span>
                <Badge variant="outline">{report.certification_outcome.replace(/_/g, " ")}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {report.data_quality_statement && (
          <Card>
            <CardHeader>
              <CardTitle>Data Quality Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{report.data_quality_statement}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {report.reviewer_status !== "APPROVED" && report.reviewer_status !== "EXPORTED" && (
        <QAChecklist
          reportId={report.id}
          qaChecks={qaChecks}
          onUpdate={fetchReport}
        />
      )}

      {report.reviewer_status === "APPROVED" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Report Approved</CardTitle>
            <CardDescription>
              This report has passed all QA gates and is ready for export.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
