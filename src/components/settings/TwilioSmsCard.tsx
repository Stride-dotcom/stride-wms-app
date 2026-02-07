import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TenantCompanySettings } from '@/hooks/useTenantSettings';

interface TwilioSmsCardProps {
  settings: TenantCompanySettings | null;
  tenantId: string;
  onUpdate: (updates: Partial<TenantCompanySettings>) => Promise<boolean>;
}

/** Normalize phone to E.164: strip everything except digits and leading + */
function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-()]/g, '');
  if (stripped.startsWith('+')) return '+' + stripped.slice(1).replace(/\D/g, '');
  return '+' + stripped.replace(/\D/g, '');
}

function validateAccountSid(sid: string): string | null {
  if (!sid) return null; // blank is ok when sms_enabled is false
  if (!sid.startsWith('AC')) return 'Must start with "AC"';
  if (sid.length !== 34) return 'Must be 34 characters (AC + 32 hex chars)';
  return null;
}

function validateMessagingServiceSid(sid: string): string | null {
  if (!sid) return null;
  if (!sid.startsWith('MG')) return 'Must start with "MG"';
  return null;
}

function validateE164(phone: string): string | null {
  if (!phone) return null;
  const cleaned = normalizePhone(phone);
  if (!/^\+\d{7,15}$/.test(cleaned)) return 'Must be E.164 format: +1XXXXXXXXXX';
  return null;
}

