import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-sms
 *
 * Sends an SMS message via Twilio. Used by the in-app Messages page
 * when replying to SMS conversations.
 *
 * Requires: TWILIO_AUTH_TOKEN as a Supabase secret.
 * Reads Account SID and From Phone/Messaging Service SID from tenant settings.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendSmsRequest {
  tenant_id: string;
  to_phone: string;
  body: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!twilioAuthToken) {
      throw new Error("TWILIO_AUTH_TOKEN not configured in Supabase secrets.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, to_phone, body: messageBody }: SendSmsRequest =
      await req.json();

    if (!tenant_id || !to_phone || !messageBody) {
      throw new Error("Missing required fields: tenant_id, to_phone, body");
    }

    // Get tenant's Twilio config
    const { data: settings, error: settingsError } = await supabase
      .from("tenant_company_settings")
      .select(
        "twilio_account_sid, twilio_messaging_service_sid, twilio_from_phone, sms_enabled"
      )
      .eq("tenant_id", tenant_id)
      .single();

    if (settingsError || !settings) {
      throw new Error("Tenant SMS settings not found.");
    }

    if (!settings.sms_enabled) {
      throw new Error("SMS is not enabled for this organization.");
    }

    const accountSid = settings.twilio_account_sid;
    if (!accountSid) {
      throw new Error(
        "Twilio Account SID not configured. Go to Settings > SMS to set it up."
      );
    }

    if (!settings.twilio_messaging_service_sid && !settings.twilio_from_phone) {
      throw new Error(
        "No Messaging Service SID or From Phone configured. Go to Settings > SMS."
      );
    }

    // Clean phone number
    let cleanPhone = to_phone.replace(/[^\d+]/g, "");
    if (!cleanPhone.startsWith("+")) {
      if (cleanPhone.length === 10) {
        cleanPhone = "+1" + cleanPhone;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
        cleanPhone = "+" + cleanPhone;
      } else {
        cleanPhone = "+" + cleanPhone;
      }
    }

    // Check opt-out status
    const { data: consent } = await supabase
      .from("sms_consent")
      .select("status")
      .eq("tenant_id", tenant_id)
      .eq("phone_number", cleanPhone)
      .maybeSingle();

    if (consent?.status === "opted_out") {
      throw new Error(
        `Cannot send SMS to ${cleanPhone} - recipient has opted out.`
      );
    }

    // Build Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append("To", cleanPhone);
    formData.append("Body", messageBody);

    // Use Messaging Service SID if available, otherwise From Phone
    if (settings.twilio_messaging_service_sid) {
      formData.append(
        "MessagingServiceSid",
        settings.twilio_messaging_service_sid
      );
    } else {
      formData.append("From", settings.twilio_from_phone!);
    }

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + btoa(`${accountSid}:${twilioAuthToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);

      if (
        twilioData.code === 21610 ||
        (twilioData.message && twilioData.message.includes("unsubscribed"))
      ) {
        throw new Error(
          "This number has been unsubscribed via Twilio. The recipient must text START to re-subscribe."
        );
      }

      throw new Error(twilioData.message || "Failed to send SMS via Twilio");
    }

    console.log("SMS sent:", twilioData.sid, "to:", cleanPhone);

    return new Response(
      JSON.stringify({
        success: true,
        sid: twilioData.sid,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
