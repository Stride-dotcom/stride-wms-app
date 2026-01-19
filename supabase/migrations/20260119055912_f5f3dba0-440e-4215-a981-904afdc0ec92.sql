-- Fix communication admin helper function (roles table uses 'name', not 'key')
CREATE OR REPLACE FUNCTION public.is_communication_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND ur.deleted_at IS NULL
      AND lower(r.name) IN ('admin', 'tenant_admin', 'super_admin')
  );
END;
$$;