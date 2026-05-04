'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScanListingFilters } from '@/components/ScanListingFilters';
import { ScanListingTable } from '@/components/ScanListingTable';
import { UploadModal } from '@/components/UploadModal';
import { RegisterCustomerModal } from '@/components/RegisterCustomerModal';
import { apiClient, SiteListingRow } from '@/lib/api';

export default function ScanListingPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanType, setScanType] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const fetchSites = useCallback(async () => {
    try {
      const data = await apiClient.getSiteListing();
      setSites(data);
    } catch (err) {
      console.error('Failed to fetch site listing:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const filtered = useMemo(() => {
    return sites.filter((site) => {
      const matchesSearch =
        !searchQuery ||
        site.site_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (site.tenant_name && site.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = scanType === 'all' || site.scan_type === scanType;
      return matchesSearch && matchesType;
    });
  }, [sites, searchQuery, scanType]);

  const handleRowClick = useCallback(
    (siteId: string, allSiteIds?: string[]) => {
      const ids = allSiteIds?.join(',') || '';
      router.push(`/sites/${siteId}${ids ? `?siteIds=${ids}` : ''}`);
    },
    [router],
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Scan Listings</h1>
        <p className="text-sm text-muted-foreground mt-1">IAQ scan results across all sites</p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setUploadOpen(true)}>
              Load Scan Data
            </Button>
            <Button variant="outline" onClick={() => setRegisterOpen(true)}>
              Register Customer
            </Button>
          </div>

          <ScanListingFilters
            searchQuery={searchQuery}
            scanType={scanType}
            onSearchChange={setSearchQuery}
            onScanTypeChange={setScanType}
          />

          <ScanListingTable data={filtered} loading={loading} onRowClick={handleRowClick} />
        </CardContent>
      </Card>

      <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} onUploadComplete={() => {
        setUploadOpen(false);
        fetchSites();
      }} />

      <RegisterCustomerModal
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={() => {
          setRegisterOpen(false);
          fetchSites();
        }}
      />
    </div>
  );
}
