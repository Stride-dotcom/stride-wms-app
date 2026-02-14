-- =============================================================================
-- Phase 4 Batch B
-- Expand shipment_exceptions.code taxonomy to include mismatch-oriented codes
-- while preserving existing condition-oriented codes used in production flows.
-- =============================================================================

DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'shipment_exceptions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%code IN (%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.shipment_exceptions DROP CONSTRAINT IF EXISTS %I',
      v_constraint.conname
    );
  END LOOP;
END
$$;

ALTER TABLE public.shipment_exceptions
  DROP CONSTRAINT IF EXISTS shipment_exceptions_code_allowed;

ALTER TABLE public.shipment_exceptions
  ADD CONSTRAINT shipment_exceptions_code_allowed
  CHECK (
    code IN (
      'PIECES_MISMATCH',
      'VENDOR_MISMATCH',
      'DESCRIPTION_MISMATCH',
      'SIDEMARK_MISMATCH',
      'SHIPPER_MISMATCH',
      'TRACKING_MISMATCH',
      'REFERENCE_MISMATCH',
      'DAMAGE',
      'WET',
      'OPEN',
      'MISSING_DOCS',
      'REFUSED',
      'CRUSHED_TORN_CARTONS',
      'OTHER'
    )
  );
