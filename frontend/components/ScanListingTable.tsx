'use client';

import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SiteListingRow } from '@/lib/api';
import { ArrowRight, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getOutcomeConfig, getScoreColor, formatDate } from '@/lib/utils';

interface ScanListingTableProps {
  data: SiteListingRow[];
  loading: boolean;
  onRowClick: (siteId: string, allSiteIds?: string[]) => void;
}

function outcomeBadge(outcome: string, scanCount: number) {
  const config = getOutcomeConfig(outcome);
  if (outcome.includes('INSUFFICIENT') && scanCount > 0) {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Processed</Badge>;
  }
  return <Badge className={`${config.bg} ${config.color} hover:${config.bg}`}>{config.label}</Badge>;
}

interface GroupedTenant {
  tenantName: string;
  sites: SiteListingRow[];
  totalScans: number;
}

function groupByTenant(data: SiteListingRow[]): GroupedTenant[] {
  const map = new Map<string, SiteListingRow[]>();
  for (const row of data) {
    const key = row.tenant_name ?? '—';
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return Array.from(map.entries()).map(([tenantName, sites]) => ({
    tenantName,
    sites,
    totalScans: sites.reduce((sum, s) => sum + s.scan_count, 0),
  }));
}

export function ScanListingTable({ data, loading, onRowClick }: ScanListingTableProps) {
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByTenant(data), [data]);

  const toggleTenant = useCallback((name: string) => {
    setExpandedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No scan data found. Upload a CSV to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Customer</TableHead>
          <TableHead>Site</TableHead>
          <TableHead className="text-right">Scans</TableHead>
          <TableHead>Last Scan</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const isExpanded = expandedTenants.has(group.tenantName);
          return (
            <>
              <TableRow
                key={`tenant-${group.tenantName}`}
                className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleTenant(group.tenantName)}
              >
                <TableCell>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </TableCell>
                <TableCell colSpan={2} className="font-medium">
                  {group.tenantName}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {group.totalScans}
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
              {isExpanded &&
                group.sites.map((site) => (
                  <TableRow
                    key={site.site_id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => onRowClick(site.site_id, site.all_site_ids)}
                  >
                    <TableCell />
                    <TableCell className="text-muted-foreground">{group.tenantName}</TableCell>
                    <TableCell className="font-medium">
                      {site.site_name}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {site.scan_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(site.last_scan_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {site.scan_type || 'Adhoc'}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${getScoreColor(site.wellness_index_score)}`}>
                      {site.wellness_index_score != null ? Math.round(site.wellness_index_score) : '—'}
                    </TableCell>
                    <TableCell>
                      {outcomeBadge(site.certification_outcome, site.scan_count)}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
