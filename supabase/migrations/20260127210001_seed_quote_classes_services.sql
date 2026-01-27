-- Seed Quote Classes and Services
-- Creates default classes and services for the quoting tool

-- ============================================================================
-- Seed Quote Classes (based on standard warehouse item sizes)
-- ============================================================================

-- This will only insert if the tenant has no quote classes yet
INSERT INTO public.quote_classes (tenant_id, name, description, display_order, is_active)
SELECT
  t.id as tenant_id,
  cls.name,
  cls.description,
  cls.display_order,
  true
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('XS - Extra Small', 'Small items under 1 cubic foot', 1),
    ('S - Small', 'Items 1-5 cubic feet', 2),
    ('M - Medium', 'Items 5-15 cubic feet', 3),
    ('L - Large', 'Items 15-40 cubic feet', 4),
    ('XL - Extra Large', 'Items 40-100 cubic feet', 5),
    ('XXL - Oversized', 'Items over 100 cubic feet', 6)
) AS cls(name, description, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.quote_classes qc WHERE qc.tenant_id = t.id
);

-- ============================================================================
-- Seed Quote Services (standard warehouse services)
-- ============================================================================

INSERT INTO public.quote_services (tenant_id, category, name, description, billing_unit, trigger_label, is_storage_service, is_taxable_default, display_order, is_active)
SELECT
  t.id as tenant_id,
  svc.category,
  svc.name,
  svc.description,
  svc.billing_unit::quote_billing_unit,
  svc.trigger_label,
  svc.is_storage_service,
  svc.is_taxable_default,
  svc.display_order,
  true
FROM public.tenants t
CROSS JOIN (
  VALUES
    -- Receiving Services
    ('Receiving', 'Standard Receiving', 'Unload, count, and check-in items', 'per_piece', 'Receiving', false, true, 1),
    ('Receiving', 'Inspection', 'Detailed inspection of items for damage', 'per_piece', 'Inspection', false, true, 2),
    ('Receiving', 'Photo Documentation', 'Photograph items during receiving', 'per_piece', 'Receiving', false, true, 3),

    -- Storage Services
    ('Storage', 'Standard Storage', 'Daily storage rate per item', 'per_day', 'Storage', true, true, 10),
    ('Storage', 'Climate Controlled Storage', 'Temperature and humidity controlled storage', 'per_day', 'Storage', true, true, 11),
    ('Storage', 'High Security Storage', 'Enhanced security storage for high-value items', 'per_day', 'Storage', true, true, 12),

    -- Handling Services
    ('Handling', 'Standard Handling', 'Move items within warehouse', 'per_piece', 'Handling', false, true, 20),
    ('Handling', 'Crating', 'Build custom crate for item', 'per_piece', 'Assembly', false, true, 21),
    ('Handling', 'Uncrating', 'Remove item from crate', 'per_piece', 'Assembly', false, true, 22),
    ('Handling', 'Blanket Wrap', 'Wrap item in protective blankets', 'per_piece', 'Handling', false, true, 23),

    -- Assembly Services
    ('Assembly', 'Basic Assembly', 'Simple assembly (1-2 hours estimated)', 'per_hour', 'Assembly', false, true, 30),
    ('Assembly', 'Complex Assembly', 'Complex assembly requiring multiple technicians', 'per_hour', 'Assembly', false, true, 31),
    ('Assembly', 'Disassembly', 'Disassemble items for storage or transport', 'per_hour', 'Assembly', false, true, 32),

    -- Delivery Services
    ('Delivery', 'Local Delivery', 'Delivery within metro area', 'flat', 'Delivery', false, true, 40),
    ('Delivery', 'White Glove Delivery', 'Premium delivery with placement and setup', 'flat', 'Delivery', false, true, 41),
    ('Delivery', 'Delivery Labor', 'Additional labor for delivery', 'per_hour', 'Delivery', false, true, 42),

    -- Special Services
    ('Special', 'Custom Service', 'Custom service - specify in notes', 'flat', 'Special', false, true, 50),
    ('Special', 'Rush Processing', 'Expedited processing surcharge', 'flat', 'Special', false, true, 51),
    ('Special', 'After Hours Service', 'Service outside normal business hours', 'per_hour', 'Special', false, true, 52)
) AS svc(category, name, description, billing_unit, trigger_label, is_storage_service, is_taxable_default, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.quote_services qs WHERE qs.tenant_id = t.id
);

-- ============================================================================
-- Seed Default Service Rates
-- ============================================================================