export function TwilioSmsCard({ settings, tenantId, onUpdate }: TwilioSmsCardProps) {
  const { toast } = useToast();

  // --- Local form state ---
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [accountSid, setAccountSid] = useState('');
  const [messagingServiceSid, setMessagingServiceSid] = useState('');
  const [fromPhone, setFromPhone] = useState('');
  const [senderName, setSenderName] = useState('');
  const [saving, setSaving] = useState(false);

  // --- Test SMS state ---
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // --- Validation errors ---
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Load from settings
  useEffect(() => {
    if (!settings) return;
    setSmsEnabled(settings.sms_enabled ?? false);
    setAccountSid(settings.twilio_account_sid || '');
    setMessagingServiceSid(settings.twilio_messaging_service_sid || '');
    setFromPhone(settings.twilio_from_phone || '');
    setSenderName(settings.sms_sender_name || '');
  }, [settings]);

  // --- Validate on change ---
  const validate = (enabledOverride?: boolean): boolean => {
    const enabled = enabledOverride ?? smsEnabled;
    const errs: Record<string, string | null> = {};

    errs.accountSid = validateAccountSid(accountSid);
    errs.messagingServiceSid = validateMessagingServiceSid(messagingServiceSid);
    errs.fromPhone = validateE164(fromPhone);

    // When enabling, require Account SID + (Messaging Service SID OR From Phone)
    if (enabled) {
      if (!accountSid) errs.accountSid = 'Required when SMS is enabled';
      if (!messagingServiceSid && !fromPhone) {
        errs.messagingServiceSid = 'Provide Messaging Service SID or From Phone Number';
      }
    }

    setErrors(errs);
    return !Object.values(errs).some(Boolean);
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const success = await onUpdate({
        sms_enabled: smsEnabled,
        twilio_account_sid: accountSid || null,
        twilio_messaging_service_sid: messagingServiceSid || null,
        twilio_from_phone: fromPhone ? normalizePhone(fromPhone) : null,
        sms_sender_name: senderName || null,
      });

      if (success) {
        toast({
          title: 'SMS Settings Saved',
          description: 'Twilio configuration has been updated.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestSms = async () => {
    const phoneErr = validateE164(testPhone);
    if (!testPhone || phoneErr) {
      setTestResult({ ok: false, message: phoneErr || 'Enter a phone number' });
      return;
    }

    setTestSending(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-test', {
        body: { tenant_id: tenantId, to_phone: normalizePhone(testPhone) },
      });

      if (error) {
        setTestResult({ ok: false, message: error.message || 'Function invocation failed' });
        return;
      }

      if (data?.success) {
        setTestResult({ ok: true, message: `Test SMS sent (SID: ${data.sid || 'ok'})` });
      } else {
        setTestResult({ ok: false, message: data?.error || 'Unknown error from function' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon name="sms" size="md" />
          SMS Sender Configuration (Twilio)
        </CardTitle>
        <CardDescription>
          Configure SMS so alerts can be sent to phone numbers via Twilio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Instructions */}
        <Alert className="bg-muted/50 border-muted-foreground/20">
          <MaterialIcon name="info" size="sm" />
          <AlertDescription className="text-sm space-y-1">
            <p className="font-medium mb-1.5">Setup steps:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              <li>Create or log in to your <span className="font-medium text-foreground">Twilio</span> account</li>
              <li>Create a <span className="font-medium text-foreground">Messaging Service</span> (recommended) or buy a phone number</li>
              <li>Copy your <span className="font-medium text-foreground">Account SID</span> and paste it below</li>
              <li>Add <code className="text-xs bg-muted px-1 py-0.5 rounded">TWILIO_AUTH_TOKEN</code> as a <span className="font-medium text-foreground">Supabase secret</span> (never paste it here)</li>
              <li>Paste your <span className="font-medium text-foreground">Messaging Service SID</span> or <span className="font-medium text-foreground">From Phone Number</span></li>
              <li>Save, then use <span className="font-medium text-foreground">Send Test SMS</span> to verify</li>
            </ol>
          </AlertDescription>
        </Alert>

        <Separator />

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Enable SMS Sending</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Turn on to allow alert templates to deliver via SMS
            </p>
          </div>
          <Switch
            checked={smsEnabled}
            onCheckedChange={(checked) => {
              setSmsEnabled(checked);
              if (checked) validate(true);
            }}
          />
        </div>

        <Separator />

        {/* Account SID */}
        <div className="space-y-1.5">
          <Label htmlFor="twilio-sid" className="text-sm">
            Twilio Account SID
          </Label>
          <Input
            id="twilio-sid"
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value.trim())}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="font-mono text-sm"
          />
          {errors.accountSid && (
            <p className="text-xs text-destructive">{errors.accountSid}</p>
          )}
        </div>

        {/* Messaging Service SID */}
        <div className="space-y-1.5">
          <Label htmlFor="twilio-msg-sid" className="text-sm">
            Messaging Service SID
            <span className="text-xs text-muted-foreground ml-1">(preferred)</span>
          </Label>
          <Input
            id="twilio-msg-sid"
            value={messagingServiceSid}
            onChange={(e) => setMessagingServiceSid(e.target.value.trim())}
            placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="font-mono text-sm"
          />
          {errors.messagingServiceSid && (
            <p className="text-xs text-destructive">{errors.messagingServiceSid}</p>
          )}
        </div>

        {/* From Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="twilio-phone" className="text-sm">
            From Phone Number
            <span className="text-xs text-muted-foreground ml-1">(fallback if no Messaging Service)</span>
          </Label>
          <Input
            id="twilio-phone"
            value={fromPhone}
            onChange={(e) => setFromPhone(e.target.value)}
            placeholder="+12065551234"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Use E.164 format. Example: +1XXXXXXXXXX
          </p>
          {errors.fromPhone && (
            <p className="text-xs text-destructive">{errors.fromPhone}</p>
          )}
        </div>

        {/* Sender name */}
        <div className="space-y-1.5">
          <Label htmlFor="sms-sender-name" className="text-sm">
            Sender Name
            <span className="text-xs text-muted-foreground ml-1">(optional, UI label only)</span>
          </Label>
          <Input
            id="sms-sender-name"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Stride Logistics"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <MaterialIcon name="save" size="sm" className="mr-2" />
                Save SMS Settings
              </>
            )}
          </Button>
        </div>

        <Separator />

        {/* Test SMS */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <MaterialIcon name="send" size="sm" />
            Send Test SMS
          </h4>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="test-phone" className="text-xs text-muted-foreground">
                Test recipient phone (E.164)
              </Label>
              <Input
                id="test-phone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+12065559999"
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestSms}
              disabled={testSending || !testPhone}
            >
              {testSending ? (
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
              ) : (
                <MaterialIcon name="send" size="sm" className="mr-2" />
              )}
              Send Test SMS
            </Button>
          </div>

          {testResult && (
            <p className={`text-xs ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}>
              {testResult.message}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            SMS will not send until <code className="bg-muted px-1 py-0.5 rounded">TWILIO_AUTH_TOKEN</code> is
            configured in Supabase secrets and the <code className="bg-muted px-1 py-0.5 rounded">send-sms-test</code> function is deployed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
