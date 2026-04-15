import React from "react"
import { 
  FileUp, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react"

export default function AnalystOverviewPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12">
      {/* Welcome Section */}
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tighter text-foreground">
          Air Quality <span className="text-primary italic">Operations</span>
        </h1>
        <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
          Upload and manage monitoring scans to generate traceability reports.
        </p>
      </div>

      {/* Primary Action */}
      <div className="flex justify-center">
        <button className="flex items-center gap-3 px-10 py-5 bg-primary text-white rounded-full text-xl font-black shadow-2xl shadow-primary/30 hover:scale-105 transition-all">
          <FileUp size={24} />
          Upload New Scan
        </button>
      </div>

      {/* Recent Scans (Queue) */}
      <div className="pt-8">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 text-center">Recent Scans</h3>
        <div className="space-y-4">
          {[
            { name: "HQ_April_2026.csv", site: "NPE HQ", status: "Complete", result: "PASS" },
            { name: "Cape_G_V2.csv", site: "Cape Guardafui", status: "Processing", result: "--" }
          ].map((item, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-secondary shadow-sm flex items-center justify-between hover:border-primary/20 transition-all">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${item.status === 'Complete' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary animate-pulse'}`}>
                  {item.status === 'Complete' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                </div>
                <div>
                  <h4 className="font-bold text-lg">{item.name}</h4>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{item.site}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                 {item.result !== '--' && (
                    <span className="text-xs font-black px-4 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100 uppercase">
                       {item.result} Output
                    </span>
                 )}
                 <button className="text-primary font-black flex items-center gap-1 hover:underline">
                    View <ArrowUpRight size={18} />
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
