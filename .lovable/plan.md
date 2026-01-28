

## Fix Build Errors Preventing App Load

The application is stuck on a loading spinner because TypeScript build errors are preventing compilation. I've identified **6 distinct issues** across multiple files that need to be resolved.

---

### Issue Summary

| File | Error Type | Cause |
|------|------------|-------|
| `AccountDialog.tsx` | Missing properties | Database types out of sync |
| `EmailWysiwygEditor.tsx` | Invalid property | Wrong email-builder API usage |
| `usePresence.ts` | Type assertion error | Missing type cast |
| `useQuickBooks.ts` | Unknown table | Database types out of sync |
| `ItemDetail.tsx` | Missing identifier | Missing `cn` import |
| `Messages.tsx` | Duplicate identifier | Name collision between import and Lucide icon |

---

### Fix Plan

#### 1. Regenerate Supabase Types
The database has new tables and columns from recent migrations that aren't reflected in `types.ts`:
- `accounts` table missing: `default_item_notes`, `highlight_item_notes`, `default_shipment_notes`, `highlight_shipment_notes`
- `qbo_invoice_sync_log` table completely missing

This requires regenerating the types file from the database schema.

#### 2. Fix `Messages.tsx` - Duplicate User Identifier
**Problem**: `User` is imported from both:
- `lucide-react` as an icon component
- `@/hooks/useUsers` as a type

**Solution**: Rename the Lucide icon import to avoid collision:
```typescript
import { User as UserIcon, ... } from 'lucide-react';
```

Then update usages of `<User ... />` to `<UserIcon ... />` throughout the file.

#### 3. Fix `ItemDetail.tsx` - Missing cn Import
**Problem**: Using `cn()` utility but it's not imported.

**Solution**: Add the import at the top of the file:
```typescript
import { cn } from '@/lib/utils';
```

#### 4. Fix `usePresence.ts` - Type Assertion
**Problem**: Converting presence state to custom type fails type checking.

**Solution**: Use proper type assertion through `unknown`:
```typescript
const latest = newPresences[newPresences.length - 1] as unknown as PresenceUser;
```

#### 5. Fix `EmailWysiwygEditor.tsx` - Invalid childrenIds Property
**Problem**: The email builder library's type definitions don't allow `childrenIds` on certain block types.

**Solution**: Type the document manipulation more loosely using type assertions for the email builder's internal structure, as this is a known limitation of the library's type definitions.

#### 6. Fix `useQuickBooks.ts` - Table Type Workaround
**Problem**: `qbo_invoice_sync_log` table isn't in generated types yet.

**Solution**: Use type assertion to bypass the type check until types are regenerated:
```typescript
(supabase.from('qbo_invoice_sync_log') as any)
```

---

### Implementation Order

1. **Regenerate types** - Run the types regeneration to add missing tables/columns
2. **Fix Messages.tsx** - Rename User icon to avoid duplicate identifier
3. **Fix ItemDetail.tsx** - Add missing `cn` import
4. **Fix usePresence.ts** - Fix type assertion
5. **Fix EmailWysiwygEditor.tsx** - Work around library type limitations
6. **Verify useQuickBooks.ts** - Should be fixed after types regeneration; add fallback if needed

---

### Technical Details

**Messages.tsx Changes:**
- Line 5: Remove duplicate `User` type import (hook doesn't export it)
- Line 48: Rename `User` to `UserIcon` in Lucide imports
- Lines 406, 630: Update JSX to use `<UserIcon />` instead of `<User />`

**ItemDetail.tsx Changes:**
- Add `cn` to the existing `@/lib/utils` import (line ~27)

**usePresence.ts Changes:**
- Line 61: Change type assertion to go through `unknown` first

**EmailWysiwygEditor.tsx Changes:**
- Lines 210-280: Use type assertions for document structure to work around library limitations

**useQuickBooks.ts Changes:**
- Lines 288, 343: Add type assertions for the table query (already partially done with `as any`)

