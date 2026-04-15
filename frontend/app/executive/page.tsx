import React from "react"
import { 
  Building2, 
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  ChevronRight
} from "lucide-react"

export default function ExecutiveDashboardPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-16 bg-background min-h-screen pt-20">
      {/* Visual Identity */}
      <div className="text-center">
         <div className="inline-block p-3 rounded-2xl bg-primary/10 text-primary mb-6">
            <Building2 size={32} />
         </div>
         <h1 className="text-3xl font-black uppercase tracking-tighter">Site Wellness Overview</h1>
         <p className="text-muted-foreground mt-2 font-medium">North Pole Estate (HQ)</p>
      </div>

      {/* Hero Score Card */}
      <div className="bg-white rounded-[3rem] p-16 shadow-2xl shadow-primary/10 border border-secondary text-center relative overflow-hidden group">
        <div className="relative z-10 space-y-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-9xl font-black italic tracking-tighter">94</span>
            <span className="text-3xl font-bold text-muted-foreground">/100</span>
          </div>
          
          <div className="bg-green-100 text-green-700 px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest inline-flex items-center gap-2">
            <ShieldCheck size={18} />
            Healthy Workplace Certified
          </div>
          
          <p className="text-muted-foreground font-medium pt-4">
            Your space meets 94% of the FJ SafeSpace Wellness Index criteria.
          </p>
        </div>
        
        {/* Subtle background element */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 opacity-50"></div>
      </div>

      {/* Simple Action List */}
      <div className="space-y-8">
        <h3 className="text-lg font-black tracking-widest uppercase text-center text-primary">Priority Actions</h3>
        <div className="space-y-4">
          {[
            { action: 'Increase Outdoor Air Flow (HVAC)', impact: 'High' },
            { action: 'HEPA Filter Replacement', impact: 'Medium' }
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-6 rounded-3xl bg-white border border-secondary hover:border-primary/30 transition-all cursor-pointer group shadow-sm">
               <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                     <Lightbulb size={20} />
                  </div>
                  <span className="font-bold text-lg">{item.action}</span>
               </div>
               <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          ))}
        </div>
      </div>

      <div className="text-center pt-8">
         <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Next Verification: 12 July 2026</p>
      </div>
    </div>
  )
}
