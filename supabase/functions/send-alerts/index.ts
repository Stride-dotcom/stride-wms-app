import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertPayload {
  alert_id: string;
  tenant_id: string;
  alert_type: string;
  entity_type: string;
  entity_id: string;
  recipient_emails: string[];
  subject: string;
  body_html?: string;
  body_text?: string;
}

async function getManagerEmails(supabase: any, tenantId: string): Promise<string[]> {
  const { data: users } = await supabase
    .from('users')
    .select(`
      email,
      user_roles(
        roles(name)
      )
    `)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (!users) return [];

  return users
    .filter((u: any) => 
      u.user_roles?.some((ur: any) => 
        ['admin', 'manager', 'tenant_admin'].includes(ur.roles?.name)
      )
    )
    .map((u: any) => u.email)
    .filter(Boolean);
}

async function getAccountContactEmail(supabase: any, accountId: string): Promise<string | null> {
  const { data } = await supabase
    .from('accounts')
    .select('primary_contact_email, alerts_contact_email')
    .eq('id', accountId)
    .single();
  
  return data?.alerts_contact_email || data?.primary_contact_email || null;
}

async function getTenantBranding(supabase: any, tenantId: string): Promise<{ 
  logoUrl: string | null; 
  companyName: string | null;
  supportEmail: string | null;
  portalBaseUrl: string | null;
}> {
  try {
    const { data: brandSettings } = await supabase
      .from('communication_brand_settings')
      .select('brand_logo_url, brand_support_email, portal_base_url')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from('tenant_company_settings')
      .select('logo_url, company_name')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single();

    return {
      logoUrl: brandSettings?.brand_logo_url || settings?.logo_url || null,
      companyName: settings?.company_name || tenant?.name || 'Warehouse System',
      supportEmail: brandSettings?.brand_support_email || null,
      portalBaseUrl: brandSettings?.portal_base_url || null,
    };
  } catch {
    return { logoUrl: null, companyName: 'Warehouse System', supportEmail: null, portalBaseUrl: null };
  }
}

// Replace both {{variable}} and [[variable]] syntax
function replaceTemplateVariables(html: string, variables: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    // Replace both {{key}} and [[key]] syntax
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    result = result.replace(new RegExp(`\\[\\[${key}\\]\\]`, 'g'), value || '');
  }
  return result;
}

function wrapEmailWithBranding(html: string, variables: Record<string, string>): string {
  // Replace template variables in the HTML
  return replaceTemplateVariables(html, variables);
}

