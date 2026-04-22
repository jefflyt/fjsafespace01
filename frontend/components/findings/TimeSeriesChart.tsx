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

function parseTimestamp(raw: string): Date {
  const trimmed = raw.trim();
  if (trimmed.includes("T")) return new Date(trimmed);
  const parts = trimmed.split(/\s+/);
  const [day, month, year] = parts[0].split("/").map(Number);
  const [hour = 0, minute = 0] = parts[1]?.split(":").map(Number) ?? [];
  return new Date(year, month - 1, day, hour, minute);
}

// Flexible Y domain: data-driven with padding, capped by config max
function computeYDomain(
  data: Record<string, unknown>[],
  zoneKeys: string[],
  configMax: number
): [number, number] {
  let maxVal = 0;
  for (const row of data) {
    for (const key of zoneKeys) {
      const v = row[key];
      if (typeof v === "number" && v > maxVal) maxVal = v;
    }
  }
  if (maxVal === 0) return [0, 5];
  const padded = Math.ceil(maxVal * 1.3);
  return [0, Math.min(padded, configMax)];
}

type Threshold = { y: number; color: string; dash: string; width: number; label: string };

// Build threshold lines that fall within the visible Y range
function buildThresholds(
  goodBand: [number, number],
  watchBand: [number, number][],
  criticalBand: [number, number][],
  unit: string,
  yMax: number
): Threshold[] {
  const seen = new Set<number>();
  const lines: Threshold[] = [];

  function add(y: number, color: string, dash: string, width: number, label: string) {
    const rounded = Math.round(y);
    if (seen.has(rounded) || y > yMax) return;
    seen.add(rounded);
    lines.push({ y, color, dash, width, label });
  }

  // GOOD upper boundary
  add(goodBand[1], "hsl(220 14% 60%)", "3 3", 1, `${goodBand[1]} ${unit}`);

  // WATCH upper boundaries
  for (const band of watchBand) {
    if (band[1] < 9999) {
      add(band[1], "#F6AD55", "5 5", 1.5, `${band[1]} ${unit}`);
    }
  }

  // CRITICAL lower boundaries only (the first point where danger starts)
  for (const band of criticalBand) {
    if (band[0] > 0) {
      add(band[0], "#E93D3D", "5 5", 1.5, `${band[0]} ${unit}`);
    }
  }

  return lines;
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

  const chartData = useMemo(() => {
    const metricReadings = readings.filter((r) => r.metric_name === metricKey);
    const byTimestamp = new Map<string, Record<string, unknown>>();
    for (const r of metricReadings) {
      const ts = r.timestamp.trim();
      if (!byTimestamp.has(ts)) byTimestamp.set(ts, { timestamp: ts });
      const row = byTimestamp.get(ts)!;
      row[r.zone_name] = r.metric_value;
      row[`${r.zone_name}_is_outlier`] = r.is_outlier;
      row[`${r.zone_name}_raw`] = r;
    }
    return Array.from(byTimestamp.values()).sort((a, b) =>
      (a.timestamp as string).localeCompare(b.timestamp as string)
    );
  }, [readings, metricKey]);

  if (chartData.length === 0) return null;

  const zoneKeys = Array.from(activeZones);
  const [yMin, yMax] = useMemo(
    () => computeYDomain(chartData, zoneKeys, config.yAxisDomain[1]),
    [chartData, zoneKeys, config.yAxisDomain]
  );

  const thresholds = useMemo(
    () => buildThresholds(config.goodBand, config.watchBand, config.criticalBand, config.unit, yMax),
    [config, yMax]
  );

  // Multi-day detection
  const dates = chartData.map((d) => parseTimestamp(d.timestamp as string));
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const isMultiDay =
    lastDate.getDate() !== firstDate.getDate() ||
    lastDate.getMonth() !== firstDate.getMonth() ||
    lastDate.getFullYear() !== firstDate.getFullYear();

  const uniqueDates = useMemo(() => {
    if (!isMultiDay) return [];
    const seen = new Set<string>();
    const result: { label: string; dataIdx: number }[] = [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    dates.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ label: `${months[d.getMonth()]} ${d.getDate()}`, dataIdx: i });
      }
    });
    return result;
  }, [dates, isMultiDay]);

  // Custom tick: time only
  const CustomTick = ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const d = parseTimestamp(payload.value);
    const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground) / 0.8)">
          {time}
        </text>
      </g>
    );
  };

  return (
    <Card className="shadow-sm animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground font-heading flex items-center gap-2">
          <span className="text-sm font-mono tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary">
            {config.symbol}
          </span>
          <span className="text-muted-foreground font-normal text-sm">{config.label} ({config.unit})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Multi-day date header — HTML, not inside SVG */}
        {isMultiDay && uniqueDates.length > 0 && (
          <div className="px-1 pb-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {uniqueDates[0].label}
            </span>
          </div>
        )}
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 15, right: 85, bottom: 50, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.08)" vertical={false} />

              <XAxis
                dataKey="timestamp"
                tick={<CustomTick />}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--muted-foreground) / 0.2)" }}
                angle={chartData.length > 20 ? -25 : 0}
                textAnchor={chartData.length > 20 ? "end" : "middle"}
                height={40}
                interval="preserveStartEnd"
              />

              <YAxis
                domain={[yMin, yMax]}
                tickLine={false}
                axisLine={false}
                allowDataOverflow
                tick={{ fill: "hsl(var(--muted-foreground) / 0.5)", fontSize: 10 }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
                formatter={(value: unknown, name: unknown, _item: unknown, _index: number, payload: unknown) => {
                  if (typeof value === "number" && typeof name === "string") {
                    const p = payload as Record<string, unknown>;
                    if (p[`${name}_raw`]) return [`${value} ${config.unit}`, name];
                  }
                  return null;
                }}
                labelFormatter={(label: unknown) => parseTimestamp(label as string).toLocaleString()}
              />

              {/* GOOD band — only if it intersects visible range */}
              {yMax >= config.goodBand[0] && (
                <ReferenceArea
                  y1={Math.max(config.goodBand[0], yMin)}
                  y2={Math.min(config.goodBand[1], yMax)}
                  fill="hsl(220 14% 92%)"
                  fillOpacity={0.4}
                  stroke="none"
                />
              )}

              {/* Threshold lines — only those within visible Y range, labels placed outside plot area */}
              {thresholds.map((t, i) => (
                <ReferenceLine
                  key={`threshold-${i}`}
                  y={t.y}
                  stroke={t.color}
                  strokeDasharray={t.dash}
                  strokeWidth={t.width}
                >
                  <Label
                    value={t.label}
                    position="right"
                    fill={t.color}
                    fontSize={9}
                    fontWeight={500}
                    dx={4}
                  />
                </ReferenceLine>
              ))}

              {/* Zone lines */}
              {zoneKeys.map((zone) => (
                <Line
                  key={zone}
                  type="monotone"
                  dataKey={zone}
                  stroke={zoneColors[zone] || "#8884d8"}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "white" }}
                  name={zone}
                  isAnimationActive={false}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
