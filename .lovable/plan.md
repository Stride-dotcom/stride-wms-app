

# Apply Flag Service Events Migration

## Overview
Run the pending migration `20260127110000_add_flag_service_events.sql` to add flag-based service events to the pricing system.

## What This Migration Does
- Updates the `seed_service_events` function with ~18 new flag-based billable services
- Adds services like Climate Control, Crate Disposal, Kitting, High Value handling, etc.
- Inserts these services for existing tenants that already have service events configured
- Expands coverage for storage, scan events, shipment services, and item-class-based rates

## Execution Steps
1. Read the full SQL content from `supabase/migrations/20260127110000_add_flag_service_events.sql`
2. Use the migration tool to execute the SQL against the database
3. You'll be prompted to approve the migration before it runs
4. Verify the new service events are present in the database

## Technical Details
The migration file location: `supabase/migrations/20260127110000_add_flag_service_events.sql`

---

**Click "Approve" below to switch me to default mode where I can execute this migration.**

