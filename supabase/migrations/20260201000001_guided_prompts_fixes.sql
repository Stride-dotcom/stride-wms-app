-- ============================================================================
-- GUIDED PROMPTS SYSTEM - FIXES AND ENHANCEMENTS
-- Addresses: uniqueness constraint, snooze, versioning, severity-based filtering
-- ============================================================================

-- ============================================================================
-- 1. FIX UNIQUENESS CONSTRAINT - Allow tenant overrides of base prompts
-- ============================================================================

-- Drop the old unique constraint
ALTER TABLE IF EXISTS public.guided_prompts
  DROP CONSTRAINT IF EXISTS guided_prompts_tenant_id_prompt_key_key;

-- Add support for global prompts (tenant_id can be null for base prompts)
ALTER TABLE public.guided_prompts
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Add base_prompt_id to track overrides
ALTER TABLE public.guided_prompts
  ADD COLUMN IF NOT EXISTS base_prompt_id UUID REFERENCES public.guided_prompts(id) ON DELETE SET NULL;

-- Create unique index that handles null tenant_id for global prompts
-- and allows tenant-specific overrides
CREATE UNIQUE INDEX IF NOT EXISTS idx_guided_prompts_unique_key
  ON public.guided_prompts (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), prompt_key)
  WHERE base_prompt_id IS NULL;

-- ============================================================================
-- 2. ADD SEVERITY FIELD - Replace min_level logic with severity-based filtering
-- ============================================================================

-- Severity determines who sees the prompt based on user level:
--   'info'     -> training only
--   'warning'  -> training + standard
--   'blocking' -> training + standard + advanced (everyone)

ALTER TABLE public.guided_prompts
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'blocking'));

-- Migrate existing min_level to severity:
--   training  -> info (only beginners see it)
--   standard  -> warning (beginners + intermediate see it)
--   advanced  -> blocking (everyone sees it)
UPDATE public.guided_prompts
SET severity = CASE
  WHEN min_level = 'training' THEN 'info'
  WHEN min_level = 'standard' THEN 'warning'
  WHEN min_level = 'advanced' THEN 'blocking'
  ELSE 'info'
END
WHERE severity IS NULL OR severity = 'info';

-- ============================================================================
-- 3. ADD VERSIONING for prompt definitions
-- ============================================================================

ALTER TABLE public.guided_prompts
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE public.guided_prompts
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.guided_prompts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add sort_order with decimal for easier insertion
ALTER TABLE public.guided_prompts
  ALTER COLUMN sort_order TYPE DECIMAL(10,2) USING sort_order::DECIMAL(10,2);

-- ============================================================================
-- 4. ADD SNOOZE SUPPORT to acknowledgments
-- ============================================================================

ALTER TABLE public.prompt_acknowledgments
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

ALTER TABLE public.prompt_acknowledgments
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'acknowledged'
    CHECK (status IN ('acknowledged', 'snoozed', 'dismissed'));

-- ============================================================================
-- 5. ADD ANALYTICS FIELDS to competency tracking
-- ============================================================================

ALTER TABLE public.prompt_competency_tracking
  ADD COLUMN IF NOT EXISTS blocked_action_count INTEGER DEFAULT 0;

ALTER TABLE public.prompt_competency_tracking
  ADD COLUMN IF NOT EXISTS prompts_shown_count INTEGER DEFAULT 0;

ALTER TABLE public.prompt_competency_tracking
  ADD COLUMN IF NOT EXISTS prompts_confirmed_count INTEGER DEFAULT 0;

-- ============================================================================
-- 6. FIX RLS POLICIES for global prompts (tenant_id IS NULL)
-- ============================================================================

-- Drop and recreate select policy to include global prompts
DROP POLICY IF EXISTS "guided_prompts_select" ON public.guided_prompts;
CREATE POLICY "guided_prompts_select" ON public.guided_prompts
  FOR SELECT USING (
    tenant_id IS NULL  -- global prompts visible to all authenticated users
    OR tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- Insert policy - only tenant-specific prompts can be inserted
DROP POLICY IF EXISTS "guided_prompts_insert" ON public.guided_prompts;
CREATE POLICY "guided_prompts_insert" ON public.guided_prompts
  FOR INSERT WITH CHECK (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = guided_prompts.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

-- Update policy - can only update tenant-specific prompts
DROP POLICY IF EXISTS "guided_prompts_update" ON public.guided_prompts;
CREATE POLICY "guided_prompts_update" ON public.guided_prompts
  FOR UPDATE USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = guided_prompts.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

-- Delete policy - can only delete tenant-specific prompts
DROP POLICY IF EXISTS "guided_prompts_delete" ON public.guided_prompts;
CREATE POLICY "guided_prompts_delete" ON public.guided_prompts
  FOR DELETE USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = guided_prompts.tenant_id
      AND u.role = 'tenant_admin'
    )
  );

