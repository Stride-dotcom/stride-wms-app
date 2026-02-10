/**
 * Billing Gateway — Phase B0
 *
 * Thin wrapper over existing billing utilities. Delegates all logic to:
 *   - chargeTypeUtils.ts   (rate lookups)
 *   - createBillingEvent.ts (event creation, voiding, sidemark moves)
 *   - billingCalculation.ts (rate-from-price-list preview)
 *
 * NO new rate logic, promo logic, billing_events writes, or schema assumptions.
 * This file is UNUSED in Phase B0 — it is a safe foundation for later migration.
 */

import {
  getEffectiveRate,
  BILLING_DISABLED_ERROR,
} from '@/lib/billing/chargeTypeUtils';

import {
  createBillingEvent,
  voidBillingEvent,
  moveItemSidemarkWithEvents,
} from '@/lib/billing/createBillingEvent';
import type { CreateBillingEventParams } from '@/lib/billing/createBillingEvent';

import { getRateFromPriceList } from '@/lib/billing/billingCalculation';

import type {
  CreateChargeParams,
  PreviewChargeParams,
  ChargeResult,
  ChargePreview,
  MoveChargesParams,
  MoveChargesResult,
} from './types';

// =============================================================================
// createCharge
// =============================================================================

/**
 * Create a single billing charge.
 *
 * 1. Resolves rate via getEffectiveRate (unless rateOverride is provided).
 * 2. Delegates to createBillingEvent for persistence.
 */
export async function createCharge(params: CreateChargeParams): Promise<ChargeResult> {
  let unitRate: number;
  let hasRateError = params.hasRateError ?? false;
  let rateErrorMessage: string | null = params.rateErrorMessage ?? null;

  // --- Rate resolution ---
  if (params.rateOverride !== undefined && params.rateOverride !== null) {
    unitRate = params.rateOverride;
  } else {
    try {
      const rateResult = await getEffectiveRate({
        tenantId: params.tenantId,
        chargeCode: params.chargeCode,
        accountId: params.accountId,
        classCode: params.classCode,
      });

      if (rateResult.has_error) {
        if (rateResult.error_message === BILLING_DISABLED_ERROR) {
          return {
            success: false,
            hasRateError: true,
            errorMessage: BILLING_DISABLED_ERROR,
          };
        }
        unitRate = 0;
        hasRateError = true;
        rateErrorMessage = rateResult.error_message;
      } else {
        unitRate = rateResult.effective_rate;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown rate lookup error';
      if (message === BILLING_DISABLED_ERROR) {
        return {
          success: false,
          hasRateError: true,
          errorMessage: BILLING_DISABLED_ERROR,
        };
      }
      unitRate = 0;
      hasRateError = true;
      rateErrorMessage = message;
    }
  }

  // --- Build event params ---
  const quantity = params.quantity ?? 1;
  const totalAmount = unitRate * quantity;

  const eventParams: CreateBillingEventParams = {
    tenant_id: params.tenantId,
    account_id: params.accountId,
    sidemark_id: params.sidemarkId ?? null,
    class_id: params.classId ?? null,
    service_id: params.serviceId ?? null,
    item_id: params.context.itemId ?? null,
    task_id: params.context.taskId ?? null,
    shipment_id: params.context.shipmentId ?? null,
    event_type: params.eventType,
    charge_type: params.chargeCode,
    description: params.description,
    quantity,
    unit_rate: unitRate,
    total_amount: totalAmount,
    has_rate_error: hasRateError,
    rate_error_message: rateErrorMessage,
    skip_promo: params.skipPromo,
    metadata: {
      ...params.metadata,
      billing_context: params.context.type,
      ...(params.context.intakeId ? { intake_id: params.context.intakeId } : {}),
    },
    created_by: params.userId,
  };

  // --- Delegate to createBillingEvent ---
  const result = await createBillingEvent(eventParams);

  if (!result) {
    return {
      success: false,
      hasRateError,
      errorMessage: 'Failed to create billing event',
    };
  }

  return {
    success: true,
    billingEventId: result.id,
    amount: result.total_amount,
    hasRateError,
    errorMessage: rateErrorMessage ?? undefined,
  };
}

// =============================================================================
// createCharges
// =============================================================================

/**
 * Create multiple billing charges.
 *
 * Phase B0: simple order-preserving loop over createCharge().
 * Returns same-length array in same order, always.
 */
export async function createCharges(paramsList: CreateChargeParams[]): Promise<ChargeResult[]> {
  const results: ChargeResult[] = [];
  for (const params of paramsList) {
    results.push(await createCharge(params));
  }
  return results;
}

// =============================================================================
// previewCharge
// =============================================================================

/**
 * Preview a single charge (rate lookup only, no persistence).
 *
 * Delegates to getRateFromPriceList for the rate lookup.
 */
export async function previewCharge(params: PreviewChargeParams): Promise<ChargePreview> {
  const rateResult = await getRateFromPriceList(
    params.tenantId,
    params.chargeCode,
    params.classCode ?? null,
    params.accountId,
  );

  const quantity = params.quantity ?? 1;
  const subtotal = quantity * rateResult.rate;

  return {
    rate: rateResult.rate,
    quantity,
    subtotal,
    serviceName: rateResult.serviceName,
    billingUnit: rateResult.billingUnit,
    hasRateError: rateResult.hasError,
    errorMessage: rateResult.errorMessage,
  };
}

// =============================================================================
// previewCharges
// =============================================================================

/**
 * Preview multiple charges in parallel, preserving order.
 */
export async function previewCharges(paramsList: PreviewChargeParams[]): Promise<ChargePreview[]> {
  return Promise.all(paramsList.map((params) => previewCharge(params)));
}

// =============================================================================
// voidCharge
// =============================================================================

/**
 * Void a single billing event by ID.
 * Delegates to voidBillingEvent.
 */
export async function voidCharge(eventId: string): Promise<{ success: boolean }> {
  const success = await voidBillingEvent(eventId);
  return { success };
}

// =============================================================================
// moveCharges
// =============================================================================

/**
 * Move unbilled billing events when an item's sidemark changes.
 * Delegates to moveItemSidemarkWithEvents.
 *
 * @param params.itemId    — required, the item whose events move
 * @param params.newSidemarkId — the target sidemark (null to clear)
 */
export async function moveCharges(params: MoveChargesParams): Promise<MoveChargesResult> {
  const result = await moveItemSidemarkWithEvents(params.itemId, params.newSidemarkId);
  return {
    success: result.success,
    movedCount: result.movedCount,
    invoicedCount: result.invoicedCount,
  };
}
