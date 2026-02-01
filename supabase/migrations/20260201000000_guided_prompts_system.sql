-- ============================================================================
-- GUIDED PROMPTS SYSTEM
-- Training Mode, Help System, and Competency Tracking
-- ============================================================================

-- ============================================================================
-- 1. USER_PROMPT_SETTINGS
-- Stores individual user prompt preferences and upgrade notification status
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_prompt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  prompt_level TEXT NOT NULL DEFAULT 'training',
  prompts_enabled_at TIMESTAMPTZ DEFAULT NOW(),

  prompt_reminder_days INTEGER DEFAULT 30,
  reminder_sent_at TIMESTAMPTZ,

  user_notified_for_upgrade BOOLEAN DEFAULT FALSE,
  manager_notified_for_upgrade BOOLEAN DEFAULT FALSE,

  updated_by UUID REFERENCES public.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_prompt_settings_tenant ON public.user_prompt_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_prompt_settings_user ON public.user_prompt_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_prompt_settings_level ON public.user_prompt_settings(prompt_level);

-- RLS
ALTER TABLE public.user_prompt_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_prompt_settings_select" ON public.user_prompt_settings;
CREATE POLICY "user_prompt_settings_select" ON public.user_prompt_settings
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "user_prompt_settings_insert" ON public.user_prompt_settings;
CREATE POLICY "user_prompt_settings_insert" ON public.user_prompt_settings
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "user_prompt_settings_update_own" ON public.user_prompt_settings;
CREATE POLICY "user_prompt_settings_update_own" ON public.user_prompt_settings
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = user_prompt_settings.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "user_prompt_settings_delete" ON public.user_prompt_settings;
CREATE POLICY "user_prompt_settings_delete" ON public.user_prompt_settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = user_prompt_settings.tenant_id
      AND u.role = 'tenant_admin'
    )
  );

-- ============================================================================
-- 2. GUIDED_PROMPTS
-- Stores all prompt definitions (seeded per tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guided_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  prompt_key TEXT NOT NULL,
  workflow TEXT NOT NULL,
  trigger_point TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  min_level TEXT NOT NULL DEFAULT 'training',

  title TEXT NOT NULL,
  message TEXT NOT NULL,
  tip_text TEXT,

  checklist_items JSONB,
  buttons JSONB,

  requires_confirmation BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, prompt_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guided_prompts_tenant ON public.guided_prompts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guided_prompts_workflow ON public.guided_prompts(workflow);
CREATE INDEX IF NOT EXISTS idx_guided_prompts_trigger ON public.guided_prompts(trigger_point);
CREATE INDEX IF NOT EXISTS idx_guided_prompts_active ON public.guided_prompts(is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE public.guided_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guided_prompts_select" ON public.guided_prompts;
CREATE POLICY "guided_prompts_select" ON public.guided_prompts
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "guided_prompts_insert" ON public.guided_prompts;
CREATE POLICY "guided_prompts_insert" ON public.guided_prompts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = guided_prompts.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "guided_prompts_update" ON public.guided_prompts;
CREATE POLICY "guided_prompts_update" ON public.guided_prompts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = guided_prompts.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "guided_prompts_delete" ON public.guided_prompts;
CREATE POLICY "guided_prompts_delete" ON public.guided_prompts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = guided_prompts.tenant_id
      AND u.role = 'tenant_admin'
    )
  );

-- ============================================================================
-- 3. PROMPT_ACKNOWLEDGMENTS
-- Tracks when users acknowledge/confirm prompts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prompt_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.guided_prompts(id) ON DELETE CASCADE,

  context_type TEXT,
  context_id UUID,

  was_confirmed BOOLEAN DEFAULT FALSE,
  checklist_state JSONB,

  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_acknowledgments_tenant ON public.prompt_acknowledgments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_acknowledgments_user ON public.prompt_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_acknowledgments_prompt ON public.prompt_acknowledgments(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_acknowledgments_context ON public.prompt_acknowledgments(context_type, context_id);

-- RLS
ALTER TABLE public.prompt_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_acknowledgments_select" ON public.prompt_acknowledgments;
CREATE POLICY "prompt_acknowledgments_select" ON public.prompt_acknowledgments
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "prompt_acknowledgments_insert" ON public.prompt_acknowledgments;
CREATE POLICY "prompt_acknowledgments_insert" ON public.prompt_acknowledgments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- ============================================================================
-- 4. PROMPT_COMPETENCY_TRACKING
-- Tracks user performance per workflow for upgrade qualification
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prompt_competency_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workflow TEXT NOT NULL,

  tasks_completed INTEGER DEFAULT 0,
  tasks_with_errors INTEGER DEFAULT 0,
  missing_photos_count INTEGER DEFAULT 0,
  location_errors_count INTEGER DEFAULT 0,
  failed_completions_count INTEGER DEFAULT 0,

  last_task_completed_at TIMESTAMPTZ,

  qualifies_for_upgrade BOOLEAN DEFAULT FALSE,
  qualified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, user_id, workflow)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_competency_tenant ON public.prompt_competency_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_competency_user ON public.prompt_competency_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_competency_workflow ON public.prompt_competency_tracking(workflow);
