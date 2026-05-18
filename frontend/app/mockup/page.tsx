'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  Activity,
  BarChart3,
  ShieldCheck,
  MapPin,
  Eye,
  EyeOff,
  GitCompare,
  Layers,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ── Mock Data ────────────────────────────────────────────────────────────────

const mockUploads = [
  { id: 'u1', scan_date: '2026-05-14T10:30:00Z', scan_type: 'continuous', parse_status: 'COMPLETE', outcome: 'PASS' },
  { id: 'u2', scan_date: '2026-05-12T14:00:00Z', scan_type: 'adhoc', parse_status: 'COMPLETE', outcome: 'WATCH' },
  { id: 'u3', scan_date: '2026-05-10T09:15:00Z', scan_type: 'continuous', parse_status: 'COMPLETE', outcome: 'PASS' },
  { id: 'u4', scan_date: '2026-05-07T16:45:00Z', scan_type: 'adhoc', parse_status: 'COMPLETE', outcome: 'FAIL' },
  { id: 'u5', scan_date: '2026-05-05T11:00:00Z', scan_type: 'continuous', parse_status: 'COMPLETE', outcome: 'PASS' },
  { id: 'u6', scan_date: '2026-05-01T08:00:00Z', scan_type: 'continuous', parse_status: 'COMPLETE', outcome: 'WATCH' },
  { id: 'u7', scan_date: '2026-04-28T13:30:00Z', scan_type: 'adhoc', parse_status: 'COMPLETE', outcome: 'PASS' },
];

