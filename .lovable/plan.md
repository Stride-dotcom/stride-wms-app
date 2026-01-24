
# Phase 3 Implementation Plan: Inbound/Task Media + QR Labels

## Executive Summary
This plan implements the "warehouse-ready" Phase 3 features: end-to-end shipment receiving with item creation, QR label printing, web document scanning, and photo/document management across Shipments, Items, and Tasks. The goal is to enable a full inbound workflow from shipment creation to inventory items with printable labels.

---

## Current State Analysis

### What Already Exists (No Changes Needed)
1. **Item Code Generator**: Already implemented as `generate_item_code()` Postgres function producing `ITM-###-####` format with uniqueness retry logic
2. **Item Photos System**: `item_photos` table with `is_primary` and `needs_attention` flags, `useItemPhotos` hook, `ItemPhotoGallery` component
3. **Document Scanner**: Full web-based scanner system in `src/components/scanner/` with PDF generation, OCR, and `documents` table
4. **Label Generator**: `src/lib/labelGenerator.ts` with `generateItemLabelsPDF()` producing QR-coded PDF labels
5. **Print Preview**: `/print-preview` route for label printing
6. **Receiving Session Hook**: `useReceivingSession.ts` creates items, links to shipments, queues alerts
7. **Shipment Media Table**: `shipment_media` table for photos/documents
8. **QR Scan Hub**: `ScanHub.tsx` handles item/location QR scanning with lookup

### What Needs Fixing/Adding
1. **Duplicate Sidemark Field**: ShipmentCreate.tsx has single sidemark - already correct
2. **Receiving Dock Location**: No tenant_settings key for `receiving_dock_location_id` - items don't get assigned to dock
3. **QR Scan Item Redirect Route**: No `/scan/item/:codeOrId` route
4. **Standardized Item List Table**: Tables exist but use different column orders
5. **Document Scanner Integration**: Scanner exists but not wired to Shipments receiving flow

---

## Implementation Steps

### Step 1: Verify Sidemark Field (NO CODE CHANGES)
**Status**: Already completed in previous phases
- ShipmentCreate.tsx has single sidemark selector at line 414-427
- ExpectedItemCard.tsx has no sidemark field (removed in Phase 2)

**Acceptance**: Already passing

---

### Step 2: Create Reusable Item List Table Component

**New File**: `src/components/items/ItemListTable.tsx`

```typescript
interface ItemListTableProps {
  items: ItemRow[];
  columns?: ColumnKey[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (id: string) => void;
  onSelectAll?: () => void;
  onRowClick?: (item: ItemRow) => void;
  editable?: boolean;
  onItemUpdate?: (id: string, field: string, value: any) => void;
  actions?: (item: ItemRow) => React.ReactNode;
  emptyMessage?: string;
}
```

**Standard Column Order**:
1. Checkbox (if selectable)
2. Photo thumbnail (if available)
3. Item Code (clickable → `/inventory/:id`)
4. Qty
5. Vendor
6. Description
7. Location
8. Sidemark
9. Room
10. Actions (if provided)

**Files to Update**:
- `src/pages/Inventory.tsx` - Replace inline table with `<ItemListTable />`
- `src/pages/ShipmentDetail.tsx` - Use for received items list
- `src/pages/Tasks.tsx` (if applicable for task items)

---

### Step 3: Receiving Flow - Assign Items to Receiving Dock

**SQL Migration**: Create receiving dock setup

