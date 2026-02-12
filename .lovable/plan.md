
# Fix: Account ID Not Saved on Quote Update

## Root Cause
In `src/hooks/useQuotes.ts`, the `updateQuote` function (lines 644-668) maps individual form fields to the database update payload, but **`account_id` is never included**. When you change the account in the UI, it updates `formData.account_id` locally, but that value is silently dropped when saving.

The save returns 204 (success) and shows "Quote updated" because other fields do save -- just not the account.

## Fix

**File: `src/hooks/useQuotes.ts` (~line 646)**

Add `account_id` to the list of fields mapped into `updateData`:

```typescript
if (formData.account_id !== undefined) updateData.account_id = formData.account_id;
```

This single line goes right after line 644 (`const updateData: Record<string, unknown> = {};`), alongside the other field mappings like `currency`, `tax_enabled`, etc.

No other files need changes -- the activity log (`quote_events`) already fires on line 784 after a successful update, and it will now capture the actual account change since it will no longer silently fail.
