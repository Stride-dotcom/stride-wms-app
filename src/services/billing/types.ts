/**
 * Billing Gateway Types — Phase B0
 *
 * All billing event types are DERIVED from existing library types.
 * Gateway-only types (BillingContextType, BillingContext) are defined here.
 */

import type { CreateBillingEventParams } from '@/lib/billing/createBillingEvent';

// =============================================================================
// DERIVED TYPES (from existing billing library)
// =============================================================================

/**
 * Derived from CreateBillingEventParams — NOT a manual union.
 * NOTE: This does not include event_type values used only by direct-insert
 * call sites (e.g. 'coverage', 'credit', 'claim_assistance'). Those will be
 * addressed in later phases when migrating those call sites.
 */
export type BillingEventType = CreateBillingEventParams['event_type'];

// =============================================================================
// GATEWAY-ONLY TYPES
// =============================================================================

/** Context type for billing operations (gateway metadata). */
export type BillingContextType = 'shipment' | 'task' | 'item' | 'intake' | 'manual';

/** Contextual identifiers attached to a billing charge. */
export interface BillingContext {
  type: BillingContextType;
  shipmentId?: string;
  taskId?: string;
  itemId?: string;
  intakeId?: string;
}

// =============================================================================
// CHARGE CREATION
// =============================================================================

export interface CreateChargeParams {
  // Required
  tenantId: string;
  accountId: string;
  chargeCode: string;
  eventType: BillingEventType;
  context: BillingContext;

  // Optional
  description?: string;
  quantity?: number;
  classCode?: string | null;
  rateOverride?: number;
  sidemarkId?: string | null;
  classId?: string | null;
  serviceId?: string | null;
  userId?: string;
  metadata?: Record<string, any>;

  // Promo control
  skipPromo?: boolean;

  // Error passthrough (from upstream callers that already know the rate status)
  hasRateError?: boolean;
  rateErrorMessage?: string | null;
}

// =============================================================================
// CHARGE PREVIEW
// =============================================================================

/** Subset of CreateChargeParams needed for rate preview. */
export type PreviewChargeParams = Pick<
  CreateChargeParams,
  'tenantId' | 'accountId' | 'chargeCode' | 'classCode' | 'quantity'
>;

// =============================================================================
// RESULTS
// =============================================================================

export interface ChargeResult {
  success: boolean;
  billingEventId?: string;
  amount?: number;
  hasRateError: boolean;
  errorMessage?: string;
}

export interface ChargePreview {
  rate: number;
  quantity: number;
  subtotal: number;
  serviceName: string;
  billingUnit: string;
  hasRateError: boolean;
  errorMessage?: string;
}

// =============================================================================
// MOVE CHARGES
// =============================================================================

export interface MoveChargesParams {
  /** Required — the item whose unbilled events will be moved. */
  itemId: string;
  newSidemarkId: string | null;
}

export interface MoveChargesResult {
  success: boolean;
  movedCount: number;
  invoicedCount: number;
}
