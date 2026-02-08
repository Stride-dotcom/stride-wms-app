
## Fix: Remove Non-Existent `task_number` Column from QA Runner

### Root Cause

The QA runner's Test 5 ("Create repair task linked to accepted quote") at line 2063 inserts a `task_number` field into the `tasks` table. However, the `tasks` table has **no `task_number` column** -- this column simply does not exist in the database schema.

PostgREST correctly rejects the insert with: *"Could not find the 'task_number' column of 'tasks' in the schema cache"*

### Fix

**File: `supabase/functions/qa-runner/index.ts`**

Remove the `task_number` line from the task insert (line 2063), and add a `title` field instead, which is how the real application creates repair tasks (as seen in `useRepairQuotes.ts` and `TaskDetail.tsx`).

The insert block (lines 2059-2073) changes from:

```typescript
{
  tenant_id: ctx.tenantId,
  warehouse_id: warehouseId,
  account_id: accountId,
  task_number: generateCode('TSK'),     // REMOVE - column doesn't exist
  task_type: 'Repair',
  status: 'pending',
  ...
}
```

To:

```typescript
{
  tenant_id: ctx.tenantId,
  warehouse_id: warehouseId,
  account_id: accountId,
  title: `Repair - QA Test ${generateCode('TSK')}`,  // Use title instead
  task_type: 'Repair',
  status: 'pending',
  ...
}
```

No other files or database changes are needed. After editing, the `qa-runner` edge function will be redeployed.
