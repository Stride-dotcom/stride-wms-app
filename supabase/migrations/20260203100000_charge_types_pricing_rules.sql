-- =============================================================================
-- Migration: charge_types + pricing_rules
-- Purpose: New pricing architecture to replace service_events
-- Safety: Does NOT modify service_events or billing_events. Keeps legacy as fallback.
-- =============================================================================

-- =============================================================================
-- STEP 1: Create charge_types table (master charge definitions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.charge_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Core identification
  charge_code TEXT NOT NULL,
  charge_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- 'receiving', 'storage', 'handling', 'task', 'shipping', 'general'

  -- Status & taxability
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_taxable BOOLEAN NOT NULL DEFAULT false,

  -- Trigger defines HOW charge is created (ONE WORD ONLY)
  -- Values: 'manual', 'task', 'shipment', 'storage', 'auto'
  default_trigger TEXT NOT NULL DEFAULT 'manual',

  -- Input mode for manual charges
  input_mode TEXT NOT NULL DEFAULT 'qty', -- 'qty', 'time', 'both'
  qty_step NUMERIC(10,2) DEFAULT 1,
  min_qty NUMERIC(10,2) DEFAULT 1,
  time_unit_default TEXT DEFAULT 'minutes', -- 'minutes', 'hours'
  min_minutes INTEGER DEFAULT 0,

  -- Service Event Scan behaviors (migrated from service_events)
  add_to_scan BOOLEAN NOT NULL DEFAULT false,
  add_flag BOOLEAN NOT NULL DEFAULT false,

  -- Alert configuration
  alert_rule TEXT DEFAULT 'none', -- 'none', 'email_office', etc.

  -- Notes for internal use
  notes TEXT,

  -- Legacy reference (for tracing back to service_events during migration)
  legacy_service_code TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  deleted_at TIMESTAMPTZ,

  -- Unique per tenant
  CONSTRAINT uq_charge_types_tenant_code UNIQUE (tenant_id, charge_code)
);

-- Indexes for charge_types
CREATE INDEX IF NOT EXISTS idx_charge_types_tenant ON public.charge_types(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_charge_types_category ON public.charge_types(tenant_id, category) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_charge_types_trigger ON public.charge_types(tenant_id, default_trigger) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_charge_types_scan ON public.charge_types(tenant_id) WHERE deleted_at IS NULL AND is_active = true AND add_to_scan = true;
CREATE INDEX IF NOT EXISTS idx_charge_types_flag ON public.charge_types(tenant_id) WHERE deleted_at IS NULL AND is_active = true AND add_flag = true;

-- RLS for charge_types
ALTER TABLE public.charge_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "charge_types_tenant_isolation" ON public.charge_types;
CREATE POLICY "charge_types_tenant_isolation" ON public.charge_types
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );


-- =============================================================================
-- STEP 2: Create pricing_rules table (rates per charge type)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  charge_type_id UUID NOT NULL REFERENCES public.charge_types(id) ON DELETE CASCADE,

  -- Pricing method
  pricing_method TEXT NOT NULL DEFAULT 'flat', -- 'flat', 'class_based', 'tiered'

  -- Class-based pricing (NULL means default/any class)
  class_code TEXT, -- 'XS', 'S', 'M', 'L', 'XL', 'XXL', or NULL for default

  -- Unit of billing (normalized from legacy billing_unit)
  unit TEXT NOT NULL DEFAULT 'each', -- 'each', 'per_item', 'per_task', 'per_hour', 'per_minute', 'per_day', 'per_month'

  -- Rate and minimum
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_charge NUMERIC(10,2) DEFAULT 0,

  -- Is this the default rule for the charge type?
  is_default BOOLEAN NOT NULL DEFAULT false,

  -- Service time for labor-based charges
  service_time_minutes INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Unique constraint: one rule per charge_type + class_code combination
  CONSTRAINT uq_pricing_rules_charge_class UNIQUE (charge_type_id, class_code)
);

