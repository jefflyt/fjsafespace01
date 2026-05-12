import { ShieldCheck, ShieldAlert, Info, CheckCircle2, AlertTriangle, AlertCircle, type LucideIcon } from "lucide-react";

// ── Certification Outcome Config ──────────────────────────────────────
// Used by: WellnessIndexCard, CrossSiteComparisonTable, StandardsTable, lib/utils.ts

export const OUTCOME_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; color: string; bg?: string; border: string }
> = {
  HEALTHY_WORKPLACE_CERTIFIED: {
    label: "Certified",
    icon: ShieldCheck,
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  HEALTHY_SPACE_VERIFIED: {
    label: "Verified",
    icon: ShieldCheck,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  IMPROVEMENT_REQUIRED: {
    label: "Improvement Needed",
    icon: ShieldAlert,
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  IMPROVEMENT_RECOMMENDED: {
    label: "Improvement Needed",
    icon: ShieldAlert,
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient Evidence",
    icon: Info,
    color: "text-muted-foreground",
    bg: "bg-gray-50",
    border: "border-gray-200",
  },
  PASS: {
    label: "Pass",
    icon: ShieldCheck,
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  FAIL: {
    label: "Fail",
    icon: ShieldAlert,
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  WATCH: {
    label: "Watch",
    icon: AlertTriangle,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
};

export function getOutcomeConfig(outcome: string | null | undefined) {
  if (!outcome) return OUTCOME_CONFIG.INSUFFICIENT_EVIDENCE;
  return OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.INSUFFICIENT_EVIDENCE;
}

// ── Threshold Band Colors (Tailwind) ──────────────────────────────────
// Used by: MetricCard, executive page inline styles

export const BAND_TAILWIND: Record<
  string,
  { color: string; bg: string; border: string; label: string; icon: LucideIcon }
> = {
  GOOD: {
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    label: "Healthy",
    icon: CheckCircle2,
  },
  WATCH: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "Attention",
    icon: AlertTriangle,
  },
  CRITICAL: {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Action Required",
    icon: AlertCircle,
  },
};

// ── Score Color Thresholds ────────────────────────────────────────────
// Used by: WellnessIndexCard, CrossSiteComparisonTable, StandardsTable

export function getScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-[#37CA37]";
  if (score >= 60) return "text-[#F6AD55]";
  return "text-[#E93D3D]";
}

// ── Band Priority Ordering ───────────────────────────────────────────
// Used by: ZoneDetailView for sorting findings by severity

export const BAND_PRIORITY: Record<string, number> = {
  CRITICAL: 0,
  WATCH: 1,
  GOOD: 2,
};

// ── Threshold Band → Certification Outcome Mapping ───────────────────
// Converts per-finding measurement bands to certification outcomes.

export const BAND_TO_OUTCOME: Record<string, string> = {
  GOOD: "PASS",
  WATCH: "WATCH",
  CRITICAL: "FAIL",
};

export function bandToOutcome(band: string): string {
  return BAND_TO_OUTCOME[band] ?? "INSUFFICIENT_EVIDENCE";
}
