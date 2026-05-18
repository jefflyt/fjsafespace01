"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/layout/Sidebar";
import { apiClient, UploadListItem, SiteDetail, ReadingsResponse } from "@/lib/api";
import { METRIC_CONFIGS, METRIC_KEYS } from "@/components/findings/MetricConfig";
import { TimeSeriesChart } from "@/components/findings/TimeSeriesChart";
import { ChevronRight, Home, ArrowLeft, Activity, ArrowRight } from "lucide-react";

// Zone color palette
const ZONE_PALETTE = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#14b8a6", "#ec4899", "#84cc16",
];

// Scan overlay colors & dash patterns
const OVERLAY_COLORS = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
const OVERLAY_DASH = ["6 4", "4 4", "2 4", "3 3", "5 3"];

interface Reading {
  metric_name: string;
  zone_name: string;
  timestamp: string;
  metric_value: number;
  is_outlier: boolean;
}

interface ScanOverlay {
  scanId: string;
  label: string;
  dateLabel: string;
  readings: Reading[];
  color: string;
  dash: string;
  isPrimary: boolean;
}

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

function formatDate(scanDate: string | null): string {
  if (!scanDate) return "Unknown";
  return new Date(scanDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFullDate(scanDate: string | null): string {
  if (!scanDate) return "Unknown";
  return new Date(scanDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScanComparePage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [siteDetail, setSiteDetail] = useState<SiteDetail | null>(null);
  const [uploads, setUploads] = useState<UploadListItem[]>([]);
  const [selectedScanIds, setSelectedScanIds] = useState<string[]>([]);
  const [scanReadings, setScanReadings] = useState<Record<string, Reading[]>>({});
  const [activeMetric, setActiveMetric] = useState("co2_ppm");
  const [activeZone, setActiveZone] = useState("all");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  // Fetch site & uploads
  useEffect(() => {
    if (!siteId) return;
    Promise.all([
      apiClient.getSiteDetail(siteId).catch(() => null),
      apiClient.getUploadsBySiteIds([siteId]).catch(() => []),
    ]).then(([detailRes, uploadsRes]) => {
      if (detailRes) setSiteDetail(detailRes);
      const list = (uploadsRes as UploadListItem[]) || [];
      setUploads(list);
      // Pre-select latest 2 scans
      if (list.length >= 2) {
        setSelectedScanIds([list[0].id, list[1].id]);
      }
      setLoading(false);
    });
  }, [siteId]);

  // Fetch readings for selected scans
  useEffect(() => {
    if (selectedScanIds.length < 2) return;

    setFetching(true);
    const fetches = selectedScanIds.map((id) =>
      apiClient.getUploadReadings(id).catch(() => null)
    );

    Promise.all(fetches).then((results) => {
      const map: Record<string, Reading[]> = {};
      results.forEach((res, i) => {
        const scanId = selectedScanIds[i];
        const allReadings: Reading[] = [];
        if (res?.metrics) {
          const grouped = res as ReadingsResponse;
          for (const [metricName, metricReadings] of Object.entries(grouped.metrics)) {
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
        map[scanId] = allReadings;
      });
      setScanReadings(map);
      setFetching(false);
    });
  }, [selectedScanIds]);

  // Derive zones from all selected scans
  const zones = useMemo(() => {
    const z = new Set<string>();
    for (const readings of Object.values(scanReadings)) {
      for (const r of readings) z.add(r.zone_name);
    }
    return Array.from(z).sort();
  }, [scanReadings]);

  const zoneColors = useMemo(() => {
    const map: Record<string, string> = {};
    zones.forEach((z, i) => { map[z] = ZONE_PALETTE[i % ZONE_PALETTE.length]; });
    return map;
  }, [zones]);

  // Build merged readings for chart (same-zone comparison)
  const mergedReadings = useMemo(() => {
    if (selectedScanIds.length < 2) return [];
    const allReadings: Reading[] = [];
    for (const scanId of selectedScanIds) {
      const readings = scanReadings[scanId] || [];
      const filtered = activeZone === "all"
        ? readings
        : readings.filter((r) => r.zone_name === activeZone);
      allReadings.push(...filtered.map((r) => ({ ...r, scanId })));
    }
    return allReadings;
  }, [scanReadings, selectedScanIds, activeZone]);

  // Overlay configs for TimeSeriesChart
  const overlays = useMemo((): ScanOverlay[] => {
    if (selectedScanIds.length < 2) return [];
    return selectedScanIds.map((scanId, i) => {
      const upload = uploads.find((u) => u.id === scanId);
      const readings = scanReadings[scanId] || [];
      const filtered = activeZone === "all"
        ? readings
        : readings.filter((r) => r.zone_name === activeZone);
      return {
        scanId,
        label: upload?.scan_type === "continuous" ? "Continuous" : `Scan ${i + 1}`,
        dateLabel: formatFullDate(upload?.scan_date ?? null),
        readings: filtered,
        color: OVERLAY_COLORS[i % OVERLAY_COLORS.length],
        dash: i === 0 ? "0" : OVERLAY_DASH[i % OVERLAY_DASH.length],
        isPrimary: i === 0,
      };
    });
  }, [selectedScanIds, scanReadings, uploads, activeZone]);

  const handleToggleScan = useCallback((scanId: string) => {
    setSelectedScanIds((prev) => {
      if (prev.includes(scanId)) {
        return prev.length > 2 ? prev.filter((id) => id !== scanId) : prev;
      }
      if (prev.length >= 3) return prev;
      return [...prev, scanId];
    });
  }, []);

  const siteName = siteDetail?.site_name || siteId;
  const validMetrics = useMemo(() => {
    const present = new Set(mergedReadings.map((r) => r.metric_name));
    return METRIC_KEYS.filter((k) => present.has(k));
  }, [mergedReadings]);

  useEffect(() => {
    if (validMetrics.length > 0 && !validMetrics.includes(activeMetric)) {
      setActiveMetric(validMetrics[0]);
    }
  }, [validMetrics, activeMetric]);

  // ── Loading state ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Compare Scans" />
          <div className="px-4 md:px-6 py-6 space-y-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // ── Main content ────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-60 min-w-0">
        <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Compare Scans" />

        <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 animate-fade-in">
            <BreadcrumbButton
              icon={Home}
              label="Scan Listings"
              onClick={() => router.push("/")}
            />
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <BreadcrumbButton
              icon={Activity}
              label="Scan Data"
              onClick={() => router.push(`/scan-data/${siteId}`)}
            />
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <BreadcrumbButton icon={ArrowRight} label="Compare Scans" isLast />
          </nav>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-fade-in">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">{siteName}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Compare up to 3 scans overlaid on the same chart
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/scan-data/${siteId}`)}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Scan Data
            </Button>
          </div>

          {/* Scan Selector */}
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Select Scans to Compare ({selectedScanIds.length}/3)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                {uploads
                  .filter((u) => u.parse_status === "COMPLETE")
                  .map((upload) => {
                    const isSelected = selectedScanIds.includes(upload.id);
                    return (
                      <button
                        key={upload.id}
                        onClick={() => handleToggleScan(upload.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-all duration-200 ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-border"
                          }`}
                        >
                          {isSelected && (
                            <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {formatDate(upload.scan_date)}
                        {upload.scan_type === "continuous" && (
                          <span className="text-[10px] opacity-60">(continuous)</span>
                        )}
                      </button>
                    );
                  })}
              </div>
              {selectedScanIds.length < 2 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Select at least 2 scans to compare.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Zone Filter */}
          {zones.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap animate-fade-in">
              <span className="text-sm text-muted-foreground">Filter by zone:</span>
              <button
                onClick={() => setActiveZone("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
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
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
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

          {/* Metric Selector */}
          {validMetrics.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap animate-fade-in">
              <span className="text-sm text-muted-foreground">Metric:</span>
              {validMetrics.map((key) => {
                const cfg = METRIC_CONFIGS[key];
                if (!cfg) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveMetric(key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                      activeMetric === key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cfg.symbol}
                  </button>
                );
              })}
            </div>
          )}

          {/* Chart */}
          {fetching ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : overlays.length >= 2 && mergedReadings.length > 0 ? (
            <TimeSeriesChart
              metricKey={activeMetric}
              readings={mergedReadings}
              activeZones={new Set(activeZone === "all" ? zones : [activeZone])}
              zoneColors={zoneColors}
              onReadingClick={() => {}}
              compareMode={{
                overlays: overlays.map((o) => ({
                  scanId: o.scanId,
                  label: o.label,
                  dateLabel: o.dateLabel,
                  color: o.color,
                  dash: o.dash,
                  isPrimary: o.isPrimary,
                })),
              }}
            />
          ) : (
            <Card className="animate-fade-in">
              <CardContent className="py-16 text-center">
                <Activity className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-heading text-lg font-semibold">Select scans to compare</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose at least 2 scans from the list above.
                </p>
              </CardContent>
            </Card>
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
