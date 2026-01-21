import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ============================================
// TYPES
// ============================================

export interface BillingEvent {
  id: string;
  tenant_id: string;
  account_id: string | null;
  item_id: string | null;
  task_id: string | null;
  event_type: string;
  charge_type: string;
  description: string | null;
  quantity: number | null;
  unit_rate: number;
  total_amount: number;
  needs_review: boolean | null;
  invoice_id: string | null;
  invoiced_at: string | null;
  created_by: string | null;
  created_at: string;
  rate_source: string | null;
  service_category: string | null;
}

export interface CreateBillingEventParams {
  account_id?: string | null;
  item_id?: string | null;
  task_id?: string | null;
  event_type: 'receiving' | 'task_completion' | 'flag_change' | 'storage' | 'will_call' | 'disposal';
  charge_type: string;
  description?: string;
  quantity?: number;
  unit_rate?: number;
  total_amount?: number;
  needs_review?: boolean;
}

// Map task types to charge types
const TASK_TYPE_CHARGE_MAP: Record<string, string> = {
  'Inspection': 'inspection',
  'Assembly': 'assembly',
  'Repair': 'repair',
  'Delivery': 'delivery',
  'Pickup': 'pickup',
  'Will Call': 'will_call',
  'Disposal': 'disposal',
  'Move': 'move',
};

// Map item flags to charge types
const FLAG_CHARGE_MAP: Record<string, string> = {
  'is_crated': 'crating',
  'is_oversize': 'oversize_handling',
  'is_overweight': 'overweight_handling',
  'is_unstackable': 'special_handling',
  'received_without_id': 'id_missing',
  'has_damage': 'damage_assessment',
  'needs_inspection': 'inspection',
  'needs_repair': 'repair',
  'needs_warehouse_assembly': 'assembly',
};

// ============================================
// HOOK
// ============================================

export function useBillingEvents() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // ------------------------------------------
  // Create a billing event
  // ------------------------------------------
  const createBillingEvent = useCallback(async (
    params: CreateBillingEventParams
  ): Promise<BillingEvent | null> => {
    if (!profile?.tenant_id || !profile?.id) {
      console.error('[BillingEvents] No tenant_id or user id available');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billing_events')
        .insert({
          tenant_id: profile.tenant_id,
          account_id: params.account_id || null,
          item_id: params.item_id || null,
          task_id: params.task_id || null,
          event_type: params.event_type,
          charge_type: params.charge_type,
          description: params.description || null,
          quantity: params.quantity || 1,
          unit_rate: params.unit_rate || 0,
          total_amount: params.total_amount || 0,
          needs_review: params.needs_review ?? (params.unit_rate === 0),
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) {
        console.error('[BillingEvents] createBillingEvent failed:', {
          error,
          message: error.message,
          code: error.code,
        });
        toast({
          variant: 'destructive',
          title: 'Billing Error',
          description: error.message,
        });
        return null;
      }

      return data as BillingEvent;
    } catch (err) {
      console.error('[BillingEvents] createBillingEvent exception:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, toast]);

  // ------------------------------------------
  // Create billing event for task completion
  // ------------------------------------------
  const createTaskBillingEvent = useCallback(async (
    taskId: string,
    taskType: string,
    accountId: string | null,
    itemId: string | null,
    quantity: number = 1,
    isUnableToComplete: boolean = false
  ): Promise<BillingEvent | null> => {
    const chargeType = TASK_TYPE_CHARGE_MAP[taskType] || taskType.toLowerCase().replace(/\s+/g, '_');
    const description = `${taskType}${isUnableToComplete ? ' (Unable to Complete)' : ''}`;

    return createBillingEvent({
      task_id: taskId,
      account_id: accountId,
      item_id: itemId,
      event_type: 'task_completion',
      charge_type: chargeType,
      description,
      quantity,
      needs_review: isUnableToComplete,
    });
  }, [createBillingEvent]);

  // ------------------------------------------
  // Create billing event for item flag change
  // ------------------------------------------
  const createFlagBillingEvent = useCallback(async (
    itemId: string,
    flagName: string,
    accountId: string | null,
    itemCode: string
  ): Promise<BillingEvent | null> => {
    const chargeType = FLAG_CHARGE_MAP[flagName] || flagName.replace('is_', '').replace('needs_', '');
    const friendlyName = chargeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return createBillingEvent({
      item_id: itemId,
      account_id: accountId,
      event_type: 'flag_change',
      charge_type: chargeType,
      description: `${friendlyName} - ${itemCode}`,
    });
  }, [createBillingEvent]);

  // ------------------------------------------
  // Create billing event for receiving
  // ------------------------------------------
  const createReceivingBillingEvent = useCallback(async (
    itemId: string,
    itemCode: string,
    accountId: string | null,
    quantity: number = 1
  ): Promise<BillingEvent | null> => {
    return createBillingEvent({
      item_id: itemId,
      account_id: accountId,
      event_type: 'receiving',
      charge_type: 'receiving',
      description: `Receiving - ${itemCode}`,
      quantity,
    });
  }, [createBillingEvent]);

  // ------------------------------------------
  // Create billing event for will call
  // ------------------------------------------
  const createWillCallBillingEvent = useCallback(async (
    itemId: string,
    itemCode: string,
    accountId: string | null
  ): Promise<BillingEvent | null> => {
    return createBillingEvent({
      item_id: itemId,
      account_id: accountId,
      event_type: 'will_call',
      charge_type: 'will_call',
      description: `Will Call - ${itemCode}`,
    });
  }, [createBillingEvent]);

  // ------------------------------------------
  // Create billing event for disposal
  // ------------------------------------------
  const createDisposalBillingEvent = useCallback(async (
    itemId: string,
    itemCode: string,
    accountId: string | null
  ): Promise<BillingEvent | null> => {
    return createBillingEvent({
      item_id: itemId,
      account_id: accountId,
      event_type: 'disposal',
      charge_type: 'disposal',
      description: `Disposal - ${itemCode}`,
    });
  }, [createBillingEvent]);

  // ------------------------------------------
  // Fetch billing events with filters
  // ------------------------------------------
  const fetchBillingEvents = useCallback(async (filters?: {
    account_id?: string;
    invoice_id?: string | null;
    event_type?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<BillingEvent[]> => {
    if (!profile?.tenant_id) return [];

    try {
      let query = supabase
        .from('billing_events')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (filters?.account_id) {
        query = query.eq('account_id', filters.account_id);
      }
      if (filters?.invoice_id !== undefined) {
        query = filters.invoice_id === null 
          ? query.is('invoice_id', null)
          : query.eq('invoice_id', filters.invoice_id);
      }
      if (filters?.event_type) {
        query = query.eq('event_type', filters.event_type);
      }
      if (filters?.from_date) {
        query = query.gte('created_at', filters.from_date);
      }
      if (filters?.to_date) {
        query = query.lte('created_at', filters.to_date);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[BillingEvents] fetchBillingEvents failed:', error);
        return [];
      }

      return data as BillingEvent[];
    } catch (err) {
      console.error('[BillingEvents] fetchBillingEvents exception:', err);
      return [];
    }
  }, [profile?.tenant_id]);

  return {
    loading,
    createBillingEvent,
    createTaskBillingEvent,
    createFlagBillingEvent,
    createReceivingBillingEvent,
    createWillCallBillingEvent,
    createDisposalBillingEvent,
    fetchBillingEvents,
  };
}
