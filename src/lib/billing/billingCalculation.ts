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
 */
export const SHIPMENT_DIRECTION_TO_SERVICE_CODE: Record<string, string> = {
  'inbound': 'RCVG',
  'outbound': 'Shipping',
  'return': 'Returns',
};

// ============================================================================
// RATE LOOKUP
// ============================================================================

export interface RateLookupResult {
  rate: number;
  serviceName: string;
  serviceCode: string;
  billingUnit: 'Day' | 'Item' | 'Task';
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
 */
export async function calculateTaskBillingPreview(
  tenantId: string,
  taskId: string,
  taskType: string,
  overrideServiceCode?: string | null,
  overrideQuantity?: number | null,
  overrideRate?: number | null
): Promise<BillingPreview> {
  // Determine service code
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
 */
export async function calculateShipmentBillingPreview(
  tenantId: string,
  shipmentId: string,
  direction: 'inbound' | 'outbound' | 'return'
): Promise<BillingPreview> {
  // Determine service code based on direction
  const serviceCode = SHIPMENT_DIRECTION_TO_SERVICE_CODE[direction] || 'RCVG';

  // Get shipment items with class info
  const { data: shipmentItems, error: shipmentItemsError } = await supabase
    .from('shipment_items')
    .select(`
      item_id,
      quantity_expected,
      quantity_received,
      items:item_id (
        item_code,
        class_id,
        classes:class_id (
          code,
          name
        )
      )
    `)
    .eq('shipment_id', shipmentId);

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

  const lineItems: BillingLineItem[] = [];
  let subtotal = 0;
  let hasErrors = false;
  let serviceName = serviceCode;

  // Calculate for each item based on class
  for (const si of shipmentItems || []) {
    const item = si.items as any;
    const itemCode = item?.item_code || null;
    const classCode = item?.classes?.code || null;
    const className = item?.classes?.name || null;
    // Use received quantity if available, otherwise expected
    const quantity = si.quantity_received || si.quantity_expected || 1;

    const rateResult = await getRateFromPriceList(tenantId, serviceCode, classCode);
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
