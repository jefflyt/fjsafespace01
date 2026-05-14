"use client";

import { useMemo, useState } from "react";
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
import { METRIC_CONFIGS, MetricConfig } from "./MetricConfig";

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
  showThresholds?: boolean;
}

function parseTimestamp(raw: string): Date {
  const trimmed = raw.trim();
  if (trimmed.includes("T")) return new Date(trimmed);
  const parts = trimmed.split(/\s+/);
  const [day, month, year] = parts[0].split("/").map(Number);
  const [hour = 0, minute = 0] = parts[1]?.split(":").map(Number) ?? [];
  // Normalize 2-digit year (e.g. 26 → 2026)
  const fullYear = year < 100 ? year + 2000 : year;
  return new Date(fullYear, month - 1, day, hour, minute);
}

// Data-driven Y domain with 10% padding
function computeYDomain(
  data: Record<string, unknown>[],
  zoneKeys: string[],
): [number, number] {
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (const row of data) {
    for (const key of zoneKeys) {
      const v = row[key];
      if (typeof v === "number") {
        if (v < dataMin) dataMin = v;
        if (v > dataMax) dataMax = v;
      }
    }
  }
  if (!isFinite(dataMin) || !isFinite(dataMax)) return [0, 1];

  const range = dataMax - dataMin;
  if (range === 0) return [dataMin, dataMax + 1];

  const pad = range * 0.1;
  let yMin = dataMin - pad;
  let yMax = dataMax + pad;

  // Clamp yMin to 0 for metrics that can't go negative
  if (yMin < 0) yMin = 0;

  return [Math.round(yMin), Math.round(yMax)];
}

// Generate clean, evenly-spaced tick values
function generateNiceTicks(min: number, max: number, targetCount: number = 5): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const roughStep = range / (targetCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let niceStep: number;
  if (normalized <= 1.5) niceStep = 1 * magnitude;
  else if (normalized <= 3) niceStep = 2 * magnitude;
  else if (normalized <= 7) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const ticks: number[] = [];
  let tick = Math.ceil(min / niceStep) * niceStep;
  while (tick <= max) {
    ticks.push(Math.round(tick * 1e10) / 1e10);
    tick += niceStep;
  }
  return ticks;
}

