"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Label,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { METRIC_CONFIGS, BAND_COLORS } from "./MetricConfig";
import type { Finding } from "./types";

interface ChartDataPoint {
  zone_name: string;
  metric_value: number;
  threshold_band: string;
  finding: Finding;
}

interface MetricChartProps {
  metricKey: string;
  findings: Finding[];
  onBarClick: (finding: Finding) => void;
}

export function MetricChart({ metricKey, findings, onBarClick }: MetricChartProps) {
  const config = METRIC_CONFIGS[metricKey];
  if (!config) return null;

  // Get latest finding per zone for this metric
  const chartData: ChartDataPoint[] = useMemo(() => {
    const byZone = new Map<string, Finding>();
    for (const f of findings) {
      if (f.metric_name !== metricKey) continue;
      const existing = byZone.get(f.zone_name);
      const isNew = !existing ||
        (f.created_at && existing.created_at && new Date(f.created_at) > new Date(existing.created_at));
      if (isNew) {
        byZone.set(f.zone_name, f);
      }
    }
    return Array.from(byZone.entries()).map(([zone, finding]) => ({
      zone_name: zone,
      metric_value: finding.metric_value,
      threshold_band: finding.threshold_band,
      finding,
    }));
  }, [findings, metricKey]);

  if (chartData.length === 0) return null;

  // Determine if we need rotated labels (more than 5 zones)
  const angle = chartData.length > 6 ? -30 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {config.symbol} — {config.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, bottom: 40, left: 0 }}
              onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload?.finding) {
                  onBarClick(e.activePayload[0].payload.finding);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis
                dataKey="zone_name"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                angle={angle}
                textAnchor={angle ? "end" : "middle"}
                height={angle ? 60 : 30}
                interval={0}
              />
              <YAxis
                domain={config.yAxisDomain}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                formatter={(value: unknown) => [`${value} ${config.unit}`, config.label]}
                labelFormatter={(label: unknown) => `Zone: ${label}`}
              />
              {/* GOOD band background */}
              <ReferenceArea
                y1={config.goodBand[0]}
                y2={config.goodBand[1]}
                fill="hsl(142 71% 45%)"
                fillOpacity={0.08}
                stroke="none"
              />
              {/* Threshold lines */}
              <ReferenceLine
                y={config.goodBand[1]}
                stroke="#22c55e"
                strokeDasharray="5 5"
                strokeWidth={1.5}
              >
                <Label
                  value={`${config.goodBand[1]} ${config.unit}`}
                  position="right"
                  fill="#22c55e"
                  fontSize={10}
                  offset={5}
                />
              </ReferenceLine>
              {/* WATCH upper boundary (if exists) */}
              {config.watchBand.map((band, i) => (
                <ReferenceLine
                  key={`watch-${i}`}
                  y={band[1] < 9999 ? band[1] : undefined}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                >
                  {band[1] < 9999 && (
                    <Label
                      value={`${band[1]} ${config.unit}`}
                      position="right"
                      fill="#f59e0b"
                      fontSize={10}
                      offset={5}
                    />
                  )}
                </ReferenceLine>
              ))}
              <Bar
                dataKey="metric_value"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                name={config.label}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAND_COLORS[entry.threshold_band as keyof typeof BAND_COLORS] || "#94a3b8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
