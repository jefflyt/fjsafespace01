'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SiteListingRow } from '@/lib/api';
import { ArrowRight, Loader2 } from 'lucide-react';

interface ScanListingTableProps {
  data: SiteListingRow[];
  loading: boolean;
  onRowClick: (siteId: string, allSiteIds?: string[]) => void;
}

function outcomeBadge(outcome: string) {
  if (outcome.includes('CERTIFIED')) {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Certified</Badge>;
  }
  if (outcome.includes('VERIFIED')) {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Verified</Badge>;
  }
  if (outcome.includes('IMPROVEMENT')) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Needs Work</Badge>;
  }
  return <Badge variant="secondary">No Data</Badge>;
}

function scoreColor(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function ScanListingTable({ data, loading, onRowClick }: ScanListingTableProps) {
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
            <TableHead>Site</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="w-[100px]">Scans</TableHead>
            <TableHead>Last Scan</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[80px] text-right">Score</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[32px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.site_id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(row.site_id, row.all_site_ids)}
            >
              <TableCell className="font-medium">{row.site_name}</TableCell>
              <TableCell className="text-muted-foreground">{row.tenant_name ?? '—'}</TableCell>
              <TableCell className="text-center font-mono tabular-nums">{row.scan_count}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.first_scan_date
                  ? new Date(row.first_scan_date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </TableCell>
              <TableCell>
                <Badge variant={row.scan_type === 'continuous' ? 'default' : 'outline'} className="text-xs">
                  {row.scan_type === 'continuous' ? 'Continuous' : 'Adhoc'}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-mono tabular-nums ${scoreColor(row.wellness_index_score)}`}>
                {row.wellness_index_score != null ? `${Math.round(row.wellness_index_score)}` : '—'}
              </TableCell>
              <TableCell>{outcomeBadge(row.certification_outcome)}</TableCell>
              <TableCell>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
