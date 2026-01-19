import { supabase } from '@/integrations/supabase/client';

export type ServiceCategory = 'item_service' | 'accessorial';
export type RateSource = 'rate_card' | 'item_type' | 'default';

export interface RateLookupResult {
  rate: number;
  source: RateSource;
  category: ServiceCategory;
}

// Mapping of service types to their item_type rate field names
const SERVICE_TO_ITEM_TYPE_FIELD: Record<string, string> = {
  // Item Services
  receiving: 'receiving_rate',
  shipping: 'shipping_rate',
  assembly: 'assembly_rate',
  inspection: 'inspection_fee',
  repair: 'minor_touchup_rate',
  storage: 'storage_rate',
  will_call: 'will_call_rate',
  disposal: 'disposal_rate',
  picking: 'picking_rate',
  packing: 'packing_rate',
  pull_for_delivery: 'pull_for_delivery_rate',
  custom_packaging: 'custom_packaging_rate',
  pallet_sale: 'pallet_sale_rate',
  
  // Accessorial Services (flat fees from item type or rate card)
  oversized: 'oversize_rate',
  overweight: 'overweight_rate',
  unstackable: 'unstackable_extra_fee',
  crated: 'crated_rate',
  received_without_id: 'received_without_id_rate',
  
  // Flag-based billing (mapped to their rate fields)
  is_oversize: 'oversize_rate',
  is_overweight: 'overweight_rate',
  is_unstackable: 'unstackable_extra_fee',
  is_crated: 'crated_rate',
  received_without_id_flag: 'received_without_id_rate',
};

// Service types that are accessorial (flat fees, not item-specific processing)
const ACCESSORIAL_SERVICES = new Set([
  'oversized',
  'overweight',
  'unstackable',
  'crated',
  'received_without_id',
  'is_oversize',
  'is_overweight',
  'is_unstackable',
  'is_crated',
  'received_without_id_flag',
]);

/**
 * Get the billing rate for a service with proper priority:
 * 1. Account's assigned rate card
 * 2. Item type base rate
 * 3. Default rate (0, flagged for review)
 */
export async function getServiceRate(params: {
  accountId: string | null;
  itemTypeId: string | null;
  serviceType: string;
}): Promise<RateLookupResult> {
  const { accountId, itemTypeId, serviceType } = params;
  const normalizedServiceType = serviceType.toLowerCase().replace(/ /g, '_');
  const isAccessorial = ACCESSORIAL_SERVICES.has(normalizedServiceType);
  const category: ServiceCategory = isAccessorial ? 'accessorial' : 'item_service';

  // 1. Try account's rate card first
  if (accountId) {
    try {
      const { data: account } = await supabase
        .from('accounts')
        .select('rate_card_id')
        .eq('id', accountId)
        .single();

      if (account?.rate_card_id) {
        const { data: rateCardDetail } = await supabase
          .from('rate_card_details')
          .select('rate')
          .eq('rate_card_id', account.rate_card_id)
          .eq('service_type', normalizedServiceType)
          .single();

        if (rateCardDetail?.rate != null) {
          return {
            rate: rateCardDetail.rate,
            source: 'rate_card',
            category,
          };
        }
      }
    } catch (error) {
      // Continue to item type fallback
    }
  }

  // 2. Fall back to item type rates
  if (itemTypeId) {
    const rateField = SERVICE_TO_ITEM_TYPE_FIELD[normalizedServiceType];
    if (rateField) {
      try {
        const { data: itemType } = await (supabase
          .from('item_types') as any)
          .select(rateField)
          .eq('id', itemTypeId)
          .single();

        if (itemType && itemType[rateField] != null) {
          return {
            rate: itemType[rateField],
            source: 'item_type',
            category,
          };
        }
      } catch (error) {
        // Continue to default
      }
    }
  }

  // 3. Default rate (flagged for review)
  return {
    rate: 0,
    source: 'default',
    category,
  };
}

/**
 * Get account ID from account name
 */
export async function getAccountIdFromName(accountName: string | null): Promise<string | null> {
  if (!accountName) return null;
  
  try {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('account_name', accountName)
      .single();
    
    return account?.id || null;
  } catch {
    return null;
  }
}

/**
 * Get rates for multiple services at once (more efficient for bulk operations)
 */
export async function getBulkServiceRates(params: {
  accountId: string | null;
  itemTypeId: string | null;
  serviceTypes: string[];
}): Promise<Record<string, RateLookupResult>> {
  const results: Record<string, RateLookupResult> = {};
  
  // Fetch all rates in parallel
  await Promise.all(
    params.serviceTypes.map(async (serviceType) => {
      results[serviceType] = await getServiceRate({
        accountId: params.accountId,
        itemTypeId: params.itemTypeId,
        serviceType,
      });
    })
  );
  
  return results;
}

/**
 * Sync item type rates to the default rate card
 * Called when item type rates are updated
 */
