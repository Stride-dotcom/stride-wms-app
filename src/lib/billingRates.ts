/**
 * Service-based billing rate lookup
 * 
 * ARCHITECTURE NOTE: Pricing is SERVICE-BASED, not item-type column-based.
 * Item Types are for classification only. All pricing should come from:
 * 1. Account's assigned rate card (rate_card_details)
 * 2. Default rate card for the tenant
 * 3. Zero rate (flagged for review)
 * 
 * The SERVICE_TO_ITEM_TYPE_FIELD mapping is DEPRECATED and will be removed.
 * Use rate_card_details with service_type instead.
 */

import { supabase } from '@/integrations/supabase/client';
import { SERVICE_CODES, ServiceCode, ServiceCategory } from './itemColumnConfig';

export type RateSource = 'rate_card' | 'default' | 'needs_review';

export interface RateLookupResult {
  rate: number;
  source: RateSource;
  category: ServiceCategory;
  serviceCode?: ServiceCode;
  needsReview?: boolean;
}

/**
 * @deprecated Use SERVICE_CODES from itemColumnConfig instead
 * This mapping is kept for backward compatibility during migration
 */
const LEGACY_SERVICE_TO_ITEM_TYPE_FIELD: Record<string, string> = {
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
  oversize: 'oversize_rate',
  overweight: 'overweight_rate',
  unstackable: 'unstackable_extra_fee',
  crate_disposal: 'crated_rate',
  minor_touchup: 'minor_touchup_rate',
  received_without_id: 'received_without_id_rate',
  returns_processing: 'returns_processing_rate',
};

// Service types that are accessorial (flat fees)
const ACCESSORIAL_SERVICES = new Set<string>([
  SERVICE_CODES.OVERSIZE,
  SERVICE_CODES.OVERWEIGHT,
  SERVICE_CODES.UNSTACKABLE,
  SERVICE_CODES.CRATE_DISPOSAL,
  SERVICE_CODES.MINOR_TOUCHUP,
  SERVICE_CODES.RECEIVED_WITHOUT_ID,
]);

/**
 * Get the billing rate for a service
 * Priority: Account rate card → Default rate card → Zero (needs review)
 * 
 * Supports both new API (serviceCode) and legacy API (serviceType) for backward compatibility
 */
export async function getServiceRate(params: {
  accountId: string | null;
  serviceCode?: ServiceCode;
  serviceType?: string;
  itemTypeId?: string | null;
}): Promise<RateLookupResult> {
  const { accountId, itemTypeId } = params;
  // Support both serviceCode and legacy serviceType parameter
  const serviceCode = params.serviceCode || (params.serviceType as ServiceCode);
  const isAccessorial = ACCESSORIAL_SERVICES.has(serviceCode);
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
        // Build query for rate card detail
        let query = supabase
          .from('rate_card_details')
          .select('rate')
          .eq('rate_card_id', account.rate_card_id)
          .eq('service_type', serviceCode);

        // If item type specified, try to find item-type-specific rate first
        if (itemTypeId) {
          const { data: specificRate } = await query
            .eq('item_type_id', itemTypeId)
            .single();

          if (specificRate?.rate != null) {
            return {
              rate: specificRate.rate,
              source: 'rate_card',
              category,
              serviceCode,
              needsReview: false,
            };
          }
        }

        // Fall back to general rate for service type
        const { data: generalRate } = await supabase
          .from('rate_card_details')
          .select('rate')
          .eq('rate_card_id', account.rate_card_id)
          .eq('service_type', serviceCode)
          .is('item_type_id', null)
          .single();

        if (generalRate?.rate != null) {
          return {
            rate: generalRate.rate,
            source: 'rate_card',
            category,
            serviceCode,
            needsReview: false,
          };
        }
      }
    } catch (error) {
      // Continue to default rate card
    }
  }

  // 2. Try default rate card for tenant
  try {
    const { data: defaultRateCard } = await supabase
      .from('rate_cards')
      .select('id')
      .eq('is_default', true)
      .is('deleted_at', null)
      .single();

    if (defaultRateCard) {
      const { data: defaultRate } = await supabase
        .from('rate_card_details')
        .select('rate')
        .eq('rate_card_id', defaultRateCard.id)
        .eq('service_type', serviceCode)
        .is('item_type_id', null)
        .single();

      if (defaultRate?.rate != null) {
        return {
          rate: defaultRate.rate,
          source: 'default',
          category,
          serviceCode,
          needsReview: false,
        };
      }
    }
  } catch (error) {
    // Continue to needs review
  }

  // 3. No rate found - flag for review
  return {
    rate: 0,
    source: 'needs_review',
    category,
    serviceCode,
    needsReview: true,
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
  serviceCodes: ServiceCode[];
  itemTypeId?: string | null;
}): Promise<Record<ServiceCode, RateLookupResult>> {
  const results: Record<string, RateLookupResult> = {};
  
  // Fetch all rates in parallel
  await Promise.all(
    params.serviceCodes.map(async (serviceCode) => {
      results[serviceCode] = await getServiceRate({
        accountId: params.accountId,
        serviceCode,
        itemTypeId: params.itemTypeId,
      });
    })
  );
  
  return results as Record<ServiceCode, RateLookupResult>;
}

