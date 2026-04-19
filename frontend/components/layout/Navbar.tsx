import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
        <div className="mr-8 flex items-center">
          <Link href="/ops" className="mr-6 flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <span className="hidden font-heading text-lg font-bold tracking-tight sm:inline-block">
              FJDashboard
            </span>
          </Link>
          <nav className="flex items-center space-x-1 text-sm">
            <Link
              href="/ops"
              className="rounded-md px-3 py-1.5 font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              Operations
            </Link>
            <Link
              href="/executive"
              className="rounded-md px-3 py-1.5 font-medium text-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
            >
              Executive
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-3">
          <NotificationBell />
          <div className="flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Ops
          </div>
        </div>
      </div>
    </header>
  )
}
