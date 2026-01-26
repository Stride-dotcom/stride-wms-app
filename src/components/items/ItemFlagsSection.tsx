import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePricingFlags,
  useItemFlags,
  useSetItemFlag,
  useUnsetItemFlag,
  PricingFlag,
} from '@/hooks/usePricing';
import { useServiceEvents, ServiceEvent } from '@/hooks/useServiceEvents';
import { supabase } from '@/integrations/supabase/client';
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
  const [updatingServiceFlag, setUpdatingServiceFlag] = useState<string | null>(null);
  const [enabledServiceFlags, setEnabledServiceFlags] = useState<Set<string>>(new Set());
  const [loadingServiceFlags, setLoadingServiceFlags] = useState(true);

  // Fetch all available flags for this tenant
  const { data: availableFlags = [], isLoading: flagsLoading } = usePricingFlags();

  // Fetch currently set flags for this item
  const { data: itemFlags = [], isLoading: itemFlagsLoading, refetch: refetchItemFlags } = useItemFlags(itemId);

  // Fetch service events with add_flag = true
  const { flagServiceEvents, getServiceRate, loading: serviceEventsLoading } = useServiceEvents();

  // Mutations
  const setItemFlag = useSetItemFlag();
  const unsetItemFlag = useUnsetItemFlag();

  // Fetch which service flags are enabled for this item (via billing_events with status = 'flagged')
  const fetchEnabledServiceFlags = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await (supabase
        .from('billing_events') as any)
        .select('charge_type')
        .eq('item_id', itemId)
        .eq('event_type', 'flag')
        .eq('status', 'flagged');

      if (error) {
        console.error('[ItemFlagsSection] Error fetching service flags:', error);
        return;
      }

      const enabledCodes = new Set<string>((data || []).map((d: any) => d.charge_type));
      setEnabledServiceFlags(enabledCodes);
    } catch (error) {
      console.error('[ItemFlagsSection] Unexpected error:', error);
    } finally {
      setLoadingServiceFlags(false);
    }
  }, [profile?.tenant_id, itemId]);

  useEffect(() => {
    fetchEnabledServiceFlags();
  }, [fetchEnabledServiceFlags]);

  // Handle service flag toggle
  const handleServiceFlagToggle = async (service: ServiceEvent, currentlyEnabled: boolean) => {
    if (isClientUser) {
      toast.error('Only warehouse staff can modify service flags.');
      return;
    }

    setUpdatingServiceFlag(service.service_code);

    try {
      if (currentlyEnabled) {
        // Remove the flagged billing event
        const { error } = await (supabase
          .from('billing_events') as any)
          .delete()
          .eq('item_id', itemId)
          .eq('charge_type', service.service_code)
          .eq('event_type', 'flag')
          .eq('status', 'flagged');

        if (error) throw error;

        toast.success(`${service.service_name} removed`);
        setEnabledServiceFlags(prev => {
          const next = new Set(prev);
          next.delete(service.service_code);
          return next;
        });
      } else {
        // Get item details for rate calculation
        const { data: itemData } = await (supabase
          .from('items') as any)
          .select('account_id, sidemark_id, class:classes(code)')
          .eq('id', itemId)
          .single();

        const classCode = itemData?.class?.code || null;
        const rateInfo = getServiceRate(service.service_code, classCode);

        // Create a flagged billing event
        const { error } = await (supabase
          .from('billing_events') as any)
          .insert({
            tenant_id: profile!.tenant_id,
            account_id: itemData?.account_id || null,
            item_id: itemId,
            sidemark_id: itemData?.sidemark_id || null,
            event_type: 'flag',
            charge_type: service.service_code,
            description: `${service.service_name} (Flag)`,
            quantity: 1,
            unit_rate: rateInfo.rate,
            status: 'flagged',
            created_by: profile!.id,
            has_rate_error: rateInfo.hasError,
            rate_error_message: rateInfo.errorMessage,
          });

        if (error) throw error;

        toast.success(`${service.service_name} enabled (billing event created)`);
        setEnabledServiceFlags(prev => {
          const next = new Set(prev);
          next.add(service.service_code);
          return next;
        });
      }

      onFlagsChange?.();
    } catch (error: any) {
      console.error('[ItemFlagsSection] Error toggling service flag:', error);
      toast.error(error.message || 'Failed to update service flag');
    } finally {
      setUpdatingServiceFlag(null);
    }
  };

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

        {/* Service Event Flags Section */}
        {flagServiceEvents.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="mb-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Service Flags
              </h4>
              <p className="text-xs text-muted-foreground">
                Select services to bill for this item
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {flagServiceEvents.map((service) => {
                const isEnabled = enabledServiceFlags.has(service.service_code);
                const isUpdating = updatingServiceFlag === service.service_code;

                return (
                  <div
                    key={service.service_code}
                    className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                      isClientUser ? 'opacity-60' : 'hover:bg-muted/50'
                    } ${isEnabled ? 'bg-success/10' : ''}`}
                    title={service.notes || undefined}
                  >
                    <Checkbox
                      id={`service-flag-${service.service_code}`}
                      checked={isEnabled}
                      onCheckedChange={() => handleServiceFlagToggle(service, isEnabled)}
                      disabled={isClientUser || isUpdating}
                    />
                    <Label
                      htmlFor={`service-flag-${service.service_code}`}
                      className={`flex items-center gap-2 flex-1 ${
                        isClientUser ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Zap className={`h-4 w-4 ${isEnabled ? 'text-success' : 'text-muted-foreground'}`} />
                      )}
                      <span className="text-sm">{service.service_name}</span>
                      <Badge variant="outline" className="text-xs px-1 ml-auto">
                        <DollarSign className="h-3 w-3 mr-0.5" />
                        {service.rate.toFixed(2)}
                      </Badge>
                    </Label>
                  </div>
                );
              })}
            </div>
          </>
        )}

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
