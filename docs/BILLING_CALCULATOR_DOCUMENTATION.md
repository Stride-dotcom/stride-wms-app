# Stride WMS Billing Calculator Documentation

## Overview

The **Billing Calculator** is a reusable component that provides real-time billing charge previews for shipments, tasks, and any future order types (delivery, transfers, etc.). It uses the **same calculation logic** as actual billing event creation, guaranteeing the preview shows exactly what will appear in Billing Reports once triggered.

**Key Principle**: The Calculator previews non-triggered billing events using the same mappings and rate lookup functions that create actual billing events. This ensures what the user sees is exactly what they'll be billed.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Architecture Overview](#architecture-overview)
3. [Core Files and Their Purpose](#core-files-and-their-purpose)
4. [Service Code Mappings](#service-code-mappings)
5. [Rate Lookup Function](#rate-lookup-function)
6. [Preview Calculation Functions](#preview-calculation-functions)
7. [BillingCalculator Component](#billingcalculator-component)
8. [How Everything Connects](#how-everything-connects)
9. [Adding New Order Types](#adding-new-order-types)
10. [Usage Examples](#usage-examples)
11. [Troubleshooting](#troubleshooting)

---

## Design Philosophy

### The Problem We Solved

Previously, the billing calculator had:
- Hardcoded service codes that broke when services were renamed
- Pattern matching that tried to guess which service to use
- Separate logic from actual billing, causing mismatches

### The Solution

The billing system already knows:
- **Task Type → Service Code**: Inspection → INSP, Assembly → 15MA, etc.
- **Shipment Direction → Service Code**: Inbound → RCVG, Outbound → Shipping
- **Rate Lookup**: Service Code + Class Code → Rate from Price List

We extracted this logic into a **shared module** that both the Calculator and billing event creation use.

### Same Logic, Different Output

| Billing Event Creation | Billing Calculator |
|------------------------|-------------------|
| Calculate → **INSERT** into `billing_events` | Calculate → **RETURN** for display |
| Runs when task/shipment completes | Runs anytime (real-time preview) |
| Creates database records | Just shows the numbers |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE                                    │
└─────────────────────────────────────────────────────────────────────────────┘

                         PRICE LIST (service_events table)
                         ┌─────────────────────────────────┐
                         │ service_code │ class_code │ rate│
                         │ RCVG         │ M          │ $15 │
                         │ RCVG         │ L          │ $20 │
                         │ INSP         │ M          │ $35 │
                         │ Shipping     │ M          │ $15 │
                         │ 15MA         │ NULL       │ $35 │
                         │ 1HRO         │ NULL       │ $105│
                         └─────────────────────────────────┘
                                        │
                                        ▼
                    ┌──────────────────────────────────────┐
                    │  src/lib/billing/billingCalculation.ts│
                    │  ════════════════════════════════════ │
                    │                                       │
                    │  MAPPINGS:                            │
                    │  • TASK_TYPE_TO_SERVICE_CODE          │
                    │  • SHIPMENT_DIRECTION_TO_SERVICE_CODE │
                    │                                       │
                    │  FUNCTIONS:                           │
                    │  • getRateFromPriceList()             │
                    │  • calculateTaskBillingPreview()      │
                    │  • calculateShipmentBillingPreview()  │
                    │  • getAssemblyServices()              │
                    │  • getRepairServiceRate()             │
                    │                                       │
                    └──────────────────────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
              ▼                         ▼                         ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│ BillingCalculator.tsx   │ │ useTasks.ts             │ │ useOutbound.ts          │
│ (Preview Component)     │ │ (Task Completion)       │ │ (Shipment Completion)   │
│                         │ │                         │ │                         │
│ Shows billing preview   │ │ Creates billing events  │ │ Creates billing events  │
│ BEFORE task completes   │ │ WHEN task completes     │ │ WHEN shipment completes │
│                         │ │                         │ │                         │
│ Uses:                   │ │ Uses:                   │ │ Uses:                   │
│ • calculateTask...()    │ │ • TASK_TYPE_TO_SERVICE  │ │ • SHIPMENT_DIRECTION... │
│ • calculateShipment...()│ │ • getRateFromPriceList  │ │ • getRateFromPriceList  │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
              │                         │                         │
              ▼                         ▼                         ▼
      [Display to User]         [billing_events table]    [billing_events table]
```

---

## Core Files and Their Purpose

### File: `src/lib/billing/billingCalculation.ts`

**This is the heart of the billing system.** All billing logic lives here.

| Export | Type | Purpose |
|--------|------|---------|
| `TASK_TYPE_TO_SERVICE_CODE` | Constant | Maps task types to service codes |
| `SHIPMENT_DIRECTION_TO_SERVICE_CODE` | Constant | Maps shipment directions to service codes |
| `getRateFromPriceList()` | Function | Looks up rate from Price List |
| `calculateTaskBillingPreview()` | Function | Calculates billing preview for a task |
| `calculateShipmentBillingPreview()` | Function | Calculates billing preview for a shipment |
| `getAssemblyServices()` | Function | Gets assembly service options for dropdown |
| `getRepairServiceRate()` | Function | Gets repair hourly rate |

### File: `src/components/billing/BillingCalculator.tsx`

**The UI component** that displays billing previews. It:
- Receives context (task ID, shipment ID, type)
- Calls the appropriate preview function
- Displays the calculated charges
- Allows rate overrides for Assembly/Repair

### File: `src/lib/billing/createBillingEvent.ts`

**Creates actual billing events** in the database. Used when tasks/shipments complete.

### File: `src/hooks/useTasks.ts`

**Handles task operations.** When a task completes, it uses `TASK_TYPE_TO_SERVICE_CODE` to determine what to bill.

### File: `src/hooks/useOutbound.ts`

**Handles shipment operations.** When a shipment completes, it uses `SHIPMENT_DIRECTION_TO_SERVICE_CODE` to determine what to bill.

---

## Service Code Mappings

### TASK_TYPE_TO_SERVICE_CODE

This mapping tells the system: "When this type of task completes, bill using this service code."

```typescript
export const TASK_TYPE_TO_SERVICE_CODE: Record<string, string> = {
  'Inspection': 'INSP',      // Inspection task → INSP service
  'Will Call': 'Will_Call',  // Will Call task → Will_Call service
  'Disposal': 'Disposal',    // Disposal task → Disposal service
  'Assembly': '15MA',        // Assembly task → 15MA (default, can be overridden)
  'Repair': '1HRO',          // Repair task → 1HRO (hourly repair)
  'Receiving': 'RCVG',       // Receiving task → RCVG service
  'Returns': 'Returns',      // Returns task → Returns service
};
```

**How to add a new task type:**
```typescript
// Example: Adding a "Reupholstery" task type
'Reupholstery': 'REUP',  // Maps to REUP service in Price List
```

### SHIPMENT_DIRECTION_TO_SERVICE_CODE

This mapping tells the system: "When this type of shipment completes, bill using this service code."

```typescript
export const SHIPMENT_DIRECTION_TO_SERVICE_CODE: Record<string, string> = {
  'inbound': 'RCVG',      // Inbound shipment → RCVG (Receiving)
  'outbound': 'Shipping', // Outbound shipment → Shipping service
  'return': 'Returns',    // Return shipment → Returns service
};
```

---

## Rate Lookup Function

### `getRateFromPriceList()`

This is the **core rate lookup function**. It finds the rate for a service code and class.

```typescript
async function getRateFromPriceList(
  tenantId: string,
  serviceCode: string,
  classCode: string | null
): Promise<RateLookupResult>
```

### Lookup Priority

```
1. Class-Specific Rate
   → Look for: service_code = 'RCVG' AND class_code = 'M'
   → If found: return $15
         ↓ (if not found)

2. General Rate (fallback)
   → Look for: service_code = 'RCVG' AND class_code = NULL
   → If found: return default rate
         ↓ (if not found)

3. Return $0 with error flag
   → hasError = true
   → errorMessage = "No rate found for service: RCVG"
```

### Return Type

```typescript
interface RateLookupResult {
  rate: number;           // The rate amount (e.g., 15.00)
  serviceName: string;    // Display name (e.g., "Receiving")
  serviceCode: string;    // Service code (e.g., "RCVG")
  billingUnit: string;    // 'Day' | 'Item' | 'Task'
  alertRule: string;      // Alert rule from Price List
  hasError: boolean;      // True if rate not found
  errorMessage?: string;  // Error description if hasError
}
```

---

## Preview Calculation Functions

### `calculateTaskBillingPreview()`

Calculates billing preview for a task.

```typescript
async function calculateTaskBillingPreview(
  tenantId: string,
  taskId: string,
  taskType: string,
  overrideServiceCode?: string | null,  // For Assembly - specific service
  overrideQuantity?: number | null,     // For Assembly/Repair - qty
  overrideRate?: number | null          // Manual rate override
): Promise<BillingPreview>
```

**How it works:**

```
1. Determine service code
   └─ Use overrideServiceCode if provided
   └─ Otherwise: TASK_TYPE_TO_SERVICE_CODE[taskType]

2. Fetch task items
   └─ SELECT * FROM task_items WHERE task_id = ?
   └─ JOIN items to get class_id
   └─ JOIN classes to get class code

3. For Assembly/Repair with quantity:
   └─ Single line item: quantity × rate

4. For per-item tasks (Inspection, etc.):
   └─ For each item:
      └─ Get class code
      └─ getRateFromPriceList(serviceCode, classCode)
      └─ Add: quantity × rate

5. Return BillingPreview
   └─ lineItems[], subtotal, hasErrors
```

### `calculateShipmentBillingPreview()`

Calculates billing preview for a shipment.

```typescript
async function calculateShipmentBillingPreview(
  tenantId: string,
  shipmentId: string,
  direction: 'inbound' | 'outbound' | 'return'
): Promise<BillingPreview>
```

**How it works:**

```
1. Determine service code
   └─ SHIPMENT_DIRECTION_TO_SERVICE_CODE[direction]
   └─ inbound → 'RCVG'
   └─ outbound → 'Shipping'

2. Fetch shipment items
   └─ SELECT * FROM shipment_items WHERE shipment_id = ?
   └─ JOIN items to get class_id
   └─ JOIN classes to get class code

3. For each item:
   └─ Get class code
   └─ getRateFromPriceList(serviceCode, classCode)
   └─ quantity = quantity_received || quantity_expected
   └─ Add: quantity × rate

4. Return BillingPreview
   └─ lineItems[], subtotal, hasErrors
```

### Return Type: `BillingPreview`

```typescript
interface BillingPreview {
  lineItems: BillingLineItem[];  // Individual charges
  subtotal: number;              // Total of all line items
  hasErrors: boolean;            // True if any rate lookup failed
  serviceCode: string;           // Primary service code used
  serviceName: string;           // Display name of service
}

interface BillingLineItem {
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
```

---

## BillingCalculator Component

### Location

`src/components/billing/BillingCalculator.tsx`

### Props

```typescript
interface BillingCalculatorProps {
  // ══════════════════════════════════════════════════════════
  // CONTEXT - Provide ONE of these
  // ══════════════════════════════════════════════════════════
  taskId?: string;              // For task billing preview
  shipmentId?: string;          // For shipment billing preview

  // ══════════════════════════════════════════════════════════
  // CONTEXT DETAILS
  // ══════════════════════════════════════════════════════════
  taskType?: string;            // 'Inspection', 'Assembly', etc.
  shipmentDirection?: 'inbound' | 'outbound' | 'return';

  // ══════════════════════════════════════════════════════════
  // FOR ASSEMBLY/REPAIR - Manual inputs
  // ══════════════════════════════════════════════════════════
  selectedServiceCode?: string; // Selected assembly tier (5MA, 15MA, etc.)
  billingQuantity?: number;     // Quantity or hours
  billingRate?: number;         // Rate override

  // ══════════════════════════════════════════════════════════
  // CALLBACKS
  // ══════════════════════════════════════════════════════════
  onServiceChange?: (code: string) => void;
  onQuantityChange?: (qty: number) => void;
  onRateChange?: (rate: number | null) => void;
  onTotalChange?: (total: number) => void;

  // ══════════════════════════════════════════════════════════
  // EXISTING CHARGES (add-ons from billing_events)
  // ══════════════════════════════════════════════════════════
  existingCharges?: Array<{
    id: string;
    charge_type: string;
    description: string | null;
    quantity: number;
    unit_rate: number;
    total_amount: number;
  }>;

  // ══════════════════════════════════════════════════════════
  // DISPLAY OPTIONS
  // ══════════════════════════════════════════════════════════
  title?: string;               // Card title (default: "Billing Charges")
  compact?: boolean;            // Compact mode (default: true)
  readOnly?: boolean;           // Disable editing
  refreshKey?: number;          // Increment to force refresh
}
```

### Component Behavior

| Task Type | Behavior |
|-----------|----------|
| **Inspection, Will Call, Disposal** | Per-item billing based on item classes |
| **Assembly** | Dropdown to select service tier + quantity input |
| **Repair** | Hours input × hourly rate |
| **Shipment (inbound)** | Per-item billing using RCVG rates |
| **Shipment (outbound)** | Per-item billing using Shipping rates |

---

## How Everything Connects

### Complete Flow: Task Creation to Billing Report

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Creates Inspection Task                                        │
│ ─────────────────────────────────────                                       │
│                                                                             │
│ Task Form shows BillingCalculator:                                          │
│ ┌─────────────────────────────────────────┐                                │
│ │ Billing Charges                         │                                │
│ │                                         │                                │
│ │ Inspection (M) ×3    $35.00    $105.00 │                                │
│ │ Inspection (L) ×2    $55.00    $110.00 │                                │
│ │ ─────────────────────────────────────── │                                │
│ │ Total:                         $215.00 │                                │
│ └─────────────────────────────────────────┘                                │
│                                                                             │
│ Behind the scenes:                                                          │
│ 1. BillingCalculator receives taskId + taskType="Inspection"               │
│ 2. Calls calculateTaskBillingPreview(tenantId, taskId, "Inspection")       │
│ 3. Function looks up TASK_TYPE_TO_SERVICE_CODE["Inspection"] = "INSP"      │
│ 4. Fetches task items with classes                                          │
│ 5. For each item: getRateFromPriceList("INSP", classCode)                  │
│ 6. Returns preview with line items                                          │
│                                                                             │
│ NOTE: No billing event exists yet - this is just a PREVIEW                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Completes Task                                                  │
│ ───────────────────────────                                                 │
│                                                                             │
│ useTasks.ts → completeTask() is called                                      │
│                                                                             │
│ 1. Determines service code:                                                 │
│    serviceCode = TASK_TYPE_TO_SERVICE_CODE["Inspection"] = "INSP"          │
│                                                                             │
│ 2. For each task item:                                                      │
│    - Gets class code from item                                              │
│    - Calls getRateFromPriceList("INSP", classCode)                         │
│    - Creates billing event:                                                 │
│      createBillingEvent({                                                   │
│        charge_type: "INSP",                                                 │
│        unit_rate: 35.00,                                                    │
│        quantity: 3,                                                         │
│        total_amount: 105.00                                                 │
│      })                                                                     │
│                                                                             │
│ 3. billing_events table now has records                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Billing Reports Show the Charges                                    │
│ ─────────────────────────────────────────                                   │
│                                                                             │
│ Billing Reports page:                                                       │
│ - Queries billing_events table                                              │
│ - Shows same $215.00 that Calculator previewed                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────┐    │
│ │ Date       │ Service    │ Class │ Qty │ Rate   │ Amount  │ Status  │    │
│ │ Jan 30     │ Inspection │ M     │ 3   │ $35.00 │ $105.00 │ Unbilled│    │
│ │ Jan 30     │ Inspection │ L     │ 2   │ $55.00 │ $110.00 │ Unbilled│    │
│ └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Adding New Order Types

### Example: Adding Delivery Orders

Let's say you want to add a new "Delivery" order type with billing.

#### Step 1: Add Service to Price List

In the Price List (service_events table), add delivery services:

```
service_code: 'DLVR_LOCAL'
service_name: 'Local Delivery'
class_code: NULL (or per-class rates)
rate: 75.00
billing_trigger: 'Delivery'
```

#### Step 2: Add Mapping to billingCalculation.ts

```typescript
// Add new mapping for delivery
export const DELIVERY_TYPE_TO_SERVICE_CODE: Record<string, string> = {
  'local': 'DLVR_LOCAL',
  'white_glove': 'DLVR_WHITE',
  'freight': 'DLVR_FREIGHT',
};
```

#### Step 3: Create Preview Function

```typescript
/**
 * Calculate billing preview for a DELIVERY
 */
export async function calculateDeliveryBillingPreview(
  tenantId: string,
  deliveryId: string,
  deliveryType: 'local' | 'white_glove' | 'freight'
): Promise<BillingPreview> {
  // Determine service code
  const serviceCode = DELIVERY_TYPE_TO_SERVICE_CODE[deliveryType] || 'DLVR_LOCAL';

  // Fetch delivery items
  const { data: deliveryItems } = await supabase
    .from('delivery_items')
    .select(`
      item_id,
      quantity,
      items:item_id (
        item_code,
        class_id,
        classes:class_id (code, name)
      )
    `)
    .eq('delivery_id', deliveryId);

  // Calculate for each item
  const lineItems: BillingLineItem[] = [];
  let subtotal = 0;
  let hasErrors = false;

  for (const di of deliveryItems || []) {
    const classCode = di.items?.classes?.code || null;
    const rateResult = await getRateFromPriceList(tenantId, serviceCode, classCode);

    const totalAmount = (di.quantity || 1) * rateResult.rate;
    lineItems.push({
      itemId: di.item_id,
      itemCode: di.items?.item_code,
      classCode,
      className: di.items?.classes?.name,
      serviceCode: rateResult.serviceCode,
      serviceName: rateResult.serviceName,
      quantity: di.quantity || 1,
      unitRate: rateResult.rate,
      totalAmount,
      hasRateError: rateResult.hasError,
      errorMessage: rateResult.errorMessage,
    });

    subtotal += totalAmount;
    if (rateResult.hasError) hasErrors = true;
  }

  return { lineItems, subtotal, hasErrors, serviceCode, serviceName: 'Delivery' };
}
```

#### Step 4: Update BillingCalculator Component

Add support for the new delivery context:

```typescript
// In BillingCalculator.tsx

interface BillingCalculatorProps {
  // ... existing props ...
  deliveryId?: string;
  deliveryType?: 'local' | 'white_glove' | 'freight';
}

// In the calculation logic:
if (isDelivery && deliveryId) {
  result = await calculateDeliveryBillingPreview(
    profile.tenant_id,
    deliveryId,
    deliveryType
  );
}
```

#### Step 5: Use in Delivery Form

```tsx
<BillingCalculator
  deliveryId={delivery.id}
  deliveryType="white_glove"
  onTotalChange={(total) => setDeliveryBilling(total)}
/>
```

#### Step 6: Create Billing Events on Delivery Completion

In your delivery hook (e.g., `useDelivery.ts`):

```typescript
import { DELIVERY_TYPE_TO_SERVICE_CODE, getRateFromPriceList } from '@/lib/billing/billingCalculation';

async function completeDelivery(deliveryId: string, deliveryType: string) {
  const serviceCode = DELIVERY_TYPE_TO_SERVICE_CODE[deliveryType];

  // Fetch delivery items
  const items = await getDeliveryItems(deliveryId);

  // Create billing events
  for (const item of items) {
    const rate = await getRateFromPriceList(tenantId, serviceCode, item.classCode);

    await createBillingEvent({
      tenant_id: tenantId,
      account_id: delivery.account_id,
      event_type: 'delivery',
      charge_type: serviceCode,
      quantity: item.quantity,
      unit_rate: rate.rate,
      // ... other fields
    });
  }
}
```

### Checklist for Adding New Order Types

- [ ] Add services to Price List (service_events table)
- [ ] Add mapping constant to `billingCalculation.ts`
- [ ] Create `calculate[Type]BillingPreview()` function
- [ ] Update BillingCalculator component props and logic
- [ ] Update your hook to create billing events on completion
- [ ] Test that Calculator preview matches actual billing

---

## Usage Examples

### Shipment (Inbound)

```tsx
<BillingCalculator
  shipmentId={shipment.id}
  shipmentDirection="inbound"
  onTotalChange={(total) => setEstimatedBilling(total)}
/>
```

### Shipment (Outbound)

```tsx
<BillingCalculator
  shipmentId={shipment.id}
  shipmentDirection="outbound"
  onTotalChange={(total) => setEstimatedBilling(total)}
/>
```

### Task (Inspection)

```tsx
<BillingCalculator
  taskId={task.id}
  taskType="Inspection"
  onTotalChange={(total) => setEstimatedBilling(total)}
/>
```

### Task (Assembly with Service Selection)

```tsx
const [selectedService, setSelectedService] = useState('60MA');
const [quantity, setQuantity] = useState(1);
const [rateOverride, setRateOverride] = useState<number | null>(null);

<BillingCalculator
  taskId={task.id}
  taskType="Assembly"
  selectedServiceCode={selectedService}
  billingQuantity={quantity}
  billingRate={rateOverride}
  onServiceChange={setSelectedService}
  onQuantityChange={setQuantity}
  onRateChange={setRateOverride}
  onTotalChange={(total) => setBillingTotal(total)}
/>
```

### Task (Repair with Hours)

```tsx
const [hours, setHours] = useState(0);
const [rateOverride, setRateOverride] = useState<number | null>(null);

<BillingCalculator
  taskId={task.id}
  taskType="Repair"
  billingQuantity={hours}
  billingRate={rateOverride}
  onQuantityChange={setHours}
  onRateChange={setRateOverride}
  onTotalChange={(total) => setBillingTotal(total)}
/>
```

### With Existing Add-on Charges

```tsx
// Fetch existing billing events for this task
const existingCharges = billingEvents.filter(e => e.task_id === task.id);

<BillingCalculator
  taskId={task.id}
  taskType="Inspection"
  existingCharges={existingCharges}
  onTotalChange={(total) => setTotalWithAddons(total)}
/>
```

---

## Troubleshooting

### Calculator Shows $0

**Possible causes:**
1. No items attached to task/shipment
2. Service code not found in Price List
3. No rate defined for the item's class

**How to debug:**
1. Check browser console for errors
2. Verify items exist in `task_items` or `shipment_items`
3. Verify service exists in `service_events` with correct `service_code`
4. Check if class-specific or default rate exists

### Calculator Shows Wrong Rate

**Possible causes:**
1. Wrong service code in mapping
2. Class code mismatch
3. Rate not updated in Price List

**How to fix:**
1. Check `TASK_TYPE_TO_SERVICE_CODE` mapping
2. Verify item has correct class assigned
3. Check Price List for correct rates

### Preview Doesn't Match Billing Report

**This should never happen** if using the shared logic correctly.

**If it does:**
1. Ensure billing event creation uses same mappings from `billingCalculation.ts`
2. Check that both use `getRateFromPriceList()`
3. Verify no hardcoded service codes in the completion hook

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/billing/billingCalculation.ts` | **THE source of truth** - all mappings and rate lookup |
| `src/components/billing/BillingCalculator.tsx` | UI component for previews |
| `src/lib/billing/createBillingEvent.ts` | Creates actual billing events |
| `src/hooks/useTasks.ts` | Task completion → billing events |
| `src/hooks/useOutbound.ts` | Shipment completion → billing events |
| `docs/BILLING_CALCULATOR_DOCUMENTATION.md` | This documentation |
| `docs/BILLING_SYSTEM_DOCUMENTATION.md` | Overall billing system docs |
| `docs/QUOTE_TOOL_DOCUMENTATION.md` | Quote tool reference |

---

## Summary

The Billing Calculator works by:

1. **Using shared mappings** - `TASK_TYPE_TO_SERVICE_CODE`, `SHIPMENT_DIRECTION_TO_SERVICE_CODE`
2. **Using shared rate lookup** - `getRateFromPriceList()`
3. **Previewing without creating** - Shows what billing events will be
4. **Matching actual billing** - Same logic used when events are created

To add new order types:
1. Add services to Price List
2. Add mapping constant
3. Create preview function
4. Update component
5. Use same logic in completion hook

This ensures the Calculator always shows exactly what will be billed.

---

*Document updated: January 30, 2026*
*Stride WMS Version: Current*
