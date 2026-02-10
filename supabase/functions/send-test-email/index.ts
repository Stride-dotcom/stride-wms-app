import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  to_email: string;
  subject: string;
  body_html: string;
  from_name?: string;
  from_email?: string;
  tenant_id: string;
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

  // Verify tenant membership using service role
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
    const { to_email, subject, body_html, from_name, from_email, tenant_id }: TestEmailRequest = await req.json();

    // Authenticate and verify tenant membership
    const { adminClient: supabase } = await authenticateAndAuthorize(req, tenant_id);

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Fetch brand settings for wrapping
    const { data: brandSettings } = await supabase
      .from('communication_brand_settings')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    // Fetch tenant name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('company_name, company_logo_url')
      .eq('id', tenant_id)
      .single();

    const logoUrl = brandSettings?.brand_logo_url || tenant?.company_logo_url;
    const companyName = tenant?.company_name || 'Stride Warehouse';
    const primaryColor = brandSettings?.brand_primary_color || '#3b82f6';

    // Wrap email with branding
    const wrappedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .email-container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 3px solid ${primaryColor}; }
    .header img { max-height: 60px; }
    .content { padding: 30px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
    .test-banner { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; text-align: center; border-radius: 6px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}">` : `<h2 style="color: ${primaryColor}; margin: 0;">${companyName}</h2>`}
    </div>
    <div class="content">
      <div class="test-banner">
        ⚠️ <strong>TEST EMAIL</strong> - This is a preview of your email template
      </div>
      ${body_html}
    </div>
    <div class="footer">
      <p>This test email was sent from ${companyName}</p>
      <p style="color: #999;">Powered by Stride Warehouse Management</p>
    </div>
  </div>
</body>
</html>`;

    const senderName = from_name || brandSettings?.from_name || companyName;
    const senderEmail = from_email || brandSettings?.from_email || 'onboarding@resend.dev';

    console.log("Sending test email to:", to_email, "from:", senderEmail);
    
    const emailResponse = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: to_email,
      subject: `[TEST] ${subject}`,
      html: wrappedHtml,
    });

    console.log("Test email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (error.message === "FORBIDDEN") {
      return new Response(
        JSON.stringify({ error: "Forbidden: tenant mismatch" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    console.error("Error sending test email:", error);
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
