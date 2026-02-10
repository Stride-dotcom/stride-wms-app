import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * handle-incoming-sms
 *
 * Twilio webhook handler for inbound SMS messages.
 * Processes STOP, HELP, START/YES/OK/ACCEPT/APPROVE keywords to manage
 * opt-in/opt-out consent per phone number (TCPA compliance).
 *
 * Setup:
 * 1. Deploy this function to Supabase
 * 2. In Twilio Console → Phone Numbers → your number → Messaging → "A MESSAGE COMES IN"
 *    set the webhook URL to: https://<project-ref>.supabase.co/functions/v1/handle-incoming-sms
 * 3. Ensure TWILIO_AUTH_TOKEN is set as a Supabase secret for request validation
 */

const STOP_KEYWORDS = ["stop", "unsubscribe", "cancel", "end", "quit"];
const HELP_KEYWORDS = ["help", "info"];
const OPT_IN_KEYWORDS_DEFAULT = ["start", "yes", "ok", "accept", "approve", "subscribe"];

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
    const body = (formData.get("Body") as string || "").trim().toLowerCase();
    const to = formData.get("To") as string; // Our Twilio number

    if (!from || !body) {
      return twimlResponse("");
    }

    // Look up tenant by their Twilio phone number
    const { data: tenantSettings } = await supabase
      .from("tenant_company_settings")
      .select("tenant_id, sms_opt_in_message, sms_help_message, sms_stop_message, sms_opt_in_keywords, twilio_from_phone, twilio_messaging_service_sid")
      .or(`twilio_from_phone.eq.${to}`)
      .limit(1)
      .maybeSingle();

    if (!tenantSettings) {
      // No tenant found for this phone number - return empty TwiML
      return twimlResponse("");
    }

    const tenantId = tenantSettings.tenant_id;

    // Parse tenant-specific opt-in keywords
    const customKeywords = tenantSettings.sms_opt_in_keywords
      ? tenantSettings.sms_opt_in_keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean)
      : OPT_IN_KEYWORDS_DEFAULT;

    // Determine keyword type
    const isStop = STOP_KEYWORDS.includes(body);
    const isHelp = HELP_KEYWORDS.includes(body);
    const isOptIn = customKeywords.includes(body);

    if (!isStop && !isHelp && !isOptIn) {
      // Not a recognized keyword - no action
      return twimlResponse("");
    }

    // Look up existing consent record
    const { data: existing } = await supabase
      .from("sms_consent")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("phone_number", from)
      .maybeSingle();

    const now = new Date().toISOString();

    if (isStop) {
      if (existing) {
        await supabase
          .from("sms_consent")
          .update({ status: "opted_out", opted_out_at: now, last_keyword: body })
          .eq("id", existing.id);

        await supabase.from("sms_consent_log").insert({
          tenant_id: tenantId,
          consent_id: existing.id,
          phone_number: from,
          action: "opt_out",
          method: "text_keyword",
          keyword: body,
          previous_status: existing.status,
          new_status: "opted_out",
        });
      } else {
        // Create record as opted_out
        const { data: newRecord } = await supabase
          .from("sms_consent")
          .insert({
            tenant_id: tenantId,
            phone_number: from,
            status: "opted_out",
            consent_method: "text_keyword",
            opted_out_at: now,
            last_keyword: body,
          })
          .select("id")
          .single();

        if (newRecord) {
          await supabase.from("sms_consent_log").insert({
            tenant_id: tenantId,
            consent_id: newRecord.id,
            phone_number: from,
            action: "opt_out",
            method: "text_keyword",
            keyword: body,
            new_status: "opted_out",
          });
        }
      }

      const stopMsg =
        tenantSettings.sms_stop_message ||
        "You have been unsubscribed. You will not receive any more messages. Reply START to re-subscribe.";

      return twimlResponse(stopMsg);
    }

    if (isHelp) {
      const helpMsg =
        tenantSettings.sms_help_message ||
        "For help, reply to this message or contact support. Reply STOP to opt out. Msg & data rates may apply.";

      return twimlResponse(helpMsg);
    }

    if (isOptIn) {
      if (existing) {
        await supabase
          .from("sms_consent")
          .update({ status: "opted_in", opted_in_at: now, last_keyword: body })
          .eq("id", existing.id);

        await supabase.from("sms_consent_log").insert({
          tenant_id: tenantId,
          consent_id: existing.id,
          phone_number: from,
          action: "opt_in",
          method: "text_keyword",
          keyword: body,
          previous_status: existing.status,
          new_status: "opted_in",
        });
      } else {
        const { data: newRecord } = await supabase
          .from("sms_consent")
          .insert({
            tenant_id: tenantId,
            phone_number: from,
            status: "opted_in",
            consent_method: "text_keyword",
            opted_in_at: now,
            last_keyword: body,
          })
          .select("id")
          .single();

        if (newRecord) {
          await supabase.from("sms_consent_log").insert({
            tenant_id: tenantId,
            consent_id: newRecord.id,
            phone_number: from,
            action: "opt_in",
            method: "text_keyword",
            keyword: body,
            new_status: "opted_in",
          });
        }
      }

      const optInMsg =
        tenantSettings.sms_opt_in_message ||
        "You are now subscribed to SMS notifications. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.";

      return twimlResponse(optInMsg);
    }

    return twimlResponse("");
  } catch (error) {
    console.error("Error handling incoming SMS:", error);
    // Return empty TwiML on error so Twilio doesn't retry
    return twimlResponse("");
  }
};

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
