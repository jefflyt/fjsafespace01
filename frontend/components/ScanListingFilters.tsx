'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ScanListingFiltersProps {
  searchQuery: string;
  scanType: string;
  onSearchChange: (value: string) => void;
  onScanTypeChange: (value: string) => void;
}

export function ScanListingFilters({
  searchQuery,
  scanType,
  onSearchChange,
  onScanTypeChange,
}: ScanListingFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Search sites..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <Select value={scanType} onValueChange={onScanTypeChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Scan type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All scans</SelectItem>
          <SelectItem value="adhoc">Adhoc</SelectItem>
          <SelectItem value="continuous">Continuous</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
