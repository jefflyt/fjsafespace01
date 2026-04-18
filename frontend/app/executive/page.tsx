/**
 * frontend/app/executive/page.tsx
 *
 * PR 6.3: Executive Dashboard UI.
 *
 * Displays:
 * - Page header with portfolio health summary
 * - Wellness Index leaderboard sorted by score DESC
 * - Top 3 Risks panel (color-coded: Green/Amber/Red/Grey)
 * - Top 3 Actions panel
 *
 * Color coding (PSD §6.1):
 *   Green  >= 90  HEALTHY_WORKPLACE_CERTIFIED
 *   Amber  75-89  HEALTHY_SPACE_VERIFIED
 *   Red    < 75   IMPROVEMENT_RECOMMENDED
 *   Grey   N/A    INSUFFICIENT_EVIDENCE
 *
 * Reference: PLAN docs/plans/epics/pr6-executive-dashboard/PLAN.md § PR 6.3
 */

"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, ShieldCheck, ShieldX, ShieldAlert, Loader2, TrendingUp } from "lucide-react"

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={20} />
          Portfolio Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{ratings.total_sites}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Sites</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{ratings.certified}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Certified</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">{ratings.verified}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Verified</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{ratings.improvement_recommended}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Needs Work</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-400">{ratings.insufficient_evidence}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">No Data</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t text-center">
          <span className="text-sm text-muted-foreground">Average Wellness Index: </span>
          <span className={cn("text-lg font-bold", getScoreColorClass(ratings.average_wellness_index))}>
            {formatScore(ratings.average_wellness_index)}%
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground py-12">
          No sites available. Upload scan data to populate the leaderboard.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Leaderboard</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ranked by Wellness Index score (descending)
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Wellness Index</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Last Scan</TableHead>
              <TableHead className="text-right">Findings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.site_id}>
                <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-semibold">{row.site_name}</TableCell>
                <TableCell className={cn("text-right font-bold text-lg", getScoreColorClass(row.wellness_index_score))}>
                  {formatScore(row.wellness_index_score)}%
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("flex w-fit gap-1", getOutcomeColor(row.certification_outcome))}>
                    {getOutcomeIcon(row.certification_outcome)}
                    {getOutcomeLabel(row.certification_outcome)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDate(row.last_scan_date)}
                </TableCell>
                <TableCell className="text-right text-sm">{row.finding_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    <div className={cn("rounded-lg border p-4 space-y-2", bandColor)}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{risk.site_name}</span>
        {risk.is_advisory && (
          <Badge variant="outline" className="text-xs text-gray-500">Advisory</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-500" />
        <span className="font-mono text-sm uppercase">{risk.metric_name}</span>
      </div>
      <p className="text-sm text-muted-foreground">{risk.interpretation_text}</p>
      <p className="text-sm font-medium">Action: {risk.recommended_action}</p>
    </div>
  )
}

function TopRisksPanel({ risks }: { risks: TopRisk[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500" />
          Top 3 Risks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {risks.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            No critical risks detected across monitored sites.
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
      <CardHeader>
        <CardTitle>Recommended Actions</CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            No actions pending.
          </p>
        ) : (
          <ul className="space-y-3">
            {actions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium text-sm">{action.recommended_action}</p>
                  <p className="text-xs text-muted-foreground">
                    {action.site_name} &middot; {action.metric_name} &middot; Priority: {action.priority}
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<ExecutiveDashboardData>("/api/dashboard/executive")
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-600 font-medium">Failed to load dashboard data</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Portfolio-level IAQ wellness overview across all managed sites.
        </p>
      </div>

      <HealthSummaryCard ratings={data.health_ratings} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LeaderboardTable rows={data.leaderboard} />
        </div>
        <div className="space-y-6">
          <TopRisksPanel risks={data.top_risks} />
          <TopActionsPanel actions={data.top_actions} />
        </div>
      </div>
    </div>
  )
}
