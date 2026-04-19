"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, ShieldCheck, ShieldX, ShieldAlert, Loader2, Activity } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardRow {
  site_id: string
  site_name: string
  wellness_index_score: number
  certification_outcome: string
  last_scan_date: string | null
  finding_count: number
}

interface TopRisk {
  site_name: string
  site_id: string
  metric_name: string
  threshold_band: string
  interpretation_text: string
  recommended_action: string
  finding_timestamp: string
  is_advisory: boolean
}

interface TopAction {
  site_name: string
  metric_name: string
  recommended_action: string
  priority: string
}

interface HealthRatings {
  total_sites: number
  certified: number
  verified: number
  improvement_recommended: number
  insufficient_evidence: number
  average_wellness_index: number
}

interface ExecutiveDashboardData {
  leaderboard: LeaderboardRow[]
  top_risks: TopRisk[]
  top_actions: TopAction[]
  health_ratings: HealthRatings
}

interface UploadSummary {
  id: string
  file_name: string
  site_id: string
  parse_status: string
  uploaded_at: string
  report_type: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case "HEALTHY_WORKPLACE_CERTIFIED":
      return "bg-green-100 text-green-800 border-green-200"
    case "HEALTHY_SPACE_VERIFIED":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "IMPROVEMENT_RECOMMENDED":
      return "bg-red-100 text-red-800 border-red-200"
    case "INSUFFICIENT_EVIDENCE":
      return "bg-gray-100 text-gray-600 border-gray-200"
    default:
      return "bg-gray-100 text-gray-600 border-gray-200"
  }
}

function getOutcomeIcon(outcome: string) {
  switch (outcome) {
    case "HEALTHY_WORKPLACE_CERTIFIED":
      return <ShieldCheck size={14} />
    case "HEALTHY_SPACE_VERIFIED":
      return <ShieldCheck size={14} />
    case "IMPROVEMENT_RECOMMENDED":
      return <ShieldAlert size={14} />
    case "INSUFFICIENT_EVIDENCE":
      return <ShieldX size={14} />
    default:
      return null
  }
}

function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case "HEALTHY_WORKPLACE_CERTIFIED":
      return "Certified"
    case "HEALTHY_SPACE_VERIFIED":
      return "Verified"
    case "IMPROVEMENT_RECOMMENDED":
      return "Improvement Needed"
    case "INSUFFICIENT_EVIDENCE":
      return "Insufficient Data"
    default:
      return outcome
  }
}

function getScoreColorClass(score: number): string {
  if (score >= 90) return "text-green-600"
  if (score >= 75) return "text-amber-600"
  if (score > 0) return "text-red-600"
  return "text-gray-400"
}

function formatScore(score: number): string {
  return score.toFixed(1)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No scans yet"
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// ── Components ───────────────────────────────────────────────────────────────

function HealthSummaryCard({ ratings }: { ratings: HealthRatings }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Portfolio Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="text-center">
            <div className="font-heading text-3xl font-bold tabular-nums">{ratings.total_sites}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Sites</div>
          </div>
          <div className="text-center">
            <div className="font-heading text-3xl font-bold tabular-nums text-green-600">{ratings.certified}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Certified</div>
          </div>
          <div className="text-center">
            <div className="font-heading text-3xl font-bold tabular-nums text-amber-600">{ratings.verified}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Verified</div>
          </div>
          <div className="text-center">
            <div className="font-heading text-3xl font-bold tabular-nums text-red-600">{ratings.improvement_recommended}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Needs Work</div>
          </div>
          <div className="text-center">
            <div className="font-heading text-3xl font-bold tabular-nums text-gray-400">{ratings.insufficient_evidence}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">No Data</div>
          </div>
        </div>
        <div className="mt-4 border-t pt-4 text-center">
          <span className="text-xs text-muted-foreground">Average Wellness Index: </span>
          <span className={cn("font-heading text-lg font-bold tabular-nums", getScoreColorClass(ratings.average_wellness_index))}>
            {formatScore(ratings.average_wellness_index)}%
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function RiskCard({ risk }: { risk: TopRisk }) {
  const bandColor = risk.threshold_band === "CRITICAL"
    ? "bg-red-50 border-red-200"
    : risk.threshold_band === "WATCH"
      ? "bg-amber-50 border-amber-200"
      : "bg-green-50 border-green-200"

  return (
    <div className={cn("rounded-lg border p-3 space-y-1.5", bandColor)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{risk.site_name}</span>
        {risk.is_advisory && (
          <Badge variant="outline" className="text-[10px] text-gray-500">Advisory</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-500" />
        <span className="font-mono text-xs uppercase">{risk.metric_name}</span>
      </div>
      <p className="text-xs text-muted-foreground">{risk.interpretation_text}</p>
      <p className="text-xs font-medium">Action: {risk.recommended_action}</p>
    </div>
  )
}

function TopRisksPanel({ risks }: { risks: TopRisk[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-lg">
          <AlertTriangle size={16} className="text-red-500" />
          Top Risks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No critical risks detected.
          </p>
        ) : (
          risks.map((risk, idx) => <RiskCard key={idx} risk={risk} />)
        )}
      </CardContent>
    </Card>
  )
}

function TopActionsPanel({ actions }: { actions: TopAction[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">Recommended Actions</CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No actions pending.
          </p>
        ) : (
          <ul className="space-y-2">
            {actions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{action.recommended_action}</p>
                  <p className="text-xs text-muted-foreground">
                    {action.site_name} · {action.metric_name} · Priority: {action.priority}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [uploads, setUploads] = useState<UploadSummary[]>([])
  const [selectedUpload, setSelectedUpload] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<ExecutiveDashboardData>("/api/dashboard/executive"),
      api.get<UploadSummary[]>("/api/uploads"),
    ])
      .then(([dashboardData, uploadsData]) => {
        setData(dashboardData)
        setUploads(uploadsData)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-600">Failed to load dashboard data</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        No data available — upload scan data to populate the dashboard.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio-level IAQ wellness overview across all managed sites.
          </p>
        </div>

        {/* Historical Scan Selector */}
        <Select value={selectedUpload} onValueChange={setSelectedUpload}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select scan results" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scans (Latest)</SelectItem>
            {uploads.map((upload) => (
              <SelectItem key={upload.id} value={upload.id}>
                {upload.file_name} — {formatDate(upload.uploaded_at)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <HealthSummaryCard ratings={data.health_ratings} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Leaderboard kept for now — can be replaced with per-scan results */}
          {data.leaderboard.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg">Site Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.leaderboard.map((row) => (
                    <div key={row.site_id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{row.site_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Last scan: {formatDate(row.last_scan_date)} · {row.finding_count} findings
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={cn("font-heading text-xl font-bold tabular-nums", getScoreColorClass(row.wellness_index_score))}>
                          {formatScore(row.wellness_index_score)}%
                        </div>
                        <Badge variant="outline" className={cn("mt-1", getOutcomeColor(row.certification_outcome))}>
                          {getOutcomeIcon(row.certification_outcome)}
                          <span className="ml-1">{getOutcomeLabel(row.certification_outcome)}</span>
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <TopRisksPanel risks={data.top_risks} />
          <TopActionsPanel actions={data.top_actions} />
        </div>
      </div>
    </div>
  )
}
