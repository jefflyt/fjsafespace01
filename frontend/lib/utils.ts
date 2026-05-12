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

// ── Outcome config (consolidated in constants.ts) ────────────────────

export { OUTCOME_CONFIG, getOutcomeConfig, bandToOutcome } from "@/lib/constants";
