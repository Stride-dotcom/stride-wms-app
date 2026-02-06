/**
 * ItemFlagsSection - Displays flags from the Price List (charge_types with add_flag=true)
 * Billing flags: When toggled, creates a billing event using the rate from the Price List
 * Indicator flags: When toggled, stores state in item_flags table (no billing event)
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
import { toast } from '@/lib/toastShim';
import { queueBillingEventAlert } from '@/lib/alertQueue';
import { BILLING_DISABLED_ERROR } from '@/lib/billing/chargeTypeUtils';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { logItemActivity } from '@/lib/activity/logItemActivity';

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
  const [enabledBillingFlags, setEnabledBillingFlags] = useState<Set<string>>(new Set());
  const [enabledIndicatorFlags, setEnabledIndicatorFlags] = useState<Set<string>>(new Set());
  const [loadingFlags, setLoadingFlags] = useState(true);

  // Fetch flags from Price List (service_events with add_flag = true)
  const { flagServiceEvents, getServiceRate, loading: serviceEventsLoading } = useServiceEvents();

  // Fetch which billing flags are enabled (via billing_events with event_type = 'flag_change')
  // and which indicator flags are enabled (via item_flags table)
  const fetchEnabledFlags = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch billing flags
      const { data: billingData, error: billingError } = await (supabase
        .from('billing_events') as any)
        .select('charge_type')
        .eq('item_id', itemId)
        .eq('event_type', 'flag_change')
        .eq('status', 'unbilled');

      if (billingError) {
        console.error('[ItemFlagsSection] Error fetching billing flags:', billingError);
      }

      const billingCodes = new Set<string>((billingData || []).map((d: any) => d.charge_type));
      setEnabledBillingFlags(billingCodes);

      // Fetch indicator flags from item_flags table
      const { data: indicatorData, error: indicatorError } = await (supabase
        .from('item_flags') as any)
        .select('service_code')
        .eq('item_id', itemId);

      if (indicatorError) {
        // Table may not exist yet — ignore gracefully
        if (indicatorError.code !== '42P01') {
          console.error('[ItemFlagsSection] Error fetching indicator flags:', indicatorError);
        }
      }

      const indicatorCodes = new Set<string>((indicatorData || []).map((d: any) => d.service_code));
      setEnabledIndicatorFlags(indicatorCodes);
    } catch (error) {
      console.error('[ItemFlagsSection] Unexpected error:', error);
    } finally {
      setLoadingFlags(false);
    }
  }, [profile?.tenant_id, itemId]);

  useEffect(() => {
    fetchEnabledFlags();
  }, [fetchEnabledFlags]);

  // Check if a flag is enabled (billing OR indicator)
  const isFlagEnabled = (service: ServiceEvent): boolean => {
    if (service.flag_is_indicator) {
      return enabledIndicatorFlags.has(service.service_code);
    }
    return enabledBillingFlags.has(service.service_code);
  };

  // Handle flag toggle
  const handleFlagToggle = async (service: ServiceEvent, currentlyEnabled: boolean) => {
    if (isClientUser) {
      toast.error('Only warehouse staff can modify flags.');
      return;
    }

    setUpdatingFlag(service.service_code);

    try {
      if (service.flag_is_indicator) {
        // INDICATOR FLAG — use item_flags table
        await handleIndicatorFlagToggle(service, currentlyEnabled);
      } else {
        // BILLING FLAG — use billing_events table
        await handleBillingFlagToggle(service, currentlyEnabled);
      }

      onFlagsChange?.();
    } catch (error: any) {
      console.error('[ItemFlagsSection] Error toggling flag:', error);
      toast.error(error.message || 'Failed to update flag');
    } finally {
      setUpdatingFlag(null);
    }
  };

  // Handle indicator flag toggle (item_flags table)
  const handleIndicatorFlagToggle = async (service: ServiceEvent, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      // Remove from item_flags
      const { error } = await (supabase
        .from('item_flags') as any)
        .delete()
        .eq('item_id', itemId)
        .eq('service_code', service.service_code);

      if (error) throw error;

      toast.success(`${service.service_name} removed`);

      logItemActivity({
        tenantId: profile!.tenant_id,
        itemId,
        actorUserId: profile!.id,
        eventType: 'item_flag_removed',
        eventLabel: `Flag removed: ${service.service_name}`,
        details: { service_code: service.service_code, service_name: service.service_name, flag_type: 'indicator' },
      });

      setEnabledIndicatorFlags(prev => {
        const next = new Set(prev);
        next.delete(service.service_code);
        return next;
      });
    } else {
      // Insert into item_flags
      const { error } = await (supabase
        .from('item_flags') as any)
        .insert({
          tenant_id: profile!.tenant_id,
          item_id: itemId,
          charge_type_id: service.charge_type_id || null,
          service_code: service.service_code,
          created_by: profile!.id,
        });

      if (error) throw error;

      // Queue alert if service has alert rule
      if (service.alert_rule && service.alert_rule !== 'none') {
        // Get item info for alert
        const { data: itemData } = await (supabase.from('items') as any)
          .select('item_code, account_id, accounts:account_id(account_name)')
          .eq('id', itemId)
          .single();

        if (itemData) {
          await queueBillingEventAlert(
            profile!.tenant_id,
            itemId, // Use item ID as entity reference
            service.service_name,
            itemData.item_code || '',
            itemData.accounts?.account_name || 'Unknown Account',
            0, // No charge for indicator
            `Indicator flag applied: ${service.service_name}`
          );
        }
        toast.success(`${service.service_name} applied (alert sent)`);
      } else {
        toast.success(`${service.service_name} applied`);
      }

      logItemActivity({
        tenantId: profile!.tenant_id,
        itemId,
        actorUserId: profile!.id,
        eventType: 'item_flag_applied',
        eventLabel: `Flag applied: ${service.service_name}`,
        details: { service_code: service.service_code, service_name: service.service_name, flag_type: 'indicator' },
      });

      setEnabledIndicatorFlags(prev => {
        const next = new Set(prev);
        next.add(service.service_code);
        return next;
      });
    }
  };

  // Handle billing flag toggle (billing_events table)
  const handleBillingFlagToggle = async (service: ServiceEvent, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      // Remove the billing event for this flag
      const { error } = await (supabase
        .from('billing_events') as any)
        .delete()
        .eq('item_id', itemId)
        .eq('charge_type', service.service_code)
        .eq('event_type', 'flag_change')
        .eq('status', 'unbilled');

      if (error) throw error;

      toast.success(`${service.service_name} removed`);

      // Log flag removal AND billing event void (billing event was deleted, but history stays)
      logItemActivity({
        tenantId: profile!.tenant_id,
        itemId,
        actorUserId: profile!.id,
        eventType: 'item_flag_removed',
        eventLabel: `Flag removed: ${service.service_name}`,
        details: { service_code: service.service_code, service_name: service.service_name, flag_type: 'billing' },
      });
      logItemActivity({
        tenantId: profile!.tenant_id,
        itemId,
        actorUserId: profile!.id,
        eventType: 'billing_event_voided',
        eventLabel: `Unbilled charge removed: ${service.service_name}`,
        details: { service_code: service.service_code, reason: 'flag_unchecked' },
      });

      setEnabledBillingFlags(prev => {
        const next = new Set(prev);
        next.delete(service.service_code);
        return next;
      });
    } else {
      // Get item details for rate calculation and account info
      const { data: itemData } = await (supabase
        .from('items') as any)
        .select('account_id, sidemark_id, class:classes(code), item_code, accounts:account_id(account_name)')
        .eq('id', itemId)
        .single();

      const classCode = itemData?.class?.code || null;
      const rateInfo = getServiceRate(service.service_code, classCode);
      const itemAccountId = itemData?.account_id || accountId || null;

      // Block class-based services when item has no class assigned
      if (service.uses_class_pricing && !classCode) {
        toast.error('Item class required to apply this service.');
        return;
      }

      // Check account_service_settings for is_enabled before creating billing event
      if (itemAccountId) {
        const { data: accountSetting } = await supabase
          .from('account_service_settings')
          .select('is_enabled')
          .eq('account_id', itemAccountId)
          .eq('service_code', service.service_code)
          .maybeSingle();

        if (accountSetting && accountSetting.is_enabled === false) {
          toast.error(BILLING_DISABLED_ERROR);
          return;
        }
      }

      // Create a billing event for this flag
      const { data: billingEvent, error } = await (supabase
        .from('billing_events') as any)
        .insert({
          tenant_id: profile!.tenant_id,
          account_id: itemAccountId,
          item_id: itemId,
          sidemark_id: itemData?.sidemark_id || null,
          event_type: 'flag_change',
          charge_type: service.service_code,
          description: `${service.service_name}`,
          quantity: 1,
          unit_rate: rateInfo.rate,
          total_amount: rateInfo.rate,
          status: 'unbilled',
          created_by: profile!.id,
          has_rate_error: rateInfo.hasError,
          rate_error_message: rateInfo.errorMessage,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Queue alert if service has alert rule
      if (service.alert_rule && service.alert_rule !== 'none' && billingEvent?.id) {
        await queueBillingEventAlert(
          profile!.tenant_id,
          billingEvent.id,
          rateInfo.serviceName,
          itemData?.item_code || '',
          itemData?.accounts?.account_name || 'Unknown Account',
          rateInfo.rate,
          `${service.service_name}`
        );
        toast.success(`${service.service_name} enabled (billing event created, alert sent)`);
      } else {
        toast.success(`${service.service_name} enabled (billing event created)`);
      }

      // Log flag applied + billing event created
      logItemActivity({
        tenantId: profile!.tenant_id,
        itemId,
        actorUserId: profile!.id,
        eventType: 'item_flag_applied',
        eventLabel: `Flag applied: ${service.service_name}`,
        details: { service_code: service.service_code, service_name: service.service_name, flag_type: 'billing', rate: rateInfo.rate },
      });
      logItemActivity({
        tenantId: profile!.tenant_id,
        itemId,
        actorUserId: profile!.id,
        eventType: 'billing_event_created',
        eventLabel: `Billing charge created: ${service.service_name}`,
        details: { service_code: service.service_code, amount: rateInfo.rate, status: 'unbilled' },
      });

      setEnabledBillingFlags(prev => {
        const next = new Set(prev);
        next.add(service.service_code);
        return next;
      });
    }
  };

  // Loading state
  if (serviceEventsLoading || loadingFlags) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MaterialIcon name="flag" size="md" />
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
            <MaterialIcon name="flag" size="md" />
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
  const allEnabledFlags = new Set([...enabledBillingFlags, ...enabledIndicatorFlags]);
  const hasDamage = Array.from(allEnabledFlags).some(code =>
    code.toLowerCase().includes('damage') ||
    code.toLowerCase().includes('repair')
  );

  // Get active indicator flags for display in parent (exposed via data attribute)
  const activeIndicatorFlags = flagServiceEvents.filter(
    s => s.flag_is_indicator && enabledIndicatorFlags.has(s.service_code)
  );

  return (
    <Card data-active-indicators={JSON.stringify(activeIndicatorFlags.map(f => ({ code: f.service_code, name: f.service_name })))}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MaterialIcon name="flag" size="md" />
          Item Flags
          {hasDamage && (
            <Badge variant="destructive" className="ml-2">
              <MaterialIcon name="warning" className="text-[12px] mr-1" />
              Attention Required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {flagServiceEvents.map((service) => {
            const isEnabled = isFlagEnabled(service);
            const isUpdating = updatingFlag === service.service_code;
            const hasAlert = service.alert_rule && service.alert_rule !== 'none';
            const isIndicator = service.flag_is_indicator;

            return (
              <div
                key={service.service_code}
                className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                  isClientUser ? 'opacity-60' : 'hover:bg-muted/50'
                } ${isEnabled ? (isIndicator ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' : 'bg-primary/5 border border-primary/20') : ''}`}
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
                    <MaterialIcon name="progress_activity" size="sm" className="animate-spin text-muted-foreground" />
                  ) : (
                    <MaterialIcon
                      name={isIndicator ? 'info' : 'flag'}
                      size="sm"
                      className={isEnabled ? (isIndicator ? 'text-amber-600 dark:text-amber-400' : 'text-primary') : 'text-muted-foreground'}
                    />
                  )}
                  <span className="text-sm">{service.service_name}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    {isIndicator ? (
                      <Badge variant="outline" className="text-xs px-1 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                        INDICATOR
                      </Badge>
                    ) : (
                      canViewPrices && service.rate > 0 && (
                        <Badge variant="outline" className="text-xs px-1">
                          <MaterialIcon name="attach_money" className="text-[12px]" />
                          {service.rate.toFixed(2)}
                        </Badge>
                      )
                    )}
                    {hasAlert && (
                      <Badge variant="outline" className="text-xs px-1">
                        <MaterialIcon name="notifications" className="text-[12px]" />
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
            <MaterialIcon name="attach_money" className="text-[12px]" />
            <span>Creates Billing Charge</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[9px] px-0.5 py-0 leading-tight">IND</Badge>
            <span>Indicator Only</span>
          </div>
          <div className="flex items-center gap-1">
            <MaterialIcon name="notifications" className="text-[12px]" />
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
