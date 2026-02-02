import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CreateDocumentBody = {
  context_type: string;
  context_id: string | null;
  file_name: string;
  storage_key: string;
  file_size?: number | null;
  page_count?: number | null;
  mime_type?: string | null;
  ocr_text?: string | null;
  ocr_pages?: unknown | null;
  ocr_status?: string | null;
  label?: string | null;
  notes?: string | null;
  is_sensitive?: boolean | null;
};

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
        JSON.stringify({ ok: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: CreateDocumentBody = await req.json();
    if (!body?.context_type || !body?.file_name || !body?.storage_key) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve tenant from the authenticated user
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "User has no tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert document record using service role (bypasses RLS)
    // We DO NOT trust tenant_id/created_by coming from the client.
    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        tenant_id: profile.tenant_id,
        created_by: user.id,
        context_type: body.context_type,
        context_id: body.context_id ?? null,
        file_name: body.file_name,
        storage_key: body.storage_key,
        file_size: body.file_size ?? null,
        page_count: body.page_count ?? null,
        mime_type: body.mime_type ?? null,
        ocr_text: body.ocr_text ?? null,
        ocr_pages: body.ocr_pages ?? null,
        ocr_status: body.ocr_status ?? null,
        label: body.label ?? null,
        notes: body.notes ?? null,
        is_sensitive: body.is_sensitive ?? false,
      })
      .select("id, tenant_id, storage_key")
      .single();

    if (insertError || !doc) {
      console.error("create-document insert failed", insertError);
      return new Response(
        JSON.stringify({ ok: false, error: insertError?.message || "Failed to create document" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, document: doc }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-document error", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
