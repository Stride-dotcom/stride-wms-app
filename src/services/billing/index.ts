/**
 * Billing Gateway — Public API (Phase B0)
 *
 * Re-exports gateway functions and types for consumers.
 * This module is UNUSED in Phase B0 — no call sites are migrated yet.
 */

// Gateway functions
export {
  createCharge,
  createCharges,
  previewCharge,
  previewCharges,
  voidCharge,
  moveCharges,
} from './billingGateway';

// Types
export type {
  BillingEventType,
  BillingContextType,
  BillingContext,
  CreateChargeParams,
  PreviewChargeParams,
  ChargeResult,
  ChargePreview,
  MoveChargesParams,
  MoveChargesResult,
} from './types';
