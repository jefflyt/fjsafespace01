"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { ReportTypeBadge } from "@/components/ReportTypeBadge";

interface Report {
  id: string;
  report_type: "ASSESSMENT" | "INTERVENTION_IMPACT";
  upload_id: string;
  reviewer_status: string;
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

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const data = await api.get<Report[]>("/api/reports");
      setReports(data);
    } catch {
      // Ignore errors for now
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and review Assessment and Intervention Impact reports.
          </p>
        </div>
        <Link href="/analyst/reports/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-md border bg-white p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No reports yet. Create your first report from a completed upload.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left font-medium px-4 py-2">Report</th>
                <th className="text-left font-medium px-4 py-2">Type</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-left font-medium px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">
                    <Link
                      href={`/analyst/reports/${r.id}`}
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {r.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <ReportTypeBadge type={r.report_type} />
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={STATUS_COLORS[r.reviewer_status]}>
                      {STATUS_LABELS[r.reviewer_status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(r.generated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