CREATE INDEX IF NOT EXISTS idx_prompt_competency_qualified ON public.prompt_competency_tracking(qualifies_for_upgrade) WHERE qualifies_for_upgrade = TRUE;

-- RLS
ALTER TABLE public.prompt_competency_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_competency_select" ON public.prompt_competency_tracking;
CREATE POLICY "prompt_competency_select" ON public.prompt_competency_tracking
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "prompt_competency_insert" ON public.prompt_competency_tracking;
CREATE POLICY "prompt_competency_insert" ON public.prompt_competency_tracking
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "prompt_competency_update" ON public.prompt_competency_tracking;
CREATE POLICY "prompt_competency_update" ON public.prompt_competency_tracking
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = prompt_competency_tracking.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

-- ============================================================================
-- 5. PROMPT_UPGRADE_SUGGESTIONS
-- Tracks pending upgrade suggestions for manager review
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prompt_upgrade_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  current_level TEXT NOT NULL,
  suggested_level TEXT NOT NULL,
  reason TEXT NOT NULL,
  qualified_workflows JSONB,

  user_notified_at TIMESTAMPTZ,
  manager_notified_at TIMESTAMPTZ,

  status TEXT DEFAULT 'pending',
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_upgrade_suggestions_tenant ON public.prompt_upgrade_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_upgrade_suggestions_user ON public.prompt_upgrade_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_upgrade_suggestions_status ON public.prompt_upgrade_suggestions(status) WHERE status = 'pending';

-- RLS
ALTER TABLE public.prompt_upgrade_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_upgrade_suggestions_select" ON public.prompt_upgrade_suggestions;
CREATE POLICY "prompt_upgrade_suggestions_select" ON public.prompt_upgrade_suggestions
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "prompt_upgrade_suggestions_insert" ON public.prompt_upgrade_suggestions;
CREATE POLICY "prompt_upgrade_suggestions_insert" ON public.prompt_upgrade_suggestions
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "prompt_upgrade_suggestions_update" ON public.prompt_upgrade_suggestions;
CREATE POLICY "prompt_upgrade_suggestions_update" ON public.prompt_upgrade_suggestions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = prompt_upgrade_suggestions.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

-- ============================================================================
-- 6. TENANT_PROMPT_DEFAULTS
-- Org-level prompt configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_prompt_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  default_prompt_level TEXT DEFAULT 'training',
  default_reminder_days INTEGER DEFAULT 30,

  competency_tasks_required INTEGER DEFAULT 10,
  competency_max_errors INTEGER DEFAULT 0,
  competency_max_missing_photos INTEGER DEFAULT 0,
  competency_max_location_errors INTEGER DEFAULT 0,

  auto_suggestion_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_prompt_defaults_tenant ON public.tenant_prompt_defaults(tenant_id);

-- RLS
ALTER TABLE public.tenant_prompt_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_prompt_defaults_select" ON public.tenant_prompt_defaults;
CREATE POLICY "tenant_prompt_defaults_select" ON public.tenant_prompt_defaults
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_prompt_defaults_insert" ON public.tenant_prompt_defaults;
CREATE POLICY "tenant_prompt_defaults_insert" ON public.tenant_prompt_defaults
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = tenant_prompt_defaults.tenant_id
      AND u.role = 'tenant_admin'
    )
  );

DROP POLICY IF EXISTS "tenant_prompt_defaults_update" ON public.tenant_prompt_defaults;
CREATE POLICY "tenant_prompt_defaults_update" ON public.tenant_prompt_defaults
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = tenant_prompt_defaults.tenant_id
      AND u.role IN ('tenant_admin', 'manager')
    )
  );

-- ============================================================================
-- DONE
-- ============================================================================
