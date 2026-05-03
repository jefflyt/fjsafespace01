'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SiteOverviewCard } from '@/components/SiteOverviewCard';
import { ZoneDetailView } from '@/components/ZoneDetailView';
import { ScanHistoryTable } from '@/components/ScanHistoryTable';
import { StandardSelector } from '@/components/StandardSelector';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api, apiClient, SiteStandard, MetricPreferences, UploadListItem } from '@/lib/api';
import type { Finding } from '@/components/findings/types';

interface Reading {
  metric_name: string;
  zone_name: string;
  timestamp: string;
  metric_value: number;
  is_outlier: boolean;
}

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;

  const [siteName, setSiteName] = useState<string>('');
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [standards, setStandards] = useState<SiteStandard[]>([]);
  const [metricPreferences, setMetricPreferences] = useState<MetricPreferences>({
    site_id: '',
    active_metrics: [],
    alert_threshold_overrides: {},
  });
  const [uploads, setUploads] = useState<UploadListItem[]>([]);
  const [activeStandard, setActiveStandard] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;

    setLoading(true);
    Promise.all([
      apiClient.getSiteOverview(siteId).catch(() => null),
      apiClient.getSitesStandards(siteId).catch(() => null),
      apiClient.getSitesMetricPreferences(siteId).catch(() => null),
      apiClient.getUploads(siteId).catch(() => []),
    ])
      .then(([overview, standardsRes, prefsRes, uploadsRes]) => {
        if (overview) {
          setSiteName(overview.site_name);
        }
        if (standardsRes) {
          setStandards(standardsRes.standards || []);
          if (standardsRes.standards?.length > 0) {
            const firstActive = standardsRes.standards.find((s: SiteStandard) => s.is_active);
            if (firstActive) setActiveStandard(firstActive.source_id);
          }
        }
        if (prefsRes) setMetricPreferences(prefsRes);
        if (uploadsRes) setUploads(uploadsRes);
      })
      .catch(console.error);
  }, [siteId]);

  // Fetch findings for the latest upload
  const latestUpload = uploads.length > 0 ? uploads[0] : null;

  useEffect(() => {
    if (!latestUpload) {
      setLoading(false);
      return;
    }

    Promise.all([
      api.get<Finding[]>(`/api/uploads/${latestUpload.id}/findings`),
      api.get<{ metrics: Record<string, Reading[]> }>(`/api/uploads/${latestUpload.id}/readings`),
    ])
      .then(([findingsRes, readingsRes]) => {
        setFindings(Array.isArray(findingsRes) ? findingsRes : []);
        // Flatten readings from all metrics
        const allReadings: Reading[] = [];
        if (readingsRes?.metrics) {
          for (const metricReadings of Object.values(readingsRes.metrics)) {
            allReadings.push(...metricReadings);
          }
        }
        setReadings(allReadings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [latestUpload]);

  const filteredFindings = useMemo(() => {
    if (!activeStandard) return findings;
    return findings.filter((f) => f.standard_id === activeStandard);
  }, [findings, activeStandard]);

  const zones = useMemo(() => [...new Set(filteredFindings.map((f) => f.zone_name))], [filteredFindings]);

  const siteOverview = useMemo(() => {
    if (filteredFindings.length === 0) return null;

    const lastUpdated = filteredFindings[0]?.created_at ?? new Date().toISOString();

    const standardScoresMap: Record<string, { scores: number[]; outcomes: string[]; title: string }> = {};
    for (const f of filteredFindings) {
      const stdId = f.standard_id ?? 'default';
      if (!standardScoresMap[stdId]) {
        standardScoresMap[stdId] = {
          scores: [],
          outcomes: [],
          title: f.standard_title ?? 'Standard',
        };
      }
      const score =
        f.threshold_band === 'GOOD' ? 100 : f.threshold_band === 'WATCH' ? 50 : 0;
      standardScoresMap[stdId].scores.push(score);
      standardScoresMap[stdId].outcomes.push(
        f.threshold_band === 'GOOD'
          ? 'PASS'
          : f.threshold_band === 'WATCH'
          ? 'INSUFFICIENT_EVIDENCE'
          : 'FAIL',
      );
    }

    const standardScores = Object.entries(standardScoresMap).map(([sourceId, data]) => ({
      sourceId,
      title: data.title,
      score:
        data.scores.length > 0
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
          : null,
      outcome: data.outcomes.includes('FAIL')
        ? 'FAIL'
        : data.outcomes.every((o) => o === 'PASS')
        ? 'PASS'
        : 'INSUFFICIENT_EVIDENCE',
    }));

    const overallWellness =
      standardScores.length > 0
        ? standardScores.reduce((sum, s) => sum + (s.score ?? 0), 0) / standardScores.length
        : null;

    const topInsight = filteredFindings.find((f) => f.threshold_band === 'CRITICAL')
      ? `${filteredFindings.find((f) => f.threshold_band === 'CRITICAL')!.metric_name} elevated in ${filteredFindings.find((f) => f.threshold_band === 'CRITICAL')!.zone_name}`
      : undefined;

    return { siteName, lastUpdated, standardScores, overallWellness, topInsight };
  }, [filteredFindings, siteName]);

  if (loading) {
    return (
      <div className="max-w-7xl px-6 py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Loading scan results...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl px-6 py-6 space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/')}
        className="gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Scan Listing
      </Button>

      {/* Site header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{siteName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tenantName ? `${tenantName} — ` : ''}
          {uploads.length} scan{uploads.length !== 1 ? 's' : ''} total
          {latestUpload
            ? ` — Last scan: ${new Date(latestUpload.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : ''}
        </p>
        <div className="h-0.5 w-24 bg-gradient-to-r from-primary to-transparent mt-3 rounded-full" />
      </div>

      {/* Standard Selector */}
      {standards.length > 1 && activeStandard && (
        <StandardSelector
          standards={standards}
          activeStandardId={activeStandard}
          onStandardChange={setActiveStandard}
        />
      )}

      {/* Site Overview */}
      {siteOverview && (
        <SiteOverviewCard
          siteName={siteOverview.siteName}
          lastUpdated={siteOverview.lastUpdated}
          scanMode="adhoc"
          standardScores={siteOverview.standardScores}
          topInsight={siteOverview.topInsight}
          overallWellness={siteOverview.overallWellness}
        />
      )}

      {/* Scan History */}
      {uploads.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scan History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScanHistoryTable
              uploads={uploads}
              onRowClick={(uploadId) => {
                // For now, same site — just scroll to zone details
                // In future, could load specific upload findings
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
            standards={standards}
            siteId={siteId}
            metricPreferences={metricPreferences}
          />
        ))
      )}
    </div>
  );
}
