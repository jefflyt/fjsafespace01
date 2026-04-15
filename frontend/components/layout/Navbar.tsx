import Link from "next/link"
import { ShieldCheck } from "lucide-react"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-6">
        <div className="mr-8 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <span className="hidden font-bold sm:inline-block text-xl tracking-tight">
              FJDashboard
            </span>
          </Link>
          <nav className="flex items-center space-x-8 text-sm font-semibold uppercase tracking-wider">
            <Link
              href="/analyst"
              className="transition-colors hover:text-primary text-foreground/80"
            >
              Operations
            </Link>
            <Link
              href="/executive"
              className="transition-colors hover:text-primary text-foreground/40"
            >
              Executive
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <div className="text-xs font-bold uppercase tracking-widest border border-primary/20 rounded-full px-4 py-1.5 bg-primary/5 text-primary flex items-center shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2"></span>
            Ops Mode
          </div>
        </div>
      </div>
    </header>
  )
}
