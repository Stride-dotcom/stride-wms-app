import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Monitor, MapPin } from 'lucide-react';

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Display Settings
        </CardTitle>
        <CardDescription>
          Configure how information is displayed throughout the application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base">Show Warehouse Name in Location</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Display location as "Code (Warehouse Name)" instead of just "Code"
            </p>
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
