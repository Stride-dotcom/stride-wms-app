import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createCharges } from '@/services/billing';
import { queueBillingEventAlert } from '@/lib/alertQueue';
import { BILLING_DISABLED_ERROR, getEffectiveRate } from '@/lib/billing/chargeTypeUtils';

// Helper to get rate via unified pricing (new system first, legacy fallback)
async function getRateFromPriceList(
  tenantId: string,
  serviceCode: string,
  classCode: string | null,
  accountId?: string | null
): Promise<{ rate: number; serviceName: string; alertRule: string; hasError: boolean; errorMessage?: string }> {
  try {
    const result = await getEffectiveRate({
      tenantId,
      chargeCode: serviceCode,
      accountId: accountId || undefined,
      classCode: classCode || undefined,
    });

    return {
      rate: result.effective_rate,
      serviceName: result.charge_name || serviceCode,
      alertRule: result.alert_rule,
      hasError: result.has_error,
      errorMessage: result.error_message || undefined,
    };
  } catch (error: any) {
    if (error?.message === BILLING_DISABLED_ERROR) {
      throw error;
    }
    console.error('[getRateFromPriceList] Error:', error);
    return {
      rate: 0,
      serviceName: serviceCode,
      alertRule: 'none',
      hasError: true,
      errorMessage: 'Error looking up rate from Price List',
    };
  }
}

// ============================================
// TYPES
// ============================================

export interface OutboundType {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  color: string;
  icon: string;
  sort_order: number;
}

export interface OutboundShipment {
  id: string;
  tenant_id: string;
  shipment_number: string;
  shipment_type: 'outbound';
  status: 'pending' | 'shipped' | 'cancelled';
  account_id: string | null;
  warehouse_id: string | null;
  outbound_type_id: string | null;
  notes: string | null;
  driver_name: string | null;
  signature_data: string | null;
  signature_name: string | null;
  signature_timestamp: string | null;
  liability_accepted: boolean;
  shipped_at: string | null;
  created_at: string;
  created_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  // Joined data
  account?: {
    id: string;
    account_name: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  outbound_type?: OutboundType;
  items?: OutboundShipmentItem[];
}

export interface OutboundShipmentItem {
  id: string;
  shipment_id: string;
  item_id: string | null;
  expected_quantity: number;
  actual_quantity: number | null;
  status: 'pending' | 'released' | 'cancelled';
  released_at: string | null;
  item?: {
    id: string;
    item_code: string;
    description: string | null;
    item_type_id: string | null;
    sidemark_id: string | null;
  };
}

export interface CreateOutboundParams {
  account_id: string;
  warehouse_id: string;
  outbound_type_id: string;
  sidemark_id?: string;
  notes?: string;
  expected_date?: string;
  item_ids: string[];
}

export interface CompleteOutboundParams {
  shipment_id: string;
  driver_name: string;
  signature_data: string;
  signature_name: string;
  liability_accepted: boolean;
}

// ============================================
// OUTBOUND TYPES HOOK
// ============================================

export function useOutboundTypes() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [outboundTypes, setOutboundTypes] = useState<OutboundType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOutboundTypes = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('outbound_types') as any)
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setOutboundTypes(data || []);
    } catch (error) {
      console.error('Error fetching outbound types:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load outbound types',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchOutboundTypes();
  }, [fetchOutboundTypes]);

  const createOutboundType = async (name: string, description?: string) => {
    if (!profile?.tenant_id) return null;

    try {
      const { data, error } = await (supabase
        .from('outbound_types') as any)
        .insert({
          tenant_id: profile.tenant_id,
          name,
          description,
          is_system: false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Outbound Type Created',
        description: `"${name}" has been added.`,
      });

      fetchOutboundTypes();
      return data;
    } catch (error) {
      console.error('Error creating outbound type:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create outbound type',
      });
      return null;
    }
  };

  return {
    outboundTypes,
    loading,
    refetch: fetchOutboundTypes,
    createOutboundType,
  };
}

// ============================================
// OUTBOUND SHIPMENTS HOOK
// ============================================

