import { supabase } from '@/integrations/supabase/client';

/**
 * Queue an alert for sending via the send-alerts edge function
 * This is the central function for queuing all types of alerts
 */
export async function queueAlert({
  tenantId,
  alertType,
  entityType,
  entityId,
  subject,
  recipientEmails,
  bodyHtml,
  bodyText,
}: {
  tenantId: string;
  alertType: string;
  entityType: string;
  entityId: string;
  subject: string;
  recipientEmails?: string[];
  bodyHtml?: string;
  bodyText?: string;
}): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('alert_queue')
      .insert({
        tenant_id: tenantId,
        alert_type: alertType,
        entity_type: entityType,
        entity_id: entityId,
        subject: subject,
        recipient_emails: recipientEmails || null,
        body_html: bodyHtml || null,
        body_text: bodyText || null,
        status: 'pending',
      })
      .select('id, tenant_id')
      .single();

    if (error) {
      console.error('Error queuing alert:', error);
      return false;
    }

    console.log(`Alert queued: ${alertType} for ${entityType}/${entityId}`);

    // Immediately invoke send-alerts edge function to process the queued alert
    try {
      const { data: invokeResult, error: invokeError } = await supabase.functions.invoke('send-alerts', {
        body: { alert_queue_id: data.id, tenant_id: data.tenant_id },
      });

      if (invokeError) {
        console.warn('send-alerts invoke failed (alert remains queued for retry):', invokeError);
      } else {
        console.log('send-alerts invoke result:', invokeResult);
      }
    } catch (invokeErr) {
      console.warn('send-alerts invoke error (alert remains queued for retry):', invokeErr);
    }

    return true;
  } catch (error) {
    console.error('Error queuing alert:', error);
    return false;
  }
}

/**
 * Queue a shipment received alert
 */
export async function queueShipmentReceivedAlert(
  tenantId: string,
  shipmentId: string,
  shipmentNumber: string,
  itemsCount: number
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'shipment.received',
    entityType: 'shipment',
    entityId: shipmentId,
    subject: `📦 Shipment ${shipmentNumber} has arrived!`,
  });
}

/**
 * Queue a shipment completed alert
 */
export async function queueShipmentCompletedAlert(
  tenantId: string,
  shipmentId: string,
  shipmentNumber: string,
  itemsCount: number
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'shipment.completed',
    entityType: 'shipment',
    entityId: shipmentId,
    subject: `✅ Shipment ${shipmentNumber} is complete!`,
  });
}

/**
 * Queue an unidentified intake completion alert
 */
export async function queueUnidentifiedIntakeCompletedAlert(
  tenantId: string,
  shipmentId: string,
  shipmentNumber: string,
  itemsFlaggedCount: number
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'shipment.unidentified_intake_completed',
    entityType: 'shipment',
    entityId: shipmentId,
    subject: `Unidentified intake completed for ${shipmentNumber} (${itemsFlaggedCount} item${itemsFlaggedCount === 1 ? '' : 's'} flagged ARRIVAL_NO_ID)`,
  });
}

/**
 * Queue a return shipment created alert
 */
export async function queueReturnShipmentCreatedAlert(
  tenantId: string,
  shipmentId: string,
  shipmentNumber: string,
  returnReason?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'shipment.return_created',
    entityType: 'shipment',
    entityId: shipmentId,
    subject: `🔄 Return Shipment ${shipmentNumber} created${returnReason ? ` - ${returnReason}` : ''}`,
  });
}

/**
 * Queue a task created alert
 */
export async function queueTaskCreatedAlert(
  tenantId: string,
  taskId: string,
  taskType: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'task.created',
    entityType: 'task',
    entityId: taskId,
    subject: `📋 New ${taskType} task created`,
  });
}

/**
 * Queue a task assigned alert
 */
export async function queueTaskAssignedAlert(
  tenantId: string,
  taskId: string,
  taskType: string,
  assigneeEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'task.assigned',
    entityType: 'task',
    entityId: taskId,
    subject: `👋 You've been assigned a ${taskType} task`,
    recipientEmails: assigneeEmail ? [assigneeEmail] : undefined,
  });
}

/**
 * Queue a task completed alert
 */
export async function queueTaskCompletedAlert(
  tenantId: string,
  taskId: string,
  taskType: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'task.completed',
    entityType: 'task',
    entityId: taskId,
    subject: `✅ ${taskType} task completed!`,
  });
}

/**
 * Queue an item damaged alert
 */
