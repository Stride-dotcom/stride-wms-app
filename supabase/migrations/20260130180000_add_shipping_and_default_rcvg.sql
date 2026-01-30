-- ============================================================================
-- Add missing Shipping service and default RCVG entries to service_events
-- ============================================================================

-- Add default RCVG entry (no class) for items without assigned classes
INSERT INTO service_events (
  tenant_id, class_code, service_code, service_name, billing_unit,
  service_time_minutes, rate, taxable, add_flag, uses_class_pricing, notes,
  add_to_service_event_scan, is_active, alert_rule, billing_trigger
)
SELECT
  t.id,
  NULL,  -- No class code (default)
  'RCVG',
  'Receiving',
  'Item',
  5,     -- service_time_minutes
  12,    -- default rate for items without class
  true,  -- taxable
  false, -- add_flag
  true,  -- uses_class_pricing (this is a fallback for missing classes)
  'Default receiving rate for items without class',
  false, -- add_to_service_event_scan
  true,  -- is_active
  'none',
  'Shipment'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM service_events se
  WHERE se.tenant_id = t.id
    AND se.service_code = 'RCVG'
    AND se.class_code IS NULL
);

-- Add Shipping service entries by class
INSERT INTO service_events (
  tenant_id, class_code, service_code, service_name, billing_unit,
  service_time_minutes, rate, taxable, add_flag, uses_class_pricing, notes,
  add_to_service_event_scan, is_active, alert_rule, billing_trigger
)
SELECT
  t.id,
  class_code,
  'Shipping',
  'Shipping',
  'Item',
  service_time_minutes,
  rate,
  true,  -- taxable
  false, -- add_flag
  true,  -- uses_class_pricing
  'Outbound Shipping',
  false, -- add_to_service_event_scan
  true,  -- is_active
  'none',
  'Shipment'
FROM tenants t
CROSS JOIN (VALUES
  ('XS', 5, 10),
  ('S', 5, 10),
  ('M', 5, 15),
  ('L', 5, 15),
  ('XL', 7, 20),
  ('XXL', 9, 25)
) AS vals(class_code, service_time_minutes, rate)
WHERE NOT EXISTS (
  SELECT 1 FROM service_events se
  WHERE se.tenant_id = t.id
    AND se.service_code = 'Shipping'
    AND se.class_code = vals.class_code
);

-- Add default Shipping entry (no class) for items without assigned classes
INSERT INTO service_events (
  tenant_id, class_code, service_code, service_name, billing_unit,
  service_time_minutes, rate, taxable, add_flag, uses_class_pricing, notes,
  add_to_service_event_scan, is_active, alert_rule, billing_trigger
)
SELECT
  t.id,
  NULL,  -- No class code (default)
  'Shipping',
  'Shipping',
  'Item',
  5,     -- service_time_minutes
  12,    -- default rate for items without class
  true,  -- taxable
  false, -- add_flag
  true,  -- uses_class_pricing
  'Default shipping rate for items without class',
  false, -- add_to_service_event_scan
  true,  -- is_active
  'none',
  'Shipment'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM service_events se
  WHERE se.tenant_id = t.id
    AND se.service_code = 'Shipping'
    AND se.class_code IS NULL
);

