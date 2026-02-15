import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBaseUrl(req: Request): string {
  const configured = APP_URL.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const origin = (req.headers.get("origin") ?? "").trim().replace(/\/+$/, "");
  if (origin.startsWith("http://") || origin.startsWith("https://")) return origin;

  return "http://localhost:5173";
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      return jsonResponse({ ok: false, error: "Stripe secret key is not configured" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ ok: false, error: "Missing authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.tenant_id) {
      return jsonResponse({ ok: false, error: "User tenant not found" }, 400);
    }

    const tenantId = profile.tenant_id;

    const { data: billingOverride, error: billingOverrideError } = await (supabase as any)
      .from("tenant_billing_overrides")
      .select("is_comped, expires_at")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (billingOverrideError) {
      return jsonResponse({ ok: false, error: billingOverrideError.message }, 500);
    }

    const isCompedTenant =
      billingOverride?.is_comped === true &&
      (!billingOverride?.expires_at ||
        new Date(String(billingOverride.expires_at)).getTime() > Date.now());
    if (isCompedTenant) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This tenant is currently marked as comped. Stripe checkout is disabled while the comped override is active.",
        },
        409
      );
    }

    const { data: existingSubscription, error: existingError } = await supabase
      .from("tenant_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ ok: false, error: existingError.message }, 500);
    }

    if (existingSubscription?.stripe_subscription_id && existingSubscription.status === "active") {
      return jsonResponse(
        {
          ok: false,
          error: "An active subscription already exists. Use subscription management instead.",
        },
        400
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("saas_plans")
      .select("id, name, stripe_price_id_base")
      .eq("is_active", true)
      .not("stripe_price_id_base", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (planError) {
      return jsonResponse({ ok: false, error: planError.message }, 500);
    }

    if (!plan?.stripe_price_id_base) {
      return jsonResponse(
        {
          ok: false,
          error: "No active SaaS plan with stripe_price_id_base configured.",
        },
        400
      );
    }

    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/billing?subscription=success`;
    const cancelUrl = `${baseUrl}/billing?subscription=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existingSubscription?.stripe_customer_id ?? undefined,
      line_items: [
        {
          price: plan.stripe_price_id_base,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        tenant_id: tenantId,
        plan_id: plan.id,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          plan_id: plan.id,
        },
      },
    });

    return jsonResponse({
      ok: true,
      url: session.url,
      session_id: session.id,
      plan_name: plan.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-stripe-checkout-session error:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});

