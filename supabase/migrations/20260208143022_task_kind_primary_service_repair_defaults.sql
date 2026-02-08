-- Migration: Add primary_service_code and task_kind to tasks table
-- Enables direct service code binding on tasks for billing, plus categorization via task_kind.
-- Also backfills task_type_id and primary_service_code for existing tasks.

-- 1. Add new columns to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS primary_service_code TEXT,
  ADD COLUMN IF NOT EXISTS task_kind TEXT;

-- 2. Add index for billing queries on primary_service_code
CREATE INDEX IF NOT EXISTS idx_tasks_primary_service_code
  ON public.tasks (primary_service_code)
  WHERE primary_service_code IS NOT NULL;

-- 3. Backfill task_type_id where NULL (best-effort, match by name + tenant)
UPDATE public.tasks t
SET task_type_id = tt.id
FROM public.task_types tt
WHERE t.task_type_id IS NULL
  AND t.tenant_id = tt.tenant_id
  AND lower(trim(t.task_type)) = lower(trim(tt.name));

-- 4. Backfill primary_service_code from task_types default_service_code / billing_service_code
UPDATE public.tasks t
SET primary_service_code = COALESCE(tt.default_service_code, tt.billing_service_code)
FROM public.task_types tt
WHERE t.task_type_id = tt.id
  AND t.primary_service_code IS NULL
  AND COALESCE(tt.default_service_code, tt.billing_service_code) IS NOT NULL;

-- 5. Backfill task_kind from task_type (normalized lowercase)
UPDATE public.tasks
SET task_kind = lower(trim(task_type))
WHERE task_kind IS NULL
  AND task_type IS NOT NULL;

-- 6. Add comment documenting column purpose
COMMENT ON COLUMN public.tasks.primary_service_code IS
  'Charge code (from charge_types.charge_code) for the primary billable service on this task. Set at creation from task_types.default_service_code.';
COMMENT ON COLUMN public.tasks.task_kind IS
  'Normalized task category (e.g. inspection, repair, assembly). Lowercase of task_type at creation time.';