-- Insert default rates for each service/class combination
INSERT INTO public.quote_service_rates (tenant_id, service_id, class_id, rate_amount, currency, is_current)
SELECT
  qs.tenant_id,
  qs.id as service_id,
  qc.id as class_id,
  CASE
    -- Receiving rates by class
    WHEN qs.name = 'Standard Receiving' THEN
      CASE qc.name
        WHEN 'XS - Extra Small' THEN 5.00
        WHEN 'S - Small' THEN 8.00
        WHEN 'M - Medium' THEN 12.00
        WHEN 'L - Large' THEN 18.00
        WHEN 'XL - Extra Large' THEN 25.00
        WHEN 'XXL - Oversized' THEN 35.00
        ELSE 10.00
      END
    -- Inspection rates
    WHEN qs.name = 'Inspection' THEN
      CASE qc.name
        WHEN 'XS - Extra Small' THEN 3.00
        WHEN 'S - Small' THEN 5.00
        WHEN 'M - Medium' THEN 8.00
        WHEN 'L - Large' THEN 12.00
        WHEN 'XL - Extra Large' THEN 18.00
        WHEN 'XXL - Oversized' THEN 25.00
        ELSE 8.00
      END
    -- Storage rates (per day)
    WHEN qs.name = 'Standard Storage' THEN
      CASE qc.name
        WHEN 'XS - Extra Small' THEN 0.15
        WHEN 'S - Small' THEN 0.25
        WHEN 'M - Medium' THEN 0.45
        WHEN 'L - Large' THEN 0.75
        WHEN 'XL - Extra Large' THEN 1.25
        WHEN 'XXL - Oversized' THEN 2.00
        ELSE 0.50
      END
    WHEN qs.name = 'Climate Controlled Storage' THEN
      CASE qc.name
        WHEN 'XS - Extra Small' THEN 0.25
        WHEN 'S - Small' THEN 0.40
        WHEN 'M - Medium' THEN 0.70
        WHEN 'L - Large' THEN 1.10
        WHEN 'XL - Extra Large' THEN 1.80
        WHEN 'XXL - Oversized' THEN 3.00
        ELSE 0.75
      END
    -- Handling rates
    WHEN qs.name = 'Standard Handling' THEN
      CASE qc.name
        WHEN 'XS - Extra Small' THEN 3.00
        WHEN 'S - Small' THEN 5.00
        WHEN 'M - Medium' THEN 10.00
        WHEN 'L - Large' THEN 15.00
        WHEN 'XL - Extra Large' THEN 25.00
        WHEN 'XXL - Oversized' THEN 40.00
        ELSE 10.00
      END
    -- Default rates for other services (flat/hourly)
    WHEN qs.billing_unit = 'per_hour' THEN 65.00
    WHEN qs.billing_unit = 'flat' THEN 150.00
    ELSE 10.00
  END as rate_amount,
  'USD',
  true
FROM public.quote_services qs
CROSS JOIN public.quote_classes qc
WHERE qs.tenant_id = qc.tenant_id
  AND qs.billing_unit IN ('per_piece', 'per_day', 'per_class')
  AND NOT EXISTS (
    SELECT 1 FROM public.quote_service_rates qsr
    WHERE qsr.service_id = qs.id AND qsr.class_id = qc.id
  );

-- Insert rates for non-class-specific services (flat, per_hour, per_line_item)
INSERT INTO public.quote_service_rates (tenant_id, service_id, class_id, rate_amount, currency, is_current)
SELECT
  qs.tenant_id,
  qs.id as service_id,
  NULL as class_id,
  CASE
    WHEN qs.name = 'Basic Assembly' THEN 65.00
    WHEN qs.name = 'Complex Assembly' THEN 85.00
    WHEN qs.name = 'Disassembly' THEN 55.00
    WHEN qs.name = 'Local Delivery' THEN 150.00
    WHEN qs.name = 'White Glove Delivery' THEN 350.00
    WHEN qs.name = 'Delivery Labor' THEN 75.00
    WHEN qs.name = 'Custom Service' THEN 100.00
    WHEN qs.name = 'Rush Processing' THEN 75.00
    WHEN qs.name = 'After Hours Service' THEN 95.00
    WHEN qs.name = 'Photo Documentation' THEN 2.00
    ELSE 50.00
  END as rate_amount,
  'USD',
  true
FROM public.quote_services qs
WHERE qs.billing_unit IN ('flat', 'per_hour', 'per_line_item')
  AND NOT EXISTS (
    SELECT 1 FROM public.quote_service_rates qsr
    WHERE qsr.service_id = qs.id AND qsr.class_id IS NULL
  );
