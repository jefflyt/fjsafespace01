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
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

export interface UploadRecord {
  id: string;
  file_name: string;
  site_id: string;
  parse_status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  parse_outcome: "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | null;
  uploaded_at: string;
}

interface UploadQueueTableProps {
  refreshTrigger?: number;
}

export function UploadQueueTable({ refreshTrigger }: UploadQueueTableProps) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<UploadRecord[]>("/api/uploads");
      setUploads(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch uploads";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, [refreshTrigger]);

  const getStatusBadge = (status: UploadRecord["parse_status"]) => {
    const variants = {
      PENDING: "secondary",
      PROCESSING: "outline",
      COMPLETE: "default",
      FAILED: "destructive",
    } as const;

    const icons = {
      PENDING: <FileText className="h-3 w-3" />,
      PROCESSING: <RefreshCw className="h-3 w-3 animate-spin" />,
      COMPLETE: <CheckCircle2 className="h-3 w-3" />,
      FAILED: <AlertCircle className="h-3 w-3" />,
    };

    return (
      <Badge variant={variants[status]} className="flex items-center gap-1">
        {icons[status]}
        {status}
      </Badge>
    );
  };

  const getOutcomeBadge = (outcome: UploadRecord["parse_outcome"]) => {
    if (!outcome) return <span className="text-muted-foreground text-xs">—</span>;

    const variants = {
      PASS: "default",
      PASS_WITH_WARNINGS: "secondary",
      FAIL: "destructive",
    } as const;

    const icons = {
      PASS: <CheckCircle2 className="h-3 w-3" />,
      PASS_WITH_WARNINGS: <AlertCircle className="h-3 w-3" />,
      FAIL: <AlertCircle className="h-3 w-3" />,
    };

    return (
      <Badge variant={variants[outcome]} className="flex items-center gap-1">
        {icons[outcome]}
        {outcome}
      </Badge>
    );
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="rounded-md border bg-white p-8 text-center text-muted-foreground">
        Loading uploads...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border bg-white p-8">
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
        <Button onClick={fetchUploads} variant="outline" size="sm" className="mt-4 mx-auto block">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="rounded-md border bg-white p-8 text-center text-muted-foreground">
        <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <p>No uploads yet. Upload your first CSV to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Upload History</h2>
        <Button onClick={fetchUploads} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Site ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Uploaded At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploads.map((upload) => (
              <TableRow key={upload.id}>
                <TableCell className="font-medium">{upload.file_name}</TableCell>
                <TableCell className="text-sm">{upload.site_id}</TableCell>
                <TableCell>{getStatusBadge(upload.parse_status)}</TableCell>
                <TableCell>{getOutcomeBadge(upload.parse_outcome)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(upload.uploaded_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
