"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface Upload {
  id: string;
  site_id: string;
  file_name: string;
  parse_status: string;
  parse_outcome: string | null;
}

export default function NewReportPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState("");
  const [reportType, setReportType] = useState<"ASSESSMENT" | "INTERVENTION_IMPACT">("ASSESSMENT");
  const [dataQualityStatement, setDataQualityStatement] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUploads();
  }, []);

  async function fetchUploads() {
    try {
      const data = await api.get<Upload[]>("/api/uploads");
      // Filter to only completed uploads
      setUploads(data.filter((u) => u.parse_status === "COMPLETE"));
    } catch (err) {
      setError("Failed to load uploads.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedUpload) {
      setError("Please select an upload.");
      return;
    }

    setSubmitting(true);
    try {
      const upload = uploads.find((u) => u.id === selectedUpload);
      const report = await api.post("/api/reports", {
        upload_id: selectedUpload,
        site_id: upload?.site_id || "",
        report_type: reportType,
        rule_version_used: "v1.0",
        citation_ids_used: "[]",
        data_quality_statement: dataQualityStatement,
      });
      router.push(`/analyst/reports/${(report as any).id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create report.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Report</h1>
        <p className="text-muted-foreground">
          Create a new Assessment or Intervention Impact report from a processed upload.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
          <CardDescription>
            Select a completed upload and choose the report type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="upload">Upload</Label>
              <Select value={selectedUpload} onValueChange={setSelectedUpload}>
                <SelectTrigger id="upload">
                  <SelectValue placeholder="Select an upload..." />
                </SelectTrigger>
                <SelectContent>
                  {uploads.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No completed uploads available
                    </SelectItem>
                  ) : (
                    uploads.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.file_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
                <SelectTrigger id="reportType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSESSMENT">Assessment</SelectItem>
                  <SelectItem value="INTERVENTION_IMPACT">Intervention Impact</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dqs">Data Quality Statement</Label>
              <Textarea
                id="dqs"
                placeholder="Describe any data quality notes..."
                value={dataQualityStatement}
                onChange={(e) => setDataQualityStatement(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting || !selectedUpload}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Draft
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
