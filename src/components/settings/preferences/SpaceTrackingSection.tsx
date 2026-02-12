import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import type { SpaceTrackingMode, ContainerVolumeMode } from '@/hooks/useOrgPreferences';

interface SpaceTrackingSectionProps {
  spaceTrackingMode: SpaceTrackingMode;
  containerVolumeMode: ContainerVolumeMode;
  onSpaceTrackingModeChange: (mode: SpaceTrackingMode) => void;
  onContainerVolumeModeChange: (mode: ContainerVolumeMode) => void;
}

export function SpaceTrackingSection({
  spaceTrackingMode,
  containerVolumeMode,
  onSpaceTrackingModeChange,
  onContainerVolumeModeChange,
}: SpaceTrackingSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MaterialIcon name="straighten" size="sm" />
          <HelpTip tooltip="Controls how inventory space usage is tracked across locations. Affects capacity calculations and utilization reporting.">
            Inventory Space Tracking
          </HelpTip>
        </CardTitle>
        <CardDescription>
          Configure how space usage and capacity are tracked for locations and containers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>
              <HelpTip tooltip="None: no space tracking. Cubic Feet Only: track unit volumes without individual dimensions. Dimensions: store L x W x H per unit with auto-computed cubic feet and class-based defaults.">
                Space Tracking Mode
              </HelpTip>
            </Label>
            <Select
              value={spaceTrackingMode}
              onValueChange={(value) => onSpaceTrackingModeChange(value as SpaceTrackingMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  None
                </SelectItem>
                <SelectItem value="cubic_feet">
                  Cubic Feet Only
                </SelectItem>
                <SelectItem value="dimensions">
                  Dimensions (L x W x H)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {spaceTrackingMode === 'none' && 'Space tracking is disabled. Capacity fields exist but are not calculated.'}
              {spaceTrackingMode === 'cubic_feet' && 'Track cubic feet per unit. Used capacity sums unit volumes at each location.'}
              {spaceTrackingMode === 'dimensions' && 'Store L x W x H dimensions per unit. Cubic feet computed automatically. Supports class-based defaults.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              <HelpTip tooltip="Units Only: sum all unit volumes directly. Bounded Footprint: use the container footprint as a ceiling when set — if total contents exceed the footprint, use contents volume instead. Falls back to units-only when footprint is not set.">
                Container Capacity Mode
              </HelpTip>
            </Label>
            <Select
              value={containerVolumeMode}
              onValueChange={(value) => onContainerVolumeModeChange(value as ContainerVolumeMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bounded_footprint">
                  Bounded Footprint (Recommended)
                </SelectItem>
                <SelectItem value="units_only">
                  Units Only
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {containerVolumeMode === 'bounded_footprint' && 'Uses container footprint as a volume ceiling. Falls back to summing unit volumes when footprint is not set.'}
              {containerVolumeMode === 'units_only' && 'Always sums individual unit volumes, ignoring container footprint.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
