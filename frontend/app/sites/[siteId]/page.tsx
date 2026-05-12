'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ZoneDetailView } from '@/components/ZoneDetailView';
import { ScanHistoryTable } from '@/components/ScanHistoryTable';
import { StandardsTable } from '@/components/StandardsTable';
import { CustomerDetailsCard } from '@/components/CustomerDetailsCard';
import { Sidebar } from '@/components/layout/Sidebar';
import { api, apiClient, MetricPreferences, UploadListItem, SiteDetail, ReferenceSource } from '@/lib/api';
import { getScoreColor, getOutcomeConfig, formatDate, bandToOutcome } from '@/lib/utils';
import { ChevronRight, Home, Activity, BarChart3, ShieldCheck } from 'lucide-react';
import type { Finding } from '@/components/findings/types';

// ── Breadcrumb Button ────────────────────────────────────────────────────────

function BreadcrumbButton({
  icon: Icon,
  label,
  onClick,
  isLast,
}: {
  icon?: React.ElementType;
  label: string;
  onClick?: () => void;
  isLast?: boolean;
}) {
  if (isLast) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-all">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground active:scale-[0.97]"
    >
      {Icon && <Icon className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />}
      {label}
    </button>
  );
}

interface Reading {
  metric_name: string;
  zone_name: string;
  timestamp: string;
  metric_value: number;
  is_outlier: boolean;
}

