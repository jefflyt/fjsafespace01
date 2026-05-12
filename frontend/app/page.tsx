'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScanListingFilters } from '@/components/ScanListingFilters';
import { ScanListingTable } from '@/components/ScanListingTable';
import { UploadModal } from '@/components/UploadModal';
import { RegisterCustomerModal } from '@/components/RegisterCustomerModal';
import { Sidebar } from '@/components/layout/Sidebar';
import { apiClient, SiteListingRow } from '@/lib/api';
import { ShieldCheck } from 'lucide-react';

export default function ScanListingPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Derived KPIs
  const uniqueSites = useMemo(() => new Set(filtered.map((s) => s.site_id)).size, [filtered]);
  const avgWellness = useMemo(() => {
    const scored = filtered.filter((s) => s.wellness_index_score != null);
    if (scored.length === 0) return null;
    return scored.reduce((sum, s) => sum + (s.wellness_index_score ?? 0), 0) / scored.length;
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          {/* Mobile top bar */}
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Scan Listings" />
          <div className="px-4 md:px-6 py-6 space-y-6">
            <Skeleton className="h-9 w-48" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </div>
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-60 min-w-0">
        {/* Mobile top bar */}
        <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Scan Listings" />

        <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {/* Page header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight">Scan Listings</h1>
              <p className="text-sm text-muted-foreground mt-1">IAQ scan results across all sites</p>
            </div>
            <div className="flex gap-3">
              <Button size="sm" className="rounded-full" onClick={() => setUploadOpen(true)}>
                Load Scan Data
              </Button>
              <Button variant="outline" size="sm" className="rounded-md" onClick={() => setRegisterOpen(true)}>
                Register Customer
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Active Sites"
              value={uniqueSites}
            />
            <KpiCard
              label="Total Scans"
              value={sites.length}
            />
            <KpiCard
              label="Avg Wellness"
              value={avgWellness != null ? `${Math.round(avgWellness)}%` : '—'}
              featured
            />
          </div>

          {/* Filter bar */}
          <ScanListingFilters
            searchQuery={searchQuery}
            scanType={scanType}
            onSearchChange={setSearchQuery}
            onScanTypeChange={setScanType}
          />

          {/* Table or empty state */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-heading text-lg font-semibold">No scan data yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Upload your first IAQ scan to get started.
                </p>
                <Button onClick={() => setUploadOpen(true)}>Load Scan Data</Button>
              </CardContent>
            </Card>
          ) : (
            <ScanListingTable data={filtered} loading={loading} onRowClick={handleRowClick} />
          )}
        </div>
      </div>

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

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, featured }: {
  label: string;
  value: string | number;
  featured?: boolean;
}) {
  return (
    <Card className={`animate-fade-in ${featured ? 'border-l-2 border-l-primary bg-accent/30' : ''}`}>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
        <p className="font-mono text-4xl font-bold tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Mobile Top Bar ───────────────────────────────────────────────────────────

function MobileTopBar({ onMenuClick, title }: { onMenuClick: () => void; title: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:hidden">
      <Button variant="ghost" size="sm" onClick={onMenuClick} className="px-2">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Button>
      <span className="font-heading text-sm font-semibold">{title}</span>
    </header>
  );
}
