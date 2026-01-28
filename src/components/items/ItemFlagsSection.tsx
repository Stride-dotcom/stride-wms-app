/**
 * ItemFlagsSection - Displays flags from the Price List (service_events with add_flag=true)
 * When a flag is checked, it creates a billing event using the rate from the Price List
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceEvents, ServiceEvent } from '@/hooks/useServiceEvents';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Flag,
  Loader2,
  DollarSign,
  Bell,
  AlertTriangle,
} from 'lucide-react';

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
  const { hasRole } = usePermissions();

  // Only show flag prices to certain roles
  const canViewPrices = hasRole('tenant_admin') || hasRole('admin') || hasRole('manager');

  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null);
  const [enabledFlags, setEnabledFlags] = useState<Set<string>>(new Set());
  const [loadingFlags, setLoadingFlags] = useState(true);

  // Fetch flags from Price List (service_events with add_flag = true)
  const { flagServiceEvents, getServiceRate, loading: serviceEventsLoading } = useServiceEvents();

  // Fetch which flags are enabled for this item (via billing_events with event_type = 'flag')
  const fetchEnabledFlags = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await (supabase
        .from('billing_events') as any)
        .select('charge_type')
        .eq('item_id', itemId)
        .eq('event_type', 'flag')
        .in('status', ['flagged', 'unbilled']); // Include both statuses

      if (error) {
        console.error('[ItemFlagsSection] Error fetching enabled flags:', error);
        return;
      }

      const enabledCodes = new Set<string>((data || []).map((d: any) => d.charge_type));
      setEnabledFlags(enabledCodes);
    } catch (error) {
      console.error('[ItemFlagsSection] Unexpected error:', error);
    } finally {
      setLoadingFlags(false);
    }
  }, [profile?.tenant_id, itemId]);

  useEffect(() => {
    fetchEnabledFlags();
  }, [fetchEnabledFlags]);

  // Handle flag toggle
  const handleFlagToggle = async (service: ServiceEvent, currentlyEnabled: boolean) => {
    if (isClientUser) {
      toast.error('Only warehouse staff can modify flags.');
      return;
    }

    setUpdatingFlag(service.service_code);

    try {
      if (currentlyEnabled) {
        // Remove the billing event for this flag
        const { error } = await (supabase
          .from('billing_events') as any)
          .delete()
          .eq('item_id', itemId)
          .eq('charge_type', service.service_code)
          .eq('event_type', 'flag')
          .in('status', ['flagged', 'unbilled']);

        if (error) throw error;

        toast.success(`${service.service_name} removed`);
        setEnabledFlags(prev => {
          const next = new Set(prev);
          next.delete(service.service_code);
          return next;
        });
      } else {
        // Get item details for rate calculation and account info
        const { data: itemData } = await (supabase
          .from('items') as any)
          .select('account_id, sidemark_id, class:classes(code)')
          .eq('id', itemId)
          .single();

        const classCode = itemData?.class?.code || null;
        const rateInfo = getServiceRate(service.service_code, classCode);
        const itemAccountId = itemData?.account_id || accountId || null;

        // Create a billing event for this flag
        const { error } = await (supabase
          .from('billing_events') as any)
          .insert({
            tenant_id: profile!.tenant_id,
            account_id: itemAccountId,
            item_id: itemId,
            sidemark_id: itemData?.sidemark_id || null,
            event_type: 'flag',
            charge_type: service.service_code,
            description: `${service.service_name}`,
            quantity: 1,
            unit_rate: rateInfo.rate,
            status: 'unbilled',
            created_by: profile!.id,
            has_rate_error: rateInfo.hasError,
            rate_error_message: rateInfo.errorMessage,
          });

        if (error) throw error;

        // Check if this service has an alert rule
        if (service.alert_rule && service.alert_rule !== 'none') {
          toast.success(`${service.service_name} enabled (billing event created, alert sent)`);
          // TODO: Send alert notification based on alert_rule
        } else {
          toast.success(`${service.service_name} enabled (billing event created)`);
        }

        setEnabledFlags(prev => {
          const next = new Set(prev);
          next.add(service.service_code);
          return next;
        });
      }

      onFlagsChange?.();
    } catch (error: any) {
      console.error('[ItemFlagsSection] Error toggling flag:', error);
      toast.error(error.message || 'Failed to update flag');
    } finally {
      setUpdatingFlag(null);
    }
  };

  // Loading state
  if (serviceEventsLoading || loadingFlags) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flag className="h-5 w-5" />
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

  // Empty state
  if (flagServiceEvents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Item Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No flags configured. Add services with "Add Flag" enabled in Settings → Pricing.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Check if any damage-related flag is enabled
  const hasDamage = Array.from(enabledFlags).some(code =>
    code.toLowerCase().includes('damage') ||
    code.toLowerCase().includes('repair')
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Flag className="h-5 w-5" />
          Item Flags
          {hasDamage && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Attention Required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {flagServiceEvents.map((service) => {
            const isEnabled = enabledFlags.has(service.service_code);
            const isUpdating = updatingFlag === service.service_code;
            const hasAlert = service.alert_rule && service.alert_rule !== 'none';

            return (
              <div
                key={service.service_code}
                className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                  isClientUser ? 'opacity-60' : 'hover:bg-muted/50'
                } ${isEnabled ? 'bg-primary/5 border border-primary/20' : ''}`}
                title={service.notes || undefined}
              >
                <Checkbox
                  id={`flag-${service.service_code}`}
                  checked={isEnabled}
                  onCheckedChange={() => handleFlagToggle(service, isEnabled)}
                  disabled={isClientUser || isUpdating}
                />
                <Label
                  htmlFor={`flag-${service.service_code}`}
                  className={`flex items-center gap-2 flex-1 ${
                    isClientUser ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Flag className={`h-4 w-4 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  )}
                  <span className="text-sm">{service.service_name}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {canViewPrices && service.rate > 0 && (
                      <Badge variant="outline" className="text-xs px-1">
                        <DollarSign className="h-3 w-3" />
                        {service.rate.toFixed(2)}
                      </Badge>
                    )}
                    {hasAlert && (
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
            <span>Creates Billing Charge</span>
          </div>
          <div className="flex items-center gap-1">
            <Bell className="h-3 w-3" />
            <span>Sends Alert</span>
          </div>
        </div>

        {isClientUser && (
          <p className="text-xs text-muted-foreground mt-4">
            Flags can only be modified by warehouse staff.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
