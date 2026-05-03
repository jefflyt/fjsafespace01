'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SiteListingRow } from '@/lib/api';
import { ArrowRight, Loader2 } from 'lucide-react';

interface ScanListingTableProps {
  data: SiteListingRow[];
  loading: boolean;
  onRowClick: (siteId: string) => void;
}

function outcomeBadge(outcome: string) {
  const normalized = outcome.toUpperCase();
  switch (normalized) {
    case 'CERTIFIED':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Certified</Badge>;
    case 'VERIFIED':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Verified</Badge>;
    case 'NEEDS_WORK':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Needs Work</Badge>;
    default:
      return <Badge variant="secondary">No Data</Badge>;
  }
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
        <p className="text-xs mt-1">Load a CSV to get started.</p>
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
            <TableHead>Last Scan</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.site_id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(row.site_id)}
            >
              <TableCell className="font-medium">{row.site_name}</TableCell>
              <TableCell className="text-muted-foreground">{row.tenant_name ?? '—'}</TableCell>
              <TableCell className="text-sm">
                {row.uploaded_at
                  ? new Date(row.uploaded_at).toLocaleDateString('en-GB', {
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
              <TableCell className={scoreColor(row.wellness_index_score)}>
                {row.wellness_index_score != null ? `${row.wellness_index_score}%` : '—'}
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
