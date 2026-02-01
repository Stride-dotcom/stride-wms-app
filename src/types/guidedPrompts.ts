// ============================================================================
// Guided Prompts Type Definitions
// ============================================================================

export type PromptLevel = 'training' | 'standard' | 'advanced';

export type PromptWorkflow =
  | 'receiving'
  | 'inspection'
  | 'assembly'
  | 'repair'
  | 'movement'
  | 'stocktake'
  | 'scan_hub'
  | 'outbound';

export type PromptTriggerPoint = 'before' | 'during' | 'after';

export type PromptUIType = 'modal' | 'slide_panel' | 'tooltip' | 'toast';

export interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
}

export interface PromptButton {
  key: string;
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  action?: 'confirm' | 'cancel' | 'skip';
}

export interface GuidedPrompt {
  id: string;
  tenant_id: string;
  prompt_key: string;
  workflow: PromptWorkflow;
  trigger_point: PromptTriggerPoint;
  prompt_type: PromptUIType;
  min_level: PromptLevel;
  title: string;
  message: string;
  tip_text?: string | null;
  checklist_items?: ChecklistItem[] | null;
  buttons?: PromptButton[] | null;
  requires_confirmation: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPromptSettings {
  id: string;
  tenant_id: string;
  user_id: string;
  prompt_level: PromptLevel;
  prompts_enabled_at: string;
  prompt_reminder_days: number;
  reminder_sent_at?: string | null;
  user_notified_for_upgrade: boolean;
  manager_notified_for_upgrade: boolean;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptAcknowledgment {
  id: string;
  tenant_id: string;
  user_id: string;
  prompt_id: string;
  context_type?: string | null;
  context_id?: string | null;
  was_confirmed: boolean;
  checklist_state?: Record<string, boolean> | null;
  acknowledged_at: string;
  created_at: string;
}

export interface PromptCompetencyTracking {
  id: string;
  tenant_id: string;
  user_id: string;
  workflow: PromptWorkflow;
  tasks_completed: number;
  tasks_with_errors: number;
  missing_photos_count: number;
  location_errors_count: number;
  failed_completions_count: number;
  last_task_completed_at?: string | null;
  qualifies_for_upgrade: boolean;
  qualified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptUpgradeSuggestion {
  id: string;
  tenant_id: string;
  user_id: string;
  current_level: PromptLevel;
  suggested_level: PromptLevel;
  reason: string;
  qualified_workflows?: PromptWorkflow[] | null;
  user_notified_at?: string | null;
  manager_notified_at?: string | null;
  status: 'pending' | 'approved' | 'dismissed';
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface TenantPromptDefaults {
  id: string;
  tenant_id: string;
  default_prompt_level: PromptLevel;
  default_reminder_days: number;
  competency_tasks_required: number;
  competency_max_errors: number;
  competency_max_missing_photos: number;
  competency_max_location_errors: number;
  auto_suggestion_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Default prompt definition for seeding (without id, tenant_id, timestamps)
export interface DefaultPromptDefinition {
  prompt_key: string;
  workflow: PromptWorkflow;
  trigger_point: PromptTriggerPoint;
  prompt_type: PromptUIType;
  min_level: PromptLevel;
  title: string;
  message: string;
  tip_text?: string;
  checklist_items?: ChecklistItem[];
  buttons?: PromptButton[];
  requires_confirmation: boolean;
  sort_order: number;
  is_active: boolean;
}

// Context for showing prompts
export interface PromptContext {
  contextType?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
}

// Competency event types
export type CompetencyEventType =
  | 'task_completed'
  | 'task_error'
  | 'missing_photo'
  | 'location_error'
  | 'failed_completion';
