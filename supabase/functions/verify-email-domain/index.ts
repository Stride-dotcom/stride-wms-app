import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get tenant_id and resend_domain_id from user profile
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

    // Get the resend_domain_id from brand settings
    const { data: brandSettings } = await supabase
      .from("communication_brand_settings")
      .select("resend_domain_id")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    if (!brandSettings?.resend_domain_id) {
      return new Response(
        JSON.stringify({ 
          error: "No domain registered. Please register your domain first.",
          verified: false,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainId = brandSettings.resend_domain_id;
    console.log(`Verifying domain ${domainId} with Resend for tenant ${profile.tenant_id}`);

    // Call Resend API to verify domain
    const verifyResponse = await fetch(`https://api.resend.com/domains/${domainId}/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      console.error("Resend verification error:", errorData);
      return new Response(
        JSON.stringify({ 
          error: errorData.message || "Failed to verify domain with Resend",
          verified: false,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the updated domain status
    const domainResponse = await fetch(`https://api.resend.com/domains/${domainId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
      },
    });

    const domainData = await domainResponse.json();
    console.log("Domain status after verification:", domainData);

    // Parse verification status from records
    const records = domainData.records || [];
    const spfRecord = records.find((r: any) => r.record === "SPF" || r.type === "TXT" && r.value?.includes("spf"));
    const dkimRecord = records.find((r: any) => r.record === "DKIM" || r.name?.includes("domainkey"));
    
    const spfVerified = spfRecord?.status === "verified" || spfRecord?.status === "success";
    const dkimVerified = dkimRecord?.status === "verified" || dkimRecord?.status === "success";
    const isVerified = domainData.status === "verified";

    // Update the database with verification status
    await supabase
      .from("communication_brand_settings")
      .update({
        email_domain_verified: isVerified,
        spf_verified: spfVerified,
        dkim_verified: dkimVerified,
        email_verified_at: isVerified ? new Date().toISOString() : null,
        resend_dns_records: records,
      })
      .eq("tenant_id", profile.tenant_id);

    const message = isVerified 
      ? "Domain verified successfully! Emails will now be sent from your custom domain."
      : `Domain verification pending. SPF: ${spfVerified ? "✓" : "pending"}, DKIM: ${dkimVerified ? "✓" : "pending"}. Please ensure DNS records are configured correctly.`;

    return new Response(
      JSON.stringify({
        verified: isVerified,
        status: domainData.status,
        spf_verified: spfVerified,
        dkim_verified: dkimVerified,
        records: records,
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
      JSON.stringify({ error: error.message, verified: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