export function useOutboundShipments(filters?: {
  status?: string;
  outboundTypeId?: string;
  accountId?: string;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<OutboundShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  const filterStatus = filters?.status;
  const filterOutboundTypeId = filters?.outboundTypeId;
  const filterAccountId = filters?.accountId;

  const fetchShipments = useCallback(async (showLoading = true) => {
    if (!profile?.tenant_id) return;

    try {
      if (showLoading && shipments.length === 0) {
        setLoading(true);
      } else {
        setIsRefetching(true);
      }

      let query = (supabase
        .from('shipments') as any)
        .select(`
          *,
          account:accounts(id, account_name),
          warehouse:warehouses(id, name),
          outbound_type:outbound_types(*)
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('shipment_type', 'outbound')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (filterOutboundTypeId && filterOutboundTypeId !== 'all') {
        query = query.eq('outbound_type_id', filterOutboundTypeId);
      }
      if (filterAccountId && filterAccountId !== 'all') {
        query = query.eq('account_id', filterAccountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setShipments(data || []);
    } catch (error) {
      console.error('Error fetching outbound shipments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load outbound shipments',
      });
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [profile?.tenant_id, filterStatus, filterOutboundTypeId, filterAccountId, toast, shipments.length]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Create outbound shipment
  const createOutbound = async (params: CreateOutboundParams): Promise<OutboundShipment | null> => {
    if (!profile?.tenant_id || !profile?.id) return null;

    try {
      // Create shipment with customer_authorized and release_type for SOP compliance
      const { data: shipment, error: shipmentError } = await (supabase
        .from('shipments') as any)
        .insert({
          tenant_id: profile.tenant_id,
          shipment_type: 'outbound',
          status: 'pending',
          account_id: params.account_id,
          warehouse_id: params.warehouse_id,
          outbound_type_id: params.outbound_type_id,
          sidemark_id: params.sidemark_id || null,
          notes: params.notes || null,
          expected_arrival_date: params.expected_date || null,
          created_by: profile.id,
          customer_authorized: true,
          customer_authorized_at: new Date().toISOString(),
          customer_authorized_by: profile.id,
          release_type: 'Customer Pickup', // Default release type for outbound
        })
        .select('*')
        .single();

      if (shipmentError) throw shipmentError;

      // Create shipment items
      if (params.item_ids.length > 0) {
        const shipmentItems = params.item_ids.map(item_id => ({
          shipment_id: shipment.id,
          item_id,
          expected_quantity: 1,
          status: 'pending',
        }));

        const { error: itemsError } = await (supabase
          .from('shipment_items') as any)
          .insert(shipmentItems);

        if (itemsError) {
          console.error('Error creating shipment items:', itemsError);
          // Don't throw - shipment was created, items just failed
        }

        // Update items to mark them as allocated/pending release
        await (supabase
          .from('items') as any)
          .update({ status: 'allocated' })
          .in('id', params.item_ids);
      }

      toast({
        title: 'Outbound Shipment Created',
        description: `Shipment ${shipment.shipment_number} has been created.`,
      });

      fetchShipments();
      return shipment;
    } catch (error: any) {
      console.error('Error creating outbound shipment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create outbound shipment',
      });
      return null;
    }
  };

  // Complete outbound shipment (mark as shipped)
  const completeOutbound = async (params: CompleteOutboundParams): Promise<boolean> => {
    if (!profile?.tenant_id || !profile?.id) return false;

    try {
      const now = new Date().toISOString();

      // Update shipment
      const { error: shipmentError } = await (supabase
        .from('shipments') as any)
        .update({
          status: 'shipped',
          driver_name: params.driver_name,
          signature_data: params.signature_data,
          signature_name: params.signature_name,
          signature_timestamp: now,
          liability_accepted: params.liability_accepted,
          shipped_at: now,
          completed_at: now,
          completed_by: profile.id,
        })
        .eq('id', params.shipment_id);

      if (shipmentError) throw shipmentError;

      // Get shipment items with class_id for billing
      const { data: shipmentItems } = await (supabase
        .from('shipment_items') as any)
        .select(`
          id,
          item_id,
          expected_quantity,
          items:item_id(id, item_code, class_id, sidemark_id, account_id, account:accounts(account_name))
        `)
        .eq('shipment_id', params.shipment_id);

      if (shipmentItems && shipmentItems.length > 0) {
        const itemIds = shipmentItems.map((si: any) => si.item_id).filter(Boolean);

        // Update shipment items to released
        await (supabase
          .from('shipment_items') as any)
          .update({
            status: 'released',
            actual_quantity: 1,
            released_at: now,
          })
          .eq('shipment_id', params.shipment_id);

        // Update items to released status
        await (supabase
          .from('items') as any)
          .update({
            status: 'released',
            released_at: now,
          })
          .in('id', itemIds);

        // Create billing events for will call fees
        await createOutboundBillingEvents(params.shipment_id, shipmentItems);
      }

      // Get shipment details for alert
      const { data: shipmentData } = await (supabase
        .from('shipments') as any)
        .select(`
          shipment_number,
          account:accounts(alerts_contact_email, primary_contact_email)
        `)
        .eq('id', params.shipment_id)
        .single();

      // Queue completion alert
      if (shipmentData) {
        const accountEmail = shipmentData.account?.alerts_contact_email ||
          shipmentData.account?.primary_contact_email;

        await (supabase.rpc as any)('queue_shipment_completed_alert', {
          p_tenant_id: profile.tenant_id,
          p_shipment_id: params.shipment_id,
          p_shipment_number: shipmentData.shipment_number,
          p_driver_name: params.driver_name,
          p_account_email: accountEmail || null,
        });
      }

      toast({
        title: 'Shipment Completed',
        description: 'Items have been released and the shipment is marked as shipped.',
      });

      fetchShipments();
      return true;
    } catch (error: any) {
      console.error('Error completing outbound shipment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete shipment',
      });
      return false;
    }
  };

  // Helper to create billing events using Price List rates
  const createOutboundBillingEvents = async (shipmentId: string, shipmentItems: any[]) => {
    if (!profile?.tenant_id || !profile?.id) return;

    try {
      // Fetch all classes to map class_id to code
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id, code')
        .eq('tenant_id', profile.tenant_id);
      const classMap = new Map((allClasses || []).map((c: any) => [c.id, c.code]));

      const chargeRequests: Array<{
        tenantId: string;
        accountId: string;
        chargeCode: string;
        eventType: 'will_call';
        context: { type: 'shipment'; shipmentId: string; itemId: string };
        description: string;
        quantity: number;
        classCode: string | null;
        rateOverride: number;
        hasRateError: boolean;
        rateErrorMessage: string | undefined;
        sidemarkId: string | null;
        classId: string | null;
        metadata: { class_code: string | null };
        userId: string;
      }> = [];
      const alertRequests: Array<{
        index: number;
        tenantId: string;
        serviceName: string;
        itemCode: string;
        accountName: string;
        amount: number;
        description: string;
      }> = [];

      for (const si of shipmentItems) {
        const item = si.items;
        if (!item) continue;

        const accountId = item.account_id;
        if (!accountId) continue;

        // Get item's class code for rate lookup
        const classCode: string | null = item.class_id ? (classMap.get(item.class_id) ?? null) : null;

        // Get will call rate from Price List (includes alert_rule)
        const rateResult = await getRateFromPriceList(
          profile.tenant_id,
          'Will_Call',
          classCode,
          accountId
        );

        const quantity = si.expected_quantity || 1;
        const totalAmount = quantity * rateResult.rate;
        const description = `Will Call: ${item.item_code}`;

        chargeRequests.push({
          tenantId: profile.tenant_id,
          accountId: accountId,
          chargeCode: 'Will_Call',
          eventType: 'will_call',
          context: {
            type: 'shipment',
            shipmentId: shipmentId,
            itemId: item.id,
          },
          description,
          quantity,
          classCode,
          rateOverride: rateResult.rate,
          hasRateError: rateResult.hasError,
          rateErrorMessage: rateResult.errorMessage,
          sidemarkId: item.sidemark_id || null,
          classId: item.class_id || null,
          metadata: {
            class_code: classCode,
          },
          userId: profile.id,
        });

        // Track alerts to queue for services with email_office alert rule
        if (rateResult.alertRule === 'email_office') {
          alertRequests.push({
            index: chargeRequests.length - 1,
            tenantId: profile.tenant_id,
            serviceName: rateResult.serviceName,
            itemCode: item.item_code,
            accountName: item.account?.account_name || 'Unknown Account',
            amount: totalAmount,
            description,
          });
        }
      }

      if (chargeRequests.length > 0) {
        const results = await createCharges(chargeRequests);

        // Queue alerts for services with email_office alert rule
        for (const alert of alertRequests) {
          const chargeResult = results[alert.index];
          if (chargeResult?.success && chargeResult.billingEventId) {
            await queueBillingEventAlert(
              alert.tenantId,
              chargeResult.billingEventId,
              alert.serviceName,
              alert.itemCode,
              alert.accountName,
              alert.amount,
              alert.description
            );
          }
        }
      }
    } catch (error: any) {
      if (error?.message === BILLING_DISABLED_ERROR) {
        console.warn('[useOutbound] Billing disabled for Will_Call on this account, skipping billing events');
        toast({ variant: 'destructive', title: 'Billing Disabled', description: BILLING_DISABLED_ERROR });
      } else {
        console.error('Error creating outbound billing events:', error);
      }
      // Don't throw - billing shouldn't block completion
    }
  };

  // Cancel outbound shipment
  const cancelOutbound = async (shipmentId: string): Promise<boolean> => {
    try {
      // Get items to restore
      const { data: shipmentItems } = await (supabase
        .from('shipment_items') as any)
        .select('item_id')
        .eq('shipment_id', shipmentId);

      // Update shipment
      const { error } = await (supabase
        .from('shipments') as any)
        .update({ status: 'cancelled' })
        .eq('id', shipmentId);

      if (error) throw error;

      // Restore items to available status
      if (shipmentItems && shipmentItems.length > 0) {
        const itemIds = shipmentItems.map((si: any) => si.item_id).filter(Boolean);
        await (supabase
          .from('items') as any)
          .update({ status: 'in_storage' })
          .in('id', itemIds);

        // Update shipment items
        await (supabase
          .from('shipment_items') as any)
          .update({ status: 'cancelled' })
          .eq('shipment_id', shipmentId);
      }

      toast({
        title: 'Shipment Cancelled',
        description: 'The outbound shipment has been cancelled.',
      });

      fetchShipments();
      return true;
    } catch (error) {
      console.error('Error cancelling outbound:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to cancel shipment',
      });
      return false;
    }
  };

  // Get shipment items
  const getShipmentItems = async (shipmentId: string): Promise<OutboundShipmentItem[]> => {
    try {
      const { data, error } = await (supabase
        .from('shipment_items') as any)
        .select(`
          *,
          item:items(id, item_code, description, item_type_id, sidemark_id)
        `)
        .eq('shipment_id', shipmentId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching shipment items:', error);
      return [];
    }
  };

  return {
    shipments,
    loading,
    isRefetching,
    refetch: () => fetchShipments(false),
    createOutbound,
    completeOutbound,
    cancelOutbound,
    getShipmentItems,
  };
}

// ============================================
// HOOK FOR GETTING ITEMS FOR OUTBOUND
// ============================================

export function useAccountItems(accountId: string | undefined) {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!profile?.tenant_id || !accountId) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('items') as any)
        .select(`
          id,
          item_code,
          description,
          status,
          item_type:item_types(id, name),
          sidemark:sidemarks(id, sidemark_name),
          warehouse:warehouses(id, name)
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('account_id', accountId)
        .in('status', ['in_storage', 'available', 'active']) // Only items that can be shipped (active is the main storage status)
        .is('deleted_at', null)
        .order('item_code');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching account items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, accountId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    refetch: fetchItems,
  };
}
