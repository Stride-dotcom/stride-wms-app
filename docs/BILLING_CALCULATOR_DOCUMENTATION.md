# Stride WMS Billing Calculator Documentation

## Overview

The **Billing Calculator** is a reusable, embeddable component that provides real-time billing charge calculations for shipments, tasks, and future service types (e.g., delivery). It is designed to be context-aware, dynamically fetching services from the Price List and calculating charges based on item classes.

**Key Principle**: The Billing Calculator is a **visual confirmation tool** that shows what the billing system calculates. It does NOT create billing events - it displays the expected charges so users can verify the billing logic is working correctly.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Architecture Overview](#architecture-overview)
3. [Context-to-Billing Mapping](#context-to-billing-mapping)
4. [Data Flow](#data-flow)
5. [Service Lookup Logic](#service-lookup-logic)
6. [Rate Calculation](#rate-calculation)
7. [Component Interface](#component-interface)
8. [UI Features](#ui-features)
9. [File Structure](#file-structure)
10. [Adding New Contexts](#adding-new-contexts)
11. [Relationship to Other Systems](#relationship-to-other-systems)

---

## Design Philosophy

### Problems Solved

The Billing Calculator was designed to address these issues:

1. **Hardcoded service codes break** - Previous implementations used hardcoded service codes (e.g., 'RCVG', 'Shipping') that failed when services were renamed or didn't exist
2. **No visual confirmation** - Users couldn't see what the billing system was calculating until invoices were generated
3. **Not scalable** - Adding new services or task types required code changes
4. **Fragile** - Changes to shipment/task forms could break billing calculations

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No hardcoded service codes** | Uses `billing_trigger` field + pattern matching |
| **Context-aware** | Receives context from parent (shipment/task/delivery) |
| **Dynamic lookup** | Fetches services from Price List in real-time |
| **Pattern matching** | Identifies services by name/code patterns, not exact matches |
| **Graceful fallback** | Returns $0 if no matching service found (doesn't crash) |
| **Extensible** | New contexts added via configuration, not code changes |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BILLING CALCULATOR ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              PARENT COMPONENT
                        (Shipment, Task, Delivery, etc.)
                                    │
                                    │ Props:
                                    │ • contextType
                                    │ • contextData
                                    │ • items[]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BILLING CALCULATOR                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    useBillingCalculator Hook                         │   │
│  │                                                                      │   │
│  │  1. Resolve Context                                                  │   │
│  │     contextType + contextData → billing configuration               │   │
│  │                                                                      │   │
│  │  2. Fetch Services                                                   │   │
│  │     SELECT * FROM service_events                                     │   │
│  │     WHERE billing_trigger IN (config.billing_triggers)               │   │
│  │                                                                      │   │
│  │  3. Find Matching Service                                            │   │
│  │     Apply pattern matching: /receiv/i, /insp/i, etc.                │   │
│  │                                                                      │   │
│  │  4. Calculate Charges                                                │   │
│  │     For each item: find rate by class → qty × rate                  │   │
│  │                                                                      │   │
│  │  5. Return Calculation                                               │   │
│  │     { lineItems[], subtotal, tax, total, customCharges[] }          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    BillingCalculator UI                              │   │
│  │                                                                      │   │
│  │  ┌───────────────────────────────────────────────────────────┐      │   │
│  │  │ Billing Charges                                           │      │   │
│  │  ├───────────────────────────────────────────────────────────┤      │   │
│  │  │ Service         Class   Qty    Rate      Total    Actions │      │   │
│  │  │ ─────────────────────────────────────────────────────────│      │   │
│  │  │ Receiving       M       3      $15.00    $45.00   [✎]    │      │   │
│  │  │ Receiving       L       2      $20.00    $40.00   [✎]    │      │   │
│  │  │ Custom: Rush    -       1      $50.00    $50.00   [✗]    │      │   │
│  │  │ ─────────────────────────────────────────────────────────│      │   │
│  │  │                              Subtotal:   $135.00          │      │   │
│  │  │                              Tax 8.25%:   $11.14          │      │   │
│  │  │                              TOTAL:      $146.14          │      │   │
│  │  │                                                           │      │   │
│  │  │ [+ Add Charge]                                            │      │   │
│  │  └───────────────────────────────────────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Context-to-Billing Mapping

The Billing Calculator uses a configuration object to map contexts to billing triggers and service patterns. This is the **only place** where billing logic is defined.

### Configuration Structure

```typescript
// src/lib/billing/calculatorConfig.ts

export const BILLING_CALCULATOR_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // SHIPMENT CONTEXTS
  // ═══════════════════════════════════════════════════════════════════════════

  shipment_inbound: {
    // Which billing_trigger values to filter services by
    billing_triggers: ['Shipment'],
    // Pattern matching to find the specific service
    service_patterns: [/receiv/i, /rcvg/i, /inbound/i],
    // Description for UI
    label: 'Receiving',
    // How to calculate quantity
    quantity_source: 'items', // Count items
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
    quantity_source: 'selected_quantity', // User-selected quantity
    use_selected_service: true, // Task has dropdown to select specific service
  },

  task_repair: {
    billing_triggers: ['Task - Assign Rate'],
    service_patterns: [/repair/i, /hro$/i, /hr.?repair/i],
    label: 'Repair',
    quantity_source: 'hours', // User-entered hours
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
    service_patterns: [/local.?deliver/i, /same.?day/i],
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
```

### Context Resolution Logic

```typescript
// How the calculator determines which config to use

function resolveContext(contextType: string, contextData: ContextData): string {
  if (contextType === 'shipment') {
    if (contextData.direction === 'inbound') return 'shipment_inbound';
    if (contextData.direction === 'outbound') return 'shipment_outbound';
    if (contextData.is_return) return 'shipment_return';
  }

  if (contextType === 'task') {
    const taskType = contextData.task_type?.toLowerCase();
    if (taskType === 'inspection') return 'task_inspection';
    if (taskType === 'assembly') return 'task_assembly';
    if (taskType === 'repair') return 'task_repair';
    if (taskType === 'disposal') return 'task_disposal';
    if (taskType === 'will call') return 'task_will_call';
  }

  if (contextType === 'delivery') {
    if (contextData.delivery_type === 'white_glove') return 'delivery_white_glove';
    return 'delivery_local';
  }

  return null; // Unknown context
}
```

---

## Data Flow

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Parent provides context                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  <BillingCalculator                                                         │
│    contextType="shipment"                                                   │
│    contextData={{ direction: 'inbound' }}                                   │
│    items={[                                                                 │
│      { id: '1', class_code: 'M', quantity: 3 },                            │
│      { id: '2', class_code: 'L', quantity: 2 },                            │
│    ]}                                                                       │
│  />                                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Resolve context to config key                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  contextType: 'shipment' + direction: 'inbound'                             │
│       ↓                                                                     │
│  configKey: 'shipment_inbound'                                              │
│       ↓                                                                     │
│  config: {                                                                  │
│    billing_triggers: ['Shipment'],                                          │
│    service_patterns: [/receiv/i, /rcvg/i, /inbound/i],                     │
│    label: 'Receiving',                                                      │
│    quantity_source: 'items'                                                 │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Fetch services from Price List                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SELECT * FROM service_events                                               │
│  WHERE tenant_id = 'xxx'                                                    │
│    AND is_active = true                                                     │
│    AND billing_trigger IN ('Shipment')                                      │
│                                                                             │
│  Returns:                                                                   │
│  ┌──────────────┬────────────┬───────────────┬──────┐                      │
│  │ service_code │ class_code │ service_name  │ rate │                      │
│  ├──────────────┼────────────┼───────────────┼──────┤                      │
│  │ RCVG         │ XS         │ Receiving     │ 10   │                      │
│  │ RCVG         │ S          │ Receiving     │ 10   │                      │
│  │ RCVG         │ M          │ Receiving     │ 15   │                      │
│  │ RCVG         │ L          │ Receiving     │ 15   │                      │
│  │ RCVG         │ XL         │ Receiving     │ 20   │                      │
│  │ RCVG         │ XXL        │ Receiving     │ 25   │                      │
│  │ RCVG         │ NULL       │ Receiving     │ 12   │  ← default           │
│  │ Shipping     │ M          │ Shipping      │ 15   │                      │
│  │ ...          │ ...        │ ...           │ ...  │                      │
│  └──────────────┴────────────┴───────────────┴──────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Find matching service using patterns                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Patterns: [/receiv/i, /rcvg/i, /inbound/i]                                │
│                                                                             │
│  For each service from Step 3:                                              │
│    if (pattern.test(service.service_name) ||                                │
│        pattern.test(service.service_code)) {                                │
│      → MATCH!                                                               │
│    }                                                                        │
│                                                                             │
│  Result: Services with code 'RCVG' / name 'Receiving' match                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Calculate charges for each item                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  items[0]: { class_code: 'M', quantity: 3 }                                 │
│    → Find rate for RCVG + class M = $15.00                                  │
│    → 3 × $15.00 = $45.00                                                    │
│                                                                             │
│  items[1]: { class_code: 'L', quantity: 2 }                                 │
│    → Find rate for RCVG + class L = $15.00                                  │
│    → 2 × $15.00 = $30.00                                                    │
│                                                                             │
│  Line Items:                                                                │
│  ┌─────────────┬───────┬─────┬────────┬────────┐                           │
│  │ Service     │ Class │ Qty │ Rate   │ Total  │                           │
│  ├─────────────┼───────┼─────┼────────┼────────┤                           │
│  │ Receiving   │ M     │ 3   │ $15.00 │ $45.00 │                           │
│  │ Receiving   │ L     │ 2   │ $15.00 │ $30.00 │                           │
│  └─────────────┴───────┴─────┴────────┴────────┘                           │
│                                                                             │
│  Subtotal: $75.00                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Add custom charges + tax                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Custom Charges: [{ description: 'Rush Fee', amount: 50 }]                  │
│                                                                             │
│  Subtotal:       $75.00                                                     │
│  Custom Charges: $50.00                                                     │
│  ────────────────────────                                                   │
│  Pre-Tax Total:  $125.00                                                    │
│  Tax (8.25%):    $10.31                                                     │
│  ════════════════════════                                                   │
│  GRAND TOTAL:    $135.31                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Lookup Logic

### Pattern Matching Function

```typescript
/**
 * Find a service that matches any of the given patterns
 * Uses both service_name and service_code for matching
 */
function findMatchingService(
  services: ServiceEvent[],
  patterns: RegExp[],
  classCode?: string | null
): ServiceEvent | null {
  // First, try to find a class-specific match
  if (classCode) {
    for (const pattern of patterns) {
      const match = services.find(
        (s) =>
          s.class_code === classCode &&
          (pattern.test(s.service_name) || pattern.test(s.service_code || ''))
      );
      if (match) return match;
    }
  }

  // Fall back to non-class-specific (default rate)
  for (const pattern of patterns) {
    const match = services.find(
      (s) =>
        s.class_code === null &&
        (pattern.test(s.service_name) || pattern.test(s.service_code || ''))
    );
    if (match) return match;
  }

  // No match found
  return null;
}
```

### Why Pattern Matching Works

| Scenario | Without Pattern Matching | With Pattern Matching |
|----------|--------------------------|----------------------|
| Service renamed "RCVG" → "Receiving" | ❌ Breaks | ✅ Works (`/receiv/i` matches) |
| New service "Inbound Processing" added | ❌ Requires code change | ✅ Works (`/inbound/i` matches) |
| Service code typo "RCVG" → "RCV" | ❌ Breaks | ✅ Works (name still matches) |
| Multiple receiving services exist | ❌ Undefined behavior | ✅ First match wins |

---

## Rate Calculation

### Rate Lookup Priority

```
1. Rate Override (user manually overrode the rate)
         ↓ (if not found)
2. Class-Specific Rate (rate for this service + this class)
         ↓ (if not found)
3. Default Rate (rate with class_code = NULL)
         ↓ (if not found)
4. Return $0 (graceful fallback)
```

### Rate Lookup Function

```typescript
function getApplicableRate(
  services: ServiceEvent[],
  patterns: RegExp[],
  classCode: string | null,
  overrides: RateOverride[]
): { rate: number; service: ServiceEvent | null } {
  // 1. Check for override
  const override = overrides.find(
    (o) => o.class_code === classCode || o.class_code === null
  );
  if (override) {
    const service = findMatchingService(services, patterns, classCode);
    return { rate: override.rate, service };
  }

  // 2. Try class-specific rate
  if (classCode) {
    const classService = findMatchingService(services, patterns, classCode);
    if (classService) {
      return { rate: classService.rate, service: classService };
    }
  }

  // 3. Fall back to default rate
  const defaultService = findMatchingService(services, patterns, null);
  if (defaultService) {
    return { rate: defaultService.rate, service: defaultService };
  }

  // 4. No rate found
  return { rate: 0, service: null };
}
```

---

## Component Interface

### Props Definition

```typescript
interface BillingCalculatorProps {
  // ═══════════════════════════════════════════════════════════════════════════
  // REQUIRED: Context Identification
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Type of parent context
   */
  contextType: 'shipment' | 'task' | 'delivery';

  /**
   * Context-specific data used to resolve billing configuration
   */
  contextData: {
    // For shipments
    direction?: 'inbound' | 'outbound';
    is_return?: boolean;

    // For tasks
    task_type?: 'Inspection' | 'Assembly' | 'Repair' | 'Disposal' | 'Will Call';
    selected_service_id?: string; // For Assembly/Repair - specific service from dropdown
    hours?: number; // For hourly billing (Repair)
    quantity?: number; // For quantity billing (Assembly)

    // For delivery (future)
    delivery_type?: 'local' | 'white_glove';
  };

  /**
   * Items to calculate billing for
   * Each item should have a class_code for rate lookup
   */
  items: Array<{
    id: string;
    class_code: string | null;
    quantity: number;
  }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Rate Overrides
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * User-defined rate overrides
   * These take precedence over Price List rates
   */
  rateOverrides?: Array<{
    class_code: string | null;
    rate: number;
  }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Custom Charges
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Additional custom charges (misc fees, rush charges, etc.)
   */
  customCharges?: Array<{
    id: string;
    description: string;
    amount: number;
  }>;

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Tax Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Whether to calculate and display tax
   */
  showTax?: boolean;

  /**
   * Tax rate percentage (e.g., 8.25 for 8.25%)
   */
  taxRate?: number;

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Callbacks
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Called when user overrides a rate
   */
  onRateOverride?: (classCode: string | null, newRate: number) => void;

  /**
   * Called when user adds a custom charge
   */
  onAddCustomCharge?: (description: string, amount: number) => void;

  /**
   * Called when user removes a custom charge
   */
  onRemoveCustomCharge?: (chargeId: string) => void;

  /**
   * Called whenever calculation changes (for parent to track totals)
   */
  onCalculationChange?: (calculation: BillingCalculation) => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIONAL: Display Options
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Whether the calculator is read-only (no edit/add buttons)
   */
  readOnly?: boolean;

  /**
   * Compact mode for smaller UI footprint
   */
  compact?: boolean;
}
```

### Calculation Result Type

```typescript
interface BillingCalculation {
  /**
   * Individual line items (one per class with charges)
   */
  lineItems: Array<{
    service_name: string;
    service_code: string;
    class_code: string | null;
    class_name: string | null;
    quantity: number;
    rate: number;
    total: number;
    is_override: boolean;
  }>;

  /**
   * Custom charges added by user
   */
  customCharges: Array<{
    id: string;
    description: string;
    amount: number;
  }>;

  /**
   * Totals
   */
  subtotal: number;
  customChargesTotal: number;
  preTaxTotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;

  /**
   * Metadata
   */
  context: string; // e.g., 'shipment_inbound'
  serviceFound: boolean; // Whether a matching service was found
  hasRateErrors: boolean; // Whether any items had $0 rate (missing rate)
}
```

---

## UI Features

### Compact Display

```
┌─────────────────────────────────────────────────────────┐
│ Billing Charges                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Receiving (M) ×3        $15.00    $45.00    [✎]       │
│  Receiving (L) ×2        $15.00    $30.00    [✎]       │
│  Receiving (XL) ×1       $20.00    $20.00    [✎]       │
│  ─────────────────────────────────────────────────      │
│  Rush Processing         $50.00    $50.00    [✗]       │
│                          ─────────────────────          │
│                          Subtotal:    $145.00           │
│                          Tax (8.25%):  $11.96           │
│                          ─────────────────────          │
│                          TOTAL:       $156.96           │
│                                                         │
│  [+ Add Charge]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Interactive Features

| Feature | Description |
|---------|-------------|
| **Rate Override** | Click [✎] to manually adjust the rate for a line item |
| **Add Custom Charge** | Click [+ Add Charge] to add miscellaneous charges |
| **Remove Custom Charge** | Click [✗] to remove a custom charge |
| **Real-Time Calculation** | Totals update immediately on any change |

### Rate Override Dialog

```
┌──────────────────────────────────────┐
│ Override Rate                        │
├──────────────────────────────────────┤
│                                      │
│ Service: Receiving                   │
│ Class: Medium (M)                    │
│                                      │
│ Current Rate: $15.00                 │
│                                      │
│ New Rate: [___________]              │
│                                      │
│        [Cancel]  [Apply Override]    │
│                                      │
└──────────────────────────────────────┘
```

### Add Charge Dialog

```
┌──────────────────────────────────────┐
│ Add Custom Charge                    │
├──────────────────────────────────────┤
│                                      │
│ Description: [___________________]   │
│                                      │
│ Amount: $[___________]               │
│                                      │
│          [Cancel]  [Add Charge]      │
│                                      │
└──────────────────────────────────────┘
```

---

## File Structure

```
src/
├── components/
│   └── billing/
│       ├── BillingCalculator.tsx        # Main component
│       ├── BillingCalculatorLineItem.tsx # Line item row
│       ├── RateOverrideDialog.tsx       # Rate override modal
│       └── AddChargeDialog.tsx          # Add custom charge modal
│
├── hooks/
│   └── useBillingCalculator.ts          # Data fetching & calculation hook
│
└── lib/
    └── billing/
        ├── calculatorConfig.ts          # Context → billing trigger mapping
        ├── calculatorTypes.ts           # TypeScript types
        └── calculatorUtils.ts           # Helper functions
```

---

## Adding New Contexts

### Example: Adding Delivery Context

**Step 1: Add to calculatorConfig.ts**

```typescript
export const BILLING_CALCULATOR_CONFIG = {
  // ... existing configs ...

  // NEW: Delivery contexts
  delivery_local: {
    billing_triggers: ['Delivery'],
    service_patterns: [/local.?deliver/i, /same.?day/i],
    label: 'Local Delivery',
    quantity_source: 'items',
  },

  delivery_white_glove: {
    billing_triggers: ['Delivery'],
    service_patterns: [/white.?glove/i, /premium/i],
    label: 'White Glove Delivery',
    quantity_source: 'items',
  },
};
```

**Step 2: Add context resolution**

```typescript
// In resolveContext function
if (contextType === 'delivery') {
  if (contextData.delivery_type === 'white_glove') return 'delivery_white_glove';
  return 'delivery_local';
}
```

**Step 3: Add services to Price List**

In the Price List (service_events table), add:
- Service with `billing_trigger: 'Delivery'`
- Service name matching patterns (e.g., "Local Delivery", "White Glove Delivery")
- Class-specific rates as needed

**Step 4: Use in Delivery component**

```tsx
<BillingCalculator
  contextType="delivery"
  contextData={{ delivery_type: 'white_glove' }}
  items={deliveryItems}
/>
```

**No code changes needed in BillingCalculator component!**

---

## Relationship to Other Systems

### Comparison Chart

| Aspect | Billing Calculator | Quote Tool | Billing Events |
|--------|-------------------|------------|----------------|
| **Purpose** | Visual confirmation | Create estimates | Record charges |
| **When Used** | Real-time in forms | Standalone page | On service completion |
| **Data Source** | `service_events` | `service_events` | `billing_events` |
| **Creates Records** | No | Yes (quotes table) | Yes (billing_events) |
| **Service Lookup** | Pattern matching | Pattern matching | Direct code reference |
| **Rate Overrides** | Temporary (display only) | Saved per quote | N/A |

### Data Flow Relationship

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  BILLING         │     │  QUOTE           │     │  BILLING         │
│  CALCULATOR      │     │  TOOL            │     │  EVENTS          │
│                  │     │                  │     │                  │
│  Visual preview  │     │  Estimates for   │     │  Actual charges  │
│  of expected     │     │  customers       │     │  for invoicing   │
│  charges         │     │                  │     │                  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVICE_EVENTS (Price List)                      │
│                                                                      │
│  Single source of truth for all service rates and billing triggers  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary

The Billing Calculator provides:

1. **Real-time billing preview** embedded in shipment/task forms
2. **Dynamic service lookup** using `billing_trigger` + pattern matching
3. **Rate override capability** for manual adjustments
4. **Custom charge support** for miscellaneous fees
5. **Extensible architecture** - new contexts added via configuration
6. **No hardcoded service codes** - adapts to Price List changes automatically

### Key Files

| File | Purpose |
|------|---------|
| `docs/BILLING_CALCULATOR_DOCUMENTATION.md` | This documentation |
| `docs/BILLING_SYSTEM_DOCUMENTATION.md` | Billing events system |
| `docs/QUOTE_TOOL_DOCUMENTATION.md` | Quote tool reference |
| `src/components/billing/BillingCalculator.tsx` | Component (to be built) |
| `src/hooks/useBillingCalculator.ts` | Hook (to be built) |
| `src/lib/billing/calculatorConfig.ts` | Configuration (to be built) |

---

*Document generated: January 30, 2026*
*Stride WMS Version: Current*