-- Indexes for pricing_rules
CREATE INDEX IF NOT EXISTS idx_pricing_rules_charge_type ON public.pricing_rules(charge_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_tenant ON public.pricing_rules(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_default ON public.pricing_rules(charge_type_id) WHERE deleted_at IS NULL AND is_default = true;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_class ON public.pricing_rules(charge_type_id, class_code) WHERE deleted_at IS NULL;

-- RLS for pricing_rules
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_rules_tenant_isolation" ON public.pricing_rules;
CREATE POLICY "pricing_rules_tenant_isolation" ON public.pricing_rules
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );


-- =============================================================================
-- STEP 3: Create task_type_charge_links table (link task types to charges)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.task_type_charge_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_type_id UUID NOT NULL REFERENCES public.task_types(id) ON DELETE CASCADE,
  charge_type_id UUID NOT NULL REFERENCES public.charge_types(id) ON DELETE CASCADE,

  -- Ordering if multiple charges per task type
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Can be disabled without deleting
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- One link per task_type + charge_type
  CONSTRAINT uq_task_type_charge_links UNIQUE (task_type_id, charge_type_id)
);

-- Indexes for task_type_charge_links
CREATE INDEX IF NOT EXISTS idx_task_type_charge_links_task ON public.task_type_charge_links(task_type_id) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_task_type_charge_links_charge ON public.task_type_charge_links(charge_type_id) WHERE deleted_at IS NULL;

-- RLS for task_type_charge_links
ALTER TABLE public.task_type_charge_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_type_charge_links_tenant_isolation" ON public.task_type_charge_links;
CREATE POLICY "task_type_charge_links_tenant_isolation" ON public.task_type_charge_links
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );


