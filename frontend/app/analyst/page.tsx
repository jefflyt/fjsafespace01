export default function AnalystOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analyst Overview</h1>
        <p className="text-muted-foreground">
          Welcome to the FJ SafeSpace Analyst Operations dashboard.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6">
            <h3 className="tracking-tight text-sm font-medium">Placeholder Stat</h3>
            <div className="text-2xl font-bold">--</div>
          </div>
        </div>
      </div>
    </div>
  )
}
