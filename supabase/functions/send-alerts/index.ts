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
  // Get admin and manager users for this tenant
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
      // Mark all as pending for retry when key is added
      return new Response(JSON.stringify({ error: "Email service not configured. Add RESEND_API_KEY secret." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Import Resend
    const { Resend } = await import("https://esm.sh/resend@2.0.0");
    const resend = new Resend(resendApiKey);

    let sent = 0;
    let failed = 0;

    for (const alert of pendingAlerts) {
      try {
        // Get recipient emails
        let recipients = alert.recipient_emails || [];
        if (recipients.length === 0) {
          // Fall back to manager emails
          recipients = await getManagerEmails(supabase, alert.tenant_id);
        }

        if (recipients.length === 0) {
          console.log(`No recipients for alert ${alert.id}`);
          continue;
        }

        // Generate email content if not provided
        let subject = alert.subject;
        let html = alert.body_html;
        let text = alert.body_text;

        if (!html || !text) {
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

        // Send email
        const { error: sendError } = await resend.emails.send({
          from: "Warehouse System <alerts@resend.dev>",
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
      } catch (alertError) {
        console.error(`Error processing alert ${alert.id}:`, alertError);

        // Mark as failed
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
