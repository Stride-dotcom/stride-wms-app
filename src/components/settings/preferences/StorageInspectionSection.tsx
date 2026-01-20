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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Storage & Automation Settings
        </CardTitle>
        <CardDescription>
          Configure storage billing and automatic task creation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="free_storage_days">Free Storage Days</Label>
            <Input
              id="free_storage_days"
              type="number"
              min="0"
              max="365"
              value={freeStorageDays}
              onChange={(e) => onFreeStorageDaysChange(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Number of days items can be stored before billing begins
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base">Auto-Create Inspections</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically create inspection tasks when items are received
              </p>
            </div>
            <Switch
              checked={shouldCreateInspections}
              onCheckedChange={onShouldCreateInspectionsChange}
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Hammer className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base">Auto-Create Assembly Tasks</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically create assembly tasks when items are received
              </p>
            </div>
            <Switch
              checked={shouldAutoAssembly}
              onCheckedChange={onShouldAutoAssemblyChange}
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base">Auto-Create Repair Tasks</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically create repair tasks when items are marked as damaged or needing repair
              </p>
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
