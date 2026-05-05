import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date formatting (en-GB: dd MMM yyyy) ─────────────────────────────────────

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// ── Score color palette ──────────────────────────────────────────────────────

export const BAND_COLORS = {
  green: "text-green-600",
  amber: "text-amber-600",
  red: "text-red-600",
} as const

export function getScoreColor(score: number): string {
  if (score >= 80) return BAND_COLORS.green
  if (score >= 60) return BAND_COLORS.amber
  return BAND_COLORS.red
}

// ── Outcome config ───────────────────────────────────────────────────────────

export const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  HEALTHY_WORKPLACE_CERTIFIED: {
    label: "Certified",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  HEALTHY_SPACE_VERIFIED: {
    label: "Verified",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  IMPROVEMENT_RECOMMENDED: {
    label: "Improvement Needed",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
  INSUFFICIENT_EVIDENCE: {
    label: "Insufficient Data",
    color: "text-muted-foreground",
    bg: "bg-muted/30 border-muted",
  },
}

export function getOutcomeConfig(outcome: string | undefined | null) {
  if (!outcome) return OUTCOME_CONFIG.INSUFFICIENT_EVIDENCE
  return OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.INSUFFICIENT_EVIDENCE
}
