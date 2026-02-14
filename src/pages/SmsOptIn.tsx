import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
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
  company_email: string | null;
  company_phone: string | null;
  logo_url: string | null;
  sms_opt_in_message: string | null;
  sms_privacy_policy_url: string | null;
  sms_terms_conditions_url: string | null;
  sms_help_message: string | null;
}

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-()]/g, '');
  if (stripped.startsWith('+')) return '+' + stripped.slice(1).replace(/\D/g, '');
  return '+' + stripped.replace(/\D/g, '');
}

export default function SmsOptIn() {
  const [searchParams] = useSearchParams();
  const { tenantId: tenantIdFromPath } = useParams<{ tenantId: string }>();
  const tenantId = tenantIdFromPath || searchParams.get('t');

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
      setError('Missing tenant identifier in the URL. Use /sms/opt-in/<tenant-id> or ?t=<tenant-id>.');
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

    const normalizedPhone = normalizePhone(phone.trim());
    if (!/^\+\d{7,15}$/.test(normalizedPhone)) {
      setSubmitError('Please enter a valid phone number in international format.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('sms-opt-in', {
        body: {
          action: 'opt_in',
          tenant_id: tenantId,
          phone_number: normalizedPhone,
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
              By checking the consent box and submitting this form, you agree to receive automated SMS
              notifications from {companyName} about shipment updates, inventory alerts, and account notifications.
            </p>
            <p>
              Message frequency varies. Message & data rates may apply.
              Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help.
            </p>
            {(tenantInfo.company_email || tenantInfo.company_phone) && (
              <p>
                Support:{' '}
                {tenantInfo.company_email ? tenantInfo.company_email : null}
                {tenantInfo.company_email && tenantInfo.company_phone ? ' | ' : null}
                {tenantInfo.company_phone ? tenantInfo.company_phone : null}
              </p>
            )}
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
              I agree to receive SMS notifications from {companyName}, acknowledge message frequency varies,
              message/data rates may apply, and understand I can reply STOP to opt out or HELP for help.
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
            disabled={submitting || !phone.trim() || !agreed}
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
