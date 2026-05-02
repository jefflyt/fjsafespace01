"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SiteStandard } from "@/lib/api";

interface StandardSelectorProps {
  standards: SiteStandard[];
  activeStandardId: string;
  onStandardChange: (sourceId: string) => void;
}

export function StandardSelector({
  standards,
  activeStandardId,
  onStandardChange,
}: StandardSelectorProps) {
  const activeStandards = standards.filter((s) => s.is_active);

  if (activeStandards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No standards configured for this site.
      </p>
    );
  }

  return (
    <Tabs value={activeStandardId} onValueChange={onStandardChange}>
      <TabsList>
        {activeStandards.map((standard) => (
          <TabsTrigger key={standard.source_id} value={standard.source_id}>
            {standard.title}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
