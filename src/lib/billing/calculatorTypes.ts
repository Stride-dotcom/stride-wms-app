/**
 * Billing Calculator TypeScript Types
 */

/**
 * Item to calculate billing for
 */
export interface BillingItem {
  id: string;
  class_code: string | null;
  quantity: number;
}

/**
 * Rate override for a specific class
 */
export interface RateOverride {
  class_code: string | null;
  rate: number;
}

/**
 * Custom charge added by user
 */
export interface CustomCharge {
  id: string;
  description: string;
  amount: number;
}

/**
 * Individual line item in the calculation
 */
export interface BillingLineItem {
  service_id: string;
  service_name: string;
  service_code: string;
  class_code: string | null;
  class_name: string | null;
  quantity: number;
  rate: number;
  total: number;
  is_override: boolean;
}

/**
 * Complete billing calculation result
 */
export interface BillingCalculation {
  /** Individual line items (one per class with charges) */
  lineItems: BillingLineItem[];

  /** Custom charges added by user */
  customCharges: CustomCharge[];

  /** Sum of line item totals */
  subtotal: number;

  /** Sum of custom charges */
  customChargesTotal: number;

  /** subtotal + customChargesTotal */
  preTaxTotal: number;

  /** Tax rate percentage (e.g., 8.25) */
  taxRate: number;

  /** Calculated tax amount */
  taxAmount: number;

  /** Final total including tax */
  grandTotal: number;

  /** Context key used (e.g., 'shipment_inbound') */
  context: string | null;

  /** Whether a matching service was found */
  serviceFound: boolean;

  /** Whether any items had $0 rate (missing rate in Price List) */
  hasRateErrors: boolean;

  /** Error message if calculation failed */
  error?: string;
}

/**
 * Service event from Price List (service_events table)
 */
export interface ServiceEvent {
  id: string;
  tenant_id: string;
  service_code: string;
  service_name: string;
  class_code: string | null;
  rate: number;
  billing_unit: string;
  billing_trigger: string;
  taxable: boolean;
  uses_class_pricing: boolean;
  is_active: boolean;
  service_time_minutes: number | null;
  notes: string | null;
}

/**
 * Class from classes table
 */
export interface BillingClass {
  id: string;
  code: string;
  name: string;
}

/**
 * Props for BillingCalculator component
 */
export interface BillingCalculatorProps {
  // ═══════════════════════════════════════════════════════════════════════════
  // REQUIRED: Context Identification
  // ═══════════════════════════════════════════════════════════════════════════

  /** Type of parent context */
  contextType: 'shipment' | 'task' | 'delivery';

  /** Context-specific data used to resolve billing configuration */
  contextData: {
    direction?: 'inbound' | 'outbound';
    is_return?: boolean;
    task_type?: string;
    selected_service_id?: string;
    hours?: number;
    quantity?: number;
    delivery_type?: 'local' | 'white_glove';
  };

  /** Items to calculate billing for */
  items: BillingItem[];

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Overrides and Custom Charges
  // ═══════════════════════════════════════════════════════════════════════════

  /** User-defined rate overrides */
  rateOverrides?: RateOverride[];

  /** Additional custom charges */
  customCharges?: CustomCharge[];

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Tax Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  /** Whether to calculate and display tax */
  showTax?: boolean;

  /** Tax rate percentage (e.g., 8.25 for 8.25%) */
  taxRate?: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Callbacks
  // ═══════════════════════════════════════════════════════════════════════════

  /** Called when user overrides a rate */
  onRateOverride?: (classCode: string | null, newRate: number) => void;

  /** Called when user adds a custom charge */
  onAddCustomCharge?: (description: string, amount: number) => void;

  /** Called when user removes a custom charge */
  onRemoveCustomCharge?: (chargeId: string) => void;

  /** Called whenever calculation changes */
  onCalculationChange?: (calculation: BillingCalculation) => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Display Options
  // ═══════════════════════════════════════════════════════════════════════════

  /** Whether the calculator is read-only */
  readOnly?: boolean;

  /** Compact mode for smaller UI footprint */
  compact?: boolean;

  /** Title to display (defaults to "Billing Charges") */
  title?: string;
}