interface StandardEntry {
  sourceId: string;
  title: string;
  shortTitle: string;
  score: number | null;
  outcome: string;
  metricCount: number;
  findings: Finding[];
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = params.siteId as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allSiteIds = useMemo(() => {
    const idsParam = searchParams.get('siteIds');
    if (idsParam) return idsParam.split(',').filter(Boolean);
    return [siteId];
  }, [siteId, searchParams]);

  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [allSources, setAllSources] = useState<ReferenceSource[]>([]);
  const [metricPreferences, setMetricPreferences] = useState<MetricPreferences>({
    site_id: '',
    active_metrics: [],
    alert_threshold_overrides: {},
  });
  const [uploads, setUploads] = useState<UploadListItem[]>([]);
  const [activeStandard, setActiveStandard] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch all data in parallel
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, sourcesRes, prefsRes, uploadsRes] = await Promise.all([
        apiClient.getSiteDetail(siteId).catch(() => null),
        apiClient.getAllActiveSources().catch(() => []),
        apiClient.getSitesMetricPreferences(siteId).catch(() => null),
        apiClient.getUploadsBySiteIds(allSiteIds).catch(() => []),
      ]);

      if (detailRes) setSiteDetail(detailRes);
      if (sourcesRes) {
        const activeSources = (sourcesRes as ReferenceSource[]).filter((s) => s.status === 'active');
        setAllSources(activeSources);
        if (activeSources.length > 0) {
          setActiveStandard(activeSources[0].id);
        }
      }
      if (prefsRes) setMetricPreferences(prefsRes);
      if (uploadsRes) {
        const seen = new Set<string>();
        const unique = (uploadsRes as UploadListItem[]).filter((u) => {
          if (u.content_hash && seen.has(u.content_hash)) return false;
          if (u.content_hash) seen.add(u.content_hash);
          return true;
        });
        setUploads(unique);
      }
    } catch (err) {
      console.error('Failed to fetch site data:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId, allSiteIds]);

  useEffect(() => {
    if (!siteId) return;
    fetchAll();
  }, [fetchAll]);

  // Fetch findings for the latest upload
  const latestUpload = uploads.length > 0 ? uploads[0] : null;

  useEffect(() => {
    if (!latestUpload) return;

    Promise.all([
      api.get<Finding[]>(`/api/uploads/${latestUpload.id}/findings`),
      api.get<{ metrics: Record<string, Reading[]> }>(`/api/uploads/${latestUpload.id}/readings`),
    ])
      .then(([findingsRes, readingsRes]) => {
        setFindings(Array.isArray(findingsRes) ? findingsRes : []);
        const allReadings: Reading[] = [];
        if (readingsRes?.metrics) {
          for (const metricReadings of Object.values(readingsRes.metrics)) {
            allReadings.push(...metricReadings);
          }
        }
        setReadings(allReadings);
      })
      .catch(console.error);
  }, [latestUpload]);

  // Build standards table: merge all rulebook sources with findings data
  const standardsEntries: StandardEntry[] = useMemo(() => {
    return allSources.map((source) => {
      const sourceFindings = findings.filter((f) => f.standard_id === source.id);
      const hasFindings = sourceFindings.length > 0;
      const isComingSoon = source.source_currency_status !== 'CURRENT_VERIFIED';

      const scores = sourceFindings.map((f) =>
        f.threshold_band === 'GOOD' ? 100 : f.threshold_band === 'WATCH' ? 50 : 0,
      );
      const outcomes = sourceFindings.map((f) => bandToOutcome(f.threshold_band));

      const score = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0 as number) / scores.length
        : null;
      const outcome = isComingSoon
        ? 'COMING_SOON'
        : outcomes.length === 0
          ? 'INSUFFICIENT_EVIDENCE'
          : outcomes.includes('FAIL')
            ? 'FAIL'
            : outcomes.every((o) => o === 'PASS')
              ? 'PASS'
              : outcomes.includes('WATCH')
                ? 'WATCH'
                : 'INSUFFICIENT_EVIDENCE';

      return {
        sourceId: source.id,
        title: source.title,
        shortTitle: shortTitle(source.title),
        score,
        outcome,
        metricCount: sourceFindings.length,
        findings: sourceFindings,
      };
    });
  }, [allSources, findings]);

  // Overall wellness from standards
  const overallWellness = useMemo(() => {
    const scored = standardsEntries.filter((s) => s.score != null && s.outcome !== 'COMING_SOON');
    if (scored.length === 0) return null;
    return scored.reduce((sum, s) => sum + (s.score ?? 0), 0) / scored.length;
  }, [standardsEntries]);

  // Last scan date from uploads — always use scan_date (actual reading time)
  const lastScanDate = uploads.length > 0 && uploads[0].scan_date
    ? new Date(uploads[0].scan_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  // Zones from findings filtered by active standard
  const filteredFindings = useMemo(() => {
    if (!activeStandard) return findings;
    return findings.filter((f) => f.standard_id === activeStandard);
  }, [findings, activeStandard]);

  const zones = useMemo(() => [...new Set(filteredFindings.map((f) => f.zone_name))], [filteredFindings]);

  // Handle customer update — refresh site detail
  const handleCustomerUpdate = useCallback(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Loading skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Site Detail" />
          <div className="px-4 md:px-6 py-6 space-y-6">
            {/* Breadcrumb skeleton */}
            <Skeleton className="h-5 w-48" />
            {/* Header skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-5 w-80" />
            </div>
            {/* KPI strip skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </div>
            {/* Standards skeleton */}
            <Skeleton className="h-40 rounded-lg" />
            {/* Scan history skeleton */}
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const displayName = siteDetail?.site_name || siteId;

  // Score color for wellness gauge
  const wellnessColor =
    overallWellness != null
      ? overallWellness >= 75
        ? 'text-healthy'
        : overallWellness >= 50
          ? 'text-warning'
          : 'text-destructive'
      : 'text-muted-foreground';

  const wellnessRingColor =
    overallWellness != null
      ? overallWellness >= 75
        ? 'stroke-healthy'
        : overallWellness >= 50
          ? 'stroke-warning'
          : 'stroke-destructive'
      : 'stroke-muted';

  // ── Main content ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-60 min-w-0">
        <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title={displayName} />

        <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 animate-fade-in">
            <BreadcrumbButton
              icon={Home}
              label="Scan Listings"
              onClick={() => router.push('/')}
            />
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <BreadcrumbButton icon={ShieldCheck} label="Certification Results" isLast />
          </nav>

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{displayName}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {siteDetail?.tenant_name ? `${siteDetail.tenant_name} · ` : ''}
                {uploads.length} scan{uploads.length !== 1 ? 's' : ''} total
                {lastScanDate ? ` · Last scan: ${lastScanDate}` : ''}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/scan-data/${siteId}${searchParams.get('batchId') ? `?batchId=${searchParams.get('batchId')}` : ''}`)}
            >
              <BarChart3 className="mr-1.5 h-4 w-4" />
              View Raw Data
            </Button>
          </div>

          {/* Wellness gauge + KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 animate-fade-in">
            {/* Wellness gauge — featured card */}
            <Card className="border-l-2 border-l-primary bg-accent/30">
              <CardContent className="pt-6 flex flex-col items-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Wellness Index</p>
                <div className="relative h-24 w-24">
                  {/* Background ring */}
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18" cy="18" r="15.915"
                      fill="none"
                      strokeWidth="3"
                      className="stroke-muted"
                    />
                    {/* Progress ring */}
                    {overallWellness != null && (
                      <circle
                        cx="18" cy="18" r="15.915"
                        fill="none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.round(overallWellness)} 100`}
                        className={wellnessRingColor}
                      />
                    )}
                  </svg>
                  {/* Center value */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-mono text-2xl font-bold tabular-nums ${wellnessColor}`}>
                      {overallWellness != null ? `${Math.round(overallWellness)}` : '—'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">/ 100</p>
              </CardContent>
            </Card>

            {/* Standard score cards */}
            {standardsEntries.slice(0, 3).map((std) => {
              const scorePct = std.score != null ? Math.round(std.score) : 0;
              const cfg = getOutcomeConfig(std.outcome);
              const barColor = cfg.bg ? cfg.bg.replace('bg-', 'bg-').split(' ')[0] : 'bg-warning';
              const iconColor = cfg.color;

              return (
                <Card
                  key={std.sourceId}
                  className="transition-all duration-150 ease-out hover:border-primary/50 hover:shadow-sm animate-fade-in"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <cfg.icon className={`h-4 w-4 ${iconColor}`} />
                      <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">{std.shortTitle}</p>
                    </div>
                    <p className={`font-mono text-3xl font-bold tabular-nums ${
                      std.score != null ? getScoreColor(std.score) : 'text-muted-foreground'
                    }`}>
                      {std.score != null ? `${Math.round(std.score)}` : '—'}
                    </p>
                    {/* Score bar */}
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {std.metricCount} metric{std.metricCount !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Customer Details */}
          <CustomerDetailsCard
            tenantName={siteDetail?.tenant_name ?? null}
            contactPerson={siteDetail?.contact_person ?? null}
            contactEmail={siteDetail?.contact_email ?? null}
            siteAddress={siteDetail?.site_address ?? null}
            premisesType={siteDetail?.premises_type ?? null}
            tenantId={siteDetail?.tenant_id ?? null}
            onUpdate={handleCustomerUpdate}
          />

          {/* Certification Standards */}
          {standardsEntries.length > 0 && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg font-semibold">Certification Standards</CardTitle>
              </CardHeader>
              <CardContent>
                <StandardsTable
                  standards={standardsEntries}
                  activeStandardId={activeStandard}
                  onStandardChange={(id) => setActiveStandard(id)}
                />
              </CardContent>
            </Card>
          )}

          {/* Scan History */}
          {uploads.length > 0 && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg font-semibold">Scan History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScanHistoryTable uploads={uploads} onRowClick={() => {}} />
              </CardContent>
            </Card>
          )}

          {/* Zone Details */}
          {zones.length === 0 ? (
            <Card className="animate-fade-in">
              <CardContent className="py-16 text-center">
                <Activity className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-heading text-lg font-semibold">No findings for this scan</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All metrics are within acceptable ranges.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-heading text-xl font-semibold">Zone Analysis</h2>
                <span className="text-sm text-muted-foreground">({zones.length} zone{zones.length !== 1 ? 's' : ''})</span>
              </div>
              {zones.map((zone) => (
                <ZoneDetailView
                  key={zone}
                  zoneName={zone}
                  findings={filteredFindings}
                  readings={readings}
                  siteId={siteId}
                  metricPreferences={metricPreferences}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
      <span className="font-heading text-sm font-semibold truncate">{title}</span>
    </header>
  );
}

// Helper: short title for standards
function shortTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('ss 554') || lower.includes('ss554')) return 'SS 554';
  if (lower.includes('well')) return 'WELL v2';
  if (lower.includes('reset')) return 'RESET Viral';
  if (lower.includes('safespace')) return 'SafeSpace IAQ';
  return title.length > 30 ? title.slice(0, 30) + '…' : title;
}
