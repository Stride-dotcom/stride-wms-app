-- Add default notes fields to accounts table
-- These allow account-level default notes that populate into items and tasks

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS default_receiving_notes text,
ADD COLUMN IF NOT EXISTS default_inspection_notes text,
ADD COLUMN IF NOT EXISTS default_item_notes text;

-- Add comments for clarity
COMMENT ON COLUMN accounts.default_receiving_notes IS 'Default notes to apply to items during receiving';
COMMENT ON COLUMN accounts.default_inspection_notes IS 'Default notes to pre-populate on inspection tasks';
COMMENT ON COLUMN accounts.default_item_notes IS 'Default notes to apply to new items for this account';
