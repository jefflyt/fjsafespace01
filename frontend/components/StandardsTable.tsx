'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Info, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { apiClient, type RulebookRule } from '@/lib/api';
import type { Finding } from '@/components/findings/types';

interface StandardEntry {
  sourceId: string;
  title: string;
  shortTitle: string;
  score: number | null;
  outcome: string;
  metricCount: number;
  findings: Finding[];
}

interface StandardsTableProps {
  standards: StandardEntry[];
  activeStandardId: string;
  onStandardChange: (sourceId: string) => void;
}

function getOutcomeBadge(outcome: string) {
  switch (outcome) {
    case 'PASS':
    case 'HEALTHY_WORKPLACE_CERTIFIED':
      return { icon: ShieldCheck, label: 'Certified', color: 'text-green-700 bg-green-50 border-green-200' };
    case 'FAIL':
    case 'IMPROVEMENT_REQUIRED':
    case 'IMPROVEMENT_RECOMMENDED':
      return { icon: ShieldAlert, label: 'Action Required', color: 'text-red-700 bg-red-50 border-red-200' };
    case 'COMING_SOON':
      return { icon: Info, label: 'Coming Soon', color: 'text-gray-700 bg-gray-50 border-gray-200' };
    case 'INSUFFICIENT_EVIDENCE':
      return { icon: Info, label: 'Partial Evidence', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    default:
      return { icon: Info, label: 'No Data', color: 'text-gray-700 bg-gray-50 border-gray-200' };
  }
}

function getScoreColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function shortTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('ss 554') || lower.includes('ss554')) return 'SS 554';
  if (lower.includes('well')) return 'WELL v2';
  if (lower.includes('reset')) return 'RESET Viral';
  if (lower.includes('safespace')) return 'SafeSpace IAQ';
  return title.length > 30 ? title.slice(0, 30) + '…' : title;
}

function formatThreshold(rule: RulebookRule): string {
  const { threshold_type, min_value, max_value } = rule;
  if (threshold_type === 'range' && min_value != null && max_value != null) return `${min_value}–${max_value}`;
  if (threshold_type === 'upper_bound' && max_value != null) return `≤ ${max_value}`;
  if (threshold_type === 'lower_bound' && min_value != null) return `≥ ${min_value}`;
  if (min_value != null && max_value != null) return `${min_value}–${max_value}`;
  if (max_value != null) return `≤ ${max_value}`;
  if (min_value != null) return `≥ ${min_value}`;
  return '—';
}

// ── Certification Threshold Popup ────────────────────────────────────────────

interface ThresholdPopupProps {
  sourceId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ThresholdPopup({ sourceId, title, open, onOpenChange }: ThresholdPopupProps) {
  const [rules, setRules] = useState<RulebookRule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getRulebookRulesBySource(sourceId);
      setRules(Array.isArray(data) ? data : []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    if (open && sourceId) fetchRules();
  }, [open, sourceId, fetchRules]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{shortTitle(title)}</DialogTitle>
          <DialogDescription>Threshold criteria defined by this certification standard.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {title?.toLowerCase().includes('safespace')
              ? 'Coming soon — SafeSpace criteria under development.'
              : 'No criteria found for this standard.'}
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead className="w-[60px]">Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.metric_name.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatThreshold(rule)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rule.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Standards Table ──────────────────────────────────────────────────────────

export function StandardsTable({ standards, activeStandardId, onStandardChange }: StandardsTableProps) {
  const [popupSourceId, setPopupSourceId] = useState<string | null>(null);
  const popupTitle = standards.find((s) => s.sourceId === popupSourceId)?.title ?? '';

  if (standards.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No standards configured for this site.</p>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32px]" />
              <TableHead>Certification</TableHead>
              <TableHead className="w-[80px] text-right">Score</TableHead>
              <TableHead className="w-[100px]">Metrics</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {standards.map((std) => {
              const badge = getOutcomeBadge(std.outcome);
              const BadgeIcon = badge.icon;
              const isActive = std.sourceId === activeStandardId;

              return (
                <TableRow
                  key={std.sourceId}
                  className={`cursor-pointer hover:bg-muted/50 ${isActive ? 'bg-muted/30' : ''}`}
                  onClick={() => onStandardChange(std.sourceId)}
                >
                  <TableCell>
                    <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  </TableCell>
                  <TableCell className="font-medium">{std.shortTitle}</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${getScoreColor(std.score)}`}>
                    {std.score != null ? Math.round(std.score) : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{std.metricCount}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${badge.color}`}>
                      <BadgeIcon className="h-2.5 w-2.5" />
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopupSourceId(std.sourceId);
                      }}
                      aria-label={`View ${std.shortTitle} criteria`}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ThresholdPopup
        sourceId={popupSourceId ?? ''}
        title={popupTitle}
        open={popupSourceId !== null}
        onOpenChange={(open) => {
          if (!open) setPopupSourceId(null);
        }}
      />
    </>
  );
}
