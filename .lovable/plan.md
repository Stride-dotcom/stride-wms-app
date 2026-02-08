

## Fix: QA Runner Not Creating `shipment_items` Junction Records

### Root Cause

The `validate_shipment_receiving_completion` RPC counts items via the `shipment_items` junction table:

```sql
SELECT COUNT(*) INTO v_item_count
FROM shipment_items
WHERE shipment_id = p_shipment_id;
```

However, the QA runner's "Create inbound shipment with items" test (Test 1) only creates `items` rows with `receiving_shipment_id` set on the items table. It **never inserts** corresponding rows into the `shipment_items` junction table.

This means the validator always sees zero items and returns the `NO_ITEMS` blocker.

### Fix

After creating each item in the receiving flow test (lines 178-196 of `qa-runner/index.ts`), insert a matching `shipment_items` record linking the item to the shipment.

### Changes

**File: `supabase/functions/qa-runner/index.ts`**

In the `runReceivingFlowTests` function, after each item is created and pushed to `itemIds`, add:

```typescript
// Link item to shipment via junction table
const { error: linkError } = await ctx.supabase
  .from('shipment_items')
  .insert({
    shipment_id: shipmentId,
    item_id: item.id,
    expected_quantity: 1,
    status: 'pending',
  });

if (linkError) throw new Error(`Failed to link item ${i + 1} to shipment: ${linkError.message}`);
```

This insert goes inside the existing `for` loop (after line 196), right after each item is created. This mirrors what the real application does in `ShipmentCreate` and `AddShipmentItemDialog` -- both create the item and then insert a `shipment_items` row.

No other files need to change. The validator RPC, the `ShipmentDetail` page, and `useShipments` hook are all correct. The issue is purely that the QA test data setup was incomplete.

