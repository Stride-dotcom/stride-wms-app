import { supabase } from '@/integrations/supabase/client';
import { getEmailTemplate, getEmailTemplateKeys } from '@/lib/emailTemplates/templates';
import { buildEmailTemplate, buildSmsTemplate, EMAIL_TEMPLATE_CONFIGS } from '@/lib/emailIcons';

// Core trigger events that should have templates seeded
const CORE_TRIGGERS = [
  { trigger: 'shipment.received', name: 'Shipment Received', key: 'shipment_received' },
  { trigger: 'shipment.completed', name: 'Shipment Completed', key: 'shipment_completed' },
  { trigger: 'shipment.status_changed', name: 'Shipment Status Changed', key: 'shipment_status_changed' },
  { trigger: 'item.received', name: 'Item Received', key: 'item_received' },
  { trigger: 'item.damaged', name: 'Item Damaged', key: 'item_damaged' },
  { trigger: 'item.location_changed', name: 'Item Location Changed', key: 'item_location_changed' },
  { trigger: 'task.created', name: 'Task Created', key: 'task_created' },
  { trigger: 'task.assigned', name: 'Task Assigned', key: 'task_assigned' },
  { trigger: 'task.completed', name: 'Task Completed', key: 'task_completed' },
  { trigger: 'task.overdue', name: 'Task Overdue', key: 'task_overdue' },
  { trigger: 'release.created', name: 'Release Created', key: 'release_created' },
  { trigger: 'release.approved', name: 'Release Approved', key: 'release_approved' },
  { trigger: 'release.completed', name: 'Release Completed', key: 'release_completed' },
  { trigger: 'invoice.created', name: 'Invoice Created', key: 'invoice_created' },
  { trigger: 'invoice.sent', name: 'Invoice Sent', key: 'invoice_sent' },
  { trigger: 'payment.received', name: 'Payment Received', key: 'payment_received' },
];

/**
 * Seeds v4 email templates for a tenant.
 * Creates communication_alerts + communication_templates for any missing core triggers.
 * Uses the v4 branded templates from emailTemplates/templates.ts when available,
 * falling back to emailIcons.ts templates.
 */
export async function seedV4Templates(tenantId: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // Fetch existing alerts for this tenant
  const { data: existingAlerts } = await supabase
    .from('communication_alerts')
    .select('id, trigger_event')
    .eq('tenant_id', tenantId);

  const existingTriggers = new Set((existingAlerts || []).map(a => a.trigger_event));

  for (const triggerDef of CORE_TRIGGERS) {
    if (existingTriggers.has(triggerDef.trigger)) {
      skipped++;
      continue;
    }

    // Create the alert
    const { data: alert, error: alertError } = await supabase
      .from('communication_alerts')
      .insert({
        tenant_id: tenantId,
        name: triggerDef.name,
        key: triggerDef.key,
        description: `Auto-seeded v4 template for ${triggerDef.name}`,
        is_enabled: true,
        channels: { email: true, sms: true },
        trigger_event: triggerDef.trigger,
        timing_rule: 'immediate',
      })
      .select()
      .single();

    if (alertError || !alert) {
      continue;
    }

    // Try v4 branded template first, fallback to emailIcons template
    const v4Template = getEmailTemplate(triggerDef.trigger);
    const emailBody = v4Template
      ? v4Template.html
      : buildEmailTemplate(triggerDef.trigger);
    const emailSubject = v4Template
      ? v4Template.subject
      : `{{tenant_name}}: ${triggerDef.name}`;
    const emailText = v4Template
      ? v4Template.text
      : '';
    const smsBody = EMAIL_TEMPLATE_CONFIGS[triggerDef.trigger]
      ? buildSmsTemplate(triggerDef.trigger)
      : `{{tenant_name}}: ${triggerDef.name}`;

    // Create email template
    await supabase.from('communication_templates').insert({
      tenant_id: tenantId,
      alert_id: alert.id,
      channel: 'email',
      subject_template: emailSubject,
      body_template: emailBody,
      body_format: 'html',
    });

    // Create SMS template
    await supabase.from('communication_templates').insert({
      tenant_id: tenantId,
      alert_id: alert.id,
      channel: 'sms',
      body_template: smsBody,
      body_format: 'text',
    });

    // Create text email template if v4 has plain text
    if (v4Template && emailText) {
      await supabase.from('communication_templates').insert({
        tenant_id: tenantId,
        alert_id: alert.id,
        channel: 'email',
        subject_template: emailSubject,
        body_template: emailText,
        body_format: 'text',
      });
    }

    created++;
  }

  return { created, skipped };
}