const outcomeColors: Record<string, string> = {
  PASS: 'bg-green-500',
  WATCH: 'bg-yellow-500',
  FAIL: 'bg-red-500',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Mock CO2 readings for overlay demo — returns relative time format
function generateMockReadings(baseDate: Date, variance: number, baseCO2: number) {
  const data: Array<{ relativeMinutes: number; fullDate: Date; fullLabel: string; 'Lobby': number; 'Meeting Room': number; 'Open Office': number }> = [];
  for (let i = 0; i < 24; i++) {
    const time = new Date(baseDate.getTime() + i * 15 * 60000);
    const relativeMinutes = i * 15;
    const fullLabel = time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
      time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    data.push({
      relativeMinutes,
      fullDate: time,
      fullLabel,
      'Lobby': Math.round(baseCO2 + Math.sin(i / 4) * 80 * variance + (Math.random() - 0.5) * 30),
      'Meeting Room': Math.round(baseCO2 + 50 + Math.cos(i / 3) * 60 * variance + (Math.random() - 0.5) * 25),
      'Open Office': Math.round(baseCO2 - 30 + Math.sin(i / 5) * 100 * variance + (Math.random() - 0.5) * 40),
    });
  }
  return data;
}

const mockChartData = generateMockReadings(new Date(2026, 4, 14, 8, 0), 1.0, 450);
const mockOverlay1 = generateMockReadings(new Date(2026, 4, 12, 8, 0), 0.9, 500);
const mockOverlay2 = generateMockReadings(new Date(2026, 4, 10, 8, 0), 1.1, 400);
const mockOverlay3 = generateMockReadings(new Date(2026, 4, 7, 8, 0), 0.8, 550);

// ── Compact Scan Pill Strip ─────────────────────────────────────────────────

function ScanPillStrip() {
  const [selectedId, setSelectedId] = useState('u1');
  const [expanded, setExpanded] = useState(false);

  const latestScans = mockUploads.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Compact pill strip */}
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground shrink-0">Scan history:</span>
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
          {latestScans.map((scan) => {
            const isSelected = scan.id === selectedId;
            return (
              <button
                key={scan.id}
                onClick={() => setSelectedId(scan.id)}
                onDoubleClick={() => alert(`Would navigate to scan ${scan.id}`)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] whitespace-nowrap',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', outcomeColors[scan.outcome])} />
                {formatDate(scan.scan_date)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? 'Hide older scans ▴' : `Show all ${mockUploads.length} scans ▾`}
      </button>

      {/* Expanded table (only when expanded) */}
      {expanded && (
        <div className="rounded-md border animate-in fade-in slide-in-from-top-2 duration-200">
          <div style={{ maxHeight: '12rem', overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Outcome</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {mockUploads.map((scan) => (
                  <tr
                    key={scan.id}
                    className={cn(
                      'border-b last:border-0 cursor-pointer hover:bg-muted/50',
                      scan.id === selectedId && 'bg-primary/5'
                    )}
                    onClick={() => setSelectedId(scan.id)}
                  >
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(scan.scan_date)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={scan.scan_type === 'continuous' ? 'default' : 'outline'} className="text-xs">
                        {scan.scan_type === 'continuous' ? 'Continuous' : 'Adhoc'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">
                        <span className={cn('mr-1.5 h-2 w-2 rounded-full inline-block', outcomeColors[scan.outcome])} />
                        {scan.outcome}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Selected: {formatDate(mockUploads.find(s => s.id === selectedId)?.scan_date || '')}
        &nbsp;· Click to highlight · Double-click to navigate
      </p>
    </div>
  );
}

// ── Old bulky card (for comparison) ─────────────────────────────────────────

function OldScanHistory() {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-semibold">Scan History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div style={{ maxHeight: '9.75rem', overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[100px]">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[100px]">Status</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {mockUploads.map((scan) => (
                  <tr key={scan.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/50">
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(scan.scan_date)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={scan.scan_type === 'continuous' ? 'default' : 'outline'} className="text-xs">
                        {scan.scan_type === 'continuous' ? 'Continuous' : 'Adhoc'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={scan.parse_status === 'COMPLETE' ? 'default' : 'secondary'} className="text-xs">
                        {scan.parse_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Scan Data Overlay Comparison ─────────────────────────────────────────────

const OVERLAY_COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
const OVERLAY_DASH = ['6 4', '4 4', '2 4', '3 3', '5 3'];

function ScanDataOverlayDemo() {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedScans, setSelectedScans] = useState<string[]>([]);
  const [compareZone, setCompareZone] = useState('Lobby');
  const [compareType, setCompareType] = useState<'time' | 'cross'>('time');

  const zones = ['Lobby', 'Meeting Room', 'Open Office'];
  const zoneColors: Record<string, string> = {
    'Lobby': '#6366f1',
    'Meeting Room': '#f59e0b',
    'Open Office': '#10b981',
  };

  const historicalScans = mockUploads.slice(1); // skip current (latest)
  const adhocScans = historicalScans.filter(s => s.scan_type === 'adhoc');
  const continuousScans = historicalScans.filter(s => s.scan_type === 'continuous');

  // Time range for continuous scans
  const [continuousTimeRange, setContinuousTimeRange] = useState<'business' | 'full' | 'custom'>('business');

  function toggleScan(id: string) {
    if (selectedScans.includes(id)) {
      setSelectedScans(selectedScans.filter(s => s !== id));
    } else if (selectedScans.length < 4) {
      setSelectedScans([...selectedScans, id]);
    }
  }

  // Build combined chart data using RELATIVE TIME normalization
  // All scans align to minutes-from-scan-start (0, 15, 30, …) so overlays line up cleanly.
  // The tooltip carries the actual date/time per scan.
  const chartData = useMemo(() => {
    if (compareType === 'time' && selectedScans.length === 0) {
      // Default: show current scan zones, keep relative time for consistency
      return mockChartData.map(r => ({ relativeMinutes: r.relativeMinutes, fullLabel: r.fullLabel, u1: (r as any)[compareZone] }));
    }

    if (compareType === 'time' && selectedScans.length > 0) {
      const allScans = ['u1', ...selectedScans];
      const scanDataMap: Record<string, typeof mockChartData> = {
        u1: mockChartData,
        u2: mockOverlay1,
        u3: mockOverlay2,
        u4: mockOverlay3,
      };

      // Collect all unique relative minutes across selected scans
      const minSet = new Set<number>();
      for (const sid of allScans) {
        const d = scanDataMap[sid];
        if (d) d.forEach(r => minSet.add(r.relativeMinutes));
      }
      const allMinutes = Array.from(minSet).sort((a, b) => a - b);

      return allMinutes.map(min => {
        const row: Record<string, unknown> = { relativeMinutes: min };
        for (const sid of allScans) {
          const d = scanDataMap[sid];
          if (!d) continue;
          const match = d.find(r => r.relativeMinutes === min);
          row[sid] = match ? (match as any)[compareZone] : null;
          // Store fullLabel per scan for tooltip context
          if (match) {
            row[`${sid}_fullLabel`] = (match as any).fullLabel;
          }
        }
        return row;
      });
    }

    // cross mode: all zones, current scan only (for now)
    return mockChartData.map(r => ({
      relativeMinutes: r.relativeMinutes,
      fullLabel: r.fullLabel,
      'Lobby': r['Lobby'],
      'Meeting Room': r['Meeting Room'],
      'Open Office': r['Open Office'],
    }));
  }, [compareType, selectedScans, compareZone]);

  return (
    <div className="space-y-4">
      {/* Zone filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Filter by zone:</span>
        {zones.map((z) => (
          <button
            key={z}
            onClick={() => setCompareZone(z)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]',
              compareZone === z
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {z}
          </button>
        ))}
      </div>

      {/* Compare toggle + mode selector */}
      <div className="flex items-center gap-3">
        <Button
          variant={compareMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setCompareMode(!compareMode);
            if (compareMode) setSelectedScans([]);
          }}
        >
          <BarChart3 className="mr-1.5 h-4 w-4" />
          Compare Scans
          {compareMode && (
            <Badge variant="secondary" className="ml-1.5 text-xs">
              {selectedScans.length + 1}
            </Badge>
          )}
        </Button>
        {compareMode && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setCompareType('time')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors',
                  compareType === 'time'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                )}
              >
                <GitCompare className="h-3 w-3" />
                Same zone, diff scans
              </button>
              <button
                onClick={() => setCompareType('cross')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border-l',
                  compareType === 'cross'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                )}
              >
                <Layers className="h-3 w-3" />
                Cross-zone
              </button>
            </div>
          </>
        )}
      </div>

      {/* Comparison mode description */}
      {compareMode && compareType === 'time' && (
        <p className="text-xs text-muted-foreground">
          Showing <strong>{compareZone}</strong> across {selectedScans.length + 1} scans.
          Each line = one scan date. Helps you see if readings improved or worsened over time.
        </p>
      )}
      {compareMode && compareType === 'cross' && (
        <p className="text-xs text-muted-foreground">
          Showing all zones across scans. Helps you see which zones consistently have higher readings.
        </p>
      )}

      {/* Scan selector panel */}
      {compareMode && (
        <div className="rounded-md border p-4 bg-muted/20 space-y-4">
          {/* Adhoc scans — direct select */}
          <div>
            <p className="text-xs font-medium mb-2">Adhoc scans</p>
            <div className="flex flex-wrap gap-3">
              {adhocScans.length === 0 && (
                <span className="text-xs text-muted-foreground">No adhoc scans available.</span>
              )}
              {adhocScans.map((scan, idx) => {
                const isChecked = selectedScans.includes(scan.id);
                return (
                  <label
                    key={scan.id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors',
                      isChecked ? 'bg-white shadow-sm border border-border' : 'hover:bg-muted/50'
                    )}
                  >
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleScan(scan.id)} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: OVERLAY_COLORS[idx + 1] }} />
                        <span className="text-xs font-medium">{formatDate(scan.scan_date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn('h-1.5 w-1.5 rounded-full', outcomeColors[scan.outcome])} />
                        <span className="text-[10px] text-muted-foreground">{scan.outcome}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Continuous scans — require time range selection */}
          {continuousScans.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2">Continuous monitoring</p>
              <p className="text-[11px] text-muted-foreground mb-2">
                Select a time range before comparing — continuous data spans too long to overlay directly.
              </p>
              {/* Time range picker */}
              <div className="flex gap-2 mb-3">
                {(['business', 'full', 'custom'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setContinuousTimeRange(range)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs transition-colors border',
                      continuousTimeRange === range
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background hover:bg-muted'
                    )}
                  >
                    {range === 'business' ? 'Business hours' : range === 'full' ? 'Full day' : 'Custom range'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                {continuousScans.map((scan, idx) => {
                  const isChecked = selectedScans.includes(scan.id);
                  const offset = adhocScans.length + idx + 1;
                  return (
                    <label
                      key={scan.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors',
                        isChecked ? 'bg-white shadow-sm border border-border' : 'hover:bg-muted/50'
                      )}
                    >
                      <Checkbox checked={isChecked} onCheckedChange={() => toggleScan(scan.id)} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: OVERLAY_COLORS[offset % OVERLAY_COLORS.length] }} />
                          <span className="text-xs font-medium">{formatDate(scan.scan_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full', outcomeColors[scan.outcome])} />
                          <span className="text-[10px] text-muted-foreground">
                            {scan.outcome} · {continuousTimeRange === 'business' ? '9am–6pm' : continuousTimeRange === 'full' ? '24h' : 'custom'}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground font-heading">
              <span className="text-muted-foreground font-normal text-sm">
                CO₂ (ppm){compareMode && compareType === 'time' && ` — ${compareZone}`}
              </span>
            </CardTitle>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" className="rounded border-border accent-primary" />
              Show thresholds
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 15, right: 85, bottom: 50, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.08)" vertical={false} />
                <XAxis
                  dataKey="relativeMinutes"
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--muted-foreground) / 0.2)' }}
                  tick={{ fill: 'hsl(var(--muted-foreground) / 0.5)', fontSize: 10 }}
                  height={40}
                  tickFormatter={(val: number) => {
                    if (val === 0) return '0';
                    if (val < 60) return `${val}m`;
                    const h = Math.floor(val / 60);
                    const m = val % 60;
                    return m === 0 ? `${h}h` : `${h}h${m}m`;
                  }}
                />
                <YAxis
                  domain={[300, 800]}
                  ticks={[300, 400, 500, 600, 700, 800]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground) / 0.5)', fontSize: 10 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const relativeMin = label as number;
                    const h = Math.floor(relativeMin / 60);
                    const m = relativeMin % 60;
                    const relStr = h === 0 ? `${m}m` : `${h}h${m === 0 ? '' : ` ${m}m`}`;
                    return (
                      <div style={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '11px', color: 'hsl(var(--foreground))' }}>
                          {relativeMin === 0 ? 'Start' : `+${relStr}`}
                        </p>
                        {(payload as any[]).map((entry, i) => {
                          const scanId = entry.dataKey as string;
                          const payloadRow = entry.payload as Record<string, unknown>;
                          const fullLabel = (payloadRow[`${scanId}_fullLabel`] as string) ?? (payloadRow.fullLabel as string | undefined);
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
                              <span style={{ color: entry.color, fontSize: '10px' }}>●</span>
                              <span style={{ fontWeight: 500, color: entry.color }}>
                                {entry.name}:
                              </span>
                              <span>{entry.value} ppm</span>
                              {fullLabel && (
                                <span style={{ fontSize: '9px', color: 'hsl(var(--muted-foreground))' }}>
                                  ({fullLabel})
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />

                {/* GOOD band */}
                <rect x="0" y="0" width="100%" height="100%" fill="none" />

                {compareType === 'time' && selectedScans.length > 0 ? (
                  /* Same-zone-across-scans mode: one line per scan */
                  <>
                    {/* Current scan (u1) — solid, thick */}
                    <Line
                      key="u1"
                      type="monotone"
                      dataKey="u1"
                      name={`Current (${formatDate(mockUploads[0].scan_date)})`}
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                      isAnimationActive={false}
                    />
                    {/* Historical scans — dashed, slightly thinner */}
                    {selectedScans.map((scanId, idx) => {
                      const scan = mockUploads.find(s => s.id === scanId);
                      return (
                        <Line
                          key={scanId}
                          type="monotone"
                          dataKey={scanId}
                          name={formatDate(scan?.scan_date || '')}
                          stroke={OVERLAY_COLORS[(idx + 1) % OVERLAY_COLORS.length]}
                          strokeWidth={2}
                          strokeDasharray={OVERLAY_DASH[idx % OVERLAY_DASH.length]}
                          dot={false}
                          activeDot={false}
                          isAnimationActive={false}
                          opacity={0.8}
                        />
                      );
                    })}
                  </>
                ) : compareType === 'cross' ? (
                  /* Cross-zone mode: current scan, all zones */
                  zones.map((zone) => (
                    <Line
                      key={zone}
                      type="monotone"
                      dataKey={zone}
                      name={zone}
                      stroke={zoneColors[zone]}
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                      isAnimationActive={false}
                    />
                  ))
                ) : (
                  /* Default: no comparison, just current scan zones */
                  zones.map((zone) => (
                    <Line
                      key={zone}
                      type="monotone"
                      dataKey={zone}
                      name={zone}
                      stroke={zoneColors[zone]}
                      strokeWidth={2.5}
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                      isAnimationActive={false}
                    />
                  ))
                )}

                <Legend
                  wrapperStyle={{ fontSize: '11px' }}
                  iconType="circle"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend for time-compare mode */}
          {compareMode && compareType === 'time' && selectedScans.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <div className="text-xs text-muted-foreground font-medium">
                Zone: {compareZone}
              </div>
              {/* Current scan */}
              <div className="flex items-center gap-1.5">
                <svg width="24" height="8">
                  <line x1="0" y1="4" x2="24" y2="4" stroke="#6366f1" strokeWidth="2.5" />
                </svg>
                <span className="text-xs font-medium">Current</span>
                <span className="text-xs text-muted-foreground">({formatDate(mockUploads[0].scan_date)})</span>
              </div>
              {/* Historical scans */}
              {selectedScans.map((scanId, idx) => {
                const scan = mockUploads.find(s => s.id === scanId);
                const color = OVERLAY_COLORS[(idx + 1) % OVERLAY_COLORS.length];
                const dash = OVERLAY_DASH[idx % OVERLAY_DASH.length];
                return (
                  <div key={scanId} className="flex items-center gap-1.5">
                    <svg width="24" height="8">
                      <line x1="0" y1="4" x2="24" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} />
                    </svg>
                    <span className="text-xs text-muted-foreground">{formatDate(scan?.scan_date || '')}</span>
                    <span className={cn('h-1.5 w-1.5 rounded-full', outcomeColors[scan?.outcome || 'PASS'])} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Mockup Page ─────────────────────────────────────────────────────────

export default function MockupPage() {
  const [view, setView] = useState<'compact' | 'overlay' | 'both'>('both');

  return (
    <div className="min-h-screen bg-background">
      {/* Mockup navigation bar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted-foreground">Mockup:</span>
          <div className="flex gap-1">
            {(['both', 'compact', 'overlay'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {v === 'both' ? 'Both Views' : v === 'compact' ? 'Compact Pills' : 'Scan Overlay'}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Mock data only — no API calls
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* ── View 1: Compact Scan Pills ─────────────────────────────── */}
        {(view === 'both' || view === 'compact') && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-heading font-semibold">Certification Results — Scan History</h2>
            </div>

            {/* BEFORE */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5" />
                BEFORE — Current bulky card (~180px height)
              </h3>
              <div className="rounded-lg border-2 border-dashed border-amber-300/50 p-4 bg-amber-50/30">
                <OldScanHistory />
              </div>
            </div>

            {/* AFTER */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" />
                AFTER — Compact pill strip (~40px height)
              </h3>
              <div className="rounded-lg border-2 border-dashed border-green-300/50 p-4 bg-green-50/30">
                <ScanPillStrip />
              </div>
            </div>
          </div>
        )}

        {/* ── View 2: Scan Data Overlay ──────────────────────────────── */}
        {(view === 'both' || view === 'overlay') && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-heading font-semibold">Scan Data — Compare Scans Overlay</h2>
            </div>
            <div className="rounded-lg border-2 border-dashed border-blue-300/50 p-4 bg-blue-50/30">
              <ScanDataOverlayDemo />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
