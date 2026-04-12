import Link from "next/link"
import { ShieldCheck } from "lucide-react"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center pl-4 pr-4">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <span className="hidden font-bold sm:inline-block text-xl">
              FJDashboard
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/analyst"
              className="transition-colors hover:text-foreground/80 text-foreground"
            >
              Operations
            </Link>
            {/* Phase 2: Executive | Phase 3: Customer portals will go here */}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* Mock Profile / Auth for Phase 1 */}
          <div className="text-sm border rounded-full px-3 py-1 bg-slate-100 flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            Analyst Session
          </div>
        </div>
      </div>
    </header>
  )
}