-- =============================================================================
-- STEP 4: Create account_charge_adjustments table (account-specific pricing)
-- This extends the existing account_service_settings concept to new system
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.account_charge_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  charge_type_id UUID NOT NULL REFERENCES public.charge_types(id) ON DELETE CASCADE,

  -- Class-specific adjustment (NULL = applies to all classes)
  class_code TEXT,

  -- Adjustment type: 'override', 'percentage', 'fixed_add'
  adjustment_type TEXT NOT NULL DEFAULT 'override',

  -- Adjustment values (only one should be set based on adjustment_type)
  override_rate NUMERIC(10,2),        -- For 'override': exact rate
  percentage_adjust NUMERIC(5,2),      -- For 'percentage': +/- percent
  fixed_add_amount NUMERIC(10,2),      -- For 'fixed_add': +/- amount

  -- Can disable charge for this account
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- One adjustment per account + charge + class combination
  CONSTRAINT uq_account_charge_adjustments UNIQUE (account_id, charge_type_id, class_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_account_charge_adj_account ON public.account_charge_adjustments(account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_charge_adj_charge ON public.account_charge_adjustments(charge_type_id) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.account_charge_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_charge_adjustments_tenant_isolation" ON public.account_charge_adjustments;
CREATE POLICY "account_charge_adjustments_tenant_isolation" ON public.account_charge_adjustments
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );


-- =============================================================================
-- STEP 5: Backfill charge_types and pricing_rules from service_events
-- =============================================================================
DO $$
DECLARE
  se RECORD;
  ct_id UUID;
  mapped_trigger TEXT;
  mapped_unit TEXT;
  mapped_category TEXT;
  mapped_input_mode TEXT;
BEGIN
  -- Process each unique service_code per tenant (ignoring class variations for charge_types)
  FOR se IN
    SELECT DISTINCT ON (tenant_id, service_code)
      tenant_id,
      service_code,
      service_name,
      billing_unit,
      billing_trigger,
      service_time_minutes,
      taxable,
      is_active,
      add_flag,
      add_to_service_event_scan,
      alert_rule,
      notes,
      uses_class_pricing
    FROM public.service_events
    WHERE tenant_id IS NOT NULL
      AND service_code IS NOT NULL
    ORDER BY tenant_id, service_code, (class_code IS NULL) DESC, created_at
  LOOP
    -- Map billing_trigger to default_trigger (ONE WORD ONLY)
    mapped_trigger := CASE
      WHEN se.billing_trigger ILIKE '%auto%' OR se.billing_trigger ILIKE '%calculate%' THEN 'auto'
      WHEN se.billing_trigger ILIKE '%task%' OR se.billing_trigger ILIKE '%completion%' THEN 'task'
      WHEN se.billing_trigger ILIKE '%ship%' OR se.billing_trigger ILIKE '%receive%' OR se.billing_trigger ILIKE '%inbound%' OR se.billing_trigger ILIKE '%outbound%' THEN 'shipment'
      WHEN se.billing_trigger ILIKE '%storage%' OR se.billing_trigger ILIKE '%day%' OR se.billing_trigger ILIKE '%month%' THEN 'storage'
      ELSE 'manual'
    END;

    -- Map billing_unit to new unit format
    mapped_unit := CASE
      WHEN se.billing_unit ILIKE '%day%' THEN 'per_day'
      WHEN se.billing_unit ILIKE '%month%' THEN 'per_month'
      WHEN se.billing_unit ILIKE '%hour%' THEN 'per_hour'
      WHEN se.billing_unit ILIKE '%minute%' THEN 'per_minute'
      WHEN se.billing_unit ILIKE '%task%' THEN 'per_task'
      WHEN se.billing_unit ILIKE '%item%' THEN 'per_item'
      ELSE 'each'
    END;

    -- Map to category based on service_code patterns
    mapped_category := CASE
      WHEN se.service_code ILIKE '%recv%' OR se.service_code ILIKE '%rcvg%' OR se.service_code ILIKE '%receive%' THEN 'receiving'
      WHEN se.service_code ILIKE '%stor%' THEN 'storage'
      WHEN se.service_code ILIKE '%ship%' OR se.service_code ILIKE '%outbound%' OR se.service_code ILIKE '%will_call%' THEN 'shipping'
      WHEN se.service_code ILIKE '%insp%' OR se.service_code ILIKE '%assy%' OR se.service_code ILIKE '%repair%' THEN 'task'
      ELSE 'general'
    END;

    -- Map input_mode based on billing_unit
    mapped_input_mode := CASE
      WHEN mapped_unit IN ('per_hour', 'per_minute') THEN 'time'
      WHEN se.service_code ILIKE '%labor%' OR se.service_code ILIKE '%hr%' THEN 'time'
      ELSE 'qty'
    END;

    -- Check if charge_type already exists
    SELECT id INTO ct_id
    FROM public.charge_types
    WHERE tenant_id = se.tenant_id AND charge_code = se.service_code;

    -- Insert charge_type if not exists
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
        se.tenant_id,
        se.service_code,
        se.service_name,
        mapped_category,
        se.is_active,
        COALESCE(se.taxable, false),
        mapped_trigger,
        mapped_input_mode,
        COALESCE(se.add_to_service_event_scan, false),
        COALESCE(se.add_flag, false),
        COALESCE(se.alert_rule, 'none'),
        se.notes,
        se.service_code
      )
      RETURNING id INTO ct_id;
    END IF;
  END LOOP;

  -- Now create pricing_rules for each service_event (including class-specific ones)
  FOR se IN
    SELECT
      se.tenant_id,
      se.service_code,
      se.class_code,
      se.rate,
      se.billing_unit,
      se.service_time_minutes,
      se.uses_class_pricing,
      ct.id AS charge_type_id
    FROM public.service_events se
    JOIN public.charge_types ct ON ct.tenant_id = se.tenant_id AND ct.charge_code = se.service_code
    WHERE se.tenant_id IS NOT NULL
      AND ct.deleted_at IS NULL
  LOOP
    -- Map billing_unit to new unit format
    mapped_unit := CASE
      WHEN se.billing_unit ILIKE '%day%' THEN 'per_day'
      WHEN se.billing_unit ILIKE '%month%' THEN 'per_month'
      WHEN se.billing_unit ILIKE '%hour%' THEN 'per_hour'
      WHEN se.billing_unit ILIKE '%minute%' THEN 'per_minute'
      WHEN se.billing_unit ILIKE '%task%' THEN 'per_task'
      WHEN se.billing_unit ILIKE '%item%' THEN 'per_item'
      ELSE 'each'
    END;

    -- Insert pricing_rule if not exists
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
      se.tenant_id,
      se.charge_type_id,
      CASE WHEN se.class_code IS NOT NULL THEN 'class_based' ELSE 'flat' END,
      se.class_code,
      mapped_unit,
      COALESCE(se.rate, 0),
      CASE WHEN se.class_code IS NULL THEN true ELSE false END,
      COALESCE(se.service_time_minutes, 0)
    )
    ON CONFLICT (charge_type_id, class_code) DO UPDATE SET
      rate = EXCLUDED.rate,
      unit = EXCLUDED.unit,
      service_time_minutes = EXCLUDED.service_time_minutes,
      updated_at = now();
  END LOOP;

  RAISE NOTICE 'Backfill complete';
