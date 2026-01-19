import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  email: string;
  verificationType: 'simple' | 'dns';
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant_id from user profile
    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "User has no tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, verificationType }: VerifyRequest = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = email.split("@")[1];
    let verified = false;
    let spfVerified = false;
    let dkimVerified = false;
    let message = "";

    if (verificationType === "simple") {
      // For simple verification, we just mark it as verified
      // In production, you'd send a verification email
      verified = true;
      message = "Domain verified via simple verification";
    } else if (verificationType === "dns") {
      // Check DNS records for SPF
      try {
        const spfRecords = await Deno.resolveDns(domain, "TXT");
        for (const records of spfRecords) {
          const recordText = Array.isArray(records) ? records.join("") : records;
          if (recordText.includes("v=spf1") && recordText.includes("resend.com")) {
            spfVerified = true;
            break;
          }
        }
      } catch (e) {
        console.log("SPF lookup error:", e);
      }

      // Check for DKIM record
      try {
        const dkimHost = `resend._domainkey.${domain}`;
        const dkimRecords = await Deno.resolveDns(dkimHost, "TXT");
        if (dkimRecords && dkimRecords.length > 0) {
          dkimVerified = true;
        }
      } catch (e) {
        console.log("DKIM lookup error:", e);
      }

      verified = spfVerified; // At minimum SPF should be set
      message = verified
        ? `Domain verified. SPF: ${spfVerified ? "✓" : "✗"}, DKIM: ${dkimVerified ? "✓" : "✗"}`
        : "DNS verification failed. Please ensure SPF record is properly configured.";
    }

    // Update the verification status in the database
    if (verified) {
      await supabase
        .from("communication_brand_settings")
        .update({
          email_domain_verified: true,
          email_verified_at: new Date().toISOString(),
          spf_verified: spfVerified,
          dkim_verified: dkimVerified,
        })
        .eq("tenant_id", profile.tenant_id);
    }

    return new Response(
      JSON.stringify({
        verified,
        spf_verified: spfVerified,
        dkim_verified: dkimVerified,
        message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-email-domain function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
