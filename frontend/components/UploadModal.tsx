'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadForm, UploadResult } from '@/components/UploadForm';
import { useRouter } from 'next/navigation';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: (result: UploadResult) => void;
}

export function UploadModal({ open, onOpenChange, onUploadComplete }: UploadModalProps) {
  const router = useRouter();

  const handleComplete = (result: UploadResult) => {
    onUploadComplete(result);
    router.push(`/sites/${result.site_id}`);
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
