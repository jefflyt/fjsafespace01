"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/layout/Sidebar";
import { apiClient, AnomalyEntry, LatestUploadResponse, TrendComparisonMetric, SiteDetail, UploadListItem } from "@/lib/api";
import { METRIC_CONFIGS, METRIC_KEYS } from "@/components/findings/MetricConfig";
import { TimeSeriesChart } from "@/components/findings/TimeSeriesChart";
import { MetricSelectorBar } from "@/components/scan-data/MetricSelectorBar";
import { TrendComparisonBar } from "@/components/scan-data/TrendComparisonBar";
import { AnomalySummary } from "@/components/scan-data/AnomalySummary";
import { ScanDataExport } from "@/components/scan-data/ScanDataExport";
import { ChevronRight, Home, ArrowLeft, Activity, MapPin, ShieldCheck, ArrowRight } from "lucide-react";

// Zone color palette — consistent across charts
const ZONE_PALETTE = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#14b8a6", "#ec4899", "#84cc16",
];

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

export default function ScanDataViewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = params.siteId as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const uploadIdParam = searchParams.get("uploadId");
  const batchIdParam = searchParams.get("batchId");

  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanDate, setLastScanDate] = useState<string | null>(null);

  const [uploadId, setUploadId] = useState<string | null>(uploadIdParam);
  const [siteName, setSiteName] = useState<string>(siteId);
  const [readings, setReadings] = useState<Array<{
    metric_name: string; zone_name: string; timestamp: string;
    metric_value: number; is_outlier: boolean;
  }>>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEntry[]>([]);
  const [trendMetrics, setTrendMetrics] = useState<Record<string, TrendComparisonMetric>>({});
  const [activeMetric, setActiveMetric] = useState<string>("co2_ppm");
  const [activeZone, setActiveZone] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive unique zones from readings
  const zones = useMemo(() => {
    const z = new Set(readings.map((r) => r.zone_name));
    return Array.from(z).sort();
  }, [readings]);

  // Zone colors map
  const zoneColors = useMemo(() => {
    const map: Record<string, string> = {};
    zones.forEach((z, i) => { map[z] = ZONE_PALETTE[i % ZONE_PALETTE.length]; });
    return map;
  }, [zones]);

  // Filtered readings for chart
  const filteredReadings = useMemo(() => {
    if (activeZone === "all") return readings;
    return readings.filter((r) => r.zone_name === activeZone);
  }, [readings, activeZone]);

  // Fetch data
  useEffect(() => {
    if (!siteId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch site detail for customer info
        const [detailRes, uploadsRes] = await Promise.all([
          apiClient.getSiteDetail(siteId).catch(() => null),
          apiClient.getUploadsBySiteIds([siteId]).catch(() => []),
        ]);

        if (detailRes) {
          setSiteDetail(detailRes);
          setSiteName(detailRes.site_name || siteId);
        }

        // Derive scan stats from uploads
        const uploads = (uploadsRes as UploadListItem[]) || [];
        if (uploads.length > 0) {
          setScanCount(uploads.length);
          const latest = uploads[0];
          if (latest.scan_date) {
            setLastScanDate(
              new Date(latest.scan_date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            );
          }
        }

        let resolvedUploadId = uploadIdParam;

        // If no uploadId, fetch latest for this site
        if (!resolvedUploadId) {
          const latest = await apiClient.getLatestUploadForSite(siteId);
          resolvedUploadId = (latest as LatestUploadResponse).upload_id;
          if (!detailRes) {
            setSiteName((latest as LatestUploadResponse).site_name || siteId);
          }
        }

        if (!resolvedUploadId) {
          setError("No scan data found for this site.");
          setLoading(false);
          return;
        }

        setUploadId(resolvedUploadId);

        // Fetch readings, anomalies, trend in parallel
        const [readingsRes, anomaliesRes, trendRes] = await Promise.all([
          apiClient.getUploadReadings(resolvedUploadId).catch(() => null),
          apiClient.getAnomalies(resolvedUploadId).catch(() => ({ anomalies: [] })),
          apiClient.getTrendComparison(resolvedUploadId).catch(() => null),
        ]);

        // Flatten readings from grouped format
        const allReadings: typeof readings = [];
        if (readingsRes?.metrics) {
          for (const [metricName, metricReadings] of Object.entries(readingsRes.metrics)) {
            for (const r of metricReadings) {
              allReadings.push({
                metric_name: metricName,
                zone_name: r.zone_name,
                timestamp: r.timestamp,
                metric_value: r.metric_value,
                is_outlier: r.is_outlier,
              });
            }
          }
        }
        setReadings(allReadings);
        setAnomalies((anomaliesRes as { anomalies: AnomalyEntry[] })?.anomalies || []);
        if (trendRes?.metrics) {
          setTrendMetrics(trendRes.metrics);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scan data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [siteId, uploadIdParam]);

  // Ensure activeMetric is valid for current data
  useEffect(() => {
    const availableMetrics = new Set(readings.map((r) => r.metric_name));
    if (!availableMetrics.has(activeMetric) && availableMetrics.size > 0) {
      setActiveMetric(availableMetrics.values().next().value as string);
    }
  }, [readings, activeMetric]);

  const handleSelectMetric = useCallback((metric: string) => {
    setActiveMetric(metric);
  }, []);

  // ── Loading state ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Scan Results" />
          <div className="px-4 md:px-6 py-6 space-y-6">
            <Skeleton className="h-5 w-48" />
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-5 w-80" />
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-[300px] w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <div className="px-4 md:px-6 py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="font-heading text-lg font-semibold">Unable to load scan data</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
              Back to Scans
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Subtitle: customer name, scan count, last scan
  const subtitleParts: string[] = [];
  if (siteDetail?.tenant_name) subtitleParts.push(siteDetail.tenant_name);
  if (scanCount > 0) subtitleParts.push(`${scanCount} scan${scanCount !== 1 ? "s" : ""}`);
  if (lastScanDate) subtitleParts.push(`Last scan: ${lastScanDate}`);
  const subtitle = subtitleParts.join(" · ") || `Raw sensor readings for ${siteName}`;

  // ── Main content ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-60 min-w-0">
        <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Scan Data" />

        <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 animate-fade-in">
            <BreadcrumbButton
              icon={Home}
              label="Scan Listings"
              onClick={() => router.push("/")}
            />
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <BreadcrumbButton icon={Activity} label="Scan Data" isLast />
          </nav>

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{siteName}</h1>
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/sites/${siteId}${batchIdParam ? `?batchId=${batchIdParam}` : ""}`)}
              >
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                View Certification Results
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              {uploadId && <ScanDataExport uploadId={uploadId} />}
            </div>
          </div>

          {/* Unified Metric Selector Bar */}
          {readings.length > 0 && (
            <MetricSelectorBar
              readings={readings}
              activeMetric={activeMetric}
              onSelectMetric={handleSelectMetric}
            />
          )}

          {/* Zone Filter Pills */}
          {zones.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by zone:</span>
              <button
                onClick={() => setActiveZone("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] ${
                  activeZone === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All Zones
              </button>
              {zones.map((z) => (
                <button
                  key={z}
                  onClick={() => setActiveZone(z)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] ${
                    activeZone === z
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          )}

          {/* Time Series Chart */}
          {readings.length > 0 ? (
            <TimeSeriesChart
              metricKey={activeMetric}
              readings={filteredReadings}
              activeZones={new Set(activeZone === "all" ? zones : [activeZone])}
              zoneColors={zoneColors}
              onReadingClick={() => {}}
            />
          ) : (
            <Card className="animate-fade-in">
              <CardContent className="py-16 text-center">
                <Activity className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-heading text-lg font-semibold">No readings found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This scan does not contain any sensor readings.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Trend Comparison */}
          {Object.keys(trendMetrics).length > 0 && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-lg font-semibold">
                  Trend vs Previous Scan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrendComparisonBar metrics={trendMetrics} />
              </CardContent>
            </Card>
          )}

          {/* Anomaly Summary */}
          <AnomalySummary anomalies={anomalies} />
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
