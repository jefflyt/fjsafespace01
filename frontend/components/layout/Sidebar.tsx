'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Users,
  Settings,
  ShieldCheck,
} from 'lucide-react'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navItems = [
  { href: '/', label: 'Scans', icon: ClipboardList, count: true },
  { href: '/executive', label: 'Executive', icon: LayoutDashboard },
  { href: '/admin/customers', label: 'Customers', icon: Users },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [scanCount, setScanCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/uploads')
      .then((r) => r.json())
      .then((data) => setScanCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setScanCount(0))
  }, [])

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname?.startsWith(path)
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-60 bg-card border-r border-gray-200 transition-transform duration-200 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex h-14 items-center px-4 border-b border-gray-200">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <span className="font-heading text-lg font-bold tracking-tight">
                FJ SafeSpace
              </span>
            </Link>
          </div>

          {/* Nav items */}
          <nav className="flex-1 py-4 space-y-0.5 px-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground border-l-2 border-primary"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.count && scanCount !== null && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary">
                      {scanCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-gray-200 p-4 space-y-0.5">
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
