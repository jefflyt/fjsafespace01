"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { StandardSelector } from "@/components/StandardSelector";
import { MetricSelector } from "@/components/MetricSelector";
import { ThresholdConfigDialog } from "@/components/ThresholdConfigDialog";
import { TimeSeriesChart } from "@/components/findings/TimeSeriesChart";
import { apiClient, type SiteStandard, type MetricPreferences } from "@/lib/api";
import type { Finding } from "@/components/findings/types";
import { METRIC_KEYS } from "@/components/findings/MetricConfig";

interface ZoneDetailViewProps {
  zoneName: string;
  findings: Finding[];
  readings: Array<{
    metric_name: string;
    zone_name: string;
    timestamp: string;
    metric_value: number;
    is_outlier: boolean;
  }>;
  standards: SiteStandard[];
  siteId: string;
  metricPreferences: MetricPreferences;
}

const BAND_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WATCH: 1,
  GOOD: 2,
};

export function ZoneDetailView({
  zoneName,
  findings,
  readings,
  standards,
  siteId,
  metricPreferences,
}: ZoneDetailViewProps) {
  const [activeStandardId, setActiveStandardId] = useState(
    standards.find((s) => s.is_active)?.source_id ?? ""
  );
  const [activeMetrics, setActiveMetrics] = useState(
    metricPreferences.active_metrics.length > 0
      ? metricPreferences.active_metrics
      : METRIC_KEYS
  );

  const zoneFindings = findings.filter((f) => f.zone_name === zoneName);

  const filteredByStandard = useMemo(() => {
    if (!activeStandardId) return zoneFindings;
    return zoneFindings.filter(
      (f) => f.standard_id === activeStandardId
    );
  }, [zoneFindings, activeStandardId]);

  // Group by metric_name, keep the worst (highest severity) finding per metric
  const findingsByMetric = useMemo(() => {
    const grouped: Record<string, Finding> = {};
    for (const f of filteredByStandard) {
      const existing = grouped[f.metric_name];
      if (
        !existing ||
        (BAND_ORDER[f.threshold_band] ?? 99) <
          (BAND_ORDER[existing.threshold_band] ?? 99)
      ) {
        grouped[f.metric_name] = f;
      }
    }
    return grouped;
  }, [filteredByStandard]);

  const visibleMetrics = activeMetrics.filter((m) => findingsByMetric[m]);

  const handleToggleMetric = async (metric: string) => {
    const newMetrics = activeMetrics.includes(metric)
      ? activeMetrics.filter((m) => m !== metric)
      : [...activeMetrics, metric];
    setActiveMetrics(newMetrics);

    try {
      await apiClient.updateSitesMetricPreferences(siteId, {
        active_metrics: newMetrics,
      });
    } catch (err) {
      console.error("Failed to persist metric preference:", err);
    }
  };

  const chartReadings = readings.filter((r) => r.zone_name === zoneName);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">{zoneName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Standard Selector */}
        <StandardSelector
          standards={standards}
          activeStandardId={activeStandardId}
          onStandardChange={setActiveStandardId}
        />

        {/* Metric Selector */}
        <details className="rounded-md border p-2">
          <summary className="text-sm font-medium cursor-pointer">
            Show/Hide Metrics
          </summary>
          <div className="mt-2">
            <MetricSelector
              availableMetrics={METRIC_KEYS}
              activeMetrics={activeMetrics}
              onToggle={handleToggleMetric}
            />
          </div>
        </details>

        {/* Threshold Config */}
        <ThresholdConfigDialog
          metricName="co2_ppm"
          currentOverrides={metricPreferences.alert_threshold_overrides}
          rulebookBounds={{ min: 300, max: 5000 }}
          onSave={(overrides) => {
            apiClient.updateSitesMetricPreferences(siteId, {
              alert_threshold_overrides: {
                ...metricPreferences.alert_threshold_overrides,
                ...overrides,
              },
            }).catch(console.error);
          }}
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleMetrics.map((metric) => {
            const finding = findingsByMetric[metric];
            if (!finding) return null;
            return (
              <MetricCard
                key={metric}
                metricName={finding.metric_name}
                metricValue={finding.metric_value}
                metricUnit={""}
                thresholdBand={
                  finding.threshold_band as "GOOD" | "WATCH" | "CRITICAL"
                }
                interpretationText={finding.interpretation_text}
                recommendedAction={finding.recommended_action}
                workforceImpactText={finding.workforce_impact_text}
              />
            );
          })}
        </div>

        {visibleMetrics.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No metrics to display for this zone.
          </p>
        )}

        {/* Time Series Chart */}
        {chartReadings.length > 0 && (
          <div className="mt-4">
            <TimeSeriesChart
              metricKey={visibleMetrics[0] ?? "co2_ppm"}
              readings={chartReadings}
              activeZones={new Set([zoneName])}
              zoneColors={{ [zoneName]: "#3b82f6" }}
              onReadingClick={() => {}}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
