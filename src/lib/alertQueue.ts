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
    const { error } = await supabase.from('alert_queue').insert({
      tenant_id: tenantId,
      alert_type: alertType,
      entity_type: entityType,
      entity_id: entityId,
      subject: subject,
      recipient_emails: recipientEmails || null,
      body_html: bodyHtml || null,
      body_text: bodyText || null,
      status: 'pending',
    });

    if (error) {
      console.error('Error queuing alert:', error);
      return false;
    }

    console.log(`Alert queued: ${alertType} for ${entityType}/${entityId}`);
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
