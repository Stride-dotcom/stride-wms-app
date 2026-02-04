CREATE UNIQUE INDEX IF NOT EXISTS pricing_rules_charge_type_class_uq
ON public.pricing_rules(charge_type_id, class_code);

DO $$
DECLARE
  rec_ct RECORD;
  rec_pr RECORD;
  ct_id UUID;
  mapped_trigger TEXT;
  mapped_unit TEXT;
  mapped_category TEXT;
  mapped_input_mode TEXT;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1) Create/Upsert charge_types from unique (tenant_id, service_code)
  -- ---------------------------------------------------------------------------
  FOR rec_ct IN
    SELECT DISTINCT ON (sv.tenant_id, sv.service_code)
      sv.tenant_id,
      sv.service_code,
      sv.service_name,
      sv.billing_unit,
      sv.billing_trigger,
      sv.service_time_minutes,
      sv.taxable,
      sv.is_active,
      sv.add_flag,
      sv.add_to_service_event_scan,
      sv.alert_rule,
      sv.notes
    FROM public.service_events sv
    WHERE sv.tenant_id IS NOT NULL
      AND sv.service_code IS NOT NULL
    ORDER BY sv.tenant_id, sv.service_code, (sv.class_code IS NULL) DESC, sv.created_at
  LOOP
    mapped_trigger := CASE
      WHEN rec_ct.billing_trigger ILIKE '%auto%' OR rec_ct.billing_trigger ILIKE '%calculate%' THEN 'auto'
      WHEN rec_ct.billing_trigger ILIKE '%task%' OR rec_ct.billing_trigger ILIKE '%completion%' THEN 'task'
      WHEN rec_ct.billing_trigger ILIKE '%ship%' OR rec_ct.billing_trigger ILIKE '%receive%' OR rec_ct.billing_trigger ILIKE '%inbound%' OR rec_ct.billing_trigger ILIKE '%outbound%' THEN 'shipment'
      WHEN rec_ct.billing_trigger ILIKE '%storage%' OR rec_ct.billing_trigger ILIKE '%day%' OR rec_ct.billing_trigger ILIKE '%month%' THEN 'storage'
      ELSE 'manual'
    END;

    mapped_unit := CASE
      WHEN rec_ct.billing_unit ILIKE '%day%' THEN 'per_day'
      WHEN rec_ct.billing_unit ILIKE '%month%' THEN 'per_month'
      WHEN rec_ct.billing_unit ILIKE '%hour%' THEN 'per_hour'
      WHEN rec_ct.billing_unit ILIKE '%minute%' THEN 'per_minute'
      WHEN rec_ct.billing_unit ILIKE '%task%' THEN 'per_task'
      WHEN rec_ct.billing_unit ILIKE '%item%' THEN 'per_item'
      ELSE 'each'
    END;

    mapped_category := CASE
      WHEN rec_ct.service_code ILIKE '%recv%' OR rec_ct.service_code ILIKE '%rcvg%' OR rec_ct.service_code ILIKE '%receive%' THEN 'receiving'
      WHEN rec_ct.service_code ILIKE '%stor%' THEN 'storage'
      WHEN rec_ct.service_code ILIKE '%ship%' OR rec_ct.service_code ILIKE '%outbound%' OR rec_ct.service_code ILIKE '%will_call%' THEN 'shipping'
      WHEN rec_ct.service_code ILIKE '%insp%' OR rec_ct.service_code ILIKE '%assy%' OR rec_ct.service_code ILIKE '%repair%' THEN 'task'
      ELSE 'general'
    END;

    mapped_input_mode := CASE
      WHEN mapped_unit IN ('per_hour', 'per_minute') THEN 'time'
      WHEN rec_ct.service_code ILIKE '%labor%' OR rec_ct.service_code ILIKE '%hr%' THEN 'time'
      ELSE 'qty'
    END;

    SELECT id INTO ct_id
    FROM public.charge_types
    WHERE tenant_id = rec_ct.tenant_id
      AND charge_code = rec_ct.service_code;

    IF ct_id IS NULL THEN
      INSERT INTO public.charge_types (
        tenant_id,
        charge_code,
        charge_name,
        category,
        is_active,
        is_taxable,
        default_trigger,
        input_mode,
        add_to_scan,
        add_flag,
        alert_rule,
        notes,
        legacy_service_code
      ) VALUES (
        rec_ct.tenant_id,
        rec_ct.service_code,
        rec_ct.service_name,
        mapped_category,
        rec_ct.is_active,
        COALESCE(rec_ct.taxable, false),
        mapped_trigger,
        mapped_input_mode,
        COALESCE(rec_ct.add_to_service_event_scan, false),
        COALESCE(rec_ct.add_flag, false),
        COALESCE(rec_ct.alert_rule, 'none'),
        rec_ct.notes,
        rec_ct.service_code
      )
      RETURNING id INTO ct_id;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- 2) Create/Upsert pricing_rules for each service_events row (class + flat)
  -- ---------------------------------------------------------------------------
  FOR rec_pr IN
    SELECT
      sv2.tenant_id,
      sv2.service_code,
      sv2.class_code,
      sv2.rate,
      sv2.billing_unit,
      sv2.service_time_minutes,
      ct2.id AS charge_type_id
    FROM public.service_events sv2
    JOIN public.charge_types ct2
      ON ct2.tenant_id = sv2.tenant_id
     AND ct2.charge_code = sv2.service_code
    WHERE sv2.tenant_id IS NOT NULL
      AND sv2.service_code IS NOT NULL
  LOOP
    mapped_unit := CASE
      WHEN rec_pr.billing_unit ILIKE '%day%' THEN 'per_day'
      WHEN rec_pr.billing_unit ILIKE '%month%' THEN 'per_month'
      WHEN rec_pr.billing_unit ILIKE '%hour%' THEN 'per_hour'
      WHEN rec_pr.billing_unit ILIKE '%minute%' THEN 'per_minute'
      WHEN rec_pr.billing_unit ILIKE '%task%' THEN 'per_task'
      WHEN rec_pr.billing_unit ILIKE '%item%' THEN 'per_item'
      ELSE 'each'
    END;

    INSERT INTO public.pricing_rules (
      tenant_id,
      charge_type_id,
      pricing_method,
      class_code,
      unit,
      rate,
      is_default,
      service_time_minutes
    ) VALUES (
      rec_pr.tenant_id,
      rec_pr.charge_type_id,
      CASE WHEN rec_pr.class_code IS NOT NULL THEN 'class_based' ELSE 'flat' END,
      rec_pr.class_code,
      mapped_unit,
      COALESCE(rec_pr.rate, 0),
      CASE WHEN rec_pr.class_code IS NULL THEN true ELSE false END,
      COALESCE(rec_pr.service_time_minutes, 0)
    )
    ON CONFLICT (charge_type_id, class_code) DO UPDATE SET
      rate = EXCLUDED.rate,
      unit = EXCLUDED.unit,
      service_time_minutes = EXCLUDED.service_time_minutes,
      updated_at = now();
  END LOOP;

  RAISE NOTICE 'Backfill complete';
END $$;
