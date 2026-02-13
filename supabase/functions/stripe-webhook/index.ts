// =============================================================================
// Stripe Webhook Handler — Stride SaaS Phase 5 v3
// Server-to-server only. No CORS. No OPTIONS handler.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return stripeStatus;
  }
}

async function tenantExists(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) {
    console.error("tenantExists check error:", error.message);
    return false;
  }
  return data !== null;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof getServiceClient>,
  event: Stripe.Event
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const tenantId = session.metadata?.tenant_id;

  if (!tenantId) {
    console.warn("checkout.session.completed: no metadata.tenant_id, skipping");
    return;
  }

  const exists = await tenantExists(supabase, tenantId);
  if (!exists) {
    console.warn(`checkout.session.completed: tenant ${tenantId} not found, skipping`);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const { error } = await supabase.rpc(
    "rpc_initialize_tenant_subscription_from_checkout",
    {
      p_tenant_id: tenantId,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId,
    }
  );

  if (error) {
    console.error("rpc_initialize_tenant_subscription_from_checkout error:", error.message);
  } else {
    console.log(`checkout.session.completed: bootstrapped tenant ${tenantId}`);
  }
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof getServiceClient>,
  event: Stripe.Event
) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!subscriptionId) {
    console.warn("invoice.paid: no subscription_id, skipping");
    return;
  }

  const { error } = await supabase.rpc("rpc_mark_payment_ok", {
    p_stripe_subscription_id: subscriptionId,
  });

  if (error) {
    console.error("rpc_mark_payment_ok error:", error.message);
  } else {
    console.log(`invoice.paid: marked ok for subscription ${subscriptionId}`);
  }
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof getServiceClient>,
  event: Stripe.Event
) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!subscriptionId) {
    console.warn("invoice.payment_failed: no subscription_id, skipping");
    return;
  }

  const { error } = await supabase.rpc("rpc_mark_payment_failed_and_start_grace", {
    p_stripe_subscription_id: subscriptionId,
  });

  if (error) {
    console.error("rpc_mark_payment_failed_and_start_grace error:", error.message);
  } else {
    console.log(`invoice.payment_failed: started grace for subscription ${subscriptionId}`);
  }
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof getServiceClient>,
  event: Stripe.Event
) {
  const subscription = event.data.object as Stripe.Subscription;

  // Look up tenant by stripe_subscription_id
  const { data: existing } = await supabase
    .from("tenant_subscriptions")
    .select("tenant_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (!existing) {
    console.warn(
      `customer.subscription.updated: no tenant found for subscription ${subscription.id}, skipping`
    );
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabase.rpc(
    "rpc_upsert_tenant_subscription_from_stripe",
    {
      p_tenant_id: existing.tenant_id,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscription.id,
      p_status: mapStripeStatus(subscription.status),
      p_current_period_end: periodEnd,
      p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    }
  );

  if (error) {
    console.error("rpc_upsert_tenant_subscription_from_stripe error:", error.message);
  } else {
    console.log(`customer.subscription.updated: upserted for tenant ${existing.tenant_id}`);
  }
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof getServiceClient>,
  event: Stripe.Event
) {
  const subscription = event.data.object as Stripe.Subscription;

  const { data: existing } = await supabase
    .from("tenant_subscriptions")
    .select("tenant_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (!existing) {
    console.warn(
      `customer.subscription.deleted: no tenant found for subscription ${subscription.id}, skipping`
    );
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const { error } = await supabase.rpc(
    "rpc_upsert_tenant_subscription_from_stripe",
    {
      p_tenant_id: existing.tenant_id,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscription.id,
      p_status: "canceled",
      p_cancel_at_period_end: false,
    }
  );

  if (error) {
    console.error("rpc_upsert_tenant_subscription_from_stripe (deleted) error:", error.message);
  } else {
    console.log(`customer.subscription.deleted: set canceled for tenant ${existing.tenant_id}`);
  }
}

// ---------------------------------------------------------------------------
// Main handler — NO CORS, server-to-server only
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event);
        break;
      case "invoice.paid":
        await handleInvoicePaid(supabase, event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(supabase, event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(supabase, event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, (err as Error).message);
    // Always return 200 to prevent Stripe retries for handled events
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