export async function queueItemDamagedAlert(
  tenantId: string,
  itemId: string,
  itemCode: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'item.damaged',
    entityType: 'item',
    entityId: itemId,
    subject: `⚠️ Damage detected on ${itemCode}`,
  });
}

/**
 * Queue an item location changed alert
 */
export async function queueItemLocationChangedAlert(
  tenantId: string,
  itemId: string,
  itemCode: string,
  newLocation: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'item.location_changed',
    entityType: 'item',
    entityId: itemId,
    subject: `📍 Item ${itemCode} moved to ${newLocation}`,
  });
}

/**
 * Queue an invoice created alert
 */
export async function queueInvoiceCreatedAlert(
  tenantId: string,
  invoiceId: string,
  invoiceNumber: string,
  amount: number
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'invoice.created',
    entityType: 'invoice',
    entityId: invoiceId,
    subject: `📄 New invoice ${invoiceNumber} - $${amount.toFixed(2)}`,
  });
}

/**
 * Queue an invoice sent alert
 */
export async function queueInvoiceSentAlert(
  tenantId: string,
  invoiceId: string,
  invoiceNumber: string,
  amount: number,
  recipientEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'invoice.sent',
    entityType: 'invoice',
    entityId: invoiceId,
    subject: `📄 Invoice ${invoiceNumber} - $${amount.toFixed(2)}`,
    recipientEmails: recipientEmail ? [recipientEmail] : undefined,
  });
}

/**
 * Queue a repair quote ready alert
 */
export async function queueRepairQuoteReadyAlert(
  tenantId: string,
  itemId: string,
  itemCode: string,
  quoteAmount: number,
  recipientEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'repair.quote_ready',
    entityType: 'item',
    entityId: itemId,
    subject: `🔧 Repair Quote Ready - ${itemCode} - $${quoteAmount.toFixed(2)}`,
    recipientEmails: recipientEmail ? [recipientEmail] : undefined,
  });
}

/**
 * Queue a repair quote sent to client alert with review link
 */
export async function queueRepairQuoteSentToClientAlert(
  tenantId: string,
  quoteId: string,
  accountName: string,
  quoteAmount: number,
  itemCodes: string[],
  bodyHtml: string,
  recipientEmails: string[]
): Promise<boolean> {
  const itemSummary = itemCodes.length === 1
    ? itemCodes[0]
    : `${itemCodes.length} items`;

  return queueAlert({
    tenantId,
    alertType: 'repair.quote_sent_to_client',
    entityType: 'repair_quote',
    entityId: quoteId,
    subject: `🔧 Repair Quote - ${itemSummary} - $${quoteAmount.toFixed(2)}`,
    recipientEmails,
    bodyHtml,
  });
}

/**
 * Queue an inspection completed alert
 */
export async function queueInspectionCompletedAlert(
  tenantId: string,
  taskId: string,
  itemCode: string,
  hasDamage: boolean,
  recipientEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'inspection.completed',
    entityType: 'task',
    entityId: taskId,
    subject: `🔍 Inspection Complete - ${itemCode}${hasDamage ? ' ⚠️ Damage Found' : ''}`,
    recipientEmails: recipientEmail ? [recipientEmail] : undefined,
  });
}

/**
 * Queue a payment received alert
 */
export async function queuePaymentReceivedAlert(
  tenantId: string,
  invoiceId: string,
  amount: number
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'payment.received',
    entityType: 'invoice',
    entityId: invoiceId,
    subject: `💚 Payment of $${amount.toFixed(2)} received!`,
  });
}

/**
 * Queue a claim filed alert
 */
export async function queueClaimFiledAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  claimType: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.filed',
    entityType: 'claim',
    entityId: claimId,
    subject: `📋 New Claim Filed: ${claimNumber} (${claimType})`,
  });
}

/**
 * Queue a claim status changed alert
 */
export async function queueClaimStatusChangedAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  newStatus: string,
  recipientEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.status_changed',
    entityType: 'claim',
    entityId: claimId,
    subject: `📋 Claim ${claimNumber} status updated to ${newStatus}`,
    recipientEmails: recipientEmail ? [recipientEmail] : undefined,
  });
}

/**
 * Queue a claim approved alert
 */
export async function queueClaimApprovedAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  payoutAmount: number,
  recipientEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.approved',
    entityType: 'claim',
    entityId: claimId,
    subject: `✅ Claim ${claimNumber} Approved - Payout: $${payoutAmount.toFixed(2)}`,
    recipientEmails: recipientEmail ? [recipientEmail] : undefined,
  });
}

/**
 * Queue a claim denied alert
 */
