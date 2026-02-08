

## Fix Inspection Task Issues: Notes, Documents/Photos, and Mobile Photo Tags

### Problem Summary

Three issues were identified on the Task Detail page for Inspection tasks:

1. **Notes do not save** -- The code reads/writes a `task_notes` column that does not exist in the database. The `tasks` table has no such column, so the "Save Notes" button silently fails.

2. **Document photos and uploads appear not to save** -- Documents and photos actually *are* saving to the database (confirmed by checking the data). However, the user does not see the new document appear in the list because the `DocumentList` component is not told to refetch after a successful upload. The `refetchKey` pattern is not wired up on the Task Detail page.

3. **Photo tag icons (Attention, Repair, Primary) are too small on mobile** -- The photo grid defaults to 4 columns on all screen sizes. On mobile, this makes each thumbnail very small, causing:
   - The `PhotoIndicatorChip` badges to overflow or be unreadable
   - The action buttons (star, attention, repair, delete) to be too small to tap reliably
   - Poor overall usability for tagging photos

---

### Plan

#### Step 1: Add the `task_notes` column to the database

Create a migration that adds the missing `task_notes` column to the `tasks` table:

```sql
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_notes text;
```

This is the only change needed -- the existing code in `TaskDetail.tsx` already reads/writes this column correctly via `handleSaveNotes`. Once the column exists, notes will save.

#### Step 2: Wire up document refetch after upload

In `TaskDetail.tsx`, add a `docRefetchKey` state counter. Increment it when `ScanDocumentButton` or `DocumentUploadButton` succeed, and pass it to `DocumentList` as the `refetchKey` prop. This follows the established pattern used on the Shipment Detail page.

Changes in `TaskDetail.tsx`:
- Add state: `const [docRefetchKey, setDocRefetchKey] = useState(0);`
- In `ScanDocumentButton.onSuccess`: call `setDocRefetchKey(prev => prev + 1)`
- In `DocumentUploadButton.onSuccess`: call `setDocRefetchKey(prev => prev + 1)`
- Pass `refetchKey={docRefetchKey}` to `DocumentList`

#### Step 3: Make photo grid responsive for mobile

In `TaggablePhotoGrid.tsx`:
- Change the grid from a fixed 4-column layout to a responsive layout: 2 columns on mobile, 3 on medium, 4 on large screens.
- On small thumbnails (mobile), hide the label text on `PhotoIndicatorChip` so only the icon shows, keeping badges compact.

In `PhotoIndicatorChip.tsx`:
- No changes needed to the component itself; the `showLabel` prop already supports this.

In `TaggablePhotoGrid.tsx`:
- Update the grid classes from `grid-cols-4` to `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
- Pass `showLabel={false}` to `PhotoIndicatorChip` when rendered inside the grid thumbnails (keep labels in the lightbox)
- Increase mobile touch target sizes for the bottom action buttons from `p-1.5` to `p-2` and icons from `h-4 w-4` to `h-5 w-5`

---

### Technical Details

**Files to modify:**
- `supabase/migrations/` -- new migration file for `task_notes` column
- `src/pages/TaskDetail.tsx` -- add `docRefetchKey` state and wire it up
- `src/components/common/TaggablePhotoGrid.tsx` -- responsive grid, larger mobile touch targets, compact indicator chips

**Files to update (types):**
- `src/integrations/supabase/types.ts` -- add `task_notes` to the Tasks type definition

