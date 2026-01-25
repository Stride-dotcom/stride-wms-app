import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePricingFlags,
  useItemFlags,
  useSetItemFlag,
  useUnsetItemFlag,
  PricingFlag,
} from '@/hooks/usePricing';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Package,
  Ruler,
  Layers,
  Box,
  Wrench,
  Search,
  Hammer,
  Bell,
  HelpCircle,
  Flag,
  Loader2,
  DollarSign,
  Weight,
  Maximize,
  GlassWater,
  Gem,
  Thermometer,
  Biohazard,
  Hand,
  Zap,
  Paintbrush,
  PackageX,
  FileQuestion,
  Puzzle,
} from 'lucide-react';

// Icon mapping from flag icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'flag': Flag,
  'package': Package,
  'weight': Weight,
  'maximize': Maximize,
  'ruler': Ruler,
  'layers': Layers,
  'box': Box,
  'wrench': Wrench,
  'search': Search,
  'hammer': Hammer,
  'bell': Bell,
  'help-circle': HelpCircle,
  'file-question': FileQuestion,
  'alert-triangle': AlertTriangle,
  'glass-water': GlassWater,
  'gem': Gem,
  'thermometer': Thermometer,
  'biohazard': Biohazard,
  'hand': Hand,
  'zap': Zap,
  'paintbrush': Paintbrush,
  'package-x': PackageX,
  'puzzle': Puzzle,
};

// Color mapping for flag badges
const COLOR_MAP: Record<string, string> = {
  'default': '',
  'warning': 'bg-amber-500 hover:bg-amber-600',
  'destructive': 'bg-destructive hover:bg-destructive/90',
  'success': 'bg-green-500 hover:bg-green-600',
};

interface ItemFlagsSectionProps {
  itemId: string;
  accountId?: string;
  onFlagsChange?: () => void;
  isClientUser?: boolean;
}

export function ItemFlagsSection({
  itemId,
  accountId,
  onFlagsChange,
  isClientUser = false,
}: ItemFlagsSectionProps) {
  const { profile } = useAuth();
  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null);

  // Fetch all available flags for this tenant
  const { data: availableFlags = [], isLoading: flagsLoading } = usePricingFlags();

  // Fetch currently set flags for this item
  const { data: itemFlags = [], isLoading: itemFlagsLoading, refetch: refetchItemFlags } = useItemFlags(itemId);

  // Mutations
  const setItemFlag = useSetItemFlag();
  const unsetItemFlag = useUnsetItemFlag();

  // Filter flags based on client visibility
  const visibleFlags = useMemo(() => {
    return availableFlags.filter(flag => {
      if (!flag.is_active) return false;
      if (isClientUser && !flag.visible_to_client) return false;
      return true;
    });
  }, [availableFlags, isClientUser]);

  // Create a set of currently enabled flag keys for quick lookup
  const enabledFlagIds = useMemo(() => {
    return new Set(itemFlags.map(f => f.flag_id));
  }, [itemFlags]);

  const getIconComponent = (iconName: string | null) => {
    if (!iconName) return Flag;
    return ICON_MAP[iconName] || Flag;
  };

  const handleFlagToggle = async (flag: PricingFlag, currentlyEnabled: boolean) => {
    // Check if client can edit this flag
    if (isClientUser && !flag.client_can_set) {
      toast.error('You do not have permission to change this flag.');
      return;
    }

    setUpdatingFlag(flag.id);

    try {
      if (currentlyEnabled) {
        // Unset the flag
        await unsetItemFlag.mutateAsync({
          itemId,
          flagKey: flag.flag_key,
        });
        toast.success(`${flag.display_name} disabled`);
      } else {
        // Set the flag - this will auto-create billing events and tasks as configured
        const result = await setItemFlag.mutateAsync({
          itemId,
          flagKey: flag.flag_key,
        });

        let message = `${flag.display_name} enabled`;
        if (result.billing_event_id) {
          message += ' (billing event created)';
        }
        if (result.task_id) {
          message += ' (task created)';
        }
        toast.success(message);
      }

      // Refetch and notify parent
      await refetchItemFlags();
      onFlagsChange?.();
    } catch (error: any) {
      console.error('Error toggling flag:', error);
      toast.error(error.message || 'Failed to update flag');
    } finally {
      setUpdatingFlag(null);
    }
  };

  // Check if any damage flag is enabled
  const hasDamage = useMemo(() => {
    return itemFlags.some(itemFlag => {
      const flagDef = availableFlags.find(f => f.id === itemFlag.flag_id);
      return flagDef?.flag_key === 'HAS_DAMAGE';
    });
  }, [itemFlags, availableFlags]);

  if (flagsLoading || itemFlagsLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Item Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visibleFlags.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Item Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No flags configured. Configure flags in Settings → Pricing → Item Flags.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Item Flags
          {hasDamage && (
            <Badge variant="destructive" className="ml-2">
              Damage Reported
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {visibleFlags.map((flag) => {
            const Icon = getIconComponent(flag.icon);
            const isEnabled = enabledFlagIds.has(flag.id);
            const isUpdating = updatingFlag === flag.id;
            const canEdit = !isClientUser || flag.client_can_set;
            const colorClass = flag.color ? COLOR_MAP[flag.color] || '' : '';

            return (
              <div
                key={flag.id}
                className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                  !canEdit ? 'opacity-60' : 'hover:bg-muted/50'
                } ${isEnabled && colorClass ? 'bg-muted/30' : ''}`}
                title={flag.description || undefined}
              >
                <Checkbox
                  id={`flag-${flag.id}`}
                  checked={isEnabled}
                  onCheckedChange={() => handleFlagToggle(flag, isEnabled)}
                  disabled={!canEdit || isUpdating}
                />
                <Label
                  htmlFor={`flag-${flag.id}`}
                  className={`flex items-center gap-2 flex-1 ${
                    canEdit ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Icon className={`h-4 w-4 ${
                      isEnabled && flag.color === 'destructive'
                        ? 'text-destructive'
                        : isEnabled && flag.color === 'warning'
                        ? 'text-amber-500'
                        : 'text-muted-foreground'
                    }`} />
                  )}
                  <span className="text-sm">{flag.display_name}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {flag.is_billable && (
                      <Badge variant="outline" className="text-xs px-1">
                        <DollarSign className="h-3 w-3" />
                      </Badge>
                    )}
                    {flag.triggers_task_type && (
                      <Badge variant="outline" className="text-xs px-1">
                        <Hammer className="h-3 w-3" />
                      </Badge>
                    )}
                    {flag.triggers_alert && (
                      <Badge variant="outline" className="text-xs px-1">
                        <Bell className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span>Billable</span>
          </div>
          <div className="flex items-center gap-1">
            <Hammer className="h-3 w-3" />
            <span>Creates Task</span>
          </div>
          <div className="flex items-center gap-1">
            <Bell className="h-3 w-3" />
            <span>Sends Alert</span>
          </div>
        </div>

        {isClientUser && (
          <p className="text-xs text-muted-foreground mt-4">
            Some flags can only be modified by warehouse staff.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Legacy compatibility - export a type that matches the old interface
export interface LegacyItemFlags {
  is_overweight: boolean;
  is_oversize: boolean;
  is_unstackable: boolean;
  is_crated: boolean;
  needs_repair: boolean;
  needs_inspection: boolean;
  needs_warehouse_assembly: boolean;
  notify_dispatch: boolean;
  has_damage: boolean;
  received_without_id: boolean;
  needs_minor_touchup: boolean;
}
