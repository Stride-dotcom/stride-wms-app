import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface BillingEvent {
  id: string;
  tenant_id: string;
  account_id: string | null;
  item_id: string | null;
  task_id: string | null;
  event_type: 'flag_change' | 'task_completion' | 'unable_to_complete';
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
}

// Map of flags to their corresponding rate field on rate_cards/item_types
const FLAG_RATE_MAPPING: Record<string, string> = {
  is_overweight: 'oversize_rate', // Using oversize as proxy for overweight
  is_oversize: 'oversize_rate',
  is_unstackable: 'extra_fee', // Using extra_fee as proxy
  is_crated: 'extra_fee',
};

export function useBillingEvents() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Get rate for a specific charge type from rate card or item type
  const getRateForCharge = async (
    accountId: string | null,
    itemTypeId: string | null,
    chargeType: string
  ): Promise<number> => {
    try {
      // Try to get rate from account's rate card first
      if (accountId) {
        const { data: account } = await supabase
          .from('accounts')
          .select('rate_card_id')
          .eq('id', accountId)
          .single();

        if (account?.rate_card_id) {
          const { data: rateCard } = await supabase
            .from('rate_card_details')
            .select('*')
            .eq('rate_card_id', account.rate_card_id)
            .eq('service_type', chargeType)
            .single();

          if (rateCard?.rate) {
            return rateCard.rate;
          }
        }
      }

      // Fall back to item type rates
      if (itemTypeId) {
        const rateField = FLAG_RATE_MAPPING[chargeType] || 'extra_fee';
        const { data: itemType } = await (supabase
          .from('item_types') as any)
          .select(rateField)
          .eq('id', itemTypeId)
          .single();

        if (itemType && itemType[rateField]) {
          return itemType[rateField];
        }
      }

      // Default rate if nothing found
      return 25.0;
    } catch (error) {
      console.error('Error getting rate:', error);
      return 25.0;
    }
  };

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
      let accountId: string | null = null;
      if (item.client_account) {
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('account_name', item.client_account)
          .single();
        accountId = account?.id || null;
      }

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

      // Get rate
      const rate = await getRateForCharge(accountId, item.item_type_id, flagName);

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
          unit_rate: rate,
          total_amount: rate,
          needs_review: false,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Billing Charge Created',
        description: `$${rate.toFixed(2)} charge for ${chargeDescription.toLowerCase()}.`,
      });

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

      for (const taskItem of taskItems) {
        const item = taskItem.items;
        if (!item) continue;

        // Get account ID
        let accountId: string | null = null;
        if (item.client_account) {
          const { data: account } = await supabase
            .from('accounts')
            .select('id')
            .eq('account_name', item.client_account)
            .single();
          accountId = account?.id || null;
        }

        // Get rate based on task type
        const rateFieldMap: Record<string, string> = {
          'Receiving': 'receiving_rate',
          'Shipping': 'shipping_rate',
          'Assembly': 'assembly_rate',
          'Inspection': 'inspection_fee',
          'Repair': 'minor_touchup_rate',
        };

        const rateField = rateFieldMap[taskType] || 'receiving_rate';
        let rate = 0;

        if (item.item_type_id) {
          const { data: itemType } = await (supabase
            .from('item_types') as any)
            .select(rateField)
            .eq('id', item.item_type_id)
            .single();

          rate = itemType?.[rateField] || 0;
        }

        const quantity = taskItem.quantity || 1;

        const { data, error } = await (supabase
          .from('billing_events') as any)
          .insert({
            tenant_id: profile.tenant_id,
            account_id: accountId,
            item_id: taskItem.item_id,
            task_id: taskId,
            event_type: isUnableToComplete ? 'unable_to_complete' : 'task_completion',
            charge_type: taskType.toLowerCase(),
            description: `${taskType} - ${item.item_code}`,
            quantity,
            unit_rate: rate,
            total_amount: quantity * rate,
            needs_review: isUnableToComplete, // Needs review if unable to complete
            created_by: profile.id,
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

  return {
    loading,
    createFlagBillingEvent,
    createTaskBillingEvent,
  };
}
