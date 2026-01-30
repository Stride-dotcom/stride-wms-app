# Stride WMS Billing Calculator Documentation

## Overview

The **Billing Calculator** is a reusable component that provides real-time billing charge previews for shipments and tasks. It uses the **same calculation logic** as actual billing event creation, guaranteeing the preview shows exactly what will appear in Billing Reports once triggered.

**Key Principle**: The Calculator previews non-triggered billing events using the same mappings and rate lookup functions that create actual billing events.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Architecture Overview](#architecture-overview)
3. [Shared Calculation Logic](#shared-calculation-logic)
4. [Service Code Mappings](#service-code-mappings)
5. [Rate Lookup](#rate-lookup)
6. [Data Flow](#data-flow)
7. [Component Interface](#component-interface)
8. [Usage Examples](#usage-examples)
9. [File Locations](#file-locations)
10. [Relationship to Billing Events](#relationship-to-billing-events)

---

## Design Philosophy

### The Core Insight

The billing system already knows:
- **Task Type → Service Code**: Inspection → INSP, Assembly → 15MA, etc.
- **Shipment Direction → Service Code**: Inbound → RCVG, Outbound → Shipping
- **Rate Lookup**: Service Code + Class Code → Rate from Price List

The **Billing Calculator** doesn't need separate calculation logic. It uses the **exact same logic** that creates billing events, but returns results for display instead of inserting into the database.

### Same Logic, Different Output

| Billing Event Creation | Billing Calculator |
|------------------------|-------------------|
| Calculate → **INSERT** into `billing_events` | Calculate → **RETURN** for display |
| Runs when task/shipment completes | Runs anytime (real-time preview) |
| Creates database records | Just shows the numbers |

### Benefits

1. **Guaranteed Accuracy**: Calculator shows exactly what Billing Reports will show
2. **Single Source of Truth**: Mappings defined once, used everywhere
3. **No Maintenance Overhead**: Changes to billing logic automatically reflected in Calculator
4. **No Hardcoded Values in UI**: All service codes come from shared module

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BILLING CALCULATOR ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │      src/lib/billing/billingCalculation.ts      │
                    │      (SHARED CALCULATION LOGIC)       │
                    ├──────────────────────────────────────┤
                    │                                      │
                    │  • TASK_TYPE_TO_SERVICE_CODE         │
                    │  • SHIPMENT_DIRECTION_TO_SERVICE_CODE│
                    │  • getRateFromPriceList()            │
                    │  • calculateTaskBillingPreview()     │
                    │  • calculateShipmentBillingPreview() │
                    │                                      │
                    └──────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │ BillingCalculator │ │ useTasks.ts       │ │ useOutbound.ts    │
        │ (Preview)         │ │ (Task Completion) │ │ (Shipment Done)   │
        │                   │ │                   │ │                   │
        │ Returns preview   │ │ Creates billing   │ │ Creates billing   │
        │ for display       │ │ events            │ │ events            │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
```

---

## Shared Calculation Logic

The shared module lives at: `src/lib/billing/billingCalculation.ts`

### Exported Functions

| Function | Purpose |
|----------|---------|
| `TASK_TYPE_TO_SERVICE_CODE` | Maps task types to service codes |
| `SHIPMENT_DIRECTION_TO_SERVICE_CODE` | Maps shipment directions to service codes |
| `getRateFromPriceList()` | Looks up rate from service_events table |
| `calculateTaskBillingPreview()` | Preview billing for a task |
| `calculateShipmentBillingPreview()` | Preview billing for a shipment |
| `getAssemblyServices()` | Get assembly services for dropdown |
| `getRepairServiceRate()` | Get repair service rate |

---

## Service Code Mappings

### Task Type → Service Code

```typescript
export const TASK_TYPE_TO_SERVICE_CODE: Record<string, string> = {
  'Inspection': 'INSP',
  'Will Call': 'Will_Call',
  'Disposal': 'Disposal',
  'Assembly': '15MA',    // Default - can be overridden per task
  'Repair': '1HRO',      // Default - can be overridden per task
  'Receiving': 'RCVG',
  'Returns': 'Returns',
};
```

### Shipment Direction → Service Code

```typescript
export const SHIPMENT_DIRECTION_TO_SERVICE_CODE: Record<string, string> = {
  'inbound': 'RCVG',
  'outbound': 'Shipping',
  'return': 'Returns',
};
```

These mappings are the **single source of truth** - used by both the Calculator and actual billing event creation.

---

## Rate Lookup

### Priority Chain

```
1. Class-Specific Rate (service_code + class_code)
         ↓ (if not found)
2. General Rate (service_code + class_code = NULL)
         ↓ (if not found)
3. Return $0 with error flag
```

### Function Signature

```typescript
async function getRateFromPriceList(
  tenantId: string,
  serviceCode: string,
  classCode: string | null
): Promise<RateLookupResult>
```

### Return Type

```typescript
interface RateLookupResult {
  rate: number;
  serviceName: string;
  serviceCode: string;
  billingUnit: 'Day' | 'Item' | 'Task';
  alertRule: string;
  hasError: boolean;
  errorMessage?: string;
}
```

---

## Data Flow

### Task Billing Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ calculateTaskBillingPreview(tenantId, taskId, taskType, overrides...)       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Determine service code                                                  │
│     serviceCode = overrideServiceCode || TASK_TYPE_TO_SERVICE_CODE[taskType]│
│                                                                             │
│  2. Fetch task items with class info                                        │
│     SELECT * FROM task_items                                                │
│     JOIN items ON items.id = task_items.item_id                            │
│     JOIN classes ON classes.id = items.class_id                            │
│                                                                             │
│  3. For each item:                                                          │
│     a. Get class code                                                       │
│     b. Call getRateFromPriceList(tenantId, serviceCode, classCode)         │
│     c. Calculate: quantity × rate                                           │
│                                                                             │
│  4. Return BillingPreview                                                   │
│     { lineItems[], subtotal, hasErrors, serviceCode, serviceName }         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Shipment Billing Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ calculateShipmentBillingPreview(tenantId, shipmentId, direction)            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Determine service code                                                  │
│     serviceCode = SHIPMENT_DIRECTION_TO_SERVICE_CODE[direction]            │
│                                                                             │
│  2. Fetch shipment items with class info                                    │
│     SELECT * FROM shipment_items                                            │
│     JOIN items ON items.id = shipment_items.item_id                        │
│     JOIN classes ON classes.id = items.class_id                            │
│                                                                             │
│  3. For each item:                                                          │
│     a. Get class code                                                       │
│     b. Call getRateFromPriceList(tenantId, serviceCode, classCode)         │
│     c. Calculate: quantity × rate                                           │
│                                                                             │
│  4. Return BillingPreview                                                   │
│     { lineItems[], subtotal, hasErrors, serviceCode, serviceName }         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Interface

### Props

```typescript
interface BillingCalculatorProps {
  // Context - provide ONE of these
  taskId?: string;
  shipmentId?: string;

  // Context details
  taskType?: string;
  shipmentDirection?: 'inbound' | 'outbound' | 'return';

  // For Assembly/Repair - manual service selection
  selectedServiceCode?: string | null;
  billingQuantity?: number | null;
  billingRate?: number | null;

  // Callbacks for Assembly/Repair
  onServiceChange?: (serviceCode: string | null) => void;
  onQuantityChange?: (quantity: number) => void;
  onRateChange?: (rate: number | null) => void;
  onTotalChange?: (total: number) => void;

  // Existing billing events (add-ons already created)
  existingCharges?: Array<{
    id: string;
    charge_type: string;
    description: string | null;
    quantity: number;
    unit_rate: number;
    total_amount: number;
  }>;

  // Refresh trigger
  refreshKey?: number;

  // Display options
  title?: string;
  compact?: boolean;
  readOnly?: boolean;
}
```

### Return Value (via onTotalChange callback)

The component calls `onTotalChange(grandTotal)` whenever the total changes, allowing parent components to track the calculated billing amount.

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
<BillingCalculator
  taskId={task.id}
  taskType="Assembly"
  selectedServiceCode={selectedAssemblyService}
  billingQuantity={assemblyQuantity}
  billingRate={overrideRate}
  onServiceChange={setSelectedAssemblyService}
  onQuantityChange={setAssemblyQuantity}
  onRateChange={setOverrideRate}
  onTotalChange={setEstimatedBilling}
/>
```

### Task (Repair with Hours)

```tsx
<BillingCalculator
  taskId={task.id}
  taskType="Repair"
  billingQuantity={repairHours}
  billingRate={overrideRate}
  onQuantityChange={setRepairHours}
  onRateChange={setOverrideRate}
  onTotalChange={setEstimatedBilling}
/>
```

---

## File Locations

| Purpose | File Path |
|---------|-----------|
| **Shared Calculation Logic** | `src/lib/billing/billingCalculation.ts` |
| **BillingCalculator Component** | `src/components/billing/BillingCalculator.tsx` |
| **Billing Event Creation** | `src/lib/billing/createBillingEvent.ts` |
| **Task Completion (uses shared logic)** | `src/hooks/useTasks.ts` |
| **Shipment Completion (uses shared logic)** | `src/hooks/useOutbound.ts` |
| **This Documentation** | `docs/BILLING_CALCULATOR_DOCUMENTATION.md` |

---

## Relationship to Billing Events

### How They Connect

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER CREATES TASK                               │
│                                    │                                        │
│                                    ▼                                        │
│              ┌─────────────────────────────────────────┐                   │
│              │ Task Form with BillingCalculator        │                   │
│              │                                         │                   │
│              │ BillingCalculator shows:                │                   │
│              │ "Inspection (M) ×3 @ $35 = $105"       │                   │
│              │                                         │                   │
│              │ This is a PREVIEW - no billing event   │                   │
│              │ exists yet in the database             │                   │
│              └─────────────────────────────────────────┘                   │
│                                    │                                        │
│                                    │ User clicks "Complete Task"            │
│                                    ▼                                        │
│              ┌─────────────────────────────────────────┐                   │
│              │ useTasks.ts → completeTask()            │                   │
│              │                                         │                   │
│              │ Uses SAME logic from billingCalculation.ts                  │
│              │ createBillingEvent({                    │                   │
│              │   charge_type: 'INSP',                  │                   │
│              │   unit_rate: 35,                        │                   │
│              │   quantity: 3,                          │                   │
│              │   total_amount: 105                     │                   │
│              │ })                                      │                   │
│              └─────────────────────────────────────────┘                   │
│                                    │                                        │
│                                    ▼                                        │
│              ┌─────────────────────────────────────────┐                   │
│              │ billing_events table                    │                   │
│              │                                         │                   │
│              │ Now the billing event EXISTS            │                   │
│              │ Appears in Billing Reports              │                   │
│              └─────────────────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Works

1. **Calculator** calls `calculateTaskBillingPreview()` → returns preview
2. **Task completion** uses same `TASK_TYPE_TO_SERVICE_CODE` mapping and `getRateFromPriceList()` → creates billing event
3. **Both use the same logic** → Calculator preview matches actual billing event

---

## Summary

The Billing Calculator is designed to:

1. **Preview billing charges** before they're triggered
2. **Use the same logic** as actual billing event creation
3. **Guarantee accuracy** - what you see is what you get
4. **Support all contexts** - tasks, shipments, and future services
5. **Allow overrides** - for Assembly/Repair with manual quantity/rate

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/billing/billingCalculation.ts` | Shared calculation logic (THE source of truth) |
| `src/components/billing/BillingCalculator.tsx` | UI component |
| `src/hooks/useTasks.ts` | Uses shared logic for task billing events |
| `src/hooks/useOutbound.ts` | Uses shared logic for shipment billing events |

---

*Document updated: January 30, 2026*
*Stride WMS Version: Current*
