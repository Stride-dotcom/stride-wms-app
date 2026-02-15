import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * sms-opt-in
 *
 * Public edge function (no auth required) for the SMS opt-in consent page.
 * Two actions:
 *   1. get_tenant_info - Returns public tenant branding for the opt-in form
 *   2. opt_in - Records consent for a phone number
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "preview",
  "preview--stridewms",
  "stridewms",
  "localhost",
]);

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-()]/g, "");
  const digitsOnly = stripped.startsWith("+")
    ? "+" + stripped.slice(1).replace(/\D/g, "")
    : stripped.replace(/\D/g, "");

  // If just digits with no +, assume US number
  if (!digitsOnly.startsWith("+")) {
    if (digitsOnly.length === 10) return "+1" + digitsOnly;
    if (digitsOnly.length === 11 && digitsOnly.startsWith("1"))
      return "+" + digitsOnly;
    return "+" + digitsOnly;
  }
  return digitsOnly;
}

function normalizeHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().split(":")[0];
}

function extractTenantSubdomain(rawHost: string): string | null {
  const host = normalizeHost(rawHost);
  if (!host || host === "localhost") return null;

  const labels = host.split(".").filter(Boolean);
  if (labels.length < 3) return null;

  const candidate = labels[0];
  if (!candidate || RESERVED_SUBDOMAINS.has(candidate)) return null;

  return candidate;
}

async function resolveTenantIdFromHost(
  supabase: ReturnType<typeof createClient>,
  rawHost: string
): Promise<string | null> {
  const subdomain = extractTenantSubdomain(rawHost);
  if (!subdomain) return null;

  const { data, error } = await supabase
    .from("tenant_company_settings")
    .select("tenant_id")
    .ilike("app_subdomain", subdomain)
    .maybeSingle();

  if (error) {
    console.error("resolveTenantIdFromHost lookup error:", error.message);
    return null;
  }

  return data?.tenant_id ?? null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const action = body?.action;
    const providedTenantId =
      typeof body?.tenant_id === "string" && body.tenant_id.trim()
        ? body.tenant_id.trim()
        : null;
    const requestedHost =
      typeof body?.host === "string" && body.host.trim() ? body.host.trim() : null;
    let resolvedTenantId = providedTenantId;

    if (!resolvedTenantId && requestedHost) {
      resolvedTenantId = await resolveTenantIdFromHost(supabase, requestedHost);
    }

    if (!resolvedTenantId) {
      return jsonResponse(
        { error: "Missing tenant context. Provide tenant_id or use a configured tenant subdomain." },
        400
      );
    }

    // Verify tenant exists
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, status")
      .eq("id", resolvedTenantId)
      .eq("status", "active")
      .maybeSingle();

    if (!tenant) {
      return jsonResponse({ error: "Organization not found" }, 404);
    }

    if (action === "get_tenant_info" || action === "resolve_tenant") {
      // Return public branding info for the opt-in form
      const { data: settings } = await supabase
        .from("tenant_company_settings")
        .select(
          "company_name, company_email, company_phone, logo_url, sms_opt_in_message, sms_help_message, sms_privacy_policy_url, sms_terms_conditions_url"
        )
        .eq("tenant_id", resolvedTenantId)
        .maybeSingle();

      return jsonResponse({
        tenant_id: resolvedTenantId,
        tenant: {
          company_name: settings?.company_name || tenant.name,
          company_email: settings?.company_email || null,
          company_phone: settings?.company_phone || null,
          logo_url: settings?.logo_url || null,
          sms_opt_in_message: settings?.sms_opt_in_message || null,
          sms_help_message: settings?.sms_help_message || null,
          sms_privacy_policy_url: settings?.sms_privacy_policy_url || null,
          sms_terms_conditions_url: settings?.sms_terms_conditions_url || null,
        },
      });
    }

    if (action === "opt_in") {
      const { phone_number, contact_name } = body;

      if (!phone_number) {
        return jsonResponse({ error: "Phone number is required" }, 400);
      }

      const normalized = normalizePhone(phone_number);

      // Validate E.164
      if (!/^\+\d{7,15}$/.test(normalized)) {
        return jsonResponse(
          { error: "Invalid phone number format. Please use a valid phone number." },
          400
        );
      }

      const now = new Date().toISOString();

      // Check for existing record
      const { data: existing } = await supabase
        .from("sms_consent")
        .select("id, status")
        .eq("tenant_id", resolvedTenantId)
        .eq("phone_number", normalized)
        .maybeSingle();

      if (existing) {
        if (existing.status === "opted_in") {
          return jsonResponse({
            success: true,
            message: "You are already subscribed to SMS notifications.",
            already_subscribed: true,
          });
        }

        // Re-opt in
        await supabase
          .from("sms_consent")
          .update({
            status: "opted_in",
            consent_method: "web_form",
            opted_in_at: now,
            contact_name: contact_name || undefined,
          })
          .eq("id", existing.id);

        await supabase.from("sms_consent_log").insert({
          tenant_id: resolvedTenantId,
          consent_id: existing.id,
          phone_number: normalized,
          action: "opt_in",
          method: "web_form",
          previous_status: existing.status,
          new_status: "opted_in",
        });
      } else {
        // Create new consent record
        const { data: newRecord, error: insertError } = await supabase
          .from("sms_consent")
          .insert({
            tenant_id: resolvedTenantId,
            phone_number: normalized,
            contact_name: contact_name || null,
            status: "opted_in",
            consent_method: "web_form",
            opted_in_at: now,
          })
          .select("id")
          .single();

        if (insertError) {
          // Handle race condition duplicate
          if (
            insertError.message?.includes("duplicate key") ||
            insertError.message?.includes("unique constraint")
          ) {
            return jsonResponse({
              success: true,
              message: "You are already subscribed.",
              already_subscribed: true,
            });
          }
          throw insertError;
        }

        if (newRecord) {
          await supabase.from("sms_consent_log").insert({
            tenant_id: resolvedTenantId,
            consent_id: newRecord.id,
            phone_number: normalized,
            action: "opt_in",
            method: "web_form",
            new_status: "opted_in",
          });
        }
      }

      return jsonResponse({
        success: true,
        message: "Successfully subscribed to SMS notifications.",
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error: any) {
    console.error("sms-opt-in error:", error);
    return jsonResponse(
      { error: error.message || "An unexpected error occurred" },
      500
    );
  }
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