export async function queueClaimDeniedAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  recipientEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.denied',
    entityType: 'claim',
    entityId: claimId,
    subject: `❌ Claim ${claimNumber} has been denied`,
    recipientEmails: recipientEmail ? [recipientEmail] : undefined,
  });
}

/**
 * Queue a claim sent for acceptance alert (to client)
 */
export async function queueClaimSentForAcceptanceAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  payoutAmount: number,
  acceptanceUrl: string,
  recipientEmail?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.determination_sent',
    entityType: 'claim',
    entityId: claimId,
    subject: `📋 Claim ${claimNumber} Determination Ready - Please Review`,
    recipientEmails: recipientEmail ? [recipientEmail] : undefined,
  });
}

/**
 * Queue a claim accepted by client alert (to warehouse admins/managers)
 */
export async function queueClaimAcceptedByClientAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  payoutAmount: number,
  recipientEmails?: string[]
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.client_accepted',
    entityType: 'claim',
    entityId: claimId,
    subject: `✅ Client Accepted Claim ${claimNumber} - Payout: $${payoutAmount.toFixed(2)}`,
    recipientEmails,
  });
}

/**
 * Queue a claim declined by client alert (to warehouse admins/managers)
 */
export async function queueClaimDeclinedByClientAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  declineReason: string,
  counterOfferAmount?: number,
  recipientEmails?: string[]
): Promise<boolean> {
  const hasCounter = counterOfferAmount != null;
  return queueAlert({
    tenantId,
    alertType: hasCounter ? 'claim.client_countered' : 'claim.client_declined',
    entityType: 'claim',
    entityId: claimId,
    subject: hasCounter
      ? `🔄 Client Counter Offer on Claim ${claimNumber} - $${counterOfferAmount.toFixed(2)}`
      : `❌ Client Declined Claim ${claimNumber}`,
    recipientEmails,
  });
}

/**
 * Queue a claim attachment added alert (to warehouse when client uploads)
 */
export async function queueClaimAttachmentAddedAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  attachmentType: string,
  recipientEmails?: string[]
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.attachment_added',
    entityType: 'claim',
    entityId: claimId,
    subject: `📎 New ${attachmentType} added to Claim ${claimNumber}`,
    recipientEmails,
  });
}

/**
 * Queue a claim note added alert (to warehouse when client adds note)
 */
export async function queueClaimNoteAddedAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  recipientEmails?: string[]
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.note_added',
    entityType: 'claim',
    entityId: claimId,
    subject: `💬 New note added to Claim ${claimNumber}`,
    recipientEmails,
  });
}

/**
 * Queue a billing event alert (for services with alert_rule: 'email_office')
 * This sends notification to office when billable services are performed
 */
export async function queueBillingEventAlert(
  tenantId: string,
  billingEventId: string,
  serviceName: string,
  itemCode: string,
  accountName: string,
  amount: number,
  description?: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'billing_event.created',
    entityType: 'billing_event',
    entityId: billingEventId,
    subject: `💰 Service Charged: ${serviceName} - ${itemCode}`,
    bodyHtml: `
      <h2 style="color: #16a34a;">💰 Service Event Billed</h2>
      <p>A billable service has been recorded:</p>
      <table style="border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; font-weight: bold;">Service:</td><td style="padding: 8px;">${serviceName}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Item:</td><td style="padding: 8px;">${itemCode}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Account:</td><td style="padding: 8px;">${accountName}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px; font-size: 1.2em; color: #16a34a;"><strong>$${amount.toFixed(2)}</strong></td></tr>
        ${description ? `<tr><td style="padding: 8px; font-weight: bold;">Description:</td><td style="padding: 8px;">${description}</td></tr>` : ''}
      </table>
      <p style="color: #6b7280; font-size: 14px;">This is an automated notification from Stride WMS.</p>
    `,
    bodyText: `Service Event Billed\n\nService: ${serviceName}\nItem: ${itemCode}\nAccount: ${accountName}\nAmount: $${amount.toFixed(2)}${description ? `\nDescription: ${description}` : ''}\n\nThis is an automated notification from Stride WMS.`,
  });
}

/**
 * Queue a flag-added-to-item alert.
 *
 * Uses per-flag trigger keys (item.flag_added.{chargeCode}) so that
 * only flags with an enabled per-flag communication_alerts trigger
 * actually fire.  The send-alerts edge function matches on the
 * trigger_event field, so per-flag alerts are processed independently.
 *
 * Guard: before queuing, checks that the per-flag trigger exists and is
 * enabled in communication_alerts.  If missing/disabled, the alert is
 * silently skipped (no spam).
 */
