import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RegisterRequest {
  domain: string;
}

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

    const { domain }: RegisterRequest = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Registering domain ${domain} with Resend for tenant ${profile.tenant_id}`);

    // Call Resend API to create domain
    const resendResponse = await fetch("https://api.resend.com/domains", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendData);
      
      // Check if domain already exists
      if (resendData.message?.includes("already exists") || resendData.name === "validation_error") {
        // Try to get existing domain from list
        const listResponse = await fetch("https://api.resend.com/domains", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
          },
        });
        
        const listData = await listResponse.json();
        const existingDomain = listData.data?.find((d: any) => d.name === domain);
        
        if (existingDomain) {
          // Fetch full domain details including DNS records
          const detailResponse = await fetch(`https://api.resend.com/domains/${existingDomain.id}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
            },
          });
          
          const domainDetails = await detailResponse.json();
          console.log("Domain details from Resend:", domainDetails);
          
          const records = domainDetails.records || [];
          
          // Update database with full domain info including DNS records
          await supabase
            .from("communication_brand_settings")
            .upsert({
              tenant_id: profile.tenant_id,
              resend_domain_id: existingDomain.id,
              resend_dns_records: records,
              email_domain_verified: domainDetails.status === "verified",
            }, {
              onConflict: "tenant_id",
            });

          return new Response(
            JSON.stringify({
              success: true,
              domain_id: existingDomain.id,
              status: domainDetails.status,
              records: records,
              message: records.length > 0 
                ? "Domain registered. Add the DNS records below to your domain settings."
                : "Domain already registered with Resend",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: resendData.message || "Failed to register domain with Resend",
          details: resendData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Resend domain created:", resendData);

    // Save the domain ID and DNS records to database
    await supabase
      .from("communication_brand_settings")
      .upsert({
        tenant_id: profile.tenant_id,
        resend_domain_id: resendData.id,
        resend_dns_records: resendData.records || [],
        email_domain_verified: false,
        spf_verified: false,
        dkim_verified: false,
      }, {
        onConflict: "tenant_id",
      });

    return new Response(
      JSON.stringify({
        success: true,
        domain_id: resendData.id,
        status: resendData.status,
        records: resendData.records || [],
        message: "Domain registered successfully. Please add the DNS records shown.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in register-email-domain function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
