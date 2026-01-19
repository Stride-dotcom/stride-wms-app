import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Package, ClipboardCheck } from 'lucide-react';

interface StorageInspectionSectionProps {
  freeStorageDays: number;
  willCallMinimum: number;
  shouldCreateInspections: boolean;
  onFreeStorageDaysChange: (value: number) => void;
  onWillCallMinimumChange: (value: number) => void;
  onShouldCreateInspectionsChange: (value: boolean) => void;
}

export function StorageInspectionSection({
  freeStorageDays,
  willCallMinimum,
  shouldCreateInspections,
  onFreeStorageDaysChange,
  onWillCallMinimumChange,
  onShouldCreateInspectionsChange,
}: StorageInspectionSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Storage & Inspection Settings
        </CardTitle>
        <CardDescription>
          Configure storage billing and inspection preferences
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

          <div className="space-y-2">
            <Label htmlFor="will_call_minimum">Will Call Minimum</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="will_call_minimum"
                type="number"
                min="0"
                step="0.01"
                value={willCallMinimum}
                onChange={(e) => onWillCallMinimumChange(parseFloat(e.target.value) || 0)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum charge for will call orders
            </p>
          </div>
        </div>

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
      </CardContent>
    </Card>
  );
}
