"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UploadCloud, Search, FileText, LayoutDashboard } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const sidebarNavItems = [
  {
    title: "Overview",
    href: "/analyst",
    icon: LayoutDashboard,
  },
  {
    title: "Upload Queue",
    href: "/analyst/upload",
    icon: UploadCloud,
  },
  {
    title: "Findings Panel",
    href: "/analyst/findings",
    icon: Search,
  },
  {
    title: "Reports",
    href: "/analyst/reports",
    icon: FileText,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
      {sidebarNavItems.map((item) => {
        const Icon = item.icon
        // Check if exact match for root, or starts with for sub-routes
        const isActive = 
          item.href === '/analyst' 
            ? pathname === item.href 
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "justify-start text-left font-medium items-center flex rounded-md px-3 py-2 text-sm",
              isActive
                ? "bg-muted hover:bg-muted bg-slate-100 text-blue-700"
                : "hover:bg-slate-50 hover:underline"
            )}
          >
            <Icon className="mr-2 h-4 w-4" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