// Custom tooltip with zone color dots and outlier indicators
function ChartTooltip({
  active,
  payload,
  label,
  metricConfig,
  zoneColors,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Record<string, unknown>>;
  label?: string | number;
  metricConfig: MetricConfig;
  zoneColors: Record<string, string>;
}) {
  if (!active || !payload?.length || !label) return null;

  const d = parseTimestamp(typeof label === "string" ? label : String(label));
  const timeLabel = d.toLocaleString("en-GB");

  return (
    <div
      style={{
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
        {timeLabel}
      </p>
      {payload.map((entry, i) => {
        const zoneName = String(entry.dataKey ?? entry.name ?? "");
        const raw = entry[`${zoneName}_raw`] as Reading | undefined;
        return (
          <div
            key={`tooltip-${i}`}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 0" }}
          >
            <span style={{ color: zoneColors[zoneName] || "#8884d8", fontSize: "10px" }}>●</span>
            <span style={{ fontWeight: 500, color: zoneColors[zoneName] || "#8884d8" }}>
              {zoneName}:
            </span>
            <span>
              {String(entry.value)} {metricConfig.unit}
            </span>
            {raw?.is_outlier && (
              <span style={{ color: "#ef4444", fontSize: "10px" }}>⚠ outlier</span>
            )}
          </div>
        );
      })}
    </div>
  );
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

// Custom X-axis tick: time only
function CustomTick({ x, y, payload }: { x: number; y: number; payload: { value: string } }) {
  const d = parseTimestamp(payload.value);
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const time = `${hours}:${minutes}`;
  return (
    <g transform={`translate(${x},${y + 15})`}>
      <text x={0} y={0} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground) / 0.8)">
        {time}
      </text>
    </g>
  );
}

export function TimeSeriesChart({
  metricKey,
  readings,
  activeZones,
  zoneColors,
  onReadingClick,
  showThresholds: initialShowThresholds = false,
}: TimeSeriesChartProps) {
  const config = METRIC_CONFIGS[metricKey];
  const [showThresholds, setShowThresholds] = useState(initialShowThresholds);

  const chartData = useMemo(() => {
    if (!config) return [];
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
  }, [readings, metricKey, config]);

  const zoneKeys = Array.from(activeZones);
  const [yMin, yMax] = useMemo(
    () => computeYDomain(chartData, zoneKeys),
    [chartData, zoneKeys]
  );
  const yTicks = useMemo(() => generateNiceTicks(yMin, yMax), [yMin, yMax]);

  const thresholds = useMemo(
    () => config ? buildThresholds(config.goodBand, config.watchBand, config.criticalBand, config.unit, yMax) : [],
    [config, yMax]
  );

  // Multi-day detection
  const { dates, isMultiDay } = useMemo(() => {
    if (chartData.length === 0 || !config) return { dates: [] as Date[], isMultiDay: false };
    const d = chartData.map((r) => parseTimestamp(r.timestamp as string));
    const multi = d.length >= 2 && (
      d[d.length - 1].getDate() !== d[0].getDate() ||
      d[d.length - 1].getMonth() !== d[0].getMonth() ||
      d[d.length - 1].getFullYear() !== d[0].getFullYear()
    );
    return { dates: d, isMultiDay: multi };
  }, [chartData, config]);

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

  // Time-based X-axis ticks: 2-minute intervals from first reading
  const xTicks = useMemo(() => {
    if (dates.length === 0) return [];
    const ticks: string[] = [];
    const first = dates[0];
    const last = dates[dates.length - 1];
    const tick = new Date(first);
    tick.setSeconds(0, 0); // snap to even minute
    while (tick <= last) {
      // Find the data point closest to this tick time
      let closestIdx = 0;
      let closestDiff = Infinity;
      for (let i = 0; i < dates.length; i++) {
        const diff = Math.abs(dates[i].getTime() - tick.getTime());
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = i;
        }
      }
      ticks.push(chartData[closestIdx].timestamp as string);
      tick.setMinutes(tick.getMinutes() + 2);
    }
    return ticks;
  }, [dates, chartData]);

  if (!config || chartData.length === 0) return null;

  return (
    <Card className="shadow-sm animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground font-heading">
            <span className="text-muted-foreground font-normal text-sm">
              {config.label}
              {config.unit ? ` (${config.unit})` : ""}
            </span>
          </CardTitle>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showThresholds}
              onChange={(e) => setShowThresholds(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            Show thresholds
          </label>
        </div>
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
                tick={(props: any) => <CustomTick {...props} />}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--muted-foreground) / 0.2)" }}
                height={40}
                ticks={xTicks}
              />

              <YAxis
                domain={[yMin, yMax]}
                ticks={yTicks}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground) / 0.5)", fontSize: 10 }}
              />

              <Tooltip
                content={({ active, payload: tipPayload, label }) => (
                  <ChartTooltip
                    active={active ?? undefined}
                    payload={tipPayload as unknown as ReadonlyArray<Record<string, unknown>>}
                    label={label}
                    metricConfig={config}
                    zoneColors={zoneColors}
                  />
                )}
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

              {/* Threshold lines — conditionally rendered */}
              {showThresholds && thresholds.map((t, i) => (
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

              {/* Zone lines with visible dots */}
              {zoneKeys.map((zone) => (
                <Line
                  key={zone}
                  type="monotone"
                  dataKey={zone}
                  stroke={zoneColors[zone] || "#8884d8"}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: zoneColors[zone] || "#8884d8" }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "white" }}
                  name={zone}
                  isAnimationActive={false}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Zone color legend */}
        {zoneKeys.length > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
            {zoneKeys.map((zone) => (
              <div key={zone} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: zoneColors[zone] || "#8884d8" }}
                />
                <span className="text-xs text-muted-foreground">{zone}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
