/**
 * Flag Alert Trigger — Per-flag trigger auto-creation / management
 *
 * When a flag (charge_type with add_flag=true) is created or edited
 * with alert_rule !== 'none', a corresponding communication_alerts record
 * is created so that the send-alerts edge function can process it.
 *
 * Trigger key convention:
 *   key:           "flag_alert_{CHARGE_CODE}"
 *   trigger_event: "item.flag_added.{CHARGE_CODE}"
 *
 * This ensures per-flag granularity — only flags with active triggers fire alerts.
 */

import { supabase } from '@/integrations/supabase/client';
import { getDefaultTemplate, type DefaultAlertTemplate } from '@/lib/emailTemplates/defaultAlertTemplates';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensure a communication_alerts trigger exists (or is disabled) for a flag.
 *
 * - If enabled=true and trigger missing  → create trigger + default templates
 * - If enabled=true and trigger exists   → ensure is_enabled=true (idempotent)
 * - If enabled=false and trigger exists  → set is_enabled=false (disable, not delete)
 * - If enabled=false and trigger missing → no-op
 *
 * Returns the communication_alerts.id if one exists / was created, null otherwise.
 */
export async function ensureFlagAlertTrigger(params: {
  tenantId: string;
  chargeTypeId: string;
  chargeCode: string;
  chargeName: string;
  enabled: boolean;
}): Promise<string | null> {
  const { tenantId, chargeTypeId, chargeCode, chargeName, enabled } = params;
  const triggerKey = buildTriggerKey(chargeCode);
  const triggerEvent = buildTriggerEvent(chargeCode);

  try {
    // Check if trigger already exists for this flag
    const { data: existing } = await (supabase as any)
      .from('communication_alerts')
      .select('id, is_enabled')
      .eq('tenant_id', tenantId)
      .eq('key', triggerKey)
      .maybeSingle();

    if (existing) {
      // Trigger exists — update is_enabled if necessary
      if (existing.is_enabled !== enabled) {
        await (supabase as any)
          .from('communication_alerts')
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }
      return existing.id;
    }

    // No existing trigger
    if (!enabled) return null; // Don't create disabled triggers

    // Create new trigger + templates
    const alertName = `Flag Alert: ${chargeName}`;

    const { data: alert, error: alertError } = await (supabase as any)
      .from('communication_alerts')
      .insert({
        tenant_id: tenantId,
        name: alertName,
        key: triggerKey,
        description: `Automatically created trigger for the "${chargeName}" flag.`,
        is_enabled: true,
        channels: { email: true, sms: false, in_app: true },
        trigger_event: triggerEvent,
        timing_rule: 'immediate',
      })
      .select('id')
      .single();

    if (alertError) {
      // Unique constraint violation means it already exists (race condition)
      if (alertError.code === '23505') {
        const { data: raceExisting } = await (supabase as any)
          .from('communication_alerts')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('key', triggerKey)
          .maybeSingle();
        return raceExisting?.id ?? null;
      }
      console.error('[ensureFlagAlertTrigger] Failed to create alert:', alertError);
      return null;
    }

    // Create default templates (email, sms, in_app) using the flag_added defaults
    await createDefaultTemplatesForFlag(tenantId, alert.id, chargeName, triggerEvent);

    return alert.id;
  } catch (error) {
    console.error('[ensureFlagAlertTrigger] Unexpected error:', error);
    return null;
  }
}

/**
 * Check whether a per-flag trigger exists and is enabled.
 * Used before queuing an alert to prevent spam.
 */
export async function isFlagTriggerEnabled(
  tenantId: string,
  chargeCode: string,
): Promise<boolean> {
  const triggerKey = buildTriggerKey(chargeCode);

  try {
    const { data } = await (supabase as any)
      .from('communication_alerts')
      .select('is_enabled')
      .eq('tenant_id', tenantId)
      .eq('key', triggerKey)
      .maybeSingle();

    return data?.is_enabled === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic key used for unique constraint on communication_alerts */
export function buildTriggerKey(chargeCode: string): string {
  return `flag_alert_${chargeCode}`;
}

/** Deterministic trigger_event used to match in send-alerts edge function */
export function buildTriggerEvent(chargeCode: string): string {
  return `item.flag_added.${chargeCode}`;
}

/**
 * Create default email / sms / in_app templates for a per-flag alert.
 * Uses the generic 'item.flag_added' defaults as a base, but customises
 * the subject line to include the specific flag name.
 */
async function createDefaultTemplatesForFlag(
  tenantId: string,
  alertId: string,
  flagName: string,
  triggerEvent: string,
): Promise<void> {
  // Fall back to generic item.flag_added template
  const defaults: DefaultAlertTemplate =
    getDefaultTemplate('item.flag_added');

  const subject = `[[tenant_name]]: Flag "${flagName}" Added — [[item_code]]`;

  const templateRows = [
    {
      tenant_id: tenantId,
      alert_id: alertId,
      channel: 'email',
      subject_template: subject,
      body_template: defaults.body,
      body_format: 'text',
    },
    {
      tenant_id: tenantId,
      alert_id: alertId,
      channel: 'sms',
      body_template: defaults.smsBody,
      body_format: 'text',
    },
    {
      tenant_id: tenantId,
      alert_id: alertId,
      channel: 'in_app',
      subject_template: `Flag "${flagName}" added`,
      body_template: `Flag "${flagName}" added to item [[item_code]].`,
      body_format: 'text',
      in_app_recipients: defaults.inAppRecipients,
    },
  ];

  const { error } = await (supabase as any)
    .from('communication_templates')
    .insert(templateRows);

  if (error) {
    console.error('[ensureFlagAlertTrigger] Failed to create templates:', error);
  }
}
