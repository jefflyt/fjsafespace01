"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

interface ThresholdConfigDialogProps {
  metricName: string;
  currentOverrides: Record<string, any>;
  rulebookBounds: { min: number; max: number };
  onSave: (overrides: Record<string, any>) => void;
}

export function ThresholdConfigDialog({
  metricName,
  currentOverrides,
  rulebookBounds,
  onSave,
}: ThresholdConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [watchMax, setWatchMax] = useState(
    currentOverrides[metricName]?.watch_max ?? ""
  );
  const [watchMin, setWatchMin] = useState(
    currentOverrides[metricName]?.watch_min ?? ""
  );
  const [criticalMax, setCriticalMax] = useState(
    currentOverrides[metricName]?.critical_max ?? ""
  );
  const [criticalMin, setCriticalMin] = useState(
    currentOverrides[metricName]?.critical_min ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  const validate = (): boolean => {
    const values = [watchMax, watchMin, criticalMax, criticalMin]
      .filter((v) => v !== "")
      .map(Number);

    for (const v of values) {
      if (isNaN(v)) {
        setError("All values must be valid numbers.");
        return false;
      }
      if (v < rulebookBounds.min || v > rulebookBounds.max) {
        setError(
          `Values must be between ${rulebookBounds.min} and ${rulebookBounds.max}.`
        );
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;

    const overrides: Record<string, any> = {};
    if (watchMax !== "") overrides.watch_max = Number(watchMax);
    if (watchMin !== "") overrides.watch_min = Number(watchMin);
    if (criticalMax !== "") overrides.critical_max = Number(criticalMax);
    if (criticalMin !== "") overrides.critical_min = Number(criticalMin);

    onSave({ [metricName]: overrides });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Configure Thresholds
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Alert Thresholds</DialogTitle>
          <DialogDescription>
            Adjust alert thresholds for {metricName}. Values must be within the
            safe range: {rulebookBounds.min} to {rulebookBounds.max}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="watch-max">Watch Max</Label>
              <Input
                id="watch-max"
                type="number"
                value={watchMax}
                onChange={(e) => setWatchMax(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="watch-min">Watch Min</Label>
              <Input
                id="watch-min"
                type="number"
                value={watchMin}
                onChange={(e) => setWatchMin(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="critical-max">Critical Max</Label>
              <Input
                id="critical-max"
                type="number"
                value={criticalMax}
                onChange={(e) => setCriticalMax(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="critical-min">Critical Min</Label>
              <Input
                id="critical-min"
                type="number"
                value={criticalMin}
                onChange={(e) => setCriticalMin(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <p className="text-xs text-muted-foreground">
            Safe range: {rulebookBounds.min} – {rulebookBounds.max}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