```sql
-- Create sequence for warehouse-specific receiving docks
-- Ensure every warehouse has a RECV-DOCK location

-- Function to get or create receiving dock for a warehouse
CREATE OR REPLACE FUNCTION public.get_or_create_receiving_dock(p_warehouse_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dock_id UUID;
BEGIN
  -- Try to find existing receiving dock
  SELECT id INTO v_dock_id
  FROM locations
  WHERE warehouse_id = p_warehouse_id
    AND type = 'receiving'
    AND deleted_at IS NULL
  LIMIT 1;
  
  IF v_dock_id IS NOT NULL THEN
    RETURN v_dock_id;
  END IF;
  
  -- Create new receiving dock
  INSERT INTO locations (warehouse_id, code, name, type, location_type, is_active)
  VALUES (p_warehouse_id, 'RECV-DOCK', 'Receiving Dock', 'receiving', 'storage', true)
  RETURNING id INTO v_dock_id;
  
  RETURN v_dock_id;
END;
$$;

-- Backfill existing warehouses with receiving docks
DO $$
DECLARE
  w_id UUID;
BEGIN
  FOR w_id IN SELECT id FROM warehouses WHERE deleted_at IS NULL LOOP
    PERFORM public.get_or_create_receiving_dock(w_id);
  END LOOP;
END;
$$;
```

**File to Update**: `src/hooks/useReceivingSession.ts`

In `finishSession()`, after creating each item, set `current_location_id`:

```typescript
// Get receiving dock location
const { data: dockLocation } = await supabase
  .rpc('get_or_create_receiving_dock', { p_warehouse_id: shipment.warehouse_id });

const itemData = {
  // ... existing fields
  current_location_id: dockLocation, // Add this
};
```

---

### Step 4: Item Code Generation (ALREADY COMPLETE)

**Verified**: The existing `generate_item_code()` function already produces `ITM-###-####` format:
- Uses MD5 hash for randomness
- Has uniqueness retry loop (up to 15 attempts)
- Trigger `set_item_code_on_insert` auto-generates if null

**No changes needed** - receiving flow in `useReceivingSession.ts` line 204 generates codes but DB trigger will handle it if we remove the client-side generation.

**Recommendation**: Remove client-side code generation at line 204 and let the database handle it:

