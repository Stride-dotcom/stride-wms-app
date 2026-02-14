-- =============================================================================
-- Backfill legacy receiving_discrepancies -> shipment_exceptions
-- -----------------------------------------------------------------------------
-- Fixes visibility gap where legacy rows remained in receiving_discrepancies
-- and were no longer shown in UI paths that read shipment_exceptions only.
-- =============================================================================

DO $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'receiving_discrepancies'
  ) THEN
    RAISE NOTICE 'Backfill skipped: receiving_discrepancies table not present';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'shipment_exceptions'
  ) THEN
    RAISE NOTICE 'Backfill skipped: shipment_exceptions table not present';
    RETURN;
  END IF;

  WITH legacy AS (
    SELECT
      rd.id AS legacy_id,
      rd.tenant_id,
      rd.shipment_id,
      rd.type AS legacy_type,
      CASE
        WHEN rd.type = 'PIECES_MISMATCH' THEN 'OTHER'
        ELSE rd.type
      END AS mapped_code,
      CASE
        WHEN rd.status = 'resolved' THEN 'resolved'
        ELSE 'open'
      END AS mapped_status,
      rd.created_at,
      rd.created_by,
      rd.resolved_at,
      rd.resolved_by,
      NULLIF(btrim(rd.resolution_notes), '') AS raw_resolution_note,
      COALESCE(
        NULLIF(btrim(rd.details->>'note'), ''),
        NULLIF(btrim(rd.details->>'description'), ''),
        CASE
          WHEN rd.details IS NOT NULL AND rd.details::text <> '{}' THEN 'Legacy details: ' || rd.details::text
          ELSE NULL
        END
      ) AS raw_note
    FROM public.receiving_discrepancies rd
  ),
  normalized AS (
    SELECT
      l.legacy_id,
      l.tenant_id,
      l.shipment_id,
      l.mapped_code::text AS code,
      CASE
        WHEN l.mapped_code IN ('REFUSED', 'OTHER') THEN
          COALESCE(l.raw_note, 'Migrated legacy discrepancy: ' || l.legacy_type)
        ELSE
          l.raw_note
      END AS note,
      l.mapped_status AS status,
      CASE
        WHEN l.mapped_status = 'resolved' THEN
          COALESCE(l.raw_resolution_note, 'Migrated from legacy receiving_discrepancies as resolved.')
        ELSE
          NULL
      END AS resolution_note,
      l.created_at,
      l.created_by,
      CASE WHEN l.mapped_status = 'resolved' THEN l.resolved_at ELSE NULL END AS resolved_at,
      CASE WHEN l.mapped_status = 'resolved' THEN l.resolved_by ELSE NULL END AS resolved_by
    FROM legacy l
    WHERE l.mapped_code IN (
      'DAMAGE',
      'WET',
      'OPEN',
      'MISSING_DOCS',
      'REFUSED',
      'CRUSHED_TORN_CARTONS',
      'OTHER'
    )
  )
  INSERT INTO public.shipment_exceptions (
    tenant_id,
    shipment_id,
    code,
    note,
    status,
    resolution_note,
    created_at,
    created_by,
    resolved_at,
    resolved_by,
    updated_at
  )
  SELECT
    n.tenant_id,
    n.shipment_id,
    n.code,
    n.note,
    n.status,
    n.resolution_note,
    n.created_at,
    n.created_by,
    n.resolved_at,
    n.resolved_by,
    now()
  FROM normalized n
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.shipment_exceptions se
    WHERE se.tenant_id = n.tenant_id
      AND se.shipment_id = n.shipment_id
      AND se.code = n.code
      AND se.status = n.status
      AND COALESCE(se.note, '') = COALESCE(n.note, '')
      AND se.created_at = n.created_at
  );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Backfill complete: % rows copied from receiving_discrepancies to shipment_exceptions', v_inserted;
END
$$;
