import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestSmsRequest {
  tenant_id: string;
  to_phone: string;
}

async function authenticateAndAuthorize(req: Request, tenant_id: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error("UNAUTHORIZED");
  }

  const userId = data.claims.sub as string;

  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: userData, error: userError } = await adminClient
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  if (userError || !userData || userData.tenant_id !== tenant_id) {
    throw new Error("FORBIDDEN");
  }

  return { userId, adminClient };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, to_phone }: TestSmsRequest = await req.json();

    if (!tenant_id || !to_phone) {
      return jsonResponse(400, { success: false, error: "Missing required fields: tenant_id, to_phone" });
    }

    // Authenticate and verify tenant membership
    const { adminClient: supabase } = await authenticateAndAuthorize(req, tenant_id);

    // Read auth token from Supabase secret (NEVER stored in DB)
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!twilioAuthToken) {
      return jsonResponse(200, {
        success: false,
        error: "TWILIO_AUTH_TOKEN is not configured in Supabase secrets. Add it via: supabase secrets set TWILIO_AUTH_TOKEN=your_token",
      });
    }

    // Fetch tenant SMS config from DB
    const { data: settings, error: dbError } = await supabase
      .from("tenant_company_settings")
      .select("twilio_account_sid, twilio_messaging_service_sid, twilio_from_phone, sms_enabled, sms_sender_name")
      .eq("tenant_id", tenant_id)
      .single();

    if (dbError || !settings) {
      return jsonResponse(200, {
        success: false,
        error: "Could not load SMS settings for this tenant. Save your Twilio configuration first.",
      });
    }

    if (!settings.sms_enabled) {
      return jsonResponse(200, {
        success: false,
        error: "SMS sending is disabled. Enable it in Organization → Contact → SMS Settings.",
      });
    }

    const accountSid = settings.twilio_account_sid;
    if (!accountSid) {
      return jsonResponse(200, {
        success: false,
        error: "Twilio Account SID is not configured. Add it in Organization → Contact → SMS Settings.",
      });
    }

    const messagingServiceSid = settings.twilio_messaging_service_sid;
    const fromPhone = settings.twilio_from_phone;
    if (!messagingServiceSid && !fromPhone) {
      return jsonResponse(200, {
        success: false,
        error: "Neither Messaging Service SID nor From Phone is configured. Add one in Organization → Contact → SMS Settings.",
      });
    }

    // Clean the destination phone
    let cleanPhone = to_phone.replace(/[\s\-()]/g, "");
    if (!cleanPhone.startsWith("+")) {
      const digits = cleanPhone.replace(/\D/g, "");
      if (digits.length === 10) {
        cleanPhone = "+1" + digits;
      } else if (digits.length === 11 && digits.startsWith("1")) {
        cleanPhone = "+" + digits;
      } else {
        cleanPhone = "+" + digits;
      }
    }

    // Build Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("To", cleanPhone);
    formData.append("Body", "✅ Stride WMS test SMS successful.");

    if (messagingServiceSid) {
      formData.append("MessagingServiceSid", messagingServiceSid);
    } else {
      formData.append("From", fromPhone!);
    }

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${twilioAuthToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));

      if (twilioData.code === 21608 || (twilioData.message && twilioData.message.includes("unverified"))) {
        return jsonResponse(200, {
          success: false,
          error: "Trial account: can only send to verified numbers. Verify this number at twilio.com/console or upgrade your account.",
        });
      }

      return jsonResponse(200, {
        success: false,
        error: twilioData.message || "Twilio API returned an error",
      });
    }

    console.log("Test SMS sent:", twilioData.sid);

    return jsonResponse(200, { success: true, sid: twilioData.sid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "UNAUTHORIZED") {
      return jsonResponse(401, { success: false, error: "Unauthorized" });
    }
    if (message === "FORBIDDEN") {
      return jsonResponse(403, { success: false, error: "Forbidden: tenant mismatch" });
    }

    console.error("send-sms-test error:", message);
    return jsonResponse(200, { success: false, error: message });
  }
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
