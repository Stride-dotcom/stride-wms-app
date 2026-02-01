/**
 * Shared Billing Calculation Logic
 *
 * This module contains the core billing calculation logic used by:
 * 1. BillingCalculator component (preview before triggering)
 * 2. Actual billing event creation (when task/shipment completes)
 *
 * By sharing this logic, we guarantee the Calculator shows EXACTLY
 * what will appear in Billing Reports once the event is triggered.
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// SERVICE CODE MAPPINGS
// These are the authoritative mappings - used by both preview and creation
// ============================================================================

/**
 * Map task types to service codes in the Price List
 * This is the single source of truth for task → service mapping
 */
export const TASK_TYPE_TO_SERVICE_CODE: Record<string, string> = {
  'Inspection': 'INSP',
  'Will Call': 'Will_Call',
  'Disposal': 'Disposal',
  'Assembly': '15MA', // Default - can be overridden per task via billing_service_code
  'Repair': '1HRO',   // Default - can be overridden per task via billing_service_code
  'Receiving': 'RCVG',
  'Returns': 'Returns',
};

/**
 * Map shipment direction to service codes
 * Outbound uses Will_Call for class-based pickup/release fees
 */
export const SHIPMENT_DIRECTION_TO_SERVICE_CODE: Record<string, string> = {
  'inbound': 'RCVG',
  'outbound': 'Will_Call',
  'return': 'Returns',
};

// ============================================================================
// RATE LOOKUP
// ============================================================================

