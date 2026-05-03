'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

function OpsRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    const uploadId = searchParams.get('uploadId');

    if (tab === 'findings' && uploadId) {
      // Resolve site_id from upload, then redirect
      setResolving(true);
      api.get<{ site_id: string }>(`/api/uploads/${uploadId}`)
        .then((upload) => {
          router.replace(`/sites/${upload.site_id}`);
        })
        .catch(() => {
          // If upload not found, go home
          router.replace('/');
        });
    } else if (tab === 'reports') {
      router.replace('/executive');
    } else {
      // tab=upload or no tab → home
      router.replace('/');
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">
        {resolving ? 'Resolving scan...' : 'Redirecting...'}
      </span>
    </div>
  );
}

/**
 * Backward-compatible redirect component for legacy /ops URLs.
 * Redirects:
 *   /ops?tab=findings&uploadId=xxx → /sites/{siteId} (resolves site_id from upload)
 *   /ops?tab=upload → /
 *   /ops?tab=reports → /executive
 *   /ops → /
 */
export default function OpsRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
      </div>
    }>
      <OpsRedirectContent />
    </Suspense>
  );
}
