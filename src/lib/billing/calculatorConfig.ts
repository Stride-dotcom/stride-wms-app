/**
 * Billing Calculator Configuration
 *
 * Maps contexts (shipment, task, delivery) to billing triggers and service patterns.
 * This is the ONLY place where billing logic is defined - no hardcoded service codes elsewhere.
 *
 * To add a new context:
 * 1. Add entry to BILLING_CALCULATOR_CONFIG
 * 2. Add case to resolveContextKey function
 * 3. Add services to Price List with matching billing_trigger
 */

export interface BillingCalculatorContextConfig {
  /** billing_trigger values to filter services by */
  billing_triggers: string[];
  /** Regex patterns to match service name/code */
  service_patterns: RegExp[];
  /** Display label for the service type */
  label: string;
  /** How to determine quantity: 'items' | 'selected_quantity' | 'hours' */
  quantity_source: 'items' | 'selected_quantity' | 'hours';
  /** If true, the parent provides a specific service_id (Assembly/Repair dropdowns) */
  use_selected_service?: boolean;
}

/**
 * Context-to-billing configuration mapping
 * Pattern matching ensures resilience to service name/code changes
 */
export const BILLING_CALCULATOR_CONFIG: Record<string, BillingCalculatorContextConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // SHIPMENT CONTEXTS
  // ═══════════════════════════════════════════════════════════════════════════

  shipment_inbound: {
    billing_triggers: ['Shipment'],
    service_patterns: [/receiv/i, /rcvg/i, /inbound/i],
    label: 'Receiving',
    quantity_source: 'items',
  },

  shipment_outbound: {
    billing_triggers: ['Shipment'],
    service_patterns: [/ship(?!ment)/i, /outbound/i, /dispatch/i],
    label: 'Shipping',
    quantity_source: 'items',
  },

  shipment_return: {
    billing_triggers: ['Shipment'],
    service_patterns: [/return/i, /rtrn/i],
    label: 'Returns Processing',
    quantity_source: 'items',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TASK CONTEXTS
  // ═══════════════════════════════════════════════════════════════════════════

  task_inspection: {
    billing_triggers: ['Through Task'],
    service_patterns: [/insp/i, /inspect/i],
    label: 'Inspection',
    quantity_source: 'items',
  },

  task_assembly: {
    billing_triggers: ['Task - Assign Rate'],
    service_patterns: [/assemb/i, /\d+ma$/i],
    label: 'Assembly',
    quantity_source: 'selected_quantity',
    use_selected_service: true,
  },

  task_repair: {
    billing_triggers: ['Task - Assign Rate'],
    service_patterns: [/repair/i, /hro$/i, /hr.?repair/i],
    label: 'Repair',
    quantity_source: 'hours',
    use_selected_service: true,
  },

  task_disposal: {
    billing_triggers: ['TASK'],
    service_patterns: [/dispos/i, /donat/i],
    label: 'Disposal',
    quantity_source: 'items',
  },

  task_will_call: {
    billing_triggers: ['Through Task'],
    service_patterns: [/will.?call/i, /pickup/i],
    label: 'Will Call',
    quantity_source: 'items',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FUTURE CONTEXTS (Delivery, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  delivery_local: {
    billing_triggers: ['Delivery'],
    service_patterns: [/local.?deliver/i, /same.?day/i, /deliver/i],
    label: 'Local Delivery',
    quantity_source: 'items',
  },

  delivery_white_glove: {
    billing_triggers: ['Delivery'],
    service_patterns: [/white.?glove/i, /premium.?deliver/i],
    label: 'White Glove Delivery',
    quantity_source: 'items',
  },
};

/**
 * Context data provided by parent component
 */
export interface ContextData {
  // For shipments
  direction?: 'inbound' | 'outbound';
  is_return?: boolean;

  // For tasks
  task_type?: string;
  selected_service_id?: string;
  hours?: number;
  quantity?: number;

  // For delivery
  delivery_type?: 'local' | 'white_glove';
}

/**
 * Resolve context type and data to a config key
 *
 * @param contextType - 'shipment' | 'task' | 'delivery'
 * @param contextData - Context-specific data
 * @returns Config key (e.g., 'shipment_inbound') or null if unknown
 */
export function resolveContextKey(
  contextType: 'shipment' | 'task' | 'delivery',
  contextData: ContextData
): string | null {
  // Shipment contexts
  if (contextType === 'shipment') {
    if (contextData.is_return) return 'shipment_return';
    if (contextData.direction === 'inbound') return 'shipment_inbound';
    if (contextData.direction === 'outbound') return 'shipment_outbound';
    // Default to inbound if no direction specified
    return 'shipment_inbound';
  }

  // Task contexts
  if (contextType === 'task') {
    const taskType = contextData.task_type?.toLowerCase() || '';

    if (taskType.includes('inspection') || taskType === 'inspection') return 'task_inspection';
    if (taskType.includes('assembly') || taskType === 'assembly') return 'task_assembly';
    if (taskType.includes('repair') || taskType === 'repair') return 'task_repair';
    if (taskType.includes('disposal') || taskType === 'disposal') return 'task_disposal';
    if (taskType.includes('will call') || taskType.includes('willcall') || taskType === 'will_call') return 'task_will_call';

    // Unknown task type
    return null;
  }

  // Delivery contexts
  if (contextType === 'delivery') {
    if (contextData.delivery_type === 'white_glove') return 'delivery_white_glove';
    return 'delivery_local';
  }

  return null;
}

/**
 * Get the billing configuration for a context
 *
 * @param contextType - 'shipment' | 'task' | 'delivery'
 * @param contextData - Context-specific data
 * @returns Configuration or null if unknown context
 */
export function getBillingConfig(
  contextType: 'shipment' | 'task' | 'delivery',
  contextData: ContextData
): BillingCalculatorContextConfig | null {
  const key = resolveContextKey(contextType, contextData);
  if (!key) return null;
  return BILLING_CALCULATOR_CONFIG[key] || null;
}
