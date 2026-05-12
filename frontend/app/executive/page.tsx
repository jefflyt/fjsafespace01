"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api, apiClient } from "@/lib/api"
import { cn, getOutcomeConfig, getScoreColor, formatDate } from "@/lib/utils"
import { BAND_TAILWIND } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StandardSelector } from "@/components/StandardSelector"
import { Sidebar } from "@/components/layout/Sidebar"
import { AlertTriangle, ShieldCheck, Loader2, Activity } from "lucide-react"
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

function formatScore(score: number): string {
  return score.toFixed(1) + "%"
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [uploads, setUploads] = useState<UploadSummary[]>([])
  const [selectedUpload, setSelectedUpload] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [allStandards, setAllStandards] = useState<SiteStandard[]>([])
  const [activeStandardId, setActiveStandardId] = useState<string>("")
  const [showNeedsAttentionOnly, setShowNeedsAttentionOnly] = useState(false)

  const [selectedSite, setSelectedSite] = useState<{ id: string; name: string } | null>(null)
  const [siteFindings, setSiteFindings] = useState<Finding[]>([])
  const [loadingFindings, setLoadingFindings] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get<ExecutiveDashboardData>("/api/dashboard/executive"),
      api.get<UploadSummary[]>("/api/uploads"),
      apiClient.getAllActiveSources().catch(() => []),
    ])
      .then(([dashboardData, uploadsData, sourcesData]) => {
        setData(dashboardData)
        setUploads(uploadsData)

        const standards: SiteStandard[] = (sourcesData as any[]).map((s) => ({
          source_id: s.id,
          title: s.title,
          is_active: s.status === "active",
        }))
        setAllStandards(standards)
        if (standards.length > 0) {
          setActiveStandardId(standards[0].source_id)
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filteredLeaderboard = (() => {
    if (!data) return []
    let rows = [...data.leaderboard]

    if (activeStandardId) {
      const std = allStandards.find((s) => s.source_id === activeStandardId)
      if (std) {
        rows = rows
          .map((row) => {
            if (!row.standard_scores || row.standard_scores.length === 0) return row
            return {
              ...row,
              standard_scores: row.standard_scores.filter((s) => s.title === std.title),
            }
          })
          .filter((row) => {
            if (!row.standard_scores || row.standard_scores.length === 0) return true
            return row.standard_scores.length > 0
          })
      }
    }

    if (showNeedsAttentionOnly) {
      rows = rows.filter((row) => {
        const rowOutcome = getOutcomeConfig(row.certification_outcome)
        const hasBadOutcome = rowOutcome.label.includes("Improvement") || rowOutcome.label.includes("Insufficient")
        const hasBadStandard = row.standard_scores?.some(
          (s) => {
            const cfg = getOutcomeConfig(s.outcome)
            return cfg.label === "Fail" || cfg.label.includes("Insufficient")
          }
        )
        return hasBadOutcome || hasBadStandard
      })
    }

    return rows
  })()

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
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Executive Summary" />
          <div className="px-4 md:px-6 py-6 space-y-6">
            <Skeleton className="h-9 w-56" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <div className="px-4 md:px-6 py-6">
            <div className={`rounded-lg border p-6 text-center ${BAND_TAILWIND.CRITICAL.bg} ${BAND_TAILWIND.CRITICAL.border}`}>
              <p className={`font-medium ${BAND_TAILWIND.CRITICAL.color.replace('700', '600')}`}>Failed to load dashboard data</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <div className="px-4 md:px-6 py-6">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-sm">Upload your first scan to see portfolio overview.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-60 min-w-0">
        <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Executive Summary" />

        <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {/* Page header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">Executive Summary</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Portfolio-level IAQ wellness overview across all managed sites.
              </p>
            </div>

            <Select value={selectedUpload} onValueChange={setSelectedUpload}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder="Select scan period" />
              </SelectTrigger>
              <SelectContent className="max-w-[90vw]">
                <SelectItem value="all">All Scans</SelectItem>
                {uploads.map((upload) => (
                  <SelectItem key={upload.id} value={upload.id}>
                    {upload.file_name} &mdash; {formatDate(upload.uploaded_at)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Sites"
              value={data.health_ratings.total_sites}
            />
            <KpiCard
              label="Certified"
              value={data.health_ratings.certified}
              dotColor="bg-healthy"
            />
            <KpiCard
              label="Needs Attention"
              value={data.health_ratings.improvement_recommended}
              dotColor="bg-warning"
            />
            <KpiCard
              label="Avg Wellness"
              value={formatScore(data.health_ratings.average_wellness_index)}
              valueColor={getScoreColor(data.health_ratings.average_wellness_index)}
              featured
            />
          </div>

          {/* Standard Selector + Filter */}
          {allStandards.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-full overflow-x-auto">
                <StandardSelector
                  standards={allStandards}
                  activeStandardId={activeStandardId}
                  onStandardChange={setActiveStandardId}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                  id="needs-attention"
                  checked={showNeedsAttentionOnly}
                  onCheckedChange={(checked) => setShowNeedsAttentionOnly(!!checked)}
                />
                <label
                  htmlFor="needs-attention"
                  className="text-sm font-medium leading-none cursor-pointer select-none whitespace-nowrap"
                >
                  Sites needing attention
                </label>
              </div>
            </div>
          )}

          {/* Main content: full width, no 3-column grid that causes overflow */}
          <div className="space-y-6">
            {/* Leaderboard with score bars */}
            {filteredLeaderboard.length > 0 && (
              <Card className="animate-fade-in" style={{ animationDelay: "100ms" }}>
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-lg">
                    Site Overview
                    {showNeedsAttentionOnly && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        (needing attention)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {filteredLeaderboard.map((row, idx) => {
                      const scorePct = row.wellness_index_score
                      const barColor = scorePct >= 75
                        ? "bg-healthy"
                        : scorePct >= 50
                          ? "bg-warning"
                          : "bg-destructive"
                      const cfg = getOutcomeConfig(row.certification_outcome)

                      return (
                        <div
                          key={row.site_id}
                          className="flex items-center justify-between rounded-lg border p-3 md:p-4 transition-all duration-150 ease-out hover:border-primary/50 hover:shadow-sm bg-white cursor-pointer"
                          style={{ animationDelay: `${idx * 50 + 150}ms` }}
                          onClick={() => handleSiteClick(row.site_id, row.site_name)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                #{idx + 1}
                              </span>
                              <p className="text-sm font-medium truncate">{row.site_name}</p>
                            </div>
                            {/* Score bar */}
                            <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-300 ease-out", barColor)}
                                style={{ width: `${Math.min(scorePct, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Last scan: {formatDate(row.last_scan_date)} &middot; {row.finding_count} findings
                            </p>
                          </div>
                          <div className="text-right ml-3 md:ml-4 shrink-0">
                            <div className={cn("font-mono text-lg md:text-xl font-bold tabular-nums", getScoreColor(row.wellness_index_score))}>
                              {formatScore(row.wellness_index_score)}
                            </div>
                            <Badge variant="outline" className={cn("mt-1 text-xs", cfg.bg, cfg.color)}>
                              <span>{cfg.label}</span>
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredLeaderboard.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">No sites match the current filter.</p>
                  <p className="text-xs mt-1">Try adjusting your filters or upload new scan data.</p>
                </CardContent>
              </Card>
            )}

            {/* Risks + Actions — responsive grid: Risks wider on large screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <TopRisksPanel risks={data.top_risks} />
              </div>
              <div className="xl:col-span-1">
                <TopActionsPanel actions={data.top_actions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Site Findings Dialog */}
      <Dialog open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Scan Findings: {selectedSite?.name}
            </DialogTitle>
          </DialogHeader>
          {loadingFindings ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading findings...</p>
            </div>
          ) : siteFindings.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <ShieldCheck className="mx-auto h-10 w-10 text-green-500/50 mb-3" />
              <p className="text-sm">All clear — no findings for this site.</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {siteFindings.map((finding) => (
                <div
                  key={finding.id}
                  className={cn(
                    "rounded-lg border p-3",
                    (BAND_TAILWIND[finding.threshold_band] ?? BAND_TAILWIND.WATCH).bg + ' ' + (BAND_TAILWIND[finding.threshold_band] ?? BAND_TAILWIND.WATCH).border
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{finding.zone_name}</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      (BAND_TAILWIND[finding.threshold_band] ?? BAND_TAILWIND.WATCH).bg + ' text-foreground ' + (BAND_TAILWIND[finding.threshold_band] ?? BAND_TAILWIND.WATCH).border
                    )}>
                      {finding.threshold_band}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono mt-1">{finding.metric_name}: {finding.metric_value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{finding.interpretation_text}</p>
                  <p className="text-xs font-medium mt-1">Recommended: {finding.recommended_action}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, dotColor, valueColor, featured }: {
  label: string;
  value: string | number;
  dotColor?: string;
  valueColor?: string;
  featured?: boolean;
}) {
  return (
    <Card className={cn("animate-fade-in", featured && "border-l-2 border-l-primary bg-accent/30")}>
      <CardContent className="pt-5">
        <div className="flex items-center gap-1.5 mb-1">
          {dotColor && <div className={cn("h-2 w-2 rounded-full", dotColor)} />}
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className={cn("font-mono text-2xl md:text-3xl font-bold tabular-nums", valueColor)}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

// ── Risk Card ────────────────────────────────────────────────────────────────

function RiskCard({ risk }: { risk: TopRisk }) {
  return (
    <div className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold truncate">{risk.site_name}</span>
        {risk.is_advisory && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Advisory</Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-500 shrink-0" />
        <span className="font-mono text-xs uppercase tracking-wider truncate">{risk.metric_name}</span>
      </div>
      <p className="text-xs text-muted-foreground">{risk.interpretation_text}</p>
      <p className="text-xs font-medium">Recommended: {risk.recommended_action}</p>
    </div>
  )
}

function TopRisksPanel({ risks }: { risks: TopRisk[] }) {
  return (
    <Card className="animate-fade-in" style={{ animationDelay: "150ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          Top Risks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.length === 0 ? (
          <div className="py-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-green-500/40 mb-3" />
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
          <div className="py-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-green-500/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              All clear — no actions pending.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-lg bg-accent/30 p-3 transition-colors hover:bg-accent/50">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{action.recommended_action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
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

// ── Mobile Top Bar ───────────────────────────────────────────────────────────

function MobileTopBar({ onMenuClick, title }: { onMenuClick: () => void; title: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:hidden">
      <Button variant="ghost" size="sm" onClick={onMenuClick} className="px-2">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Button>
      <span className="font-heading text-sm font-semibold">{title}</span>
    </header>
  )
}