/**
 * Map task type to service code for billing
 * @deprecated Use taskTypeToServiceCode from itemColumnConfig
 */
export function taskTypeToServiceType(taskType: string): string {
  const mapping: Record<string, string> = {
    'Receiving': SERVICE_CODES.RECEIVING,
    'Shipping': SERVICE_CODES.SHIPPING,
    'Assembly': SERVICE_CODES.ASSEMBLY,
    'Inspection': SERVICE_CODES.INSPECTION,
    'Repair': SERVICE_CODES.REPAIR,
    'Will Call': SERVICE_CODES.WILL_CALL,
    'Disposal': SERVICE_CODES.DISPOSAL,
    'Picking': SERVICE_CODES.PICKING,
    'Packing': SERVICE_CODES.PACKING,
    'Pull for Delivery': SERVICE_CODES.PULL_FOR_DELIVERY,
  };
  
  return mapping[taskType] || taskType.toLowerCase().replace(/ /g, '_');
}

/**
 * Map flag name to service code for billing
 * @deprecated Use flagToServiceCode from itemColumnConfig
 */
export function flagToServiceType(flagName: string): string {
  const mapping: Record<string, string> = {
    is_oversize: SERVICE_CODES.OVERSIZE,
    is_overweight: SERVICE_CODES.OVERWEIGHT,
    is_unstackable: SERVICE_CODES.UNSTACKABLE,
    is_crated: SERVICE_CODES.CRATE_DISPOSAL,
    needs_minor_touchup: SERVICE_CODES.MINOR_TOUCHUP,
    received_without_id: SERVICE_CODES.RECEIVED_WITHOUT_ID,
  };
  
  return mapping[flagName] || flagName;
}

/**
 * Populate a rate card with default rates for all services
 * This is called when creating a new rate card
 */
export async function populateRateCardWithDefaults(
  rateCardId: string,
  defaultRates?: Partial<Record<ServiceCode, number>>
): Promise<{ inserted: number }> {
  let inserted = 0;

  const servicesToInsert = Object.values(SERVICE_CODES);
  
  for (const serviceCode of servicesToInsert) {
    const rate = defaultRates?.[serviceCode as ServiceCode] ?? 0;
    const isAccessorial = ACCESSORIAL_SERVICES.has(serviceCode);
    
    try {
      const { error } = await supabase
        .from('rate_card_details')
        .insert({
          rate_card_id: rateCardId,
          service_type: serviceCode,
          rate,
          category: isAccessorial ? 'accessorial' : 'item_service',
          charge_unit: 'per_item',
        });

      if (!error) {
        inserted++;
      }
    } catch (error) {
      console.error(`Error inserting rate for ${serviceCode}:`, error);
    }
  }

  return { inserted };
}

/**
 * @deprecated Legacy function - Sync item type rates to the default rate card
 * This function is kept for backward compatibility. New code should use rate_card_details directly.
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
      minor_touchup_rate: 'minor_touchup',
      storage_rate: 'storage',
      will_call_rate: 'will_call',
      disposal_rate: 'disposal',
      picking_rate: 'picking',
      packing_rate: 'packing',
      oversize_rate: 'oversize',
      overweight_rate: 'overweight',
      unstackable_extra_fee: 'unstackable',
      crated_rate: 'crate_disposal',
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
 * @deprecated Legacy function - Populate a rate card with all item type rates as a starting template
 * This function is kept for backward compatibility. New code should use populateRateCardWithDefaults.
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
      .eq('tenant_id', tenantId);

    if (!itemTypes || itemTypes.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    // 2. Service type mapping
    const fieldToService: Record<string, string> = {
      receiving_rate: 'receiving',
      shipping_rate: 'shipping',
      assembly_rate: 'assembly',
      inspection_fee: 'inspection',
      minor_touchup_rate: 'minor_touchup',
      storage_rate: 'storage',
      will_call_rate: 'will_call',
      disposal_rate: 'disposal',
      picking_rate: 'picking',
      packing_rate: 'packing',
      oversize_rate: 'oversize',
      overweight_rate: 'overweight',
      unstackable_extra_fee: 'unstackable',
      crated_rate: 'crate_disposal',
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