END $$;


-- =============================================================================
-- STEP 6: Create helper function for rate lookup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_effective_rate(
  p_tenant_id UUID,
  p_charge_code TEXT,
  p_account_id UUID DEFAULT NULL,
  p_class_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  charge_type_id UUID,
  charge_code TEXT,
  charge_name TEXT,
  category TEXT,
  is_taxable BOOLEAN,
  default_trigger TEXT,
  input_mode TEXT,
  service_time_minutes INTEGER,
  add_to_scan BOOLEAN,
  add_flag BOOLEAN,
  unit TEXT,
  base_rate NUMERIC,
  effective_rate NUMERIC,
  adjustment_type TEXT,
  adjustment_applied BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_charge_type RECORD;
  v_pricing_rule RECORD;
  v_adjustment RECORD;
  v_base_rate NUMERIC;
  v_effective_rate NUMERIC;
  v_adjustment_type TEXT := NULL;
  v_adjustment_applied BOOLEAN := false;
  v_error_message TEXT := NULL;
BEGIN
  -- Step 1: Find the charge_type
  SELECT * INTO v_charge_type
  FROM public.charge_types ct
  WHERE ct.tenant_id = p_tenant_id
    AND ct.charge_code = p_charge_code
    AND ct.is_active = true
    AND ct.deleted_at IS NULL;

  IF v_charge_type.id IS NULL THEN
    v_error_message := 'Charge type not found: ' || p_charge_code;
    RETURN QUERY SELECT
      NULL::UUID, p_charge_code, NULL::TEXT, NULL::TEXT, false, 'manual', 'qty',
      0, false, false, 'each', 0::NUMERIC, 0::NUMERIC, NULL::TEXT, false, v_error_message;
    RETURN;
  END IF;

  -- Step 2: Find pricing rule (class-specific first, then default)
  -- Try class-specific rule first
  IF p_class_code IS NOT NULL THEN
    SELECT * INTO v_pricing_rule
    FROM public.pricing_rules pr
    WHERE pr.charge_type_id = v_charge_type.id
      AND pr.class_code = p_class_code
      AND pr.deleted_at IS NULL;
  END IF;

  -- Fall back to default rule
  IF v_pricing_rule.id IS NULL THEN
    SELECT * INTO v_pricing_rule
    FROM public.pricing_rules pr
    WHERE pr.charge_type_id = v_charge_type.id
      AND pr.is_default = true
      AND pr.deleted_at IS NULL;
  END IF;

  -- Fall back to any rule (first one)
  IF v_pricing_rule.id IS NULL THEN
    SELECT * INTO v_pricing_rule
    FROM public.pricing_rules pr
    WHERE pr.charge_type_id = v_charge_type.id
      AND pr.deleted_at IS NULL
    ORDER BY pr.class_code NULLS FIRST
    LIMIT 1;
  END IF;

  IF v_pricing_rule.id IS NULL THEN
    v_error_message := 'No pricing rule found for: ' || p_charge_code;
    v_base_rate := 0;
  ELSE
    v_base_rate := COALESCE(v_pricing_rule.rate, 0);
  END IF;

  v_effective_rate := v_base_rate;

  -- Step 3: Apply account adjustments from account_service_settings
  IF p_account_id IS NOT NULL AND v_pricing_rule.id IS NOT NULL THEN
    SELECT * INTO v_adjustment
    FROM public.account_service_settings ass
    WHERE ass.account_id = p_account_id
      AND ass.service_code = p_charge_code;

    IF v_adjustment.id IS NOT NULL THEN
      -- Check if billing is disabled for this account + service
      IF v_adjustment.is_enabled = false THEN
        v_error_message := 'Billing for this service is disabled for this account. Please update account pricing settings to continue.';
        RETURN QUERY SELECT
          v_charge_type.id, v_charge_type.charge_code, v_charge_type.charge_name,
          v_charge_type.category, v_charge_type.is_taxable, v_charge_type.default_trigger,
          v_charge_type.input_mode, COALESCE(v_pricing_rule.service_time_minutes, 0),
          v_charge_type.add_to_scan, v_charge_type.add_flag,
          COALESCE(v_pricing_rule.unit, 'each'), v_base_rate, 0::NUMERIC,
          NULL::TEXT, false, v_error_message;
        RETURN;
      END IF;

      -- Apply custom_rate (override) or custom_percent_adjust (percentage)
      IF v_adjustment.custom_rate IS NOT NULL THEN
        v_adjustment_applied := true;
        v_adjustment_type := 'override';
        v_effective_rate := v_adjustment.custom_rate;
      ELSIF v_adjustment.custom_percent_adjust IS NOT NULL THEN
        v_adjustment_applied := true;
        v_adjustment_type := 'percentage';
        v_effective_rate := v_base_rate * (1 + v_adjustment.custom_percent_adjust / 100);
      END IF;
    END IF;
  END IF;

  -- Return the result
  RETURN QUERY SELECT
    v_charge_type.id,
    v_charge_type.charge_code,
    v_charge_type.charge_name,
    v_charge_type.category,
    v_charge_type.is_taxable,
    v_charge_type.default_trigger,
    v_charge_type.input_mode,
    COALESCE(v_pricing_rule.service_time_minutes, 0),
    v_charge_type.add_to_scan,
    v_charge_type.add_flag,
    COALESCE(v_pricing_rule.unit, 'each'),
    v_base_rate,
    v_effective_rate,
    v_adjustment_type,
    v_adjustment_applied,
    v_error_message;
END;
$$;


-- =============================================================================
-- STEP 7: Updated_at triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charge_types_updated_at ON public.charge_types;
CREATE TRIGGER charge_types_updated_at
  BEFORE UPDATE ON public.charge_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS account_charge_adjustments_updated_at ON public.account_charge_adjustments;
CREATE TRIGGER account_charge_adjustments_updated_at
  BEFORE UPDATE ON public.account_charge_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- STEP 8: Grant permissions
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charge_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_type_charge_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_charge_adjustments TO authenticated;


-- =============================================================================
-- Done!
-- =============================================================================
COMMENT ON TABLE public.charge_types IS 'Master charge definitions - replaces service_events for charge metadata';
COMMENT ON TABLE public.pricing_rules IS 'Rates per charge type with class-based pricing support';
COMMENT ON TABLE public.task_type_charge_links IS 'Links task types to charge types for automatic billing on task completion';
COMMENT ON TABLE public.account_charge_adjustments IS 'Account-specific pricing adjustments for charge types';
COMMENT ON FUNCTION public.get_effective_rate IS 'Looks up effective rate for a charge code with account adjustments applied';
