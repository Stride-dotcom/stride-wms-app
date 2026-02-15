-- =============================================================================
-- Admin SMS Sender Ops RPCs + Admin Select Policies
-- Migration: 20260215060000_admin_sms_sender_ops_views.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Allow admin_dev read access to sender profile tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_sms_sender_profiles_select_admin_dev" ON public.tenant_sms_sender_profiles;
CREATE POLICY "tenant_sms_sender_profiles_select_admin_dev"
  ON public.tenant_sms_sender_profiles FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin_dev());

DROP POLICY IF EXISTS "tenant_sms_sender_profile_log_select_admin_dev" ON public.tenant_sms_sender_profile_log;
CREATE POLICY "tenant_sms_sender_profile_log_select_admin_dev"
  ON public.tenant_sms_sender_profile_log FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin_dev());

-- ---------------------------------------------------------------------------
-- 2) Admin RPC: list sender profiles with tenant/company context
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_list_sms_sender_profiles(
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  company_name text,
  company_email text,
  app_subdomain text,
  sender_type text,
  provisioning_status text,
  twilio_phone_number_sid text,
  twilio_phone_number_e164 text,
  requested_at timestamptz,
  verification_submitted_at timestamptz,
  verification_approved_at timestamptz,
  verification_rejected_at timestamptz,
  billing_start_at timestamptz,
  last_error text,
  sms_addon_active boolean,
  sms_addon_status text,
  sms_enabled boolean,
  profile_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_user_is_admin_dev() THEN
    RAISE EXCEPTION 'Only admin_dev users can access sender ops list';
  END IF;

  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    tcs.company_name,
    tcs.company_email,
    tcs.app_subdomain,
    sp.sender_type,
    sp.provisioning_status,
    sp.twilio_phone_number_sid,
    sp.twilio_phone_number_e164,
    sp.requested_at,
    sp.verification_submitted_at,
    sp.verification_approved_at,
    sp.verification_rejected_at,
    sp.billing_start_at,
    sp.last_error,
    COALESCE(sa.is_active, false) AS sms_addon_active,
    COALESCE(sa.activation_status, 'not_activated') AS sms_addon_status,
    COALESCE(tcs.sms_enabled, false) AS sms_enabled,
    sp.updated_at AS profile_updated_at
  FROM public.tenant_sms_sender_profiles sp
  JOIN public.tenants t
    ON t.id = sp.tenant_id
  LEFT JOIN public.tenant_company_settings tcs
    ON tcs.tenant_id = sp.tenant_id
  LEFT JOIN public.tenant_sms_addon_activation sa
    ON sa.tenant_id = sp.tenant_id
  WHERE p_status IS NULL OR p_status = '' OR sp.provisioning_status = p_status
  ORDER BY
    sp.requested_at DESC NULLS LAST,
    sp.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_list_sms_sender_profiles(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_list_sms_sender_profiles(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_list_sms_sender_profiles(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Admin RPC: sender profile event history per tenant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_get_sms_sender_profile_log(
  p_tenant_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  event_type text,
  actor_user_id uuid,
  status_from text,
  status_to text,
  notes text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_user_is_admin_dev() THEN
    RAISE EXCEPTION 'Only admin_dev users can access sender ops history';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  RETURN QUERY
  SELECT
    l.id,
    l.tenant_id,
    l.event_type,
    l.actor_user_id,
    l.status_from,
    l.status_to,
    l.notes,
    l.metadata,
    l.created_at
  FROM public.tenant_sms_sender_profile_log l
  WHERE l.tenant_id = p_tenant_id
  ORDER BY l.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_admin_get_sms_sender_profile_log(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_admin_get_sms_sender_profile_log(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_get_sms_sender_profile_log(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.rpc_admin_list_sms_sender_profiles(text) IS
'Admin-dev sender ops queue list with tenant/company context and activation/readiness fields.';
COMMENT ON FUNCTION public.rpc_admin_get_sms_sender_profile_log(uuid, integer) IS
'Admin-dev sender profile audit events for a tenant.';

