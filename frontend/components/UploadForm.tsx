"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UploadCloud, FileText, X, AlertCircle, Loader2 } from "lucide-react";
import { api, apiClient, PreviewUploadResponse, ConfirmUploadResponse, ConfirmUploadChild, SiteListingRow } from "@/lib/api";
import { CustomerLookup } from "@/components/CustomerLookup";
import { ZoneAssignment } from "@/components/ZoneAssignment";

export interface UploadResult {
  upload_id: string;
  file_name: string;
  site_id: string;
  tenant_id: string | null;
  parse_status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  parse_outcome: "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | null;
  warnings: string | null;
  uploaded_at: string;
  failed_row_count: number;
  report_type: "ASSESSMENT" | "INTERVENTION_IMPACT";
  standards_evaluated?: string[];
  // R1-08: Dedup fields
  is_duplicate?: boolean;
  duplicate_of?: string;
}

export interface BatchUploadResult {
  batch_id: string;
  children: ConfirmUploadChild[];
}

interface UploadFormProps {
  onUploadComplete?: (result: UploadResult | BatchUploadResult) => void;
}

type UploadStep = "lookup" | "register" | "file-select" | "preview" | "zone-assignment" | "uploading" | "complete";

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // R1-07: Two-step flow
  const [step, setStep] = useState<UploadStep>("lookup");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedTenantName, setSelectedTenantName] = useState<string | null>(null);

  // Registration form state
  const [regClientName, setRegClientName] = useState("");
  const [regContactEmail, setRegContactEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // R1-08: Duplicate detection state
  const [duplicateResult, setDuplicateResult] = useState<UploadResult | null>(null);

  // R1-10: Preview and zone assignment state
  const [previewResult, setPreviewResult] = useState<PreviewUploadResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [existingSites, setExistingSites] = useState<{ id: string; name: string }[]>([]);

  // Fetch existing sites for zone assignment dropdown
  useEffect(() => {
    if (step === "preview" || step === "zone-assignment") {
      apiClient.getSiteListing()
        .then((rows) => {
          const sites = rows.map((r) => ({ id: r.site_id, name: r.site_name }));
          setExistingSites(sites);
        })
        .catch(console.error);
    }
  }, [step]);

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

  const isFormValid = file;

  // R1-07: Tenant selection and registration
  const handleTenantSelected = (tenantId: string, clientName: string) => {
    setSelectedTenantId(tenantId);
    setSelectedTenantName(clientName);
    setStep("file-select");
  };

  const handleRegisterNew = () => {
    setStep("register");
  };

  const handleRegistrationSubmit = async () => {
    if (!regClientName || !regContactEmail) return;

    setIsRegistering(true);
    setError(null);
    try {
      const result = await apiClient.createTenant({
        client_name: regClientName,
        contact_email: regContactEmail,
      });
      setSelectedTenantId(result.id);
      setSelectedTenantName(result.client_name);
      setStep("file-select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register customer");
    } finally {
      setIsRegistering(false);
    }
  };

  // R1-10: Preview zones from selected file
  const handlePreview = async () => {
    if (!file || !selectedTenantId) return;

    setIsPreviewing(true);
    setError(null);
    try {
      const result = await apiClient.previewUpload(file, selectedTenantId);
      setPreviewResult(result);

      if (result.is_duplicate) {
        setError("This CSV has been uploaded before.");
        setDuplicateResult({
          upload_id: "",
          file_name: result.file_name,
          site_id: "",
          tenant_id: selectedTenantId,
          parse_status: "COMPLETE",
          parse_outcome: null,
          warnings: null,
          uploaded_at: new Date().toISOString(),
          failed_row_count: 0,
          report_type: "ASSESSMENT",
          is_duplicate: true,
        });
        setIsPreviewing(false);
        return;
      }

      // Single zone → skip zone assignment, proceed to direct upload
      if (result.zones.length === 1) {
        handleDirectUpload();
      } else {
        // Multiple zones → show zone assignment
        setStep("zone-assignment");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsPreviewing(false);
    }
  };

  // R1-10: Direct upload for single-zone CSVs
  const handleDirectUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedTenantId) {
        formData.append("tenant_id", selectedTenantId);
      }

      const response = await api.upload<UploadResult>("/api/uploads", formData);

      if (response.is_duplicate) {
        setDuplicateResult(response);
        setIsUploading(false);
        return;
      }

      onUploadComplete?.(response);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      if (!duplicateResult) {
        setIsUploading(false);
      }
    }
  };

  // R1-10: Confirm multi-zone upload
  const handleZoneAssignmentSubmit = async (zoneMapping: Record<string, string>) => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const result = await apiClient.confirmUpload(
        file,
        selectedTenantId,
        zoneMapping,
        null,
      );

      onUploadComplete?.(result);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleForceUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setDuplicateResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("force", "true");
      if (selectedTenantId) {
        formData.append("tenant_id", selectedTenantId);
      }

      const response = await api.upload<UploadResult>("/api/uploads", formData);

      onUploadComplete?.(response);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setStep("lookup");
    setSelectedTenantId(null);
    setSelectedTenantName(null);
    setRegClientName("");
    setRegContactEmail("");
    setPreviewResult(null);
    setDuplicateResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        {/* Step: Customer Lookup */}
        {step === "lookup" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Search for an existing customer or register a new one.
            </p>
            <CustomerLookup
              onTenantSelected={handleTenantSelected}
              onRegisterNew={handleRegisterNew}
            />
          </div>
        )}

        {/* Step: Register New Customer */}
        {step === "register" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Register a new customer — only name and email required.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Client Name *</label>
                <Input
                  type="text"
                  value={regClientName}
                  onChange={(e) => setRegClientName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Contact Email *</label>
                <Input
                  type="email"
                  value={regContactEmail}
                  onChange={(e) => setRegContactEmail(e.target.value)}
                  placeholder="e.g., contact@acme.com"
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleRegistrationSubmit}
                disabled={!regClientName || !regContactEmail || isRegistering}
              >
                {isRegistering ? "Registering..." : "Register & Continue"}
              </Button>
              <Button variant="ghost" onClick={() => { setStep("lookup"); setError(null); }}>
                Back to Search
              </Button>
            </div>
          </div>
        )}

        {/* Step: File Select + Standards */}
        {step === "file-select" && (
          <div className="space-y-4">
            {selectedTenantName && (
              <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                <p className="text-sm font-medium text-primary">
                  Uploading for: {selectedTenantName}
                </p>
              </div>
            )}

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
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handlePreview}
              disabled={!isFormValid || isPreviewing}
              className="w-full mt-4"
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing CSV...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload & Analyze
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step: Zone Assignment (multi-zone) */}
        {step === "zone-assignment" && previewResult && (
          <ZoneAssignment
            zones={previewResult.zones}
            existingSites={existingSites}
            onSubmit={handleZoneAssignmentSubmit}
            onCancel={() => {
              setStep("file-select");
              setPreviewResult(null);
              setError(null);
            }}
          />
        )}

        {/* Step: Uploading */}
        {step === "uploading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Processing CSV...</p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && (
          <div className="text-center py-8">
            <p className="text-lg font-medium text-green-600">Upload complete!</p>
          </div>
        )}

        {/* R1-08: Duplicate Detection Dialog */}
        {duplicateResult && (
          <Dialog open={true} onOpenChange={() => setDuplicateResult(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                  Duplicate Upload Detected
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This CSV file was previously uploaded on{" "}
                  <span className="font-medium">
                    {new Date(duplicateResult.uploaded_at).toLocaleDateString()}
                  </span>
                  {duplicateResult.file_name && (
                    <> — <code className="text-xs bg-muted px-1 rounded">{duplicateResult.file_name}</code></>
                  )}
                  .
                </p>
                <p className="text-sm text-muted-foreground">
                  Would you like to view the existing findings instead?
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDuplicateResult(null);
                    setFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleForceUpload}
                  disabled={isUploading}
                >
                  {isUploading ? "Uploading..." : "Upload Anyway"}
                </Button>
                <Button
                  onClick={() => {
                    onUploadComplete?.(duplicateResult);
                    resetForm();
                  }}
                >
                  View Existing Findings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