async function generateItemsTableHtml(supabase: any, itemIds: string[]): Promise<string> {
  if (!itemIds || itemIds.length === 0) return '<p style="color:#6b7280;font-size:14px;text-align:center;">No items</p>';
  
  const { data: items } = await supabase
    .from('items')
    .select('item_code, description, vendor, current_location')
    .in('id', itemIds);
  
  if (!items || items.length === 0) return '<p style="color:#6b7280;font-size:14px;text-align:center;">No items found</p>';
  
  const rows = items.map((item: any, index: number) => `
    <tr style="background-color:${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#111111;">${item.item_code || 'N/A'}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#374151;">${item.description || 'N/A'}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.vendor || 'N/A'}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${item.current_location || 'N/A'}</td>
    </tr>
  `).join('');
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background-color:#111111;">
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Item ID</th>
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Description</th>
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Vendor</th>
          <th style="padding:14px 16px;text-align:left;font-weight:600;color:#ffffff;font-size:13px;letter-spacing:0.3px;">Location</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

async function generateItemsListText(supabase: any, itemIds: string[]): Promise<string> {
  if (!itemIds || itemIds.length === 0) return 'No items';
  
  const { data: items } = await supabase
    .from('items')
    .select('item_code, description')
    .in('id', itemIds);
  
  if (!items || items.length === 0) return 'No items found';
  
  return items.map((item: any) => `• ${item.item_code}: ${item.description || 'N/A'}`).join('\n');
}

// Fetch entity data and build variables for template substitution
async function buildTemplateVariables(
  supabase: any,
  alertType: string,
  entityType: string,
  entityId: string,
  tenantId: string
): Promise<{ variables: Record<string, string>; itemIds: string[] }> {
  const branding = await getTenantBranding(supabase, tenantId);
  
  const variables: Record<string, string> = {
    tenant_name: branding.companyName || 'Warehouse System',
    brand_logo_url: branding.logoUrl || '',
    brand_support_email: branding.supportEmail || 'support@example.com',
    portal_base_url: branding.portalBaseUrl || '',
    created_at: new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
  };
  
  let itemIds: string[] = [];

  try {
    // Fetch entity-specific data based on entity type
    if (entityType === 'shipment') {
      const { data: shipment } = await supabase
        .from('shipments')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (shipment) {
        variables.shipment_number = shipment.shipment_number || entityId;
        variables.shipment_status = shipment.status || 'Unknown';
        variables.shipment_vendor = shipment.vendor || 'N/A';
        variables.account_name = shipment.account?.account_name || 'N/A';
        variables.account_contact_name = shipment.account?.primary_contact_name || 'Customer';
        variables.account_contact_email = shipment.account?.primary_contact_email || '';
        variables.shipment_link = `${branding.portalBaseUrl}/shipments/${entityId}`;

        // Get shipment items
        const { data: shipmentItems } = await supabase
          .from('items')
          .select('id')
          .eq('receiving_shipment_id', entityId);
        
        if (shipmentItems) {
          itemIds = shipmentItems.map((i: any) => i.id);
          variables.items_count = String(itemIds.length);
        } else {
          variables.items_count = '0';
        }
      }
    } else if (entityType === 'item') {
      const { data: item } = await supabase
        .from('items')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (item) {
        variables.item_code = item.item_code || entityId;
        variables.item_id = item.item_code || entityId;
        variables.item_description = item.description || 'N/A';
        variables.item_location = item.current_location || 'Unknown';
        variables.account_name = item.account?.account_name || item.client_account || 'N/A';
        variables.account_contact_name = item.account?.primary_contact_name || 'Customer';
        variables.item_photos_link = `${branding.portalBaseUrl}/inventory/${entityId}`;
        variables.items_count = '1';
        itemIds = [entityId];
      }
    } else if (entityType === 'task') {
      const { data: task } = await supabase
        .from('tasks')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email),
          assigned_user:users!tasks_assigned_to_fkey(first_name, last_name, email),
          completed_by_user:users!tasks_completed_by_fkey(first_name, last_name)
        `)
        .eq('id', entityId)
        .single();

      if (task) {
        variables.task_type = task.task_type || 'Task';
        variables.task_title = task.title || 'Untitled Task';
        variables.task_due_date = task.due_date 
          ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'No due date';
        variables.account_name = task.account?.account_name || 'N/A';
        variables.account_contact_name = task.account?.primary_contact_name || 'Customer';
        variables.task_link = `${branding.portalBaseUrl}/tasks`;
        
        if (task.assigned_user) {
          variables.assigned_to_name = `${task.assigned_user.first_name || ''} ${task.assigned_user.last_name || ''}`.trim() || 'Unassigned';
        }
        
        if (task.completed_by_user) {
          variables.created_by_name = `${task.completed_by_user.first_name || ''} ${task.completed_by_user.last_name || ''}`.trim() || 'Someone';
        } else {
          variables.created_by_name = 'Someone';
        }

        // Calculate days overdue for task.overdue alerts
        if (alertType === 'task.overdue' && task.due_date) {
          const dueDate = new Date(task.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - dueDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          variables.task_days_overdue = String(Math.max(0, diffDays));
        }

        // Get task items
        const { data: taskItems } = await supabase
          .from('task_items')
          .select('item_id')
          .eq('task_id', entityId);
        
        if (taskItems) {
          itemIds = taskItems.map((ti: any) => ti.item_id);
          variables.items_count = String(itemIds.length);
        } else {
          variables.items_count = '0';
        }
      }
    } else if (entityType === 'invoice') {
      const { data: invoice } = await supabase
        .from('invoices')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name, primary_contact_email)
        `)
        .eq('id', entityId)
        .single();

      if (invoice) {
        variables.invoice_number = invoice.invoice_number || entityId;
        variables.amount_due = invoice.total_amount
          ? `$${Number(invoice.total_amount).toFixed(2)}`
          : '$0.00';
        variables.account_name = invoice.account?.account_name || 'N/A';
        variables.account_contact_name = invoice.account?.primary_contact_name || 'Customer';
        variables.account_contact_email = invoice.account?.primary_contact_email || '';
        variables.items_count = '0';
      }
    } else if (entityType === 'billing_event') {
      const { data: billingEvent } = await supabase
        .from('billing_events')
        .select(`
          *,
          account:accounts(account_name, primary_contact_name),
          item:items(item_code, description),
          created_by_user:users!billing_events_created_by_fkey(first_name, last_name)
        `)
        .eq('id', entityId)
        .single();

      if (billingEvent) {
        variables.service_name = billingEvent.charge_type || 'Service';
        variables.service_code = billingEvent.charge_type || '';
        variables.service_amount = billingEvent.total_amount
          ? `$${Number(billingEvent.total_amount).toFixed(2)}`
          : '$0.00';
        variables.billing_description = billingEvent.description || '';
        variables.account_name = billingEvent.account?.account_name || 'N/A';
        variables.account_contact_name = billingEvent.account?.primary_contact_name || 'Customer';
        variables.item_code = billingEvent.item?.item_code || 'N/A';
        variables.item_id = billingEvent.item?.item_code || 'N/A';
        variables.item_description = billingEvent.item?.description || 'N/A';
        variables.items_count = '1';

        if (billingEvent.created_by_user) {
          const firstName = billingEvent.created_by_user.first_name || '';
          const lastName = billingEvent.created_by_user.last_name || '';
          variables.user_name = `${firstName} ${lastName}`.trim() || 'System';
          variables.created_by_name = variables.user_name;
        } else {
          variables.user_name = 'System';
          variables.created_by_name = 'System';
        }

        if (billingEvent.item_id) {
          itemIds = [billingEvent.item_id];
        }
      }
    }
  } catch (error) {
    console.error('Error building template variables:', error);
  }

  return { variables, itemIds };
}

