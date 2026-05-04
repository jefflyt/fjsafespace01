'use client';

import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SiteListingRow } from '@/lib/api';
import { ArrowRight, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface ScanListingTableProps {
  data: SiteListingRow[];
  loading: boolean;
  onRowClick: (siteId: string, allSiteIds?: string[]) => void;
}

function outcomeBadge(outcome: string, scanCount: number) {
  if (outcome.includes('CERTIFIED')) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Certified</Badge>;
  }
  if (outcome.includes('VERIFIED')) {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Verified</Badge>;
  }
  if (outcome.includes('IMPROVEMENT')) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Needs Work</Badge>;
  }
  if (outcome.includes('FAIL')) {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Fail</Badge>;
  }
  // Data exists but insufficient for certification
  if (scanCount > 0) {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Processed</Badge>;
  }
  return <Badge variant="secondary">No Data</Badge>;
}

function scoreColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
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

  const grouped = useMemo(() => groupByTenant(data), [data]);

  const toggleTenant = useCallback((tenantName: string) => {
    setExpandedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(tenantName)) next.delete(tenantName);
      else next.add(tenantName);
      return next;
    });
  }, []);

  const singleTenant = grouped.length === 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading scan results...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No scan results yet.</p>
        <p className="text-xs mt-1">Upload a scan file to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Site</TableHead>
            <TableHead className="w-[100px]">Scans</TableHead>
            <TableHead>Last Scan</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[80px] text-right">Score</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[32px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((group) => {
            const isExpanded = singleTenant || expandedTenants.has(group.tenantName);

            return (
              <GroupedTenantRow
                key={group.tenantName}
                group={group}
                isExpanded={isExpanded}
                singleTenant={singleTenant}
                onToggle={toggleTenant}
                onRowClick={onRowClick}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupedTenantRow({
  group,
  isExpanded,
  singleTenant,
  onToggle,
  onRowClick,
}: {
  group: GroupedTenant;
  isExpanded: boolean;
  singleTenant: boolean;
  onToggle: (tenantName: string) => void;
  onRowClick: (siteId: string, allSiteIds?: string[]) => void;
}) {
  if (group.sites.length === 1) {
    // Single site under tenant — render as a flat row (no collapse)
    const site = group.sites[0];
    return (
      <TableRow
        key={site.site_id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => onRowClick(site.site_id, site.all_site_ids)}
      >
        <TableCell className="font-medium">{site.tenant_name ?? '—'}</TableCell>
        <TableCell className="text-muted-foreground">{site.site_name}</TableCell>
        <TableCell className="text-center font-mono tabular-nums">{site.scan_count}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {site.first_scan_date
            ? new Date(site.first_scan_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—'}
        </TableCell>
        <TableCell>
          <Badge variant={site.scan_type === 'continuous' ? 'default' : 'outline'} className="text-xs">
            {site.scan_type === 'continuous' ? 'Continuous' : 'Adhoc'}
          </Badge>
        </TableCell>
        <TableCell className={`text-right font-mono tabular-nums ${scoreColor(site.wellness_index_score)}`}>
          {site.wellness_index_score != null ? `${Math.round(site.wellness_index_score)}` : '—'}
        </TableCell>
        <TableCell>{outcomeBadge(site.certification_outcome, site.scan_count)}</TableCell>
        <TableCell>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </TableCell>
      </TableRow>
    );
  }

  // Multiple sites under tenant — render parent row + children
  return (
    <>
      {/* Parent row */}
      <TableRow
        className="cursor-pointer hover:bg-muted/50 bg-muted/30"
        onClick={() => onToggle(group.tenantName)}
      >
        <TableCell className="font-semibold">
          <span className="flex items-center gap-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {group.tenantName}
            <Badge variant="outline" className="ml-2 text-xs">
              {group.sites.length} site{group.sites.length > 1 ? 's' : ''}
            </Badge>
          </span>
        </TableCell>
        <TableCell />
        <TableCell className="text-center font-mono tabular-nums">{group.totalScans}</TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
      </TableRow>

      {/* Child rows */}
      {isExpanded &&
        group.sites.map((site) => (
          <TableRow
            key={site.site_id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onRowClick(site.site_id, site.all_site_ids)}
          >
            <TableCell className="pl-10 text-muted-foreground">{site.tenant_name ?? '—'}</TableCell>
            <TableCell className="font-medium">
              <span className="text-muted-foreground mr-1">›</span>
              {site.site_name}
            </TableCell>
            <TableCell className="text-center font-mono tabular-nums">{site.scan_count}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {site.first_scan_date
                ? new Date(site.first_scan_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </TableCell>
            <TableCell>
              <Badge variant={site.scan_type === 'continuous' ? 'default' : 'outline'} className="text-xs">
                {site.scan_type === 'continuous' ? 'Continuous' : 'Adhoc'}
              </Badge>
            </TableCell>
            <TableCell className={`text-right font-mono tabular-nums ${scoreColor(site.wellness_index_score)}`}>
              {site.wellness_index_score != null ? `${Math.round(site.wellness_index_score)}` : '—'}
            </TableCell>
            <TableCell>{outcomeBadge(site.certification_outcome, site.scan_count)}</TableCell>
            <TableCell>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}
