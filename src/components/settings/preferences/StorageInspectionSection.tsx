import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Package, ClipboardCheck, Hammer, Wrench } from 'lucide-react';

interface StorageInspectionSectionProps {
  freeStorageDays: number;
  shouldCreateInspections: boolean;
  shouldAutoAssembly: boolean;
  shouldAutoRepair: boolean;
  onFreeStorageDaysChange: (value: number) => void;
  onShouldCreateInspectionsChange: (value: boolean) => void;
  onShouldAutoAssemblyChange: (value: boolean) => void;
  onShouldAutoRepairChange: (value: boolean) => void;
}

export function StorageInspectionSection({
  freeStorageDays,
  shouldCreateInspections,
  shouldAutoAssembly,
  shouldAutoRepair,
  onFreeStorageDaysChange,
  onShouldCreateInspectionsChange,
  onShouldAutoAssemblyChange,
  onShouldAutoRepairChange,
}: StorageInspectionSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          Storage & Automation
        </CardTitle>
        <CardDescription className="text-xs">
          Configure storage billing and automatic task creation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Free Storage Days - Compact */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="free_storage_days" className="text-sm">Free Storage Days</Label>
            <p className="text-xs text-muted-foreground">
              Days before billing begins
            </p>
          </div>
          <Input
            id="free_storage_days"
            type="number"
            min="0"
            max="365"
            value={freeStorageDays}
            onChange={(e) => onFreeStorageDaysChange(parseInt(e.target.value) || 0)}
            className="w-20 text-right"
          />
        </div>

        {/* Automation Toggles - Compact Grid */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <Label className="text-sm">Auto-Create Inspections</Label>
                <p className="text-xs text-muted-foreground truncate">
                  Create inspection tasks on receiving
                </p>
              </div>
            </div>
            <Switch
              checked={shouldCreateInspections}
              onCheckedChange={onShouldCreateInspectionsChange}
            />
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2 min-w-0">
              <Hammer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <Label className="text-sm">Auto-Create Assembly Tasks</Label>
                <p className="text-xs text-muted-foreground truncate">
                  Create assembly tasks on receiving
                </p>
              </div>
            </div>
            <Switch
              checked={shouldAutoAssembly}
              onCheckedChange={onShouldAutoAssemblyChange}
            />
          </div>

          <div className="flex items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-2 min-w-0">
              <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <Label className="text-sm">Auto-Create Repair Tasks</Label>
                <p className="text-xs text-muted-foreground truncate">
                  Create repair tasks when damaged
                </p>
              </div>
            </div>
            <Switch
              checked={shouldAutoRepair}
              onCheckedChange={onShouldAutoRepairChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
