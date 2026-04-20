"use client";

interface ZoneToggleProps {
  zones: string[];
  activeZones: Set<string>;
  zonesWithData: Set<string>;
  zoneColors: Record<string, string>;
  onToggle: (zone: string) => void;
}

export function ZoneToggle({
  zones,
  activeZones,
  zonesWithData,
  zoneColors,
  onToggle,
}: ZoneToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-fj-gray shrink-0">
        Zones
      </span>
      <div className="flex flex-wrap gap-2">
        {zones.map((zone) => {
          const hasData = zonesWithData.has(zone);
          const isActive = activeZones.has(zone);
          const color = zoneColors[zone] || "#8884d8";

          return (
            <button
              key={zone}
              disabled={!hasData}
              onClick={() => hasData && onToggle(zone)}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-full border transition-all
                ${!hasData
                  ? "text-gray-300 border-gray-200 bg-gray-50 cursor-not-allowed"
                  : isActive
                    ? "text-white border-transparent shadow-sm cursor-pointer"
                    : "text-fj-gray border-[--border] bg-white hover:bg-[--muted] cursor-pointer"
                }
              `}
              style={isActive && hasData ? {
                backgroundColor: color,
                borderColor: color,
                boxShadow: `0 1px 3px ${color}30`,
              } : {}}
            >
              {zone}
            </button>
          );
        })}
      </div>
    </div>
  );
}
