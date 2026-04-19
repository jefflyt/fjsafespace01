"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UploadCloud, Search, FileText } from "lucide-react"

import { cn } from "@/lib/utils"

const sidebarNavItems = [
  { title: "Upload", href: "/ops", icon: UploadCloud, tab: "upload" },
  { title: "Findings", href: "/ops", icon: Search, tab: "findings" },
  { title: "Reports", href: "/ops", icon: FileText, tab: "reports" },
]

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  )
  const activeTab = searchParams.get("tab") || "upload"

  return (
    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
      {sidebarNavItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname.startsWith("/ops") && activeTab === item.tab

        return (
          <Link
            key={item.href}
            href={`${item.href}?tab=${item.tab}`}
            className={cn(
              "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
