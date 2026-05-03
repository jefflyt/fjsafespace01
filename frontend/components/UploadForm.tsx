"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, FileText, X, AlertCircle } from "lucide-react";
import { api, apiClient } from "@/lib/api";
import { CustomerLookup } from "@/components/CustomerLookup";

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

interface ReferenceSource {
  id: string;
  title: string;
  publisher: string;
  source_currency_status: string;
}

interface UploadFormProps {
  onUploadComplete?: (result: UploadResult) => void;
}

type UploadStep = "lookup" | "register" | "upload" | "complete";

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // R1-05: Standard selector
  const [availableStandards, setAvailableStandards] = useState<ReferenceSource[]>([]);
  const [selectedStandards, setSelectedStandards] = useState<string[]>([]);

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

  useEffect(() => {
    apiClient
      .getRulebookSources()
      .then((sources) => {
        setAvailableStandards(sources);
        // Default to SS554 if available
        const ss554 = sources.find((s) => s.title.includes("SS 554") || s.title.includes("SS554"));
        if (ss554) {
          setSelectedStandards([ss554.id]);
        } else if (sources.length > 0) {
          setSelectedStandards([sources[0].id]);
        }
      })
      .catch(console.error);
  }, []);

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

  const isFormValid = file && selectedStandards.length > 0;

  // R1-07: Tenant selection and registration
  const handleTenantSelected = (tenantId: string, clientName: string) => {
    setSelectedTenantId(tenantId);
    setSelectedTenantName(clientName);
    setStep("upload");
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
      setStep("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register customer");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUpload = async () => {
    if (!isFormValid) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file!);
      formData.append("standards", JSON.stringify(selectedStandards));
      if (selectedTenantId) {
        formData.append("tenant_id", selectedTenantId);
      }

      const response = await api.upload<UploadResult>(
        "/api/uploads",
        formData
      );

      if (response.is_duplicate) {
        setDuplicateResult(response);
        setIsUploading(false);
        return;
      }

      onUploadComplete?.(response);
      setFile(null);
      setStep("lookup");
      setSelectedTenantId(null);
      setSelectedTenantName(null);
      setRegClientName("");
      setRegContactEmail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      if (!duplicateResult) {
        setIsUploading(false);
      }
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
      formData.append("standards", JSON.stringify(selectedStandards));
      formData.append("force", "true");
      if (selectedTenantId) {
        formData.append("tenant_id", selectedTenantId);
      }

      const response = await api.upload<UploadResult>(
        "/api/uploads",
        formData
      );

      onUploadComplete?.(response);
      setFile(null);
      setStep("lookup");
      setSelectedTenantId(null);
      setSelectedTenantName(null);
      setRegClientName("");
      setRegContactEmail("");
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
              <div>
                <label className="text-sm font-medium">Client Name *</label>
                <input
                  type="text"
                  value={regClientName}
                  onChange={(e) => setRegClientName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  placeholder="e.g., Acme Corporation"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Contact Email *</label>
                <input
                  type="email"
                  value={regContactEmail}
                  onChange={(e) => setRegContactEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md"
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

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            {selectedTenantName && (
              <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                <p className="text-sm font-medium text-primary">
                  Uploading for: {selectedTenantName}
                </p>
              </div>
            )}

            {/* R1-05: Standard Selector */}
            <div className="mb-6 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Evaluation Standards
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableStandards.map((standard) => {
                  const isSelected = selectedStandards.includes(standard.id);
                  const isDraft = standard.source_currency_status === "DRAFT";
                  return (
                    <button
                      key={standard.id}
                      onClick={() => {
                        if (isSelected) {
                          if (selectedStandards.length > 1) {
                            setSelectedStandards(
                              selectedStandards.filter((id) => id !== standard.id)
                            );
                          }
                        } else {
                          setSelectedStandards([...selectedStandards, standard.id]);
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted-foreground/25 text-muted-foreground hover:border-primary/50"
                      } ${isDraft ? "opacity-60" : ""}`}
                    >
                      {standard.title}
                      {isDraft && (
                        <Badge variant="secondary" className="text-xs px-1">
                          Draft
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
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
          </div>
        )}

        {/* Error Message (for upload step) */}
        {step !== "register" && error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Button (only in upload step) */}
        {step === "upload" && (
          <Button
            onClick={handleUpload}
            disabled={!isFormValid || isUploading}
            className="w-full mt-4"
          >
            {isUploading ? (
              <>
                <span className="animate-spin mr-2">&#8987;</span>
                Uploading & Parsing...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload & Parse
              </>
            )}
          </Button>
        )}

        {/* R1-08: Duplicate Detection Dialog */}
        {duplicateResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <h3 className="text-lg font-semibold">Duplicate Upload Detected</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                This CSV file was previously uploaded on{" "}
                <span className="font-medium">
                  {new Date(duplicateResult.uploaded_at).toLocaleDateString()}
                </span>
                {duplicateResult.file_name && (
                  <> — <code className="text-xs bg-muted px-1 rounded">{duplicateResult.file_name}</code></>
                )}
                .
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Would you like to view the existing findings instead?
              </p>
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
                    setDuplicateResult(null);
                    setFile(null);
                    setStep("lookup");
                    setSelectedTenantId(null);
                    setSelectedTenantName(null);
                  }}
                >
                  View Existing Findings
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
