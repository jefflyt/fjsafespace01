export default function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      {children}
    </div>
  )
}
