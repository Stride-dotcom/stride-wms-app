-- ============================================================================
-- V4 Alert Triggers Upsert
-- ============================================================================
-- Ensures every trigger_event from v4 manifest.json exists in
-- communication_alerts for every tenant. Idempotent: uses WHERE NOT EXISTS
-- to skip rows that already exist (by trigger_event per tenant).
--
-- If a row already exists we leave it alone (preserves tenant preferences).
-- ============================================================================

DO $$
DECLARE
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN (SELECT id FROM public.tenants) LOOP

    -- 1. shipment_created
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Shipment Created', 'SHIPMENT_CREATED',
      'Sent when a new shipment record is created',
      'shipment_created',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'shipment_created'
    );

    -- 2. shipment_scheduled
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Shipment Scheduled', 'SHIPMENT_SCHEDULED',
      'Sent when a shipment is scheduled for delivery',
      'shipment_scheduled',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'shipment_scheduled'
    );

    -- 3. shipment_delayed
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Shipment Delayed', 'SHIPMENT_DELAYED',
      'Sent when a shipment experiences a delay',
      'shipment_delayed',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'shipment_delayed'
    );

    -- 4. shipment_out_for_delivery
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Shipment Out for Delivery', 'SHIPMENT_OUT_FOR_DELIVERY',
      'Sent when a shipment is out for delivery',
      'shipment_out_for_delivery',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'shipment_out_for_delivery'
    );

    -- 5. shipment_delivered
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Shipment Delivered', 'SHIPMENT_DELIVERED',
      'Sent when a shipment has been delivered',
      'shipment_delivered',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'shipment_delivered'
    );

    -- 6. will_call_ready
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Will Call Ready', 'WILL_CALL_READY',
      'Sent when a will-call release is ready for pickup',
      'will_call_ready',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'will_call_ready'
    );

    -- 7. will_call_released
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Will Call Released', 'WILL_CALL_RELEASED',
      'Sent when a will-call release has been completed',
      'will_call_released',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'will_call_released'
    );

    -- 8. inspection_started
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Inspection Started', 'INSPECTION_STARTED',
      'Sent when an inspection process begins',
      'inspection_started',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'inspection_started'
    );

    -- 9. inspection_report_available
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Inspection Report Available', 'INSPECTION_REPORT_AVAILABLE',
      'Sent when an inspection report is ready for review',
      'inspection_report_available',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'inspection_report_available'
    );

    -- 10. inspection_requires_attention
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Inspection Requires Attention', 'INSPECTION_REQUIRES_ATTENTION',
      'Sent when inspection findings require client review or action',
      'inspection_requires_attention',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'inspection_requires_attention'
    );

    -- 11. task_assigned
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Task Assigned', 'TASK_ASSIGNED',
      'Sent when a task is assigned to a team member',
      'task_assigned',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'task_assigned'
    );

    -- 12. task_completed
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Task Completed', 'TASK_COMPLETED',
      'Sent when a task is marked as completed',
      'task_completed',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'task_completed'
    );

    -- 13. task_overdue
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Task Overdue', 'TASK_OVERDUE',
      'Sent when a task has passed its due date',
      'task_overdue',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'task_overdue'
    );

    -- 14. repair_started
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Repair Started', 'REPAIR_STARTED',
      'Sent when repair work begins on an item',
      'repair_started',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'repair_started'
    );

    -- 15. repair_completed
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Repair Completed', 'REPAIR_COMPLETED',
      'Sent when repair work is finished on an item',
      'repair_completed',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'repair_completed'
    );

    -- 16. repair_requires_approval
    INSERT INTO public.communication_alerts
      (tenant_id, name, key, description, trigger_event, channels, is_enabled, timing_rule)
    SELECT v_tenant.id, 'Repair Requires Approval', 'REPAIR_REQUIRES_APPROVAL',
      'Sent when a repair estimate needs client approval before proceeding',
      'repair_requires_approval',
      '{"email": true, "sms": true}'::jsonb, true, 'immediate'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.communication_alerts
      WHERE tenant_id = v_tenant.id AND trigger_event = 'repair_requires_approval'
    );

  END LOOP;

  RAISE NOTICE 'V4 alert triggers upserted for all tenants';
END;
$$;
