"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const QA_GATES = [
  { id: "QA-G1", label: "Citations linked to rule_version and citation_unit_ids", description: "Every finding must reference a valid rule version and citation unit." },
  { id: "QA-G2", label: "Non-current sources labeled", description: "Findings from non-CURRENT_VERIFIED sources are marked appropriately." },
  { id: "QA-G3", label: "Report type is valid", description: "Report type must be ASSESSMENT or INTERVENTION_IMPACT." },
  { id: "QA-G4", label: "Data quality statement present", description: "A data quality statement must be provided by the analyst." },
  { id: "QA-G5", label: "All findings have ruleVersion + citationUnitIds", description: "Required for certification-impact decisions." },
  { id: "QA-G6", label: "Source currency status valid", description: "All sourceCurrencyStatus values must be recognized enum values." },
  { id: "QA-G7", label: "Certification outcome set", description: "certificationOutcome must not be null." },
  { id: "QA-G8", label: "Reviewer identity verified", description: "reviewerName must match the authorized approver for certification reports." },
];

interface QAGateState {
  gate: string;
  passed: boolean;
  message: string;
}

interface QAChecklistProps {
  reportId: string;
  qaChecks: Record<string, boolean>;
  onUpdate: () => void;
}

export function QAChecklist({ reportId, qaChecks, onUpdate }: QAChecklistProps) {
  const [reviewerName, setReviewerName] = useState("");
  const [approving, setApproving] = useState(false);
  const [gateResults, setGateResults] = useState<QAGateState[]>([]);
  const [approvalError, setApprovalError] = useState("");
  const [approvalSuccess, setApprovalSuccess] = useState(false);

  const allChecked = QA_GATES.every((g) => qaChecks[g.id]);
  const passedCount = QA_GATES.filter((g) => qaChecks[g.id]).length;

  async function handleApprove() {
    setApproving(true);
    setApprovalError("");
    setApprovalSuccess(false);

    try {
      const result = await api.post(`/api/reports/${reportId}/approve`, {
        reviewer_name: reviewerName,
      }) as any;

      setGateResults(result.qa_results || []);

      if (result.success) {
        setApprovalSuccess(true);
        onUpdate();
      } else {
        setApprovalError(result.error || "QA gate checks failed.");
      }
    } catch (err: any) {
      setApprovalError(err.message || "Failed to run approval checks.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center justify-between text-lg">
          <span>QA Checklist</span>
          <Badge variant={allChecked ? "default" : "secondary"}>
            {passedCount}/{QA_GATES.length} checked
          </Badge>
        </CardTitle>
        <CardDescription>
          Review each gate and confirm before approving the report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {QA_GATES.map((gate) => (
            <div
              key={gate.id}
              className="flex items-start gap-3 rounded-lg border px-4 py-3"
            >
              <div className="mt-0.5">
                {qaChecks[gate.id] ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {gate.id}
                  </span>
                  <span className="font-medium text-sm">{gate.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {gate.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {gateResults.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <h4 className="font-medium text-sm">Gate Results</h4>
            {gateResults.map((r) => (
              <div key={r.gate} className="flex items-center gap-2 text-sm">
                {r.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-mono text-xs">{r.gate}</span>
                <span className="text-muted-foreground">{r.message}</span>
              </div>
            ))}
          </div>
        )}

        {approvalSuccess && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200">
            Report approved successfully.
          </div>
        )}

        {approvalError && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {approvalError}
          </div>
        )}

        <div className="flex items-center gap-3 border-t pt-4">
          <input
            type="text"
            placeholder="Reviewer name (e.g., Jay Choy)"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            className="flex h-9 w-64 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            onClick={handleApprove}
            disabled={approving || !reviewerName}
          >
            {approving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve & Generate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
