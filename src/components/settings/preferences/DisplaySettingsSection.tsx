import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface DisplaySettingsSectionProps {
  showWarehouseInLocation: boolean;
  onShowWarehouseInLocationChange: (value: boolean) => void;
}

export function DisplaySettingsSection({
  showWarehouseInLocation,
  onShowWarehouseInLocationChange,
}: DisplaySettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MaterialIcon name="desktop_windows" size="sm" />
          Display Settings
        </CardTitle>
        <CardDescription className="text-xs">
          Configure how information is displayed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-2 min-w-0">
            <MaterialIcon name="location_on" size="sm" className="text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <Label className="text-sm">Show Warehouse in Location</Label>
              <p className="text-xs text-muted-foreground truncate">
                Display "Code (Warehouse)" format
              </p>
            </div>
          </div>
          <Switch
            checked={showWarehouseInLocation}
            onCheckedChange={onShowWarehouseInLocationChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
