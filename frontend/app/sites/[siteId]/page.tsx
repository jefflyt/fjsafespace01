'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZoneDetailView } from '@/components/ZoneDetailView';
import { ScanHistoryTable } from '@/components/ScanHistoryTable';
import { StandardsTable } from '@/components/StandardsTable';
import { CustomerDetailsCard } from '@/components/CustomerDetailsCard';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api, apiClient, MetricPreferences, UploadListItem, SiteDetail, ReferenceSource } from '@/lib/api';
import type { Finding } from '@/components/findings/types';

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
      if (uploadsRes) setUploads(uploadsRes);
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
      const outcomes = sourceFindings.map((f) =>
        f.threshold_band === 'GOOD' ? 'PASS' : f.threshold_band === 'WATCH' ? 'INSUFFICIENT_EVIDENCE' : 'FAIL',
      );

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

  // Last scan date from uploads
  const lastScanDate = uploads.length > 0
    ? new Date(uploads[0].uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Loading scan results...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName = siteDetail?.site_name || siteId;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Scan Listings
      </Button>

      {/* Page header */}
      <div className="border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Scan Details</p>
        <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {siteDetail?.tenant_name ? `${siteDetail.tenant_name} · ` : ''}
          {uploads.length} scan{uploads.length !== 1 ? 's' : ''} total
          {lastScanDate ? ` · Last scan: ${lastScanDate}` : ''}
        </p>
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

      {/* Overall Score Card */}
      {standardsEntries.some((s) => s.score != null) && (
        <Card className="transition-all hover:shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Wellness Index</p>
                <span className={`text-4xl font-bold tabular-nums ${
                  overallWellness != null
                    ? overallWellness >= 80 ? 'text-green-600'
                    : overallWellness >= 60 ? 'text-amber-600'
                    : 'text-red-600'
                    : 'text-muted-foreground'
                }`}>
                  {overallWellness != null ? Math.round(overallWellness) : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certification Standards */}
      {standardsEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Certification Standards</CardTitle>
          </CardHeader>
          <CardContent>
            <StandardsTable
              standards={standardsEntries}
              activeStandardId={activeStandard}
              onStandardChange={(id) => {
                setActiveStandard(id);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Scan History */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scan History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScanHistoryTable
              uploads={uploads}
              onRowClick={(uploadId) => {
                console.log('Selected upload:', uploadId);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Zone Details */}
      {zones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg font-medium">No findings for this scan</p>
            <p className="text-sm mt-2">All metrics are within acceptable ranges.</p>
          </CardContent>
        </Card>
      ) : (
        zones.map((zone) => (
          <ZoneDetailView
            key={zone}
            zoneName={zone}
            findings={filteredFindings}
            readings={readings}
            siteId={siteId}
            metricPreferences={metricPreferences}
          />
        ))
      )}
    </div>
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
