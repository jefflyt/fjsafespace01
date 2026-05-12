'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadForm, UploadResult, BatchUploadResult } from '@/components/UploadForm';
import { useRouter } from 'next/navigation';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: (result: UploadResult | BatchUploadResult) => void;
}

export function UploadModal({ open, onOpenChange, onUploadComplete }: UploadModalProps) {
  const router = useRouter();

  const handleComplete = (result: UploadResult | BatchUploadResult) => {
    onUploadComplete(result);
    onOpenChange(false);

    // For single upload, redirect to scan data view
    if ('upload_id' in result) {
      router.push(`/scan-data/${result.site_id}`);
    }
    // For batch upload, redirect to first child's scan data view
    else if ('children' in result && result.children.length > 0) {
      router.push(`/scan-data/${result.children[0].site_id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Upload Scan Data</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          <UploadForm onUploadComplete={handleComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
