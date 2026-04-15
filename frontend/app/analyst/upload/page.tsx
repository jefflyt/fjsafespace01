"use client";

import { useState } from "react";
import { UploadForm, UploadResult } from "@/components/UploadForm";
import { UploadQueueTable } from "@/components/UploadQueueTable";

export default function UploadQueuePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = (result: UploadResult) => {
    // Trigger a refresh of the queue table
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Queue</h1>
        <p className="text-muted-foreground">
          Upload uHoo CSV files and monitor their processing status.
        </p>
      </div>

      <UploadForm onUploadComplete={handleUploadComplete} />
      <UploadQueueTable refreshTrigger={refreshKey} />
    </div>
  );
}
