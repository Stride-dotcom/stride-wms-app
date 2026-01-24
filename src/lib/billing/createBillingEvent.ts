import { supabase } from '@/integrations/supabase/client';

export interface CreateBillingEventParams {
  tenant_id: string;
  account_id: string;
  sidemark_id?: string | null;
  class_id?: string | null;
  service_id?: string | null;
  item_id?: string | null;
  task_id?: string | null;
  shipment_id?: string | null;
  event_type: 'receiving' | 'task_completion' | 'flag_change' | 'storage' | 'will_call' | 'disposal' | 'addon';
  charge_type: string;
  description?: string;
  quantity?: number;
  unit_rate: number;
  total_amount?: number;
  status?: 'unbilled' | 'invoiced' | 'void';
  occurred_at?: string;
  metadata?: Record<string, any>;
  created_by?: string;
}

export interface BillingEventResult {
  id: string;
  total_amount: number;
  status: string;
}

/**
 * Create a billing event with proper defaults and validation
 */
export async function createBillingEvent(params: CreateBillingEventParams): Promise<BillingEventResult | null> {
  const quantity = params.quantity || 1;
  const totalAmount = params.total_amount ?? (quantity * params.unit_rate);

  const eventData = {
    tenant_id: params.tenant_id,
    account_id: params.account_id,
    sidemark_id: params.sidemark_id || null,
    class_id: params.class_id || null,
    service_id: params.service_id || null,
    item_id: params.item_id || null,
    task_id: params.task_id || null,
    shipment_id: params.shipment_id || null,
    event_type: params.event_type,
    charge_type: params.charge_type,
    description: params.description || null,
    quantity,
    unit_rate: params.unit_rate,
    total_amount: totalAmount,
    status: params.status || 'unbilled',
    occurred_at: params.occurred_at || new Date().toISOString(),
    metadata: params.metadata || {},
    created_by: params.created_by || null,
    needs_review: params.unit_rate === 0,
  };

  const { data, error } = await supabase
    .from('billing_events')
    .insert(eventData)
    .select('id, total_amount, status')
    .single();

  if (error) {
    console.error('Error creating billing event:', error);
    return null;
  }

  return data;
}

/**
 * Create multiple billing events in a batch
 */
export async function createBillingEventsBatch(events: CreateBillingEventParams[]): Promise<BillingEventResult[]> {
  const eventDataArray = events.map(params => {
    const quantity = params.quantity || 1;
    const totalAmount = params.total_amount ?? (quantity * params.unit_rate);

    return {
      tenant_id: params.tenant_id,
      account_id: params.account_id,
      sidemark_id: params.sidemark_id || null,
      class_id: params.class_id || null,
      service_id: params.service_id || null,
      item_id: params.item_id || null,
      task_id: params.task_id || null,
      shipment_id: params.shipment_id || null,
      event_type: params.event_type,
      charge_type: params.charge_type,
      description: params.description || null,
      quantity,
      unit_rate: params.unit_rate,
      total_amount: totalAmount,
      status: params.status || 'unbilled',
      occurred_at: params.occurred_at || new Date().toISOString(),
      metadata: params.metadata || {},
      created_by: params.created_by || null,
      needs_review: params.unit_rate === 0,
    };
  });

  const { data, error } = await supabase
    .from('billing_events')
    .insert(eventDataArray)
    .select('id, total_amount, status');

  if (error) {
    console.error('Error creating billing events batch:', error);
    return [];
  }

  return data || [];
}

/**
 * Void a billing event (only if unbilled)
 */
export async function voidBillingEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('billing_events')
    .update({ status: 'void' })
    .eq('id', eventId)
    .eq('status', 'unbilled');

  if (error) {
    console.error('Error voiding billing event:', error);
    return false;
  }

  return true;
}

/**
 * Move unbilled events to new sidemark using RPC
 */
export async function moveItemSidemarkWithEvents(
  itemId: string,
  newSidemarkId: string | null
): Promise<{ success: boolean; movedCount: number; invoicedCount: number }> {
  const { data, error } = await supabase.rpc('move_item_sidemark_and_unbilled_events', {
    p_item_id: itemId,
    p_new_sidemark_id: newSidemarkId,
  });

  if (error) {
    console.error('Error moving item sidemark:', error);
    return { success: false, movedCount: 0, invoicedCount: 0 };
  }

  const result = data as Record<string, any> | null;
  return {
    success: result?.success ?? false,
    movedCount: result?.moved_events_count ?? 0,
    invoicedCount: result?.invoiced_events_count ?? 0,
  };
}
