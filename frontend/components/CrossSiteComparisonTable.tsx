"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck, ShieldAlert, Info } from "lucide-react";

const OUTCOME_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; border: string }> = {
  HEALTHY_WORKPLACE_CERTIFIED: { label: "Certified", icon: ShieldCheck, color: "text-green-700 bg-green-50 border-green-200", border: "border-green-200" },
  HEALTHY_SPACE_VERIFIED: { label: "Verified", icon: ShieldCheck, color: "text-blue-700 bg-blue-50 border-blue-200", border: "border-blue-200" },
  IMPROVEMENT_REQUIRED: { label: "Improvement", icon: ShieldAlert, color: "text-yellow-700 bg-yellow-50 border-yellow-200", border: "border-yellow-200" },
  INSUFFICIENT_EVIDENCE: { label: "Insufficient", icon: Info, color: "text-gray-700 bg-gray-50 border-gray-200", border: "border-gray-200" },
  PASS: { label: "Pass", icon: ShieldCheck, color: "text-green-700 bg-green-50 border-green-200", border: "border-green-200" },
  FAIL: { label: "Fail", icon: ShieldAlert, color: "text-red-700 bg-red-50 border-red-200", border: "border-red-200" },
};

interface StandardScore {
  title: string;
  score: number | null;
  outcome: string;
}

interface SiteRow {
  site_id: string;
  site_name: string;
  wellness_index_score: number | null;
  certification_outcome: string | null;
  last_scan_date?: string | null;
  // R1-05: per-standard scores
  standard_scores?: StandardScore[];
}

interface CrossSiteComparisonTableProps {
  sites: SiteRow[];
  // R1-05: list of available standards for filtering
  availableStandards?: { source_id: string; title: string }[];
}

type SortKey = "site_name" | "wellness_index_score" | "certification_outcome" | "last_scan_date";
type SortDir = "asc" | "desc";

export function CrossSiteComparisonTable({ sites, availableStandards }: CrossSiteComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("wellness_index_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterStandard, setFilterStandard] = useState<string>("all");

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-heading text-lg">Cross-Site Comparison</CardTitle>
            <CardDescription className="text-xs">Ranked by Wellness Index</CardDescription>
          </div>
          {/* R1-05: Filter by standard */}
          {availableStandards && availableStandards.length > 0 && (
            <Select value={filterStandard} onValueChange={setFilterStandard}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All standards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All standards</SelectItem>
                {availableStandards.map((s) => (
                  <SelectItem key={s.source_id} value={s.source_id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sites available for comparison.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="w-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground p-2">#</th>
                  <th className="p-2">
                    <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("site_name")}>
                      Site <SortIcon column="site_name" />
                    </button>
                  </th>
                  <th className="text-right p-2">
                    <button className="ml-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("wellness_index_score")}>
                      Score <SortIcon column="wellness_index_score" />
                    </button>
                  </th>
                  <th className="p-2">
                    <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("certification_outcome")}>
                      Status <SortIcon column="certification_outcome" />
                    </button>
                  </th>
                  {/* R1-05: Per-standard score columns */}
                  {filterStandard !== "all" && sites.some((s) => s.standard_scores?.length) && (
                    (() => {
                      const std = availableStandards?.find((s) => s.source_id === filterStandard);
                      return std ? (
                        <th className="text-right p-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {std.title}
                        </th>
                      ) : null;
                    })()
                  )}
                  <th className="text-right p-2">
                    <button className="ml-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground" onClick={() => handleSort("last_scan_date")}>
                      Last Scan <SortIcon column="last_scan_date" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((site, idx) => {
                  const outcomeKey = site.certification_outcome as string;
                  const config = OUTCOME_CONFIG[outcomeKey] ?? OUTCOME_CONFIG.INSUFFICIENT_EVIDENCE;
                  const StatusIcon = config.icon;

                  // Get the filtered standard score
                  const filteredStandardScore = filterStandard !== "all"
                    ? site.standard_scores?.find((s) => {
                        const std = availableStandards?.find((a) => a.source_id === filterStandard);
                        return std ? s.title === std.title : false;
                      })
                    : null;

                  return (
                    <tr key={site.site_id} className="border-b hover:bg-muted/50">
                      <td className="font-mono text-xs text-muted-foreground p-2">{idx + 1}</td>
                      <td className="text-sm font-medium p-2">{site.site_name}</td>
                      <td className="text-right p-2">
                        {site.wellness_index_score != null ? (
                          <span className={`font-heading text-lg font-bold tabular-nums ${
                            site.wellness_index_score >= 80 ? "text-[#37CA37]"
                            : site.wellness_index_score >= 60 ? "text-[#F6AD55]"
                            : site.wellness_index_score >= 40 ? "text-[#F6AD55]"
                            : "text-[#E93D3D]"
                          }`}>
                            {Math.round(site.wellness_index_score)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={`gap-1 ${config.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </td>
                      {/* R1-05: Per-standard score cell */}
                      {filterStandard !== "all" && filteredStandardScore && (
                        <td className="text-right p-2">
                          <span className={`font-heading text-lg font-bold tabular-nums ${
                            filteredStandardScore.score != null && filteredStandardScore.score >= 80 ? "text-[#37CA37]"
                            : filteredStandardScore.score != null && filteredStandardScore.score >= 60 ? "text-[#F6AD55]"
                            : "text-[#E93D3D]"
                          }`}>
                            {filteredStandardScore.score != null ? Math.round(filteredStandardScore.score) : "N/A"}
                          </span>
                        </td>
                      )}
                      {filterStandard !== "all" && !filteredStandardScore && (
                        <td className="text-right p-2 text-muted-foreground">N/A</td>
                      )}
                      <td className="text-right text-xs text-muted-foreground tabular-nums p-2">
                        {site.last_scan_date ? new Date(site.last_scan_date).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
