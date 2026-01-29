
# Fix Plan: Task Items Not Loading & Build Errors

## Summary
There are **two separate issues** that need to be resolved:

1. **Task Items Not Loading**: The TaskDetail page is failing to fetch items because it queries for a column `inspection_result` that doesn't exist in the database. The correct column name is `inspection_status`.

2. **Build Errors (30+ files)**: Previous icon migration work left the `MaterialIcon` component without support for `style` and `onClick` props, causing TypeScript errors across many files.

---

## Root Cause Analysis

### Issue 1: Database Column Mismatch
The `TaskDetail.tsx` file queries for `inspection_result` on the `items` table, but the actual database schema has:
- `inspection_status` ✓
- `inspection_photos` ✓  
- `needs_inspection` ✓
- `inspection_result` ✗ (does not exist)

This causes a PostgreSQL error `42703: column items.inspection_result does not exist`.

### Issue 2: MaterialIcon Props Missing
The `MaterialIcon` component only accepts: `name`, `className`, `size`, `filled`, `weight`

But various files are passing:
- `style={{ fontSize: '...' }}` - not supported
- `onClick={...}` - not supported

---

## Implementation Plan

### Part 1: Fix Task Items Query (TaskDetail.tsx)

**Changes needed:**
1. Replace all references to `inspection_result` with `inspection_status`
2. Update the database query to use the correct column
3. Update the update function to use the correct column
4. Update all UI display logic to check `inspection_status`

Affected lines in `src/pages/TaskDetail.tsx`:
- Line 62: Interface definition
- Line 85: TaskItemRow interface
- Line 210: Supabase query
- Lines 302-312: Update function
- Lines 546-555: Badge counting logic
- Lines 616-632: Table cell rendering

### Part 2: Fix MaterialIcon Component

**Option A (Recommended)**: Extend `MaterialIcon` to support `style` and `onClick` props
- Add `style?: React.CSSProperties` to the interface
- Add `onClick?: React.MouseEventHandler` to the interface
- Pass these through to the underlying `span` element

This is the cleanest solution as it makes the component more flexible.

### Part 3: Fix Missing Import Errors

Two files have missing imports that need to be added:
- `src/components/settings/alerts/tabs/EmailHtmlTab.tsx` - missing `Loader2` 
- `src/components/ui/searchable-select.tsx` - missing `Check`

These need to either import from lucide-react or be replaced with MaterialIcon.

---

## Technical Details

### Database Schema (items table - relevant columns)
| Column | Exists |
|--------|--------|
| inspection_status | ✓ |
| inspection_photos | ✓ |
| needs_inspection | ✓ |
| inspection_result | ✗ |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/TaskDetail.tsx` | Replace `inspection_result` → `inspection_status` |
| `src/components/ui/MaterialIcon.tsx` | Add `style` and `onClick` props |
| `src/components/settings/alerts/tabs/EmailHtmlTab.tsx` | Fix missing Loader2 reference |
| `src/components/ui/searchable-select.tsx` | Fix missing Check reference |

---

## Expected Outcome
After these fixes:
1. Task items will load and display correctly on the Task Detail page
2. Inspection pass/fail functionality will work again
3. All TypeScript build errors will be resolved
4. The app will compile and run without errors
