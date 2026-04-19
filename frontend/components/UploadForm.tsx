"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, FileText, X, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export interface UploadResult {
  upload_id: string;
  file_name: string;
  site_id: string;
  parse_status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  parse_outcome: "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | null;
  warnings: string | null;
  uploaded_at: string;
  failed_row_count: number;
  report_type: "ASSESSMENT" | "INTERVENTION_IMPACT";
}

interface UploadFormProps {
  onUploadComplete?: (result: UploadResult) => void;
}

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [siteId, setSiteId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
      } else {
        setError("Only CSV files are allowed");
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Only CSV files are allowed");
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !siteId) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      // FastAPI expects query params for non-file fields
      const response = await api.upload<UploadResult>(
        `/api/uploads?site_id=${encodeURIComponent(siteId)}`,
        formData
      );

      onUploadComplete?.(response);
      setFile(null);
      setSiteId("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white p-6">
        <h2 className="text-lg font-semibold mb-4">Upload uHoo CSV</h2>

        {/* Site ID Input */}
        <div className="mb-4">
          <Label htmlFor="site-id">Site ID</Label>
          <Input
            id="site-id"
            placeholder="Enter site ID"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative overflow-hidden rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          style={{
            backgroundImage: dragActive
              ? undefined
              : "radial-gradient(circle, hsl(var(--muted)) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div className="text-left">
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
                className="ml-auto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <label htmlFor="file-upload" className="cursor-pointer">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">
                Drop your CSV here, or{" "}
                <span className="text-primary underline">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                uHoo export format (.csv)
              </p>
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Button */}
        <Button
          onClick={handleUpload}
          disabled={!file || !siteId || isUploading}
          className="w-full mt-4"
        >
          {isUploading ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Uploading & Parsing...
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload & Parse
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
