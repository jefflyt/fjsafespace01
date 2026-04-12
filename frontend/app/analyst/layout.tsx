import { Sidebar } from "@/components/layout/Sidebar"

export default function AnalystLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 pt-8 pb-8 px-4">
      <aside className="fixed top-20 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
        <Sidebar />
      </aside>
      <main className="flex w-full flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
