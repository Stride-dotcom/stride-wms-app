import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface TenantInfo {
  company_name: string | null;
  logo_url: string | null;
  sms_opt_in_message: string | null;
  sms_privacy_policy_url: string | null;
  sms_terms_conditions_url: string | null;
  sms_help_message: string | null;
}

export default function SmsOptIn() {
  const [searchParams] = useSearchParams();
  const tenantIdFromQuery = searchParams.get('t');
  const tenantId = tenantIdFromQuery || import.meta.env.VITE_DEFAULT_TENANT_ID || null;

  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch tenant branding info (public - uses edge function)
  useEffect(() => {
    if (!tenantId) {
      // Allow this page to be used as a stable public URL for Twilio review.
      // Consent submission requires a tenant id (either via `?t=` or `VITE_DEFAULT_TENANT_ID`).
      setTenantInfo({
        company_name: null,
        logo_url: null,
        sms_opt_in_message: null,
        sms_privacy_policy_url: null,
        sms_terms_conditions_url: null,
        sms_help_message: null,
      });
      setLoading(false);
      return;
    }

    const fetchTenantInfo = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('sms-opt-in', {
          body: { action: 'get_tenant_info', tenant_id: tenantId },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        setTenantInfo(data.tenant);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to load page.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantInfo();
  }, [tenantId]);

  const handleSubmit = async () => {
    if (!phone.trim() || !agreed || !tenantId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sms-opt-in', {
        body: {
          action: 'opt_in',
          tenant_id: tenantId,
          phone_number: phone.trim(),
          contact_name: name.trim() || null,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-primary" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error
  if (error || !tenantInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <MaterialIcon name="error" size="md" />
              Unable to Load
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {error || 'This opt-in page could not be loaded. Please check the URL and try again.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const companyName = tenantInfo.company_name || 'our company';
  const canSubmit = Boolean(tenantId) && phone.trim() && agreed;

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {tenantInfo.logo_url && (
              <div className="flex justify-center mb-4">
                <img
                  src={tenantInfo.logo_url}
                  alt={companyName}
                  className="h-12 object-contain"
                />
              </div>
            )}
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <MaterialIcon name="check_circle" size="xl" className="text-green-600" />
              </div>
            </div>
            <CardTitle>You're Subscribed!</CardTitle>
            <CardDescription>
              You have opted in to receive SMS notifications from {companyName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantInfo.sms_opt_in_message && (
              <Alert className="bg-green-50 border-green-200">
                <MaterialIcon name="sms" size="sm" className="text-green-600" />
                <AlertDescription className="text-green-800 text-sm">
                  {tenantInfo.sms_opt_in_message}
                </AlertDescription>
              </Alert>
            )}
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
              <p>You can opt out at any time by replying <strong>STOP</strong> to any message.</p>
              <p>Reply <strong>HELP</strong> for assistance.</p>
              <p>Message & data rates may apply.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Opt-in form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {tenantInfo.logo_url && (
            <div className="flex justify-center mb-4">
              <img
                src={tenantInfo.logo_url}
                alt={companyName}
                className="h-12 object-contain"
              />
            </div>
          )}
          <div className="flex justify-center mb-2">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon name="sms" size="lg" className="text-primary" />
            </div>
          </div>
          <CardTitle>SMS Notifications</CardTitle>
          <CardDescription>
            Subscribe to receive SMS notifications from {companyName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!tenantIdFromQuery && !import.meta.env.VITE_DEFAULT_TENANT_ID && (
            <Alert className="bg-amber-50 border-amber-200">
              <MaterialIcon name="info" size="sm" className="text-amber-700" />
              <AlertDescription className="text-amber-900 text-sm">
                This opt-in link is missing an organization identifier. If you were given a link by {companyName},
                it should include <strong>?t=...</strong>. If you manage this site, set <code>VITE_DEFAULT_TENANT_ID</code>{' '}
                to make <code>/sms-opt-in</code> work without parameters.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="font-mono"
              type="tel"
            />
            <p className="text-xs text-muted-foreground">
              Enter your mobile phone number to receive SMS alerts
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
            <p>
              By subscribing, you agree to receive automated SMS notifications
              from {companyName} about shipment updates, inventory alerts, and
              account notifications.
            </p>
            <p>
              Message frequency varies. Message & data rates may apply.
              Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help.
            </p>
            <p>Consent is not a condition of purchase.</p>
            {(tenantInfo.sms_privacy_policy_url || tenantInfo.sms_terms_conditions_url) && (
              <p className="flex gap-3">
                {tenantInfo.sms_privacy_policy_url && (
                  <a
                    href={tenantInfo.sms_privacy_policy_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Privacy Policy
                  </a>
                )}
                {tenantInfo.sms_terms_conditions_url && (
                  <a
                    href={tenantInfo.sms_terms_conditions_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Terms & Conditions
                  </a>
                )}
              </p>
            )}
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="agree" className="text-sm leading-snug cursor-pointer">
              I agree to receive SMS notifications from {companyName} and acknowledge
              the terms above.
            </label>
          </div>

          {submitError && (
            <Alert variant="destructive">
              <MaterialIcon name="error" size="sm" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                Subscribing...
              </>
            ) : (
              <>
                <MaterialIcon name="check" size="sm" className="mr-2" />
                Subscribe to SMS Notifications
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