export interface RateLookupResult {
  rate: number;
  serviceName: string;
  serviceCode: string;
  billingUnit: string;  // Flexible to handle all database values
  alertRule: string;
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Get rate from Price List (service_events table)
 * Tries class-specific rate first, falls back to general rate
 */
export async function getRateFromPriceList(
  tenantId: string,
  serviceCode: string,
  classCode: string | null
): Promise<RateLookupResult> {
  try {
    // Try class-specific rate first
    if (classCode) {
      const { data: classRate } = await supabase
        .from('service_events')
        .select('rate, service_name, billing_unit, alert_rule')
        .eq('tenant_id', tenantId)
        .eq('service_code', serviceCode)
        .eq('class_code', classCode)
        .eq('is_active', true)
        .maybeSingle();

      if (classRate) {
        return {
          rate: classRate.rate,
          serviceName: classRate.service_name || serviceCode,
          serviceCode,
          billingUnit: classRate.billing_unit || 'Item',
          alertRule: classRate.alert_rule || 'none',
          hasError: false,
        };
      }
    }

    // Fall back to general rate (no class_code)
    const { data: generalRate } = await supabase
      .from('service_events')
      .select('rate, service_name, billing_unit, alert_rule')
      .eq('tenant_id', tenantId)
      .eq('service_code', serviceCode)
      .is('class_code', null)
      .eq('is_active', true)
      .maybeSingle();

    if (generalRate) {
      return {
        rate: generalRate.rate,
        serviceName: generalRate.service_name || serviceCode,
        serviceCode,
        billingUnit: generalRate.billing_unit || 'Item',
        alertRule: generalRate.alert_rule || 'none',
        hasError: false,
      };
    }

    // No rate found
    return {
      rate: 0,
      serviceName: serviceCode,
      serviceCode,
      billingUnit: 'Item',
      alertRule: 'none',
      hasError: true,
      errorMessage: `No rate found for service: ${serviceCode}`,
    };
  } catch (error) {
    console.error('[getRateFromPriceList] Error:', error);
    return {
      rate: 0,
      serviceName: serviceCode,
      serviceCode,
      billingUnit: 'Item',
      alertRule: 'none',
      hasError: true,
      errorMessage: 'Error looking up rate',
    };
  }
}

// ============================================================================
// BILLING PREVIEW CALCULATION
// ============================================================================

export interface BillingLineItem {
  itemId: string | null;
  itemCode: string | null;
  classCode: string | null;
  className: string | null;
  serviceCode: string;
  serviceName: string;
  quantity: number;
  unitRate: number;
  totalAmount: number;
  hasRateError: boolean;
  errorMessage?: string;
}

export interface BillingPreview {
  lineItems: BillingLineItem[];
  subtotal: number;
  hasErrors: boolean;
  serviceCode: string;
  serviceName: string;
}

/**
 * Calculate billing preview for a TASK
 * Returns what billing events WOULD be created when task completes
 * 
 * Note: For dynamic service code lookup from task_types table, 
 * callers should use getTaskTypeServiceCode() before calling this function.
 */
export async function calculateTaskBillingPreview(
  tenantId: string,
  taskId: string,
  taskType: string,
  overrideServiceCode?: string | null,
  overrideQuantity?: number | null,
  overrideRate?: number | null
): Promise<BillingPreview> {
  // Determine service code - override takes priority, then falls back to hardcoded defaults
  // For dynamic lookup, caller should pass in the result of getTaskTypeServiceCode()
  const serviceCode = overrideServiceCode || TASK_TYPE_TO_SERVICE_CODE[taskType] || 'INSP';

  // Get task items with class info
  const { data: taskItems, error: taskItemsError } = await supabase
    .from('task_items')
    .select(`
      item_id,
      quantity,
      items:item_id (
        item_code,
        class_id,
        classes:class_id (
          code,
          name
        )
      )
    `)
    .eq('task_id', taskId);

  if (taskItemsError) {
    console.error('[calculateTaskBillingPreview] Error fetching task items:', taskItemsError);
    return {
      lineItems: [],
      subtotal: 0,
      hasErrors: true,
      serviceCode,
      serviceName: serviceCode,
    };
  }

  const lineItems: BillingLineItem[] = [];
  let subtotal = 0;
  let hasErrors = false;
  let serviceName = serviceCode;

  // For Assembly/Repair with override quantity, treat as single line item
  const isPerTaskBilling = taskType === 'Assembly' || taskType === 'Repair';

  if (isPerTaskBilling && overrideQuantity !== null && overrideQuantity !== undefined) {
    // Get the rate (use override if provided, otherwise look up)
    let rate = overrideRate;
    let rateError = false;
    let errorMessage: string | undefined;

    if (rate === null || rate === undefined) {
      const rateResult = await getRateFromPriceList(tenantId, serviceCode, null);
      rate = rateResult.rate;
      serviceName = rateResult.serviceName;
      rateError = rateResult.hasError;
      errorMessage = rateResult.errorMessage;
    }

    const totalAmount = (overrideQuantity || 0) * (rate || 0);

    lineItems.push({
      itemId: null,
      itemCode: null,
      classCode: null,
      className: null,
      serviceCode,
      serviceName,
      quantity: overrideQuantity || 0,
      unitRate: rate || 0,
      totalAmount,
      hasRateError: rateError,
      errorMessage,
    });

    subtotal = totalAmount;
    hasErrors = rateError;
  } else {
    // Per-item billing - calculate for each item based on class
    for (const ti of taskItems || []) {
      const item = ti.items as any;
      const itemCode = item?.item_code || null;
      const classCode = item?.classes?.code || null;
      const className = item?.classes?.name || null;
      const quantity = ti.quantity || 1;

      const rateResult = await getRateFromPriceList(tenantId, serviceCode, classCode);
      serviceName = rateResult.serviceName;

      const totalAmount = quantity * rateResult.rate;

      lineItems.push({
        itemId: ti.item_id,
        itemCode,
        classCode,
        className,
        serviceCode: rateResult.serviceCode,
        serviceName: rateResult.serviceName,
        quantity,
        unitRate: rateResult.rate,
        totalAmount,
        hasRateError: rateResult.hasError,
        errorMessage: rateResult.errorMessage,
      });

      subtotal += totalAmount;
      if (rateResult.hasError) hasErrors = true;
    }
  }

  return {
    lineItems,
    subtotal,
    hasErrors,
    serviceCode,
    serviceName,
  };
}

/**
 * Calculate billing preview for a SHIPMENT
 * Returns what billing events WOULD be created when shipment completes
 *
 * Items are now created with class_id during shipment creation,
 * so we can directly use item.class_id for rate lookups.
 */
export async function calculateShipmentBillingPreview(
  tenantId: string,
  shipmentId: string,
  direction: 'inbound' | 'outbound' | 'return'
): Promise<BillingPreview> {
  console.log('[calculateShipmentBillingPreview] Starting calculation', { tenantId, shipmentId, direction });

  // Determine service code based on direction
  const serviceCode = SHIPMENT_DIRECTION_TO_SERVICE_CODE[direction] || 'RCVG';
  console.log('[calculateShipmentBillingPreview] Service code:', serviceCode);

  // Get shipment items - no nested PostgREST joins (no FK constraints defined)
  const { data: shipmentItems, error: shipmentItemsError } = await supabase
    .from('shipment_items')
    .select(`
      item_id,
      expected_quantity,
      actual_quantity,
      expected_class_id
    `)
    .eq('shipment_id', shipmentId);

  console.log('[calculateShipmentBillingPreview] Shipment items query result:', {
    error: shipmentItemsError,
    itemCount: shipmentItems?.length || 0,
    items: shipmentItems?.map(si => ({
      item_id: si.item_id,
      expected_quantity: si.expected_quantity,
      actual_quantity: si.actual_quantity,
      expected_class_id: si.expected_class_id
    }))
  });

  if (shipmentItemsError) {
    console.error('[calculateShipmentBillingPreview] Error fetching shipment items:', shipmentItemsError);
    return {
      lineItems: [],
      subtotal: 0,
      hasErrors: true,
      serviceCode,
      serviceName: serviceCode,
    };
  }

  // Fetch classes separately (no FK defined for PostgREST)
  const classIds = [...new Set((shipmentItems || []).map(si => si.expected_class_id).filter(Boolean))];
  const { data: classes } = classIds.length > 0
    ? await supabase.from('classes').select('id, code, name').in('id', classIds)
    : { data: [] };
  const classMap = new Map((classes || []).map(c => [c.id, c]));

  // Fetch items separately
  const itemIds = [...new Set((shipmentItems || []).map(si => si.item_id).filter(Boolean))];
  const { data: items } = itemIds.length > 0
    ? await supabase.from('items').select('id, item_code, class_id').in('id', itemIds)
    : { data: [] };
  const itemMap = new Map((items || []).map(i => [i.id, i]));

  // Also fetch classes for items that have class_id set
  const itemClassIds = [...new Set((items || []).map(i => i.class_id).filter(Boolean))];
  const additionalClassIds = itemClassIds.filter(id => !classMap.has(id));
  if (additionalClassIds.length > 0) {
    const { data: additionalClasses } = await supabase.from('classes').select('id, code, name').in('id', additionalClassIds);
    (additionalClasses || []).forEach(c => classMap.set(c.id, c));
  }

  console.log('[calculateShipmentBillingPreview] Separate lookups:', {
    classIds,
    itemIds,
    classMapSize: classMap.size,
    itemMapSize: itemMap.size
  });

  const lineItems: BillingLineItem[] = [];
  let subtotal = 0;
  let hasErrors = false;
  let serviceName = serviceCode;

  // Calculate for each item based on class
  for (const si of shipmentItems || []) {
    const item = itemMap.get(si.item_id);
    const expectedClass = classMap.get(si.expected_class_id);
    const itemClass = item?.class_id ? classMap.get(item.class_id) : null;

    // Get class info from linked item, or fall back to expected_class for old shipments
    const itemCode = item?.item_code || null;
    const classCode = itemClass?.code || expectedClass?.code || null;
    const className = itemClass?.name || expectedClass?.name || null;

    console.log('[calculateShipmentBillingPreview] Processing item:', {
      item_id: si.item_id,
      itemCode,
      classCode,
      className,
      hasItemData: !!item,
      hasExpectedClass: !!expectedClass,
      expectedClassCode: expectedClass?.code
    });

    // Use actual quantity if available, otherwise expected
    const quantity = si.actual_quantity || si.expected_quantity || 1;

    const rateResult = await getRateFromPriceList(tenantId, serviceCode, classCode);
    console.log('[calculateShipmentBillingPreview] Rate lookup result:', {
      serviceCode,
      classCode,
      rate: rateResult.rate,
      hasError: rateResult.hasError,
      errorMessage: rateResult.errorMessage
    });

    serviceName = rateResult.serviceName;

    const totalAmount = quantity * rateResult.rate;

    lineItems.push({
      itemId: si.item_id,
      itemCode,
      classCode,
      className,
      serviceCode: rateResult.serviceCode,
      serviceName: rateResult.serviceName,
      quantity,
      unitRate: rateResult.rate,
      totalAmount,
      hasRateError: rateResult.hasError,
      errorMessage: rateResult.errorMessage,
    });

    subtotal += totalAmount;
    if (rateResult.hasError) hasErrors = true;
  }

  console.log('[calculateShipmentBillingPreview] Final result:', {
    lineItemCount: lineItems.length,
    subtotal,
    hasErrors
  });

  return {
    lineItems,
    subtotal,
    hasErrors,
    serviceCode,
    serviceName,
  };
}

/**
 * Get assembly services from Price List for dropdown
 */
export async function getAssemblyServices(tenantId: string): Promise<Array<{
  serviceCode: string;
  serviceName: string;
  rate: number;
  serviceTimeMinutes: number | null;
}>> {
  const { data, error } = await supabase
    .from('service_events')
    .select('service_code, service_name, rate, service_time_minutes')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('class_code', null)
    .ilike('billing_trigger', '%Task - Assign Rate%')
    .or('service_code.ilike.%MA,service_name.ilike.%assembl%')
    .order('service_time_minutes', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('[getAssemblyServices] Error:', error);
    return [];
  }

  // Dedupe by service_code and sort by numeric prefix
  const seen = new Set<string>();
  return (data || [])
    .filter(s => {
      if (seen.has(s.service_code)) return false;
      seen.add(s.service_code);
      return true;
    })
    .sort((a, b) => {
      const aNum = parseInt(a.service_code) || 999;
      const bNum = parseInt(b.service_code) || 999;
      return aNum - bNum;
    })
    .map(s => ({
      serviceCode: s.service_code,
      serviceName: s.service_name,
      rate: s.rate,
      serviceTimeMinutes: s.service_time_minutes,
    }));
}

/**
 * Get repair service rate from Price List
 */
export async function getRepairServiceRate(tenantId: string): Promise<{
  serviceCode: string;
  serviceName: string;
  rate: number;
} | null> {
  const { data, error } = await supabase
    .from('service_events')
    .select('service_code, service_name, rate')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('class_code', null)
    .or('service_code.ilike.%HRO%,service_name.ilike.%repair%')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error('[getRepairServiceRate] Error:', error);
    return null;
  }

  return {
    serviceCode: data.service_code,
    serviceName: data.service_name,
    rate: data.rate,
  };
}
