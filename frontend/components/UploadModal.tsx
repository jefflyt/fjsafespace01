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

    // For single upload, redirect to site
    if ('upload_id' in result) {
      router.push(`/sites/${result.site_id}`);
    }
    // For batch upload, redirect to first child's site
    else if ('children' in result && result.children.length > 0) {
      router.push(`/sites/${result.children[0].site_id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Scan Data</DialogTitle>
        </DialogHeader>
        <UploadForm onUploadComplete={handleComplete} />
      </DialogContent>
    </Dialog>
  );
}
