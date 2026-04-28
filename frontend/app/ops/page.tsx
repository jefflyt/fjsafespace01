"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UploadForm, UploadResult } from "@/components/UploadForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, UploadCloud, ListChecks, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "findings", label: "Findings", icon: ListChecks },
  { id: "reports", label: "Reports", icon: FileText },
] as const;

function OpsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "upload";
  const currentUploadId = searchParams.get("uploadId") || null;

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

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

      {/* Findings Tab — placeholder (to be rebuilt for PSD-R1) */}
      {activeTab === "findings" && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Dashboard view under construction</p>
            <p className="text-sm mt-2">
              The human-friendly metric card dashboard is being built for PSD-R1.
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

      {/* Reports Tab — placeholder (to be rebuilt for PSD-R1) */}
      {activeTab === "reports" && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Reports under construction</p>
            <p className="text-sm mt-2">
              PDF report generation is planned for PSD-R3.
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