async function getTemplateForAlert(
  supabase: any,
  alertType: string,
  tenantId: string,
  channel: 'email' | 'sms' = 'email'
): Promise<{ subjectTemplate: string; bodyTemplate: string } | null> {
  try {
    // First try to find a communication_alert with matching trigger_event
    const { data: alert } = await supabase
      .from('communication_alerts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('trigger_event', alertType)
      .eq('is_enabled', true)
      .maybeSingle();

    if (alert) {
      // Get the template for this alert
      const { data: template } = await supabase
        .from('communication_templates')
        .select('subject_template, body_template')
        .eq('alert_id', alert.id)
        .eq('channel', channel)
        .maybeSingle();

      if (template) {
        return {
          subjectTemplate: template.subject_template || '',
          bodyTemplate: template.body_template || '',
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching template:', error);
    return null;
  }
}

// Generate default email content for legacy alerts
async function generateEmailContent(
  alertType: string, 
  entityType: string,
  entityId: string,
  supabase: any
): Promise<{ subject: string; html: string; text: string }> {
  let subject = '';
  let html = '';
  let text = '';

  switch (alertType) {
    case 'damage_photo': {
      const { data: item } = await supabase
        .from('items')
        .select('item_code, description, client_account')
        .eq('id', entityId)
        .single();

      subject = `⚠️ Damage Photo Flagged - ${item?.item_code || 'Item'}`;
      text = `A photo has been flagged as needing attention for item ${item?.item_code || entityId}.\n\nItem: ${item?.item_code}\nDescription: ${item?.description || 'N/A'}\nClient: ${item?.client_account || 'N/A'}\n\nPlease review this item in the system.`;
      html = `
        <h2 style="color: #dc2626;">⚠️ Damage Photo Flagged</h2>
        <p>A photo has been flagged as needing attention.</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Item Code:</td><td style="padding: 8px;">${item?.item_code || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Description:</td><td style="padding: 8px;">${item?.description || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${item?.client_account || 'N/A'}</td></tr>
        </table>
        <p>Please review this item in the system.</p>
      `;
      break;
    }

    case 'unable_to_complete': {
      const { data: task } = await supabase
        .from('tasks')
        .select('title, task_type, unable_to_complete_note, assigned_user:users!tasks_assigned_to_fkey(first_name, last_name)')
        .eq('id', entityId)
        .single();

      subject = `❌ Task Unable to Complete - ${task?.title || 'Task'}`;
      const assignedTo = task?.assigned_user 
        ? `${task.assigned_user.first_name} ${task.assigned_user.last_name}`
        : 'Unassigned';
      text = `A task has been marked as unable to complete.\n\nTask: ${task?.title}\nType: ${task?.task_type}\nAssigned To: ${assignedTo}\n\nReason: ${task?.unable_to_complete_note || 'No reason provided'}\n\nPlease review and take action.`;
      html = `
        <h2 style="color: #dc2626;">❌ Task Unable to Complete</h2>
        <p>A task has been marked as unable to complete and requires review.</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Task:</td><td style="padding: 8px;">${task?.title || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Type:</td><td style="padding: 8px;">${task?.task_type || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Assigned To:</td><td style="padding: 8px;">${assignedTo}</td></tr>
        </table>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 20px 0;">
          <strong>Reason:</strong><br/>
          ${task?.unable_to_complete_note || 'No reason provided'}
        </div>
        <p>Please review and take appropriate action.</p>
      `;
      break;
    }

    case 'repair_quote_approved': {
      const { data: item } = await supabase
        .from('items')
        .select('item_code, description, client_account')
        .eq('id', entityId)
        .single();

      subject = `✅ Repair Quote Approved - ${item?.item_code || 'Item'}`;
      text = `A repair quote has been approved for item ${item?.item_code}.\n\nA repair task has been automatically created.`;
      html = `
        <h2 style="color: #16a34a;">✅ Repair Quote Approved</h2>
        <p>A repair quote has been approved for the following item:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Item Code:</td><td style="padding: 8px;">${item?.item_code || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Description:</td><td style="padding: 8px;">${item?.description || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${item?.client_account || 'N/A'}</td></tr>
        </table>
        <p>A repair task has been automatically created and added to the queue.</p>
      `;
      break;
    }

    case 'repair_quote_pending': {
      const { data: item } = await supabase
        .from('items')
        .select('item_code, description, client_account')
        .eq('id', entityId)
        .single();

      const { data: quote } = await supabase
        .from('repair_quotes')
        .select('flat_rate, notes')
        .eq('item_id', entityId)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      subject = `🔧 New Repair Quote Pending - ${item?.item_code || 'Item'}`;
      text = `A new repair quote is pending approval.\n\nItem: ${item?.item_code}\nAmount: $${quote?.flat_rate?.toFixed(2) || '0.00'}\n\nPlease review and approve or decline.`;
      html = `
        <h2 style="color: #f59e0b;">🔧 Repair Quote Pending Approval</h2>
        <p>A new repair quote requires your approval:</p>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">Item Code:</td><td style="padding: 8px;">${item?.item_code || entityId}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Description:</td><td style="padding: 8px;">${item?.description || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${item?.client_account || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Quote Amount:</td><td style="padding: 8px; font-size: 1.2em; color: #16a34a;"><strong>$${quote?.flat_rate?.toFixed(2) || '0.00'}</strong></td></tr>
        </table>
        ${quote?.notes ? `<p><strong>Notes:</strong> ${quote.notes}</p>` : ''}
        <p>Please log in to review and approve or decline this quote.</p>
      `;
      break;
    }

    default:
      subject = `Alert: ${alertType}`;
      text = `An alert of type ${alertType} was triggered for ${entityType} ${entityId}.`;
      html = `<p>An alert of type <strong>${alertType}</strong> was triggered for ${entityType} ${entityId}.</p>`;
  }

  return { subject, html, text };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending alerts from queue
    const { data: pendingAlerts, error: fetchError } = await supabase
      .from('alert_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(50);

    if (fetchError) throw fetchError;

    if (!pendingAlerts || pendingAlerts.length === 0) {
      return new Response(JSON.stringify({ message: "No pending alerts" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured. Add RESEND_API_KEY secret." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    let sent = 0;
    let failed = 0;

    for (const alert of pendingAlerts) {
      try {
        // Build template variables from entity data
        const { variables, itemIds } = await buildTemplateVariables(
          supabase,
          alert.alert_type,
          alert.entity_type,
          alert.entity_id,
          alert.tenant_id
        );

        // Generate items table HTML
        const itemsTableHtml = await generateItemsTableHtml(supabase, itemIds);
        const itemsListText = await generateItemsListText(supabase, itemIds);
        variables.items_table_html = itemsTableHtml;
        variables.items_list_text = itemsListText;

        // Get recipient emails
        let recipients = alert.recipient_emails || [];
        if (recipients.length === 0) {
          recipients = await getManagerEmails(supabase, alert.tenant_id);
        }

        if (recipients.length === 0) {
          console.log(`No recipients for alert ${alert.id}`);
          await supabase
            .from('alert_queue')
            .update({ status: 'failed', error_message: 'No recipients found' })
            .eq('id', alert.id);
          failed++;
          continue;
        }

        // Try to get custom template first
        const customTemplate = await getTemplateForAlert(supabase, alert.alert_type, alert.tenant_id, 'email');
        
        let subject = alert.subject;
        let html = alert.body_html;
        let text = alert.body_text;

        if (customTemplate && customTemplate.bodyTemplate) {
          // Use custom template with variable substitution
          subject = replaceTemplateVariables(customTemplate.subjectTemplate || subject, variables);
          html = replaceTemplateVariables(customTemplate.bodyTemplate, variables);
          text = html.replace(/<[^>]+>/g, ''); // Strip HTML for text version
        } else if (!html || !text) {
          // Fall back to legacy content generation
          const content = await generateEmailContent(
            alert.alert_type,
            alert.entity_type,
            alert.entity_id,
            supabase
          );
          subject = subject || content.subject;
          html = html || content.html;
          text = text || content.text;
        }

        // Apply variable substitution to all content
        subject = replaceTemplateVariables(subject, variables);
        html = replaceTemplateVariables(html!, variables);
        text = replaceTemplateVariables(text!, variables);

        // Get custom email domain settings
        const { data: brandSettings } = await supabase
          .from('communication_brand_settings')
          .select('custom_email_domain, from_name, from_email, email_domain_verified')
          .eq('tenant_id', alert.tenant_id)
          .maybeSingle();

        // Determine from email
        let fromEmail = 'alerts@resend.dev';
        let fromName = variables.tenant_name || 'Warehouse System';

        if (brandSettings?.email_domain_verified && brandSettings?.from_email) {
          fromEmail = brandSettings.from_email;
          if (brandSettings?.from_name) {
            fromName = brandSettings.from_name;
          }
        }

        // Send email
        const { error: sendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipients,
          subject: subject,
          html: html,
          text: text,
        });

        if (sendError) throw sendError;

        // Mark as sent
        await supabase
          .from('alert_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', alert.id);

        sent++;
        console.log(`Alert ${alert.id} sent successfully to ${recipients.length} recipients`);
      } catch (alertError) {
        console.error(`Error processing alert ${alert.id}:`, alertError);

        await supabase
          .from('alert_queue')
          .update({
            status: 'failed',
            error_message: alertError instanceof Error ? alertError.message : 'Unknown error',
          })
          .eq('id', alert.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processed ${pendingAlerts.length} alerts`, 
        sent, 
        failed 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-alerts function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
