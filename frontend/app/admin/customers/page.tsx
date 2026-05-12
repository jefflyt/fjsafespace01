"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { CustomerManagement } from "@/components/CustomerManagement";

export default function AdminCustomersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Brief loading simulation so skeleton renders before data arrives
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-60 min-w-0">
          <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Customers" />
          <div className="px-4 md:px-6 py-6 space-y-6">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-96" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-60 min-w-0">
        <MobileTopBar onMenuClick={() => setSidebarOpen(true)} title="Customers" />

        <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {/* Page header */}
          <div className="animate-fade-in">
            <h1 className="font-heading text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage customer accounts and their scan history.
            </p>
          </div>

          <div className="animate-fade-in">
            <CustomerManagement />
          </div>
        </div>
      </div>
    </div>
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
