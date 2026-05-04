'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface SiteOption {
  id: string;
  name: string;
}

interface ZoneAssignmentProps {
  zones: string[];
  existingSites: SiteOption[];
  onSubmit: (zoneMapping: Record<string, string>) => void;
  onCancel: () => void;
}

/**
 * Zone assignment UI for multi-site CSV uploads.
 *
 * For each zone detected in the CSV, user selects:
 * - An existing site from dropdown, OR
 * - Creates a new site by entering a name
 */
export function ZoneAssignment({
  zones,
  existingSites,
  onSubmit,
  onCancel,
}: ZoneAssignmentProps) {
  // Track assignment mode per zone: 'existing' | 'new'
  const [modes, setModes] = useState<Record<string, 'existing' | 'new'>>(
    () =>
      zones.reduce(
        (acc, z) => ({ ...acc, [z]: existingSites.length > 0 ? 'existing' : 'new' }),
        {} as Record<string, 'existing' | 'new'>,
      ),
  );

  // Track site selection per zone (existing site ID)
  const [selections, setSelections] = useState<Record<string, string>>(
    () => zones.reduce((acc, z) => ({ ...acc, [z]: '' }), {} as Record<string, string>),
  );

  // Track new site names per zone
  const [newNames, setNewNames] = useState<Record<string, string>>(
    () => zones.reduce((acc, z) => ({ ...acc, [z]: z }), {} as Record<string, string>),
  );

  const [error, setError] = useState<string | null>(null);

  const handleModeChange = (zone: string, mode: 'existing' | 'new') => {
    setModes((prev) => ({ ...prev, [zone]: mode }));
  };

  const handleSelectChange = (zone: string, siteId: string) => {
    setSelections((prev) => ({ ...prev, [zone]: siteId }));
  };

  const handleNameChange = (zone: string, name: string) => {
    setNewNames((prev) => ({ ...prev, [zone]: name }));
  };

  const handleSubmit = () => {
    const mapping: Record<string, string> = {};

    for (const zone of zones) {
      if (modes[zone] === 'existing') {
        if (!selections[zone]) {
          setError(`Please select a site for zone "${zone}"`);
          return;
        }
        mapping[zone] = selections[zone];
      } else {
        if (!newNames[zone].trim()) {
          setError(`Please enter a site name for zone "${zone}"`);
          return;
        }
        mapping[zone] = `__new__:${newNames[zone].trim()}`;
      }
    }

    setError(null);
    onSubmit(mapping);
  };

  // Group zones by assignment for preview summary
  const existingGrouped: Record<string, string[]> = {};
  const newGrouped: string[] = [];

  for (const zone of zones) {
    if (modes[zone] === 'existing' && selections[zone]) {
      const siteName = existingSites.find((s) => s.id === selections[zone])?.name || selections[zone];
      if (!existingGrouped[siteName]) existingGrouped[siteName] = [];
      existingGrouped[siteName].push(zone);
    } else if (modes[zone] === 'new') {
      newGrouped.push(newNames[zone] || zone);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Assign Zones to Sites</h3>
        <p className="text-sm text-muted-foreground">
          {zones.length} zone{zones.length !== 1 ? 's' : ''} detected. Map each zone to an existing site or create a new one.
        </p>
      </div>

      {/* Zone rows */}
      <div className="space-y-3">
        {zones.map((zone) => (
          <div key={zone} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg">
            <div className="flex-1 min-w-[120px]">
              <span className="font-medium text-sm">{zone}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={modes[zone] === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange(zone, 'existing')}
              >
                Existing
              </Button>
              <Button
                variant={modes[zone] === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleModeChange(zone, 'new')}
              >
                New
              </Button>
            </div>

            {modes[zone] === 'existing' ? (
              <select
                className="flex-1 min-w-[200px] px-3 py-2 border rounded-md text-sm"
                value={selections[zone] || ''}
                onChange={(e) => handleSelectChange(zone, e.target.value)}
              >
                <option value="">Select a site...</option>
                {existingSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="flex-1 min-w-[200px] px-3 py-2 border rounded-md text-sm"
                placeholder="Enter site name..."
                value={newNames[zone]}
                onChange={(e) => handleNameChange(zone, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {(Object.keys(existingGrouped).length > 0 || newGrouped.length > 0) && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <h4 className="text-sm font-semibold">Summary</h4>
          {Object.entries(existingGrouped).map(([siteName, assignedZones]) => (
            <div key={siteName} className="text-sm">
              <span className="font-medium">{siteName}</span>: {assignedZones.join(', ')}
            </div>
          ))}
          {newGrouped.map((name) => (
            <div key={name} className="text-sm">
              <span className="font-medium text-primary">{name}</span> (new site)
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>
          Upload & Split
        </Button>
      </div>
    </div>
  );
}
