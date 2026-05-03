'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight } from 'lucide-react';

interface ScanHistoryEntry {
  id: string;
  file_name: string;
  uploaded_at: string;
  scan_type: string | null;
  parse_status: string;
  standards_evaluated: string[];
}

interface ScanHistoryTableProps {
  uploads: ScanHistoryEntry[];
  onRowClick: (uploadId: string) => void;
}

export function ScanHistoryTable({ uploads, onRowClick }: ScanHistoryTableProps) {
  if (uploads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No scan history yet.</p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Standards</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {uploads.map((upload) => (
            <TableRow
              key={upload.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(upload.id)}
            >
              <TableCell className="text-sm">
                {new Date(upload.uploaded_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell>
                <Badge variant={upload.scan_type === 'continuous' ? 'default' : 'outline'} className="text-xs">
                  {upload.scan_type === 'continuous' ? 'Continuous' : 'Adhoc'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {upload.standards_evaluated.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={upload.parse_status === 'COMPLETE' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {upload.parse_status}
                </Badge>
              </TableCell>
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
