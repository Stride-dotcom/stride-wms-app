/**
 * useServiceEvents - Hook for service events pricing and billing
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { queueBillingEventAlert } from '@/lib/alertQueue';

export interface ServiceEvent {
  id: string;
  tenant_id: string;
  class_code: string | null;
  service_code: string;
  service_name: string;
  billing_unit: 'Day' | 'Item' | 'Task';
  service_time_minutes: number | null;
  rate: number;
  taxable: boolean;
  uses_class_pricing: boolean;
  is_active: boolean;
  notes: string | null;
  add_flag: boolean;
  add_to_service_event_scan: boolean;
  alert_rule: string;
  billing_trigger: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceEventForScan {
  service_code: string;
  service_name: string;
  rate: number;
  billing_unit: string;
  uses_class_pricing: boolean;
  notes: string | null;
}

export function useServiceEvents() {
  const [serviceEvents, setServiceEvents] = useState<ServiceEvent[]>([]);
  const [scanServiceEvents, setScanServiceEvents] = useState<ServiceEventForScan[]>([]);
  const [flagServiceEvents, setFlagServiceEvents] = useState<ServiceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  // Fetch all service events
  const fetchServiceEvents = useCallback(async () => {
    if (!profile?.tenant_id) {
      setServiceEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await (supabase
        .from('service_events') as any)
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('service_name');

      if (error) {
        console.error('[useServiceEvents] Fetch failed:', error);
        toast({
          variant: 'destructive',
          title: 'Error loading service events',
          description: error.message,
        });
        return;
      }

      setServiceEvents(data || []);

      // Extract unique services for scan (where add_to_service_event_scan = true)
      const scanServices = (data || [])
        .filter((se: ServiceEvent) => se.add_to_service_event_scan)
        .reduce((acc: ServiceEventForScan[], se: ServiceEvent) => {
          // Only add if we haven't seen this service_code yet
          if (!acc.find(s => s.service_code === se.service_code)) {
            acc.push({
              service_code: se.service_code,
              service_name: se.service_name,
              rate: se.rate,
              billing_unit: se.billing_unit,
              uses_class_pricing: se.uses_class_pricing,
              notes: se.notes,
            });
          }
          return acc;
        }, []);

      setScanServiceEvents(scanServices);

      // Extract services with add_flag = true
      const flagServices = (data || []).filter((se: ServiceEvent) => se.add_flag);
      setFlagServiceEvents(flagServices);

    } catch (error: any) {
      console.error('[useServiceEvents] Unexpected error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load service events',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchServiceEvents();
  }, [fetchServiceEvents]);

  // Get rate for a specific service and class
  const getServiceRate = useCallback((serviceCode: string, classCode?: string | null): {
    rate: number;
    serviceName: string;
    alertRule: string;
    hasError: boolean;
    errorMessage: string | null;
  } => {
    // First try class-specific rate
    if (classCode) {
      const classSpecific = serviceEvents.find(
        se => se.service_code === serviceCode && se.class_code === classCode
      );
      if (classSpecific) {
        return {
          rate: classSpecific.rate,
          serviceName: classSpecific.service_name,
          alertRule: classSpecific.alert_rule || 'none',
          hasError: false,
          errorMessage: null,
        };
      }
    }

    // Try non-class-specific rate
    const general = serviceEvents.find(
      se => se.service_code === serviceCode && !se.class_code
    );

    if (general) {
      // Check if this service normally uses class pricing
      if (general.uses_class_pricing && !classCode) {
        return {
          rate: general.rate,
          serviceName: general.service_name,
          alertRule: general.alert_rule || 'none',
          hasError: true,
          errorMessage: 'Item has no class assigned - using default rate',
        };
      }
      return {
        rate: general.rate,
        serviceName: general.service_name,
        alertRule: general.alert_rule || 'none',
        hasError: false,
        errorMessage: null,
      };
    }

    // Service not found
    return {
      rate: 0,
      serviceName: serviceCode,
      alertRule: 'none',
      hasError: true,
      errorMessage: `Service not found: ${serviceCode}`,
    };
  }, [serviceEvents]);

  // Create billing events for items with selected services
  const createBillingEvents = useCallback(async (
    items: Array<{ id: string; item_code: string; class_code?: string | null; account_id?: string | null; sidemark_id?: string | null; account_name?: string }>,
    serviceCodes: string[]
  ): Promise<{ success: boolean; count: number; errors: number }> => {
    if (!profile?.tenant_id || !profile?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Not authenticated',
      });
      return { success: false, count: 0, errors: 0 };
    }

    let successCount = 0;
    let errorCount = 0;

    for (const item of items) {
      for (const serviceCode of serviceCodes) {
        const rateInfo = getServiceRate(serviceCode, item.class_code);
        const description = `${rateInfo.serviceName} - ${item.item_code}`;

        const { data: billingEvent, error } = await (supabase
          .from('billing_events') as any)
          .insert({
            tenant_id: profile.tenant_id,
            account_id: item.account_id,
            item_id: item.id,
            sidemark_id: item.sidemark_id,
            event_type: 'service_scan',
            charge_type: serviceCode,
            description,
            quantity: 1,
            unit_rate: rateInfo.rate,
            status: 'unbilled',
            created_by: profile.id,
            has_rate_error: rateInfo.hasError,
            rate_error_message: rateInfo.errorMessage,
          })
          .select('id')
          .single();

        if (error) {
          console.error('[useServiceEvents] Failed to create billing event:', error);
          errorCount++;
        } else {
          successCount++;

          // Queue alert if service has email_office alert rule
          if (rateInfo.alertRule === 'email_office' && billingEvent?.id) {
            await queueBillingEventAlert(
              profile.tenant_id,
              billingEvent.id,
              rateInfo.serviceName,
              item.item_code,
              item.account_name || 'Unknown Account',
              rateInfo.rate,
              description
            );
          }
        }
      }
    }

    if (errorCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Some billing events failed',
        description: `Created ${successCount}, failed ${errorCount}`,
      });
    } else {
      toast({
        title: 'Billing events created',
        description: `Created ${successCount} billing event${successCount !== 1 ? 's' : ''}`,
      });
    }

    return { success: errorCount === 0, count: successCount, errors: errorCount };
  }, [profile, getServiceRate, toast]);

  // Seed service events for tenant
  const seedServiceEvents = useCallback(async () => {
    if (!profile?.tenant_id) return;

    const { error } = await (supabase.rpc as any)('seed_service_events', {
      p_tenant_id: profile.tenant_id,
    });

    if (error) {
      console.error('[useServiceEvents] Seed failed:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to seed service events',
        description: error.message,
      });
      return;
    }

    toast({
      title: 'Service events seeded',
      description: 'Price list has been populated.',
    });

    fetchServiceEvents();
  }, [profile?.tenant_id, toast, fetchServiceEvents]);

  return {
    serviceEvents,
    scanServiceEvents,
    flagServiceEvents,
    loading,
    refetch: fetchServiceEvents,
    getServiceRate,
    createBillingEvents,
    seedServiceEvents,
  };
}