export async function queueFlagAddedAlert({
  tenantId,
  itemId,
  itemCode,
  flagServiceName,
  flagServiceCode,
  actorUserId,
  actorName,
}: {
  tenantId: string;
  itemId: string;
  itemCode: string;
  flagServiceName: string;
  flagServiceCode: string;
  actorUserId: string;
  actorName?: string;
}): Promise<boolean> {
  // Per-flag trigger key: only fire if this specific flag has an enabled trigger
  const perFlagEvent = `item.flag_added.${flagServiceCode}`;
  const perFlagKey = `flag_alert_${flagServiceCode}`;

  try {
    const { data: trigger } = await supabase
      .from('communication_alerts')
      .select('is_enabled')
      .eq('tenant_id', tenantId)
      .eq('key', perFlagKey)
      .maybeSingle();

    if (!trigger || !trigger.is_enabled) {
      // No per-flag trigger configured or it's disabled — skip silently
      console.log(`[queueFlagAddedAlert] Skipped: no enabled trigger for ${flagServiceCode}`);
      return false;
    }
  } catch (err) {
    // If we can't verify the trigger, still attempt to queue (fail-open for existing behavior)
    console.warn('[queueFlagAddedAlert] Could not verify per-flag trigger, proceeding:', err);
  }

  const timestamp = new Date().toISOString();
  return queueAlert({
    tenantId,
    alertType: perFlagEvent,
    entityType: 'item',
    entityId: itemId,
    subject: `Flag added to item ${itemCode}: ${flagServiceName}`,
    bodyHtml: `
      <h2 style="color: #d97706;">&#9888;&#65039; Flag Added to Item</h2>
      <p>A flag has been applied to an item:</p>
      <table style="border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; font-weight: bold;">Flag:</td><td style="padding: 8px;">${flagServiceName}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Service Code:</td><td style="padding: 8px;">${flagServiceCode}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Item:</td><td style="padding: 8px;">${itemCode}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Applied by:</td><td style="padding: 8px;">${actorName || actorUserId}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Timestamp:</td><td style="padding: 8px;">${timestamp}</td></tr>
      </table>
      <p style="color: #6b7280; font-size: 14px;">This is an automated notification from Stride WMS.</p>
    `,
    bodyText: `Flag Added to Item\n\nFlag: ${flagServiceName}\nService Code: ${flagServiceCode}\nItem: ${itemCode}\nApplied by: ${actorName || actorUserId}\nTimestamp: ${timestamp}\n\nThis is an automated notification from Stride WMS.`,
  });
}

/**
 * Queue a repair unable to complete alert (unrepairable item)
 */
export async function queueRepairUnableToCompleteAlert(
  tenantId: string,
  taskId: string,
  itemCodes: string[],
  note: string,
  accountName?: string
): Promise<boolean> {
  const itemSummary = itemCodes.length === 1
    ? itemCodes[0]
    : `${itemCodes.length} items`;

  return queueAlert({
    tenantId,
    alertType: 'repair.unable_to_complete',
    entityType: 'task',
    entityId: taskId,
    subject: `🔧 Repair Unable to Complete - ${itemSummary}${accountName ? ` (${accountName})` : ''}`,
  });
}

/**
 * Queue a claim requires approval alert (to admins/managers)
 */
export async function queueClaimRequiresApprovalAlert(
  tenantId: string,
  claimId: string,
  claimNumber: string,
  payoutAmount: number,
  recipientEmails?: string[]
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'claim.requires_approval',
    entityType: 'claim',
    entityId: claimId,
    subject: `⚠️ Claim ${claimNumber} requires approval - $${payoutAmount.toFixed(2)}`,
    recipientEmails,
  });
}

/**
 * Queue a receiving discrepancy alert
 */
export async function queueReceivingDiscrepancyAlert(
  tenantId: string,
  shipmentId: string,
  shipmentNumber: string,
  discrepancyCount: number
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'receiving.discrepancy_created',
    entityType: 'shipment',
    entityId: shipmentId,
    subject: `Receiving discrepancy on ${shipmentNumber} (${discrepancyCount} issue${discrepancyCount !== 1 ? 's' : ''})`,
  });
}

/**
 * Queue a receiving exception noted alert
 */
export async function queueReceivingExceptionAlert(
  tenantId: string,
  shipmentId: string,
  shipmentNumber: string,
  exceptionType: string
): Promise<boolean> {
  return queueAlert({
    tenantId,
    alertType: 'receiving.exception_noted',
    entityType: 'shipment',
    entityId: shipmentId,
    subject: `Receiving exception on ${shipmentNumber}: ${exceptionType}`,
  });
}