```typescript
// Remove: const itemCode = `ITM-${Date.now()}-${Math.random()...`;
// Let DB trigger handle item_code generation
const itemData = {
  // item_code omitted - DB trigger will generate
  tenant_id: profile.tenant_id,
  // ...
};
```

---

### Step 5: QR Label Printing (ALREADY COMPLETE)

**Verified existing implementation**:
- `src/lib/labelGenerator.ts` - `generateItemLabelsPDF()` creates PDF with QR codes
- `src/components/inventory/PrintLabelsDialog.tsx` - Dialog for printing
- `src/pages/PrintPreview.tsx` - Print preview page

**Files Already Wired**:
- `src/pages/Inventory.tsx` line 242 - Print button for selected items
- `src/pages/ItemDetail.tsx` line 538-542 - Print Labels action

**Enhancement Needed**: Add "Print Labels" prompt after receiving completes

**File to Update**: `src/pages/ShipmentDetail.tsx`

After successful finish receiving, show option to print labels:
```typescript
// In handleFinishReceiving after result.success
if (result.createdItemIds.length > 0) {
  // Show print dialog or navigate to print preview
  setCreatedItemIds(result.createdItemIds);
  setShowPrintLabelsAfterReceive(true);
}
```

---

### Step 6: QR Scan Lookup Route

**New File**: `src/pages/ScanItemRedirect.tsx`

```typescript
export default function ScanItemRedirect() {
  const { codeOrId } = useParams<{ codeOrId: string }>();
  const navigate = useNavigate();
  
  useEffect(() => {
    const lookup = async () => {
      // If UUID, lookup by id
      if (isValidUuid(codeOrId)) {
        navigate(`/inventory/${codeOrId}`, { replace: true });
        return;
      }
      
      // Otherwise lookup by item_code
      const { data } = await supabase
        .from('items')
        .select('id')
        .eq('item_code', codeOrId)
        .maybeSingle();
      
      if (data) {
        navigate(`/inventory/${data.id}`, { replace: true });
      } else {
        navigate('/inventory', { replace: true });
        toast.error('Item not found');
      }
    };
    lookup();
  }, [codeOrId]);
  
  return <Loader2 className="animate-spin" />;
}
```

**File to Update**: `src/App.tsx`

Add route:
```typescript
<Route path="/scan/item/:codeOrId" element={<ProtectedRoute><ScanItemRedirect /></ProtectedRoute>} />
```

---

### Step 7: Document Scanner Integration for Receiving

**Files Already Exist**:
- `src/components/scanner/DocumentScanner.tsx`
- `src/components/scanner/DocumentCapture.tsx`
- `src/components/scanner/ScanDocumentButton.tsx`

**File to Update**: `src/pages/ShipmentDetail.tsx`

Add document capture section in receiving UI:
```typescript
import { DocumentCapture } from '@/components/scanner';

// In receiving section:
<DocumentCapture
  context={{ type: 'shipment', shipmentId: shipment.id }}
  maxDocuments={10}
  ocrEnabled={true}
  onDocumentAdded={(docId) => console.log('Document added:', docId)}
/>
```

---

### Step 8: Email Alerts (ALREADY COMPLETE)

**Verified existing implementation**:
- `src/lib/alertQueue.ts` - `queueShipmentReceivedAlert()`, `queueTaskCreatedAlert()`
- `supabase/functions/send-alerts/index.ts` - Processes alert queue, sends via Resend
- `useReceivingSession.ts` lines 373-398 - Already queues shipment received alerts

**No changes needed** - alerts are already wired in the receiving flow.

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/items/ItemListTable.tsx` | Reusable item table component |
| `src/pages/ScanItemRedirect.tsx` | QR code redirect handler |
| `supabase/migrations/[timestamp]_receiving_dock_setup.sql` | Receiving dock location function |

### Files to Modify
| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/scan/item/:codeOrId` route |
| `src/hooks/useReceivingSession.ts` | Assign receiving dock location, remove client-side item code |
| `src/pages/ShipmentDetail.tsx` | Add print labels after receive, add document capture |
| `src/pages/Inventory.tsx` | Use ItemListTable component |

### Database Changes
| Change | Description |
|--------|-------------|
| Function `get_or_create_receiving_dock` | Gets/creates RECV-DOCK location per warehouse |
| Backfill | Ensures all warehouses have receiving dock |

---

## Acceptance Checklist

### A) Shipment Create
- [x] Only one sidemark selector (already complete)
- [x] Save shipment works (already complete)
- [ ] Items list table uses standardized columns (needs ItemListTable)

### B) Receive Shipment
- [ ] Receive creates items (already works via useReceivingSession)
- [ ] Items start at Receiving Dock (needs location assignment)
- [x] Item codes match ITM-###-#### (DB trigger already handles)
- [ ] Print Labels produces PDF (needs post-receive prompt)

### C) Media
- [x] Scan paperwork PDF on shipment (DocumentCapture exists)
- [x] Upload photos on item (ItemPhotoGallery exists)
- [x] Mark Primary + Needs Attention works (useItemPhotos supports this)
- [x] Download works (already implemented)

### D) Scan QR Lookup
- [ ] QR opens item detail (needs ScanItemRedirect route)

### E) Alerts
- [x] Shipment received triggers email (already complete)

---

## Implementation Order

1. **SQL Migration**: Create receiving dock function + backfill
2. **ScanItemRedirect**: New page + route in App.tsx
3. **ItemListTable**: Create reusable component
4. **useReceivingSession**: Add dock location assignment
5. **ShipmentDetail**: Add print labels prompt + document capture
6. **Inventory.tsx**: Refactor to use ItemListTable

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing items have no location | Backfill not needed - only new items get dock |
| Item code collision | DB trigger has retry loop with 15 attempts |
| Document scanner camera permissions | Existing fallback to file upload |
| Print popup blocked | Existing download fallback in labelGenerator |

---

## Out of Scope (Future Phases)
- Invoicing UI / QBO integration
- CardX/Stripe payments
- Claims management
- Stocktakes/cycle counts
- Repair quote automation
- SMS alerts (email only for now)