-- ============================================================================
-- 7. SERVER-SIDE VALIDATION RPC FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_workflow_completion(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_workflow TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  prompt_key TEXT,
  severity TEXT,
  title TEXT,
  message TEXT,
  is_blocking BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_user_level TEXT;
BEGIN
  -- Get user and tenant
  v_user_id := COALESCE(p_user_id, auth.uid());
  SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_user_id;

  -- Get user's prompt level
  SELECT prompt_level INTO v_user_level
  FROM public.user_prompt_settings
  WHERE user_id = v_user_id AND tenant_id = v_tenant_id;

  v_user_level := COALESCE(v_user_level, 'training');

  -- Return prompts that should be shown based on severity and user level
  -- training: sees info, warning, blocking
  -- standard: sees warning, blocking
  -- advanced: sees blocking only
  RETURN QUERY
  SELECT
    gp.prompt_key,
    gp.severity,
    gp.title,
    gp.message,
    (gp.severity = 'blocking') AS is_blocking
  FROM public.guided_prompts gp
  WHERE gp.workflow = p_workflow
    AND gp.is_active = TRUE
    AND gp.archived_at IS NULL
    AND (gp.tenant_id IS NULL OR gp.tenant_id = v_tenant_id)
    AND (
      -- Training users see all severities
      (v_user_level = 'training')
      -- Standard users see warning and blocking
      OR (v_user_level = 'standard' AND gp.severity IN ('warning', 'blocking'))
      -- Advanced users see blocking only
      OR (v_user_level = 'advanced' AND gp.severity = 'blocking')
    )
    -- Check if user hasn't already acknowledged this prompt for this entity
    AND NOT EXISTS (
      SELECT 1 FROM public.prompt_acknowledgments pa
      WHERE pa.prompt_id = gp.id
        AND pa.user_id = v_user_id
        AND pa.context_type = p_entity_type
        AND pa.context_id = p_entity_id
        AND pa.was_confirmed = TRUE
        AND (pa.status != 'snoozed' OR pa.snoozed_until < NOW())
    )
  ORDER BY gp.sort_order;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_workflow_completion TO authenticated;

-- ============================================================================
-- 8. HELPER FUNCTION: Check if user can complete workflow
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_complete_workflow(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_workflow TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_blocking BOOLEAN;
BEGIN
  -- Check if any blocking prompts haven't been acknowledged
  SELECT EXISTS (
    SELECT 1 FROM public.validate_workflow_completion(p_entity_type, p_entity_id, p_workflow)
    WHERE is_blocking = TRUE
  ) INTO v_has_blocking;

  RETURN NOT v_has_blocking;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_complete_workflow TO authenticated;

-- ============================================================================
-- 9. ADD MISSING WORKFLOW TYPES
-- ============================================================================

-- Add claims and will_call workflows to support those features
-- Note: This just documents the expected values, actual constraint is in app code

COMMENT ON COLUMN public.guided_prompts.workflow IS
  'Workflow types: receiving, inspection, assembly, repair, movement, stocktake, scan_hub, outbound, claims, will_call';

-- ============================================================================
-- 10. ADD REQUIREMENTS/CONDITIONS JSONB for complex validation rules
-- ============================================================================

ALTER TABLE public.guided_prompts
  ADD COLUMN IF NOT EXISTS conditions JSONB;

-- Conditions schema example:
-- {
--   "operator": "and", -- or "or"
--   "rules": [
--     {"field": "item.has_photos", "op": "eq", "value": false},
--     {"field": "item.status", "op": "in", "value": ["pending", "in_progress"]}
--   ]
-- }
-- Supported operators: eq, ne, in, not_in, gt, lt, gte, lte, is_null, is_not_null, contains

COMMENT ON COLUMN public.guided_prompts.conditions IS
  'JSONB conditions for when to show prompt. Operators: eq, ne, in, not_in, gt, lt, gte, lte, is_null, is_not_null, contains';

-- ============================================================================
-- DONE
-- ============================================================================
