"use client";

import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { apiClient, ReadingsResponse } from "@/lib/api";

interface ScanDataExportProps {
  uploadId: string;
}

export function ScanDataExport({ uploadId }: ScanDataExportProps) {
  const handleDownloadCSV = async () => {
    try {
      const data = await apiClient.getUploadReadings(uploadId);
      const csv = buildCSV(data);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scan-data-${uploadId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download CSV:", err);
    }
  };

  const handleGeneratePDF = () => {
    // Deferred stub — R2
    alert("PDF export coming soon.");
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
        <Download className="mr-1.5 h-4 w-4" />
        Download CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleGeneratePDF} disabled>
        <FileText className="mr-1.5 h-4 w-4" />
        Generate Summary PDF
      </Button>
    </div>
  );
}

function buildCSV(data: ReadingsResponse): string {
  const rows = ["timestamp,zone_name,metric_name,value,is_outlier"];
  for (const [metricName, readings] of Object.entries(data.metrics)) {
    for (const r of readings) {
      rows.push(
        `${r.timestamp},${r.zone_name},${metricName},${r.metric_value},${r.is_outlier}`
      );
    }
  }
  return rows.join("\n");
}
