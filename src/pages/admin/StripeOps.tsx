import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionGate } from "@/hooks/useSubscriptionGate";

interface SubscriptionSnapshot {
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_payment_failed_at: string | null;
  grace_until: string | null;
  created_at: string | null;
  updated_at: string | null;
  plan?: {
    name: string | null;
  } | null;
}

export default function StripeOps() {
  const { data: gate, refetch: refetchGate, isFetching: isFetchingGate } = useSubscriptionGate();
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);

  const fetchSnapshot = async () => {
    setLoadingSnapshot(true);
    try {
      const { data } = await supabase
        .from("tenant_subscriptions")
        .select(
          "tenant_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, last_payment_failed_at, grace_until, created_at, updated_at, plan:saas_plans(name)"
        )
        .maybeSingle();

      setSnapshot((data as SubscriptionSnapshot | null) ?? null);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  useEffect(() => {
    void fetchSnapshot();
  }, []);

  const customerDashboardUrl = useMemo(() => {
    if (!snapshot?.stripe_customer_id) return null;
    return `https://dashboard.stripe.com/customers/${snapshot.stripe_customer_id}`;
  }, [snapshot?.stripe_customer_id]);

  const subscriptionDashboardUrl = useMemo(() => {
    if (!snapshot?.stripe_subscription_id) return null;
    return `https://dashboard.stripe.com/subscriptions/${snapshot.stripe_subscription_id}`;
  }, [snapshot?.stripe_subscription_id]);

  return (
    <DashboardLayout>
      <PageHeader
        primaryText="Stripe"
        accentText="Ops"
        description="Read-only observability for subscription state and Stripe object links"
      />

      <div className="space-y-6">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/billing-overrides-ops">
              <MaterialIcon name="money_off" size="sm" className="mr-2" />
              Open Billing Overrides Ops
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/sms-sender-ops">
              <MaterialIcon name="sms" size="sm" className="mr-2" />
              Open SMS Sender Ops
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/pricing-ops">
              <MaterialIcon name="tune" size="sm" className="mr-2" />
              Open Pricing Ops
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gate state</CardTitle>
            <CardDescription>Live result from rpc_get_my_subscription_gate()</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">status:</span> {gate?.status ?? "unknown"}
            </p>
            <p>
              <span className="font-medium">is_active:</span> {String(gate?.is_active ?? false)}
            </p>
            <p>
              <span className="font-medium">is_in_grace:</span> {String(gate?.is_in_grace ?? false)}
            </p>
            <p>
              <span className="font-medium">is_restricted:</span> {String(gate?.is_restricted ?? false)}
            </p>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={() => void refetchGate()} disabled={isFetchingGate}>
                Refresh gate state
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant subscription snapshot</CardTitle>
            <CardDescription>Read view from tenant_subscriptions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loadingSnapshot ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                Loading subscription snapshot...
              </div>
            ) : !snapshot ? (
              <p className="text-muted-foreground">
                No tenant_subscriptions row visible for this user/tenant.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <Badge variant="secondary">{snapshot.status}</Badge>
                </div>
                <p>
                  <span className="font-medium">Plan:</span> {snapshot.plan?.name ?? "N/A"}
                </p>
                <p>
                  <span className="font-medium">Tenant ID:</span> {snapshot.tenant_id}
                </p>
                <p>
                  <span className="font-medium">Stripe customer:</span> {snapshot.stripe_customer_id ?? "N/A"}
                </p>
                <p>
                  <span className="font-medium">Stripe subscription:</span>{" "}
                  {snapshot.stripe_subscription_id ?? "N/A"}
                </p>
                <p>
                  <span className="font-medium">Current period end:</span>{" "}
                  {snapshot.current_period_end
                    ? new Date(snapshot.current_period_end).toLocaleString()
                    : "N/A"}
                </p>
                <p>
                  <span className="font-medium">Grace until:</span>{" "}
                  {snapshot.grace_until ? new Date(snapshot.grace_until).toLocaleString() : "N/A"}
                </p>
                <p>
                  <span className="font-medium">Last payment failed at:</span>{" "}
                  {snapshot.last_payment_failed_at
                    ? new Date(snapshot.last_payment_failed_at).toLocaleString()
                    : "N/A"}
                </p>
                <p>
                  <span className="font-medium">Updated:</span>{" "}
                  {snapshot.updated_at ? new Date(snapshot.updated_at).toLocaleString() : "N/A"}
                </p>
              </>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => void fetchSnapshot()} disabled={loadingSnapshot}>
                Refresh snapshot
              </Button>
              {customerDashboardUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={customerDashboardUrl} target="_blank" rel="noreferrer">
                    Open Stripe customer
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Open Stripe customer
                </Button>
              )}
              {subscriptionDashboardUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={subscriptionDashboardUrl} target="_blank" rel="noreferrer">
                    Open Stripe subscription
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Open Stripe subscription
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">
                  Stripe dashboard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