-- Also update the seed_service_events function to include these for new tenants
CREATE OR REPLACE FUNCTION public.seed_service_events(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear existing for this tenant (if re-seeding)
  DELETE FROM service_events WHERE tenant_id = p_tenant_id;

  -- Insert standard pricing
  INSERT INTO service_events (
    tenant_id, class_code, service_code, service_name, billing_unit,
    service_time_minutes, rate, taxable, add_flag, uses_class_pricing, notes,
    add_to_service_event_scan, is_active, alert_rule, billing_trigger
  ) VALUES
  -- ============================================================================
  -- SCAN EVENTS (add_to_service_event_scan = true for most)
  -- ============================================================================

  -- Photo charges
  (p_tenant_id, NULL, 'Photo1', '1 Photo', 'Item', 2, 2, true, false, false, 'First Photo', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, NULL, 'Photo', '+1 Photo', 'Item', 2, 1, true, false, false, 'Additional Photo', false, true, 'none', 'SCAN EVENT'),

  -- Blanket wrap
  (p_tenant_id, NULL, 'Blanket', 'Blanket', 'Item', 6, 20, true, false, false, 'Blanket Wrap', false, true, 'none', 'SCAN EVENT'),

  -- Pad wrap (by class)
  (p_tenant_id, 'XS', 'Pad', 'Pad Wrap', 'Item', 3, 3, true, false, true, 'Pad Wrap', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'S', 'Pad', 'Pad Wrap', 'Item', 4, 7, true, false, true, 'Pad Wrap', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'M', 'Pad', 'Pad Wrap', 'Item', 5, 10, true, false, true, 'Pad Wrap', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'L', 'Pad', 'Pad Wrap', 'Item', 6, 15, true, false, true, 'Pad Wrap', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'XL', 'Pad', 'Pad Wrap', 'Item', 8, 20, true, false, true, 'Pad Wrap', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'XXL', 'Pad', 'Pad Wrap', 'Item', 10, 30, true, false, true, 'Pad Wrap', false, true, 'none', 'SCAN EVENT'),

  -- Crate (by class)
  (p_tenant_id, 'XS', 'Crate', 'Crate', 'Item', 10, 30, true, false, true, 'Crate Required', false, true, 'email_office', 'SCAN EVENT'),
  (p_tenant_id, 'S', 'Crate', 'Crate', 'Item', 15, 50, true, false, true, 'Crate Required', false, true, 'email_office', 'SCAN EVENT'),
  (p_tenant_id, 'M', 'Crate', 'Crate', 'Item', 20, 75, true, false, true, 'Crate Required', false, true, 'email_office', 'SCAN EVENT'),
  (p_tenant_id, 'L', 'Crate', 'Crate', 'Item', 30, 115, true, false, true, 'Crate Required', false, true, 'email_office', 'SCAN EVENT'),
  (p_tenant_id, 'XL', 'Crate', 'Crate', 'Item', 40, 250, true, false, true, 'Crate Required', false, true, 'email_office', 'SCAN EVENT'),
  (p_tenant_id, 'XXL', 'Crate', 'Crate', 'Item', 60, 350, true, false, true, 'Crate Required', false, true, 'email_office', 'SCAN EVENT'),

  -- Uncrate (by class)
  (p_tenant_id, 'XS', 'Uncrate', 'Uncrate', 'Item', 10, 30, true, false, true, 'Uncrate', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'S', 'Uncrate', 'Uncrate', 'Item', 15, 50, true, false, true, 'Uncrate', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'M', 'Uncrate', 'Uncrate', 'Item', 20, 75, true, false, true, 'Uncrate', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'L', 'Uncrate', 'Uncrate', 'Item', 30, 115, true, false, true, 'Uncrate', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'XL', 'Uncrate', 'Uncrate', 'Item', 40, 175, true, false, true, 'Uncrate', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'XXL', 'Uncrate', 'Uncrate', 'Item', 60, 275, true, false, true, 'Uncrate', false, true, 'none', 'SCAN EVENT'),

  -- Vault (by class)
  (p_tenant_id, 'XS', 'Vault', 'Vault', 'Item', 8, 15, true, false, true, 'Vaulting', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'S', 'Vault', 'Vault', 'Item', 10, 25, true, false, true, 'Vaulting', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'M', 'Vault', 'Vault', 'Item', 12, 50, true, false, true, 'Vaulting', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'L', 'Vault', 'Vault', 'Item', 14, 75, true, false, true, 'Vaulting', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'XL', 'Vault', 'Vault', 'Item', 20, 125, true, false, true, 'Vaulting', false, true, 'email_office', 'SCAN EVENT'),
  (p_tenant_id, 'XXL', 'Vault', 'Vault', 'Item', 30, 175, true, false, true, 'Vaulting', false, true, 'email_office', 'SCAN EVENT'),

  -- Debris removal
  (p_tenant_id, NULL, 'Debris', 'Debris', 'Item', 3, 15, true, false, false, 'Debris Removal', false, true, 'none', 'SCAN EVENT'),

  -- Pallet
  (p_tenant_id, NULL, 'Pallet', 'Pallet', 'Item', 4, 25, true, false, false, 'Put on Pallet', false, true, 'none', 'SCAN EVENT'),

  -- Restock Small
  (p_tenant_id, NULL, 'Restock_Sm', 'Restock', 'Item', 4, 25, true, true, false, 'Restock Item', false, true, 'none', 'SCAN EVENT'),

  -- Restock Large
  (p_tenant_id, NULL, 'Restock_Lrg', 'Restock', 'Item', 10, 50, true, true, false, 'Restock Item', false, true, 'none', 'SCAN EVENT'),

  -- Wrap / Shrink Wrapping
  (p_tenant_id, NULL, 'Wrap', 'Shrink Wrapping', 'Item', 4, 15, true, true, false, 'Shrink wrap added', false, true, 'none', 'SCAN EVENT'),

  -- Sit Test (by class)
  (p_tenant_id, 'XS', 'Sit_test', 'Sit Test', 'Item', 5, 2, true, false, true, 'Sit Test or Viewing', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'S', 'Sit_test', 'Sit Test', 'Item', 5, 3, true, false, true, 'Sit Test or Viewing', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'M', 'Sit_test', 'Sit Test', 'Item', 5, 5, true, false, true, 'Sit Test or Viewing', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'L', 'Sit_test', 'Sit Test', 'Item', 5, 7, true, false, true, 'Sit Test or Viewing', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'XL', 'Sit_test', 'Sit Test', 'Item', 7, 9, true, false, true, 'Sit Test or Viewing', false, true, 'none', 'SCAN EVENT'),
  (p_tenant_id, 'XXL', 'Sit_test', 'Sit Test', 'Item', 9, 12, true, false, true, 'Sit Test or Viewing', true, true, 'none', 'SCAN EVENT'),

  -- ============================================================================
  -- SHIPMENT SERVICES
  -- ============================================================================

  -- Receiving (by class) - Shipment
  (p_tenant_id, 'XS', 'RCVG', 'Receiving', 'Item', 5, 10, true, false, true, 'Receive and put away Item', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'S', 'RCVG', 'Receiving', 'Item', 5, 10, true, false, true, 'Receive and put away Item', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'M', 'RCVG', 'Receiving', 'Item', 5, 15, true, false, true, 'Receive and put away Item', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'L', 'RCVG', 'Receiving', 'Item', 5, 15, true, false, true, 'Receive and put away Item', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'XL', 'RCVG', 'Receiving', 'Item', 7, 20, true, false, true, 'Receive and put away Item', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'XXL', 'RCVG', 'Receiving', 'Item', 9, 25, true, false, true, 'Receive and put away Item', false, false, 'none', 'Shipment'),
  -- Default RCVG for items without class
  (p_tenant_id, NULL, 'RCVG', 'Receiving', 'Item', 5, 12, true, false, true, 'Default receiving rate for items without class', false, false, 'none', 'Shipment'),

  -- Shipping (by class) - Shipment
  (p_tenant_id, 'XS', 'Shipping', 'Shipping', 'Item', 5, 10, true, false, true, 'Outbound Shipping', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'S', 'Shipping', 'Shipping', 'Item', 5, 10, true, false, true, 'Outbound Shipping', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'M', 'Shipping', 'Shipping', 'Item', 5, 15, true, false, true, 'Outbound Shipping', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'L', 'Shipping', 'Shipping', 'Item', 5, 15, true, false, true, 'Outbound Shipping', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'XL', 'Shipping', 'Shipping', 'Item', 7, 20, true, false, true, 'Outbound Shipping', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'XXL', 'Shipping', 'Shipping', 'Item', 9, 25, true, false, true, 'Outbound Shipping', false, false, 'none', 'Shipment'),
  -- Default Shipping for items without class
  (p_tenant_id, NULL, 'Shipping', 'Shipping', 'Item', 5, 12, true, false, true, 'Default shipping rate for items without class', false, false, 'none', 'Shipment'),

  -- Returns Processing (by class) - Shipment
  (p_tenant_id, 'XS', 'Returns', 'Returns Processing', 'Item', 5, 10, true, false, true, 'Return Shipment Processing', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'S', 'Returns', 'Returns Processing', 'Item', 5, 10, true, false, true, 'Return Shipment Processing', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'M', 'Returns', 'Returns Processing', 'Item', 5, 15, true, false, true, 'Return Shipment Processing', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'L', 'Returns', 'Returns Processing', 'Item', 5, 15, true, false, true, 'Return Shipment Processing', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'XL', 'Returns', 'Returns Processing', 'Item', 7, 20, true, false, true, 'Return Shipment Processing', false, false, 'none', 'Shipment'),
  (p_tenant_id, 'XXL', 'Returns', 'Returns Processing', 'Item', 9, 25, true, false, true, 'Return Shipment Processing', false, false, 'none', 'Shipment'),

  -- Stocktake
  (p_tenant_id, NULL, 'STOCKTAKE', 'Stocktake', 'Item', 2, 2, true, false, true, 'Flat per item scanned.', false, false, 'none', 'Stocktake'),

  -- ============================================================================
  -- TASK SERVICES
  -- ============================================================================

  -- Disposal (by class)
  (p_tenant_id, 'XS', 'Disposal', 'Disposal', 'Item', 7, 10, true, false, true, 'Disposal Or Donation', false, false, 'none', 'TASK'),
  (p_tenant_id, 'S', 'Disposal', 'Disposal', 'Item', 7, 25, true, false, true, 'Disposal Or Donation', false, false, 'none', 'TASK'),
  (p_tenant_id, 'M', 'Disposal', 'Disposal', 'Item', 9, 50, true, false, true, 'Disposal Or Donation', false, false, 'none', 'TASK'),
  (p_tenant_id, 'L', 'Disposal', 'Disposal', 'Item', 10, 100, true, false, true, 'Disposal Or Donation', false, false, 'none', 'TASK'),
  (p_tenant_id, 'XL', 'Disposal', 'Disposal', 'Item', 14, 185, true, false, true, 'Disposal Or Donation', false, false, 'none', 'TASK'),
  (p_tenant_id, 'XXL', 'Disposal', 'Disposal', 'Item', 20, 250, true, false, true, 'Disposal Or Donation', false, false, 'none', 'TASK'),

  -- Assembly Services (billing_unit = Item)
  (p_tenant_id, NULL, '5MA', 'Assembly <15', 'Item', 5, 25, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '15MA', 'Assembly 15m', 'Item', 15, 35, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '30MA', 'Assembly 30m', 'Item', 30, 70, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '45MA', 'Assembly 45m', 'Item', 45, 105, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '60MA', 'Assembly 60m', 'Item', 60, 140, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '75MA', 'Assembly 75m', 'Item', 75, 175, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '90MA', 'Assembly 1.5hr', 'Item', 90, 210, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '120MA', 'Assembly 120m', 'Item', 120, 245, true, false, true, 'Assembly', false, false, 'none', 'Task - Assign Rate'),

  -- Quote Required Assembly
  (p_tenant_id, NULL, 'QR_ASSM', 'Assembly Mgr Quote Req', 'Item', NULL, 0, true, false, true, 'Manager Quote Required Assembly', false, false, 'email_office', 'Task - Assign Rate'),

  -- Repair Services (billing_unit = Item)
  (p_tenant_id, NULL, '1HRO', '1 Hr Repair', 'Item', 60, 105, true, false, true, 'Repair', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '1.5HRO', 'Repair 1.5hr', 'Item', 90, 212.5, true, false, true, 'Repair', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '2HRO', 'Repair 2hr', 'Item', 60, 110, true, false, true, 'Repair', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '2.5HRO', 'Repair 2.5hr', 'Item', 150, 387.5, true, false, true, 'Repair', false, false, 'none', 'Task - Assign Rate'),
  (p_tenant_id, NULL, '3HRO', 'Repair 3hr', 'Item', 180, 465, true, false, true, 'Repair', false, false, 'none', 'Task - Assign Rate'),

  -- Quote Required Repair
  (p_tenant_id, NULL, 'QR_REPAIR', 'Repair Mgr Quote Req', 'Item', NULL, 0, true, false, true, 'Manager Quote Required Repair', false, false, 'none', 'Task - Assign Rate'),

  -- Inspection (by class) - billing_unit = Item
  (p_tenant_id, 'XS', 'INSP', 'Inspection', 'Item', 7, 15, true, false, true, 'Inspection and pack for storage', false, false, 'email_office', 'Through Task'),
  (p_tenant_id, 'S', 'INSP', 'Inspection', 'Item', 7, 25, true, false, true, 'Inspection and pack for storage', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'M', 'INSP', 'Inspection', 'Item', 9, 35, true, false, true, 'Inspection and pack for storage', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'L', 'INSP', 'Inspection', 'Item', 10, 55, true, false, true, 'Inspection and pack for storage', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'XL', 'INSP', 'Inspection', 'Item', 14, 65, true, false, true, 'Inspection and pack for storage', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'XXL', 'INSP', 'Inspection', 'Item', 20, 75, true, false, true, 'Inspection and pack for storage', false, false, 'none', 'Through Task'),

  -- Will Call (by class) - billing_unit = Item
  (p_tenant_id, 'XS', 'Will_Call', 'Will Call', 'Item', 5, 10, true, false, true, 'Will Call / Outbound Shipment', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'S', 'Will_Call', 'Will Call', 'Item', 5, 10, true, false, true, 'Will Call / Outbound Shipment', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'M', 'Will_Call', 'Will Call', 'Item', 5, 15, true, false, true, 'Will Call / Outbound Shipment', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'L', 'Will_Call', 'Will Call', 'Item', 5, 15, true, false, true, 'Will Call / Outbound Shipment', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'XL', 'Will_Call', 'Will Call', 'Item', 7, 20, true, false, true, 'Will Call / Outbound Shipment', false, false, 'none', 'Through Task'),
  (p_tenant_id, 'XXL', 'Will_Call', 'Will Call', 'Item', 9, 25, true, false, true, 'Will Call / Outbound Shipment', false, false, 'none', 'Through Task');

END;
$$;

COMMENT ON FUNCTION public.seed_service_events IS 'Populate standard price list for a tenant - includes Shipping and default RCVG entries';
