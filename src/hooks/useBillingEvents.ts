import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  getServiceRate, 
  getAccountIdFromName, 
  flagToServiceType,
  taskTypeToServiceType,
  RateLookupResult,
} from '@/lib/billingRates';

export interface BillingEvent {
  id: string;
  tenant_id: string;
  account_id: string | null;
  item_id: string | null;
  task_id: string | null;
  event_type: 'flag_change' | 'task_completion' | 'unable_to_complete' | 'receiving' | 'will_call' | 'disposal';
  charge_type: string;
  description: string | null;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  needs_review: boolean;
  invoice_id: string | null;
  invoiced_at: string | null;
  created_by: string | null;
  created_at: string;
  rate_source: string | null;
  service_category: string | null;
}

export function useBillingEvents() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Create billing event when a flag changes on an item
  const createFlagBillingEvent = useCallback(async (
    itemId: string,
    flagName: string,
    flagValue: boolean
  ) => {
    if (!profile?.tenant_id || !flagValue) return null; // Only bill when flag is set to true

    try {
      setLoading(true);

      // Get item details
      const { data: item } = await (supabase
        .from('items') as any)
        .select('client_account, item_type_id, item_code')
        .eq('id', itemId)
        .single();

      if (!item) return null;

      // Get account ID from client_account name
      const accountId = await getAccountIdFromName(item.client_account);

      // Check if billing event already exists for this flag
      const { data: existingEvent } = await (supabase
        .from('billing_events') as any)
        .select('id')
        .eq('item_id', itemId)
        .eq('charge_type', flagName)
        .single();

      if (existingEvent) {
        // Billing event already exists, don't create duplicate
        return null;
      }

      // Get rate using unified rate lookup
      const serviceType = flagToServiceType(flagName);
      const rateResult: RateLookupResult = await getServiceRate({
        accountId,
        itemTypeId: item.item_type_id,
        serviceType,
      });

      // Create billing event
      const chargeDescription = flagName
        .replace('is_', '')
        .replace('_', ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      const { data, error } = await (supabase
        .from('billing_events') as any)
        .insert({
          tenant_id: profile.tenant_id,
          account_id: accountId,
          item_id: itemId,
          event_type: 'flag_change',
          charge_type: flagName,
          description: `${chargeDescription} - ${item.item_code}`,
          quantity: 1,
          unit_rate: rateResult.rate,
          total_amount: rateResult.rate,
          needs_review: rateResult.source === 'default', // Flag for review if using default rate
          created_by: profile.id,
          rate_source: rateResult.source,
          service_category: rateResult.category,
        })
        .select()
        .single();

      if (error) throw error;

      if (rateResult.rate > 0) {
        toast({
          title: 'Billing Charge Created',
          description: `$${rateResult.rate.toFixed(2)} charge for ${chargeDescription.toLowerCase()}.`,
        });
      } else {
        toast({
          title: 'Billing Charge Created',
          description: `Charge created for ${chargeDescription.toLowerCase()} (needs rate review).`,
          variant: 'default',
        });
      }

      return data;
    } catch (error) {
      console.error('Error creating flag billing event:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, toast]);

  // Create billing event for task completion
  const createTaskBillingEvent = useCallback(async (
    taskId: string,
    taskType: string,
    isUnableToComplete: boolean = false
  ) => {
    if (!profile?.tenant_id) return null;

    try {
      setLoading(true);

      // Get task details with items
      const { data: taskItems } = await (supabase
        .from('task_items') as any)
        .select(`
          item_id,
          quantity,
          items:item_id(item_code, client_account, item_type_id)
        `)
        .eq('task_id', taskId);

      if (!taskItems || taskItems.length === 0) return null;

      const billingEvents: BillingEvent[] = [];
      const serviceType = taskTypeToServiceType(taskType);

      for (const taskItem of taskItems) {
        const item = taskItem.items;
        if (!item) continue;

        // Get account ID
        const accountId = await getAccountIdFromName(item.client_account);

        // Get rate using unified rate lookup
        const rateResult = await getServiceRate({
          accountId,
          itemTypeId: item.item_type_id,
          serviceType,
        });

        const quantity = taskItem.quantity || 1;

        const { data, error } = await (supabase
          .from('billing_events') as any)
          .insert({
            tenant_id: profile.tenant_id,
            account_id: accountId,
            item_id: taskItem.item_id,
            task_id: taskId,
            event_type: isUnableToComplete ? 'unable_to_complete' : 'task_completion',
            charge_type: serviceType,
            description: `${taskType} - ${item.item_code}`,
            quantity,
            unit_rate: rateResult.rate,
            total_amount: quantity * rateResult.rate,
            needs_review: isUnableToComplete || rateResult.source === 'default',
            created_by: profile.id,
            rate_source: rateResult.source,
            service_category: rateResult.category,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) billingEvents.push(data);
      }

      if (billingEvents.length > 0) {
        const total = billingEvents.reduce((sum, e) => sum + e.total_amount, 0);
        toast({
          title: 'Billing Events Created',
          description: `${billingEvents.length} charge(s) totaling $${total.toFixed(2)}${isUnableToComplete ? ' (needs review)' : ''}.`,
        });
      }

      return billingEvents;
    } catch (error) {
      console.error('Error creating task billing events:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, toast]);

  // Create billing event for receiving
  const createReceivingBillingEvent = useCallback(async (
    itemId: string,
    itemCode: string,
    accountId: string | null,
    itemTypeId: string | null,
    quantity: number = 1
  ) => {
    if (!profile?.tenant_id) return null;

    try {
      const rateResult = await getServiceRate({
        accountId,
        itemTypeId,
        serviceType: 'receiving',
      });

      const { data, error } = await (supabase
        .from('billing_events') as any)
        .insert({
          tenant_id: profile.tenant_id,
          account_id: accountId,
          item_id: itemId,
          event_type: 'receiving',
          charge_type: 'receiving',
          description: `Receiving - ${itemCode}`,
          quantity,
          unit_rate: rateResult.rate,
          total_amount: quantity * rateResult.rate,
          needs_review: rateResult.source === 'default',
          created_by: profile.id,
          rate_source: rateResult.source,
          service_category: rateResult.category,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating receiving billing event:', error);
      return null;
    }
  }, [profile?.tenant_id, profile?.id]);

  // Create billing event for will call
  const createWillCallBillingEvent = useCallback(async (
    itemId: string,
    itemCode: string,
    accountId: string | null,
    itemTypeId: string | null
  ) => {
    if (!profile?.tenant_id) return null;

    try {
      const rateResult = await getServiceRate({
        accountId,
        itemTypeId,
        serviceType: 'will_call',
      });

      const { data, error } = await (supabase
        .from('billing_events') as any)
        .insert({
          tenant_id: profile.tenant_id,
          account_id: accountId,
          item_id: itemId,
          event_type: 'will_call',
          charge_type: 'will_call',
          description: `Will Call - ${itemCode}`,
          quantity: 1,
          unit_rate: rateResult.rate,
          total_amount: rateResult.rate,
          needs_review: rateResult.source === 'default',
          created_by: profile.id,
          rate_source: rateResult.source,
          service_category: rateResult.category,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating will call billing event:', error);
      return null;
    }
  }, [profile?.tenant_id, profile?.id]);

  // Create billing event for disposal
  const createDisposalBillingEvent = useCallback(async (
    itemId: string,
    itemCode: string,
    accountId: string | null,
    itemTypeId: string | null
  ) => {
    if (!profile?.tenant_id) return null;

    try {
      const rateResult = await getServiceRate({
        accountId,
        itemTypeId,
        serviceType: 'disposal',
      });

      const { data, error } = await (supabase
        .from('billing_events') as any)
        .insert({
          tenant_id: profile.tenant_id,
          account_id: accountId,
          item_id: itemId,
          event_type: 'disposal',
          charge_type: 'disposal',
          description: `Disposal - ${itemCode}`,
          quantity: 1,
          unit_rate: rateResult.rate,
          total_amount: rateResult.rate,
          needs_review: rateResult.source === 'default',
          created_by: profile.id,
          rate_source: rateResult.source,
          service_category: rateResult.category,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating disposal billing event:', error);
      return null;
    }
  }, [profile?.tenant_id, profile?.id]);

  return {
    loading,
    createFlagBillingEvent,
    createTaskBillingEvent,
    createReceivingBillingEvent,
    createWillCallBillingEvent,
    createDisposalBillingEvent,
  };
}
