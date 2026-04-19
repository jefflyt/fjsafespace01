"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, Shield, ShieldCheck, AlertTriangle, Info } from "lucide-react";

const OUTCOME_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; border: string }> = {
  HEALTHY_WORKPLACE_CERTIFIED: { label: "Certified", icon: ShieldCheck, color: "text-green-700 bg-green-50 border-green-200", border: "border-green-200" },
  HEALTHY_SPACE_VERIFIED: { label: "Verified", icon: Shield, color: "text-blue-700 bg-blue-50 border-blue-200", border: "border-blue-200" },
  IMPROVEMENT_REQUIRED: { label: "Improvement", icon: AlertTriangle, color: "text-yellow-700 bg-yellow-50 border-yellow-200", border: "border-yellow-200" },
  INSUFFICIENT_EVIDENCE: { label: "Insufficient", icon: Info, color: "text-gray-700 bg-gray-50 border-gray-200", border: "border-gray-200" },
};

interface SiteRow {
  site_id: string;
  site_name: string;
  wellness_index_score: number | null;
  certification_outcome: string | null;
  last_scan_date?: string | null;
}

interface CrossSiteComparisonTableProps {
  sites: SiteRow[];
}

type SortKey = "site_name" | "wellness_index_score" | "certification_outcome" | "last_scan_date";
type SortDir = "asc" | "desc";

export function CrossSiteComparisonTable({ sites }: CrossSiteComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("wellness_index_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "wellness_index_score" ? "desc" : "asc");
    }
  };

  const sorted = [...sites].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortDir === "asc" ? -1 : 1;
    if (bVal == null) return sortDir === "asc" ? 1 : -1;
    const cmp = typeof aVal === "string" && typeof bVal === "string"
      ? aVal.localeCompare(bVal)
      : Number(aVal) - Number(bVal);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg">Cross-Site Comparison</CardTitle>
        <CardDescription className="text-xs">Ranked by Wellness Index</CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sites available for comparison.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                <TableHead>
                  <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("site_name")}>
                    Site <SortIcon column="site_name" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="ml-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("wellness_index_score")}>
                    Score <SortIcon column="wellness_index_score" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("certification_outcome")}>
                    Status <SortIcon column="certification_outcome" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="ml-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("last_scan_date")}>
                    Last Scan <SortIcon column="last_scan_date" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((site, idx) => {
                const outcomeKey = site.certification_outcome as string;
                const config = OUTCOME_CONFIG[outcomeKey] ?? OUTCOME_CONFIG.INSUFFICIENT_EVIDENCE;
                const StatusIcon = config.icon;

                return (
                  <TableRow key={site.site_id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{site.site_name}</TableCell>
                    <TableCell className="text-right">
                      {site.wellness_index_score != null ? (
                        <span className={`font-heading text-lg font-bold tabular-nums ${
                          site.wellness_index_score >= 80 ? "text-green-600"
                          : site.wellness_index_score >= 60 ? "text-blue-600"
                          : site.wellness_index_score >= 40 ? "text-yellow-600"
                          : "text-red-600"
                        }`}>
                          {Math.round(site.wellness_index_score)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${config.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {site.last_scan_date ? new Date(site.last_scan_date).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
