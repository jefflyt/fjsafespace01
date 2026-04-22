"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, FileText, X, AlertCircle } from "lucide-react";
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

const PREMISES_TYPES = [
  "Industrial",
  "Office",
  "Retail",
  "School",
  "Healthcare",
  "Other",
] as const;

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // PR9: Customer information fields (replaces site ID input)
  const [clientName, setClientName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [premisesType, setPremisesType] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [specificEvent, setSpecificEvent] = useState("");
  const [comparativeAnalysis, setComparativeAnalysis] = useState(false);

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

  const isFormValid =
    file && clientName && siteAddress && premisesType && contactPerson;

  const handleUpload = async () => {
    if (!isFormValid) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file!);

      // Build query params — site_id is auto-generated UUID
      const params = new URLSearchParams({
        client_name: clientName,
        site_address: siteAddress,
        premises_type: premisesType,
        contact_person: contactPerson,
      });
      if (specificEvent) {
        params.set("specific_event", specificEvent);
      }
      if (comparativeAnalysis) {
        params.set("comparative_analysis", "true");
      }

      const response = await api.upload<UploadResult>(
        `/api/uploads?${params.toString()}`,
        formData
      );

      onUploadComplete?.(response);
      setFile(null);
      setClientName("");
      setSiteAddress("");
      setPremisesType("");
      setContactPerson("");
      setSpecificEvent("");
      setComparativeAnalysis(false);
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

        {/* Customer Information Section */}
        <div className="mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Customer Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client-name">Company Name *</Label>
              <Input
                id="client-name"
                placeholder="Enter company name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contact-person">Contact Person *</Label>
              <Input
                id="contact-person"
                placeholder="Enter contact person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="site-address">Site Address *</Label>
              <Input
                id="site-address"
                placeholder="Enter site address"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="premises-type">Premises Type *</Label>
              <Select value={premisesType} onValueChange={setPremisesType}>
                <SelectTrigger id="premises-type" className="mt-1">
                  <SelectValue placeholder="Select premises type" />
                </SelectTrigger>
                <SelectContent>
                  {PREMISES_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="specific-event">
              Specific Event / Complaint{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="specific-event"
              placeholder="Describe the event or complaint that triggered this assessment..."
              value={specificEvent}
              onChange={(e) => setSpecificEvent(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="comparative-analysis"
              checked={comparativeAnalysis}
              onChange={(e) => setComparativeAnalysis(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="comparative-analysis" className="text-sm font-normal">
              Comparative Analysis — compare with previous assessments
            </Label>
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
      </div>
    </div>
  );
}
