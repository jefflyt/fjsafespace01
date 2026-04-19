import { Sidebar } from "@/components/layout/Sidebar"

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-7xl items-start gap-6 px-6 py-6 md:grid md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
        <Sidebar />
      </aside>
      <main className="w-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
