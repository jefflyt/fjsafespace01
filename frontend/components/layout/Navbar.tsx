"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"
import { cn } from "@/lib/utils"

export function Navbar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/"
    return pathname?.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
        <div className="mr-8 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <span className="hidden font-heading text-lg font-bold tracking-tight sm:inline-block">
              FJDashboard
            </span>
          </Link>
          <nav className="flex items-center space-x-1 text-sm">
            <Link
              href="/"
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-muted",
                isActive("/") ? "text-foreground bg-muted" : "text-foreground/70 hover:text-foreground"
              )}
            >
              Scan Listings
            </Link>
            <Link
              href="/executive"
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-muted",
                isActive("/executive") ? "text-foreground bg-muted" : "text-foreground/70 hover:text-foreground"
              )}
            >
              Executive Summary
            </Link>
            <Link
              href="/admin/customers"
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-muted",
                isActive("/admin/customers") ? "text-foreground bg-muted" : "text-foreground/70 hover:text-foreground"
              )}
            >
              Customers
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-3">
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
