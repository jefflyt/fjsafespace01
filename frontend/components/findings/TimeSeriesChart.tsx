"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Label,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { METRIC_CONFIGS } from "./MetricConfig";
import type { Finding } from "./types";

interface Reading {
  metric_name: string;
  zone_name: string;
  timestamp: string;
  metric_value: number;
  is_outlier: boolean;
}

interface TimeSeriesChartProps {
  metricKey: string;
  readings: Reading[];
  activeZones: Set<string>;
  zoneColors: Record<string, string>;
  onReadingClick: (reading: Reading) => void;
}

export function TimeSeriesChart({
  metricKey,
  readings,
  activeZones,
  zoneColors,
  onReadingClick,
}: TimeSeriesChartProps) {
  const config = METRIC_CONFIGS[metricKey];
  if (!config) return null;

  // Build chart data: filter by metricKey, group by timestamp, one column per zone
  const chartData = useMemo(() => {
    const metricReadings = readings.filter((r) => r.metric_name === metricKey);
    const byTimestamp = new Map<string, Record<string, unknown>>();
    for (const r of metricReadings) {
      if (!byTimestamp.has(r.timestamp)) {
        byTimestamp.set(r.timestamp, { timestamp: r.timestamp });
      }
      const row = byTimestamp.get(r.timestamp)!;
      row[r.zone_name] = r.metric_value;
      row[`${r.zone_name}_is_outlier`] = r.is_outlier;
      row[`${r.zone_name}_raw`] = r;
    }
    return Array.from(byTimestamp.values()).sort((a, b) =>
      (a.timestamp as string).localeCompare(b.timestamp as string)
    );
  }, [readings, metricKey]);

  if (chartData.length === 0) return null;

  // Determine time format based on data span
  const firstDate = new Date(chartData[0].timestamp as string);
  const lastDate = new Date(chartData[chartData.length - 1].timestamp as string);
  const isMultiDay = lastDate.getDate() !== firstDate.getDate() ||
    lastDate.getMonth() !== firstDate.getMonth();

  return (
    <Card className="border-[--border] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-[--fj-dark] font-heading flex items-center gap-2">
          <span className="text-sm font-mono tabular-nums px-2 py-0.5 rounded-md bg-[--fj-purple]/10 text-[--fj-purple]">
            {config.symbol}
          </span>
          <span className="text-fj-gray font-normal text-sm">{config.label} ({config.unit})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 20, bottom: 30, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground) / 0.15)"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--muted-foreground) / 0.3)" }}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(value: string) => {
                  const d = new Date(value);
                  return isMultiDay
                    ? `${d.getDate()}/${d.getMonth() + 1}`
                    : `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                }}
              />
              <YAxis
                domain={config.yAxisDomain}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
                formatter={(value: unknown, name: unknown, _item: unknown, _index: number, payload: unknown) => {
                  if (typeof value === "number" && typeof name === "string") {
                    const p = payload as Record<string, unknown>;
                    const raw = p[`${name}_raw`];
                    if (raw) {
                      return [`${value} ${config.unit}`, name];
                    }
                  }
                  return null;
                }}
                labelFormatter={(label: unknown) => {
                  const d = new Date(label as string);
                  return d.toLocaleString();
                }}
              />
              {/* GOOD band background */}
              <ReferenceArea
                y1={config.goodBand[0]}
                y2={config.goodBand[1]}
                fill="#37CA37"
                fillOpacity={0.07}
                stroke="none"
              />
              {/* Threshold lines */}
              <ReferenceLine
                y={config.goodBand[1]}
                stroke="#37CA37"
                strokeDasharray="5 5"
                strokeWidth={1.5}
              >
                <Label
                  value={`${config.goodBand[1]} ${config.unit}`}
                  position="right"
                  fill="#37CA37"
                  fontSize={10}
                  offset={5}
                />
              </ReferenceLine>
              {config.watchBand.map((band, i) => (
                <ReferenceLine
                  key={`watch-${i}`}
                  y={band[1] < 9999 ? band[1] : undefined}
                  stroke="#F6AD55"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                >
                  {band[1] < 9999 && (
                    <Label
                      value={`${band[1]} ${config.unit}`}
                      position="right"
                      fill="#F6AD55"
                      fontSize={10}
                      offset={5}
                    />
                  )}
                </ReferenceLine>
              ))}
              {/* One line per active zone */}
              {Array.from(activeZones).map((zone) => (
                <Line
                  key={zone}
                  type="monotone"
                  dataKey={zone}
                  stroke={zoneColors[zone] || "#8884d8"}
                  strokeWidth={2.5}
                  dot={{ r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }}
                  name={zone}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
