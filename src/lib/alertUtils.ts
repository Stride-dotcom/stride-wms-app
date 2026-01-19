import { supabase } from '@/integrations/supabase/client';

/**
 * Queue an alert if the alert is enabled and the specified channel is active.
 * This function checks the communication_alerts table before queuing.
 */
export async function queueAlertIfEnabled(
  tenantId: string,
  alertKey: string,
  entityType: string,
  entityId: string,
  additionalData?: Record<string, any>
): Promise<boolean> {
  try {
    // Check if alert exists and is enabled
    const { data: alert, error: alertError } = await supabase
      .from('communication_alerts')
      .select('id, is_enabled, channels')
      .eq('tenant_id', tenantId)
      .eq('key', alertKey)
      .maybeSingle();

    if (alertError) {
      console.error('Error checking alert status:', alertError);
      return false;
    }

    if (!alert || !alert.is_enabled) {
      console.log(`Alert ${alertKey} is not enabled or does not exist`);
      return false;
    }

    // Check if at least one channel is enabled
    const channels = alert.channels as { email: boolean; sms: boolean };
    if (!channels.email && !channels.sms) {
      console.log(`Alert ${alertKey} has no channels enabled`);
      return false;
    }

    // Queue the alert
    const { error: queueError } = await supabase
      .from('alert_queue')
      .insert({
        tenant_id: tenantId,
        alert_type: alertKey,
        entity_type: entityType,
        entity_id: entityId,
        status: 'pending',
        subject: '', // Will be filled by send-alerts function
        ...(additionalData || {}),
      });

    if (queueError) {
      console.error('Error queuing alert:', queueError);
      return false;
    }

    console.log(`Alert ${alertKey} queued successfully`);
    return true;
  } catch (error) {
    console.error('Error in queueAlertIfEnabled:', error);
    return false;
  }
}
