"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StandardSelector } from "@/components/StandardSelector"
import { AlertTriangle, ShieldCheck, ShieldX, ShieldAlert, Loader2, Activity, ArrowUpRight, X, ExternalLink } from "lucide-react"
import type { Finding } from "@/components/findings/types"

// ── Types ────────────────────────────────────────────────────────────────────

interface StandardScore {
  title: string;
  score: number | null;
  outcome: string;
}

interface LeaderboardRow {
  site_id: string
  site_name: string
  wellness_index_score: number
  certification_outcome: string
  last_scan_date: string | null
  finding_count: number
  // R1-05: per-standard scores
  standard_scores?: StandardScore[]
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
  is_duplicate: boolean
}

interface SiteStandard {
  source_id: string;
  title: string;
  is_active: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case "HEALTHY_WORKPLACE_CERTIFIED":
      return "bg-green-50 text-green-700 border-green-200"
    case "HEALTHY_SPACE_VERIFIED":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "IMPROVEMENT_RECOMMENDED":
      return "bg-red-50 text-red-700 border-red-200"
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

function getScoreColor(score: number): string {
  if (score >= 90) return "text-[#37CA37]"
  if (score >= 75) return "text-[#F6AD55]"
  if (score > 0) return "text-[#E93D3D]"
  return "text-muted-foreground"
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

function AnimatedMetric({ value, label, color, delay }: { value: number | string; label: string; color?: string; delay: number }) {
  return (
    <div
      className="animate-fade-in text-center"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("font-heading text-3xl font-bold tabular-nums", color)}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

function HealthSummaryCard({ ratings }: { ratings: HealthRatings }) {
  return (
    <Card className="animate-fade-in border-l-2 border-l-primary bg-accent/30 animate-border-glow">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary" />
          Portfolio Health
          <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">Live</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37CA37] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#37CA37]"></span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <AnimatedMetric value={ratings.total_sites} label="Total Sites" delay={0} />
          <AnimatedMetric value={ratings.certified} label="Certified" color="text-[#37CA37]" delay={50} />
          <AnimatedMetric value={ratings.verified} label="Verified" color="text-[#F6AD55]" delay={100} />
          <AnimatedMetric value={ratings.improvement_recommended} label="Needs Work" color="text-[#E93D3D]" delay={150} />
          <AnimatedMetric value={ratings.insufficient_evidence} label="No Data" color="text-muted-foreground" delay={200} />
        </div>
        <div className="mt-4 border-t pt-4 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Average Wellness Index</span>
          <span className={cn("font-heading text-2xl font-bold tabular-nums", getScoreColor(ratings.average_wellness_index))}>
            {formatScore(ratings.average_wellness_index)}%
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
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
          <Badge variant="outline" className="text-[10px] text-muted-foreground">Advisory</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-500" />
        <span className="font-mono text-xs uppercase tracking-wider">{risk.metric_name}</span>
      </div>
      <p className="text-xs text-muted-foreground">{risk.interpretation_text}</p>
      <p className="text-xs font-medium">Action: {risk.recommended_action}</p>
    </div>
  )
}

function TopRisksPanel({ risks }: { risks: TopRisk[] }) {
  return (
    <Card className="animate-fade-in" style={{ animationDelay: "150ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-lg">
          <AlertTriangle size={16} className="text-red-500" />
          Top Risks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.length === 0 ? (
          <div className="py-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#37CA37]/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No critical risks detected.
            </p>
          </div>
        ) : (
          risks.map((risk, idx) => <RiskCard key={idx} risk={risk} />)
        )}
      </CardContent>
    </Card>
  )
}

function TopActionsPanel({ actions }: { actions: TopAction[] }) {
  return (
    <Card className="animate-fade-in" style={{ animationDelay: "200ms" }}>
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
              <li key={idx} className="flex items-start gap-3 rounded-lg bg-accent/30 p-3 transition-colors hover:bg-accent/50">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{action.recommended_action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {action.site_name} &middot; <span className="font-mono uppercase">{action.metric_name}</span> &middot; Priority: {action.priority}
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
  const router = useRouter()
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [uploads, setUploads] = useState<UploadSummary[]>([])
  const [selectedUpload, setSelectedUpload] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // R1-05: Standard filtering
  const [allStandards, setAllStandards] = useState<SiteStandard[]>([])
  const [activeStandardId, setActiveStandardId] = useState<string>("")
  const [showNeedsAttentionOnly, setShowNeedsAttentionOnly] = useState(false)

  // R1-08: Site findings dialog
  const [selectedSite, setSelectedSite] = useState<{ id: string; name: string } | null>(null)
  const [siteFindings, setSiteFindings] = useState<Finding[]>([])
  const [loadingFindings, setLoadingFindings] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<ExecutiveDashboardData>("/api/dashboard/executive"),
      api.get<UploadSummary[]>("/api/uploads"),
    ])
      .then(([dashboardData, uploadsData]) => {
        setData(dashboardData)
        setUploads(uploadsData)

        // Derive standards from leaderboard data
        const standardTitles = new Set<string>()
        for (const row of dashboardData.leaderboard) {
          if (row.standard_scores) {
            for (const s of row.standard_scores) {
              standardTitles.add(s.title)
            }
          }
        }
        const standards: SiteStandard[] = Array.from(standardTitles).map((title, i) => ({
          source_id: `standard-${i}`,
          title,
          is_active: true,
        }))
        setAllStandards(standards)
        if (standards.length > 0) {
          setActiveStandardId(standards[0].source_id)
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Filter leaderboard by standard and attention
  const filteredLeaderboard = (() => {
    if (!data) return []
    let rows = [...data.leaderboard]

    // Filter by standard
    if (activeStandardId) {
      const std = allStandards.find((s) => s.source_id === activeStandardId)
      if (std) {
        rows = rows
          .map((row) => ({
            ...row,
            standard_scores: row.standard_scores?.filter((s) => s.title === std.title),
          }))
          .filter((row) => row.standard_scores && row.standard_scores.length > 0)
      }
    }

    // Filter: needs attention only
    if (showNeedsAttentionOnly) {
      rows = rows.filter((row) => {
        const hasBadOutcome = row.certification_outcome?.includes("IMPROVEMENT") ||
          row.certification_outcome?.includes("INSUFFICIENT")
        const hasBadStandard = row.standard_scores?.some(
          (s) => s.outcome === "FAIL" || s.outcome === "INSUFFICIENT_EVIDENCE"
        )
        return hasBadOutcome || hasBadStandard
      })
    }

    return rows
  })()

  // R1-08: Fetch findings when a site is clicked
  const handleSiteClick = (siteId: string, siteName: string) => {
    setSelectedSite({ id: siteId, name: siteName })
    setLoadingFindings(true)
    setSiteFindings([])
    api.get<UploadSummary[]>("/api/uploads")
      .then((allUploads) => {
        const siteUploads = allUploads.filter((u) => u.site_id === siteId)
        if (siteUploads.length > 0) {
          return api.get<Finding[]>(`/api/uploads/${siteUploads[0].id}/findings`)
        }
        return []
      })
      .then((findings) => {
        setSiteFindings(findings)
      })
      .catch(console.error)
      .finally(() => setLoadingFindings(false))
  }

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
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No data available — upload scan data to populate the dashboard.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Executive Dashboard</h1>
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37CA37] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#37CA37]"></span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Live</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio-level IAQ wellness overview across all managed sites.
          </p>
          <div className="h-0.5 w-24 bg-gradient-to-r from-primary to-transparent mt-3 rounded-full"></div>
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
                {upload.file_name} &mdash; {formatDate(upload.uploaded_at)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* R1-05: Standard Selector + Attention Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {allStandards.length > 0 && (
          <StandardSelector
            standards={allStandards}
            activeStandardId={activeStandardId}
            onStandardChange={setActiveStandardId}
          />
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id="needs-attention"
            checked={showNeedsAttentionOnly}
            onCheckedChange={(checked) => setShowNeedsAttentionOnly(!!checked)}
          />
          <label
            htmlFor="needs-attention"
            className="text-sm font-medium leading-none cursor-pointer"
          >
            Show sites needing attention only
          </label>
        </div>
      </div>

      <HealthSummaryCard ratings={data.health_ratings} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Leaderboard with per-standard badges */}
          {filteredLeaderboard.length > 0 && (
            <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg">
                  Site Results
                  {showNeedsAttentionOnly && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (needs attention)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredLeaderboard.map((row, idx) => (
                    <div
                      key={row.site_id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-white cursor-pointer"
                      style={{ animationDelay: `${idx * 50 + 150}ms` }}
                      onClick={() => handleSiteClick(row.site_id, row.site_name)}
                    >
                      <div>
                        <p className="text-sm font-medium">{row.site_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last scan: {formatDate(row.last_scan_date)} &middot; {row.finding_count} findings
                        </p>
                        {/* R1-05: Per-standard badges */}
                        {row.standard_scores && row.standard_scores.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {row.standard_scores.map((s) => {
                              const sColor = s.outcome === "PASS"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : s.outcome === "FAIL"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-gray-100 text-gray-600 border-gray-200"
                              return (
                                <Badge key={s.title} variant="outline" className={`text-[10px] ${sColor}`}>
                                  {s.title}: {s.score != null ? Math.round(s.score) : "N/A"}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={cn("font-heading text-xl font-bold tabular-nums", getScoreColor(row.wellness_index_score))}>
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

          {filteredLeaderboard.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No sites match the current filter.</p>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <TopRisksPanel risks={data.top_risks} />
          <TopActionsPanel actions={data.top_actions} />
        </div>
      </div>

      {/* R1-08: Site Findings Dialog */}
      {selectedSite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl border max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Findings: {selectedSite.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSite(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {loadingFindings ? (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Loading findings...</p>
              </div>
            ) : siteFindings.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShieldCheck className="mx-auto h-10 w-10 text-green-500/50 mb-3" />
                <p className="text-sm">No findings for this site.</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-2">
                {siteFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className={cn(
                      "rounded-lg border p-3",
                      finding.threshold_band === "CRITICAL" ? "bg-red-50 border-red-200" :
                      finding.threshold_band === "WATCH" ? "bg-amber-50 border-amber-200" :
                      "bg-green-50 border-green-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{finding.zone_name}</span>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        finding.threshold_band === "CRITICAL" ? "bg-red-50 text-red-700 border-red-200" :
                        finding.threshold_band === "WATCH" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-green-50 text-green-700 border-green-200"
                      )}>
                        {finding.threshold_band}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono mt-1">{finding.metric_name}: {finding.metric_value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{finding.interpretation_text}</p>
                    <p className="text-xs font-medium mt-1">Action: {finding.recommended_action}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/ops?tab=findings`)}
              >
                View in Operations <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