export async function syncItemTypeRatesToDefaultRateCard(
  tenantId: string,
  itemTypeId: string,
  rateUpdates: Record<string, number | null>
): Promise<void> {
  try {
    // Find the default rate card for this tenant
    const { data: defaultRateCard } = await supabase
      .from('rate_cards')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .is('deleted_at', null)
      .single();

    if (!defaultRateCard) {
      console.log('No default rate card found for tenant');
      return;
    }

    // Map rate fields to service types
    const fieldToService: Record<string, string> = {
      receiving_rate: 'receiving',
      shipping_rate: 'shipping',
      assembly_rate: 'assembly',
      inspection_fee: 'inspection',
      minor_touchup_rate: 'repair',
      storage_rate: 'storage',
      will_call_rate: 'will_call',
      disposal_rate: 'disposal',
      picking_rate: 'picking',
      packing_rate: 'packing',
      oversize_rate: 'oversized',
      overweight_rate: 'overweight',
      unstackable_extra_fee: 'unstackable',
      crated_rate: 'crated',
      received_without_id_rate: 'received_without_id',
    };

    // Update or insert rate card details for each changed rate
    for (const [field, rate] of Object.entries(rateUpdates)) {
      const serviceType = fieldToService[field];
      if (!serviceType || rate === null) continue;

      const isAccessorial = ACCESSORIAL_SERVICES.has(serviceType);

      // Check if detail exists
      const { data: existingDetail } = await supabase
        .from('rate_card_details')
        .select('id')
        .eq('rate_card_id', defaultRateCard.id)
        .eq('service_type', serviceType)
        .eq('item_type_id', itemTypeId)
        .single();

      if (existingDetail) {
        // Update existing
        await supabase
          .from('rate_card_details')
          .update({ 
            rate,
            category: isAccessorial ? 'accessorial' : 'item_service',
          })
          .eq('id', existingDetail.id);
      } else {
        // Insert new
        await supabase
          .from('rate_card_details')
          .insert({
            rate_card_id: defaultRateCard.id,
            service_type: serviceType,
            rate,
            item_type_id: itemTypeId,
            category: isAccessorial ? 'accessorial' : 'item_service',
            charge_unit: 'per_item',
          });
      }
    }
  } catch (error) {
    console.error('Error syncing rates to default rate card:', error);
  }
}

/**
 * Map task type to service type for billing
 */
export function taskTypeToServiceType(taskType: string): string {
  const mapping: Record<string, string> = {
    'Receiving': 'receiving',
    'Shipping': 'shipping',
    'Assembly': 'assembly',
    'Inspection': 'inspection',
    'Repair': 'repair',
    'Will Call': 'will_call',
    'Disposal': 'disposal',
    'Picking': 'picking',
    'Packing': 'packing',
    'Pull for Delivery': 'pull_for_delivery',
  };
  
  return mapping[taskType] || taskType.toLowerCase().replace(/ /g, '_');
}

/**
 * Map flag name to service type for billing
 */
export function flagToServiceType(flagName: string): string {
  const mapping: Record<string, string> = {
    is_oversize: 'oversized',
    is_overweight: 'overweight',
    is_unstackable: 'unstackable',
    is_crated: 'crated',
    received_without_id: 'received_without_id',
  };
  
  return mapping[flagName] || flagName;
}

/**
 * Populate a rate card with all item type rates as a starting template
 * Called when a new rate card is created or when syncing existing cards
 */
export async function populateRateCardFromItemTypes(
  tenantId: string,
  rateCardId: string
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  try {
    // 1. Fetch all item types for this tenant
    const { data: itemTypes } = await supabase
      .from('item_types')
      .select('id, receiving_rate, shipping_rate, assembly_rate, inspection_fee, minor_touchup_rate, storage_rate, will_call_rate, disposal_rate, picking_rate, packing_rate, oversize_rate, overweight_rate, unstackable_extra_fee, crated_rate, received_without_id_rate, pull_for_delivery_rate, custom_packaging_rate, pallet_sale_rate')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (!itemTypes || itemTypes.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    // 2. Service type mapping
    const fieldToService: Record<string, string> = {
      receiving_rate: 'receiving',
      shipping_rate: 'shipping',
      assembly_rate: 'assembly',
      inspection_fee: 'inspection',
      minor_touchup_rate: 'repair',
      storage_rate: 'storage',
      will_call_rate: 'will_call',
      disposal_rate: 'disposal',
      picking_rate: 'picking',
      packing_rate: 'packing',
      oversize_rate: 'oversized',
      overweight_rate: 'overweight',
      unstackable_extra_fee: 'unstackable',
      crated_rate: 'crated',
      received_without_id_rate: 'received_without_id',
      pull_for_delivery_rate: 'pull_for_delivery',
      custom_packaging_rate: 'custom_packaging',
      pallet_sale_rate: 'pallet_sale',
    };

    // 3. Get existing rate card details
    const { data: existingDetails } = await supabase
      .from('rate_card_details')
      .select('id, service_type, item_type_id')
      .eq('rate_card_id', rateCardId);

    const existingMap = new Map(
      (existingDetails || []).map(d => [`${d.service_type}-${d.item_type_id}`, d.id])
    );

    // 4. Build upsert operations
    for (const itemType of itemTypes) {
      for (const [field, serviceType] of Object.entries(fieldToService)) {
        const rate = (itemType as any)[field];
        if (rate != null && rate > 0) {
          const isAccessorial = ACCESSORIAL_SERVICES.has(serviceType);
          const key = `${serviceType}-${itemType.id}`;
          const existingId = existingMap.get(key);

          if (existingId) {
            // Update existing
            await supabase
              .from('rate_card_details')
              .update({ 
                rate,
                category: isAccessorial ? 'accessorial' : 'item_service',
              })
              .eq('id', existingId);
            updated++;
          } else {
            // Insert new
            await supabase
              .from('rate_card_details')
              .insert({
                rate_card_id: rateCardId,
                service_type: serviceType,
                rate,
                item_type_id: itemType.id,
                category: isAccessorial ? 'accessorial' : 'item_service',
                charge_unit: 'per_item',
              });
            inserted++;
          }
        }
      }
    }

    return { inserted, updated };
  } catch (error) {
    console.error('Error populating rate card from item types:', error);
    throw error;
  }
}
