'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScanHistoryTable } from './ScanHistoryTable';

interface UploadOutcome {
  id: string;
  outcome: string;
}

interface ScanHistoryPillsProps {
  uploads: Array<{
    id: string;
    scan_date: string | null;
    scan_type: string | null;
    parse_status: string;
  }>;
  outcomes: Record<string, string>; // uploadId → PASS/WATCH/FAIL
  currentUploadId?: string;
  onScanSelect: (uploadId: string) => void;
  onCompare?: () => void;
}

const OUTCOME_DOT: Record<string, string> = {
  PASS: 'bg-green-500',
  WATCH: 'bg-amber-500',
  FAIL: 'bg-red-500',
};

function formatDate(scanDate: string | null): string {
  if (!scanDate) return 'Unknown';
  return new Date(scanDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ScanHistoryPills({
  uploads,
  outcomes,
  currentUploadId,
  onScanSelect,
  onCompare,
}: ScanHistoryPillsProps) {
  const [expanded, setExpanded] = useState(false);

  if (uploads.length === 0) return null;

  const displayUploads = expanded ? uploads : uploads.slice(0, 5);
  const hasMore = uploads.length > 5;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Scans:</span>
        {displayUploads.map((upload) => {
          const outcome = outcomes[upload.id] ?? 'INSUFFICIENT_EVIDENCE';
          const dotColor =
            outcome === 'PASS' || outcome === 'HEALTHY_WORKSPACE_CERTIFIED'
              ? OUTCOME_DOT.PASS
              : outcome === 'WATCH' || outcome === 'HEALTHY_SPACE_VERIFIED'
                ? OUTCOME_DOT.WATCH
                : outcome === 'FAIL' || outcome === 'IMPROVEMENT_REQUIRED'
                  ? OUTCOME_DOT.FAIL
                  : 'bg-muted-foreground/40';
          const isActive = upload.id === currentUploadId;

          return (
            <button
              key={upload.id}
              onClick={() => onScanSelect(upload.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              {formatDate(upload.scan_date)}
            </button>
          );
        })}

        {onCompare && uploads.length >= 2 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs rounded-full"
            onClick={onCompare}
          >
            Compare scans
          </Button>
        )}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? 'Show less' : `Show all ${uploads.length} scans`}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-3">
          <ScanHistoryTable uploads={uploads as any} onRowClick={onScanSelect} />
        </div>
      )}
    </div>
  );
}
