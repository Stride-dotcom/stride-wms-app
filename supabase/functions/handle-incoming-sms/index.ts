import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * handle-incoming-sms
 *
 * Twilio webhook handler for inbound SMS messages.
 *
 * Twilio's built-in Opt-Out Management handles STOP/HELP/START keywords
 * automatically before they reach this webhook. This function only receives
 * non-keyword messages (actual replies from recipients).
 *
 * Non-keyword messages are routed to the in-app messaging system so
 * office staff can see SMS replies in their Messages inbox.
 *
 * Setup:
 * 1. Deploy this function to Supabase
 * 2. In Twilio Console -> Phone Numbers -> your number -> Messaging -> "A MESSAGE COMES IN"
 *    set the webhook URL to: https://lxkstlsfxocaswqwlmed.supabase.co/functions/v1/handle-incoming-sms
 * 3. Twilio Opt-Out Management handles STOP/HELP/START — no need to handle here
 */

const handler = async (req: Request): Promise<Response> => {
  // Twilio sends POST with application/x-www-form-urlencoded
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook payload (form-encoded)
    const formData = await req.formData();
    const from = formData.get("From") as string; // E.164 phone number
    const messageBody = (formData.get("Body") as string || "").trim();
    const to = formData.get("To") as string; // Our Twilio number

    if (!from || !messageBody) {
      return twimlResponse("");
    }

    // Look up tenant by their Twilio phone number
    const { data: tenantSettings } = await supabase
      .from("tenant_company_settings")
      .select("tenant_id, twilio_from_phone")
      .or(`twilio_from_phone.eq.${to}`)
      .limit(1)
      .maybeSingle();

    if (!tenantSettings) {
      console.log("No tenant found for Twilio number:", to);
      return twimlResponse("");
    }

    // Route the SMS reply into the in-app messaging system
    await routeSmsReplyToMessages(supabase, tenantSettings.tenant_id, from, messageBody);

    return twimlResponse("");
  } catch (error) {
    console.error("Error handling incoming SMS:", error);
    // Return empty TwiML on error so Twilio doesn't retry
    return twimlResponse("");
  }
};

/**
 * Route an inbound SMS reply into the in-app messaging system.
 * Creates a system message and notifies tenant admin users so they
 * see SMS replies in the Messages page and bell icon notifications.
 */
async function routeSmsReplyToMessages(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  fromPhone: string,
  messageBody: string
): Promise<void> {
  try {
    // Look up contact name from sms_consent if available
    const { data: consent } = await supabase
      .from("sms_consent")
      .select("contact_name, account_id")
      .eq("tenant_id", tenantId)
      .eq("phone_number", fromPhone)
      .maybeSingle();

    const senderLabel = consent?.contact_name
      ? `${consent.contact_name} (${fromPhone})`
      : fromPhone;

    // Find admin users for this tenant to deliver the message to.
    // Messages require a sender_id so we use the first admin as system sender.
    const { data: adminUsers } = await supabase
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("role", "tenant_admin")
      .limit(10);

    if (!adminUsers || adminUsers.length === 0) {
      console.log("No admin users found for tenant", tenantId);
      return;
    }

    const systemSenderId = adminUsers[0].id;

    // Create the message
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .insert({
        tenant_id: tenantId,
        sender_id: systemSenderId,
        subject: `SMS from ${senderLabel}`,
        body: messageBody,
        message_type: "system",
        priority: "normal",
        metadata: {
          source: "sms_reply",
          from_phone: fromPhone,
          contact_name: consent?.contact_name || null,
          account_id: consent?.account_id || null,
        },
      })
      .select("id")
      .single();

    if (msgError) {
      console.error("Error creating SMS reply message:", msgError);
      return;
    }

    // Create message_recipients for all admin users
    const recipientInserts = adminUsers.map((user: { id: string }) => ({
      message_id: message.id,
      recipient_type: "user",
      recipient_id: user.id,
      user_id: user.id,
    }));

    await supabase.from("message_recipients").insert(recipientInserts);

    // Create in_app_notifications for admin users (bell icon + Messages page)
    const notifInserts = adminUsers.map((user: { id: string }) => ({
      tenant_id: tenantId,
      user_id: user.id,
      title: `SMS Reply from ${senderLabel}`,
      body: messageBody.length > 100
        ? messageBody.substring(0, 100) + "..."
        : messageBody,
      category: "sms_reply",
      priority: "normal",
      icon: "sms",
      action_url: "/messages",
      related_entity_type: "sms_reply",
    }));

    await supabase.from("in_app_notifications").insert(notifInserts);

    console.log(
      `SMS reply from ${fromPhone} routed to ${adminUsers.length} admin user(s) for tenant ${tenantId}`
    );
  } catch (error) {
    console.error("Error routing SMS reply to messages:", error);
  }
}

/** Return a TwiML XML response */
function twimlResponse(message: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

serve(handler);
