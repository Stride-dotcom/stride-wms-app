import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, CheckCircle, XCircle, Loader2, Copy, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface EmailDomainSettings {
  custom_email_domain: string | null;
  email_domain_verified: boolean;
  email_verification_type: 'simple' | 'dns' | null;
  dkim_verified: boolean;
  spf_verified: boolean;
}

export function EmailDomainSection() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settings, setSettings] = useState<EmailDomainSettings>({
    custom_email_domain: null,
    email_domain_verified: false,
    email_verification_type: null,
    dkim_verified: false,
    spf_verified: false,
  });
  const [customEmail, setCustomEmail] = useState('');
  const [verificationType, setVerificationType] = useState<'simple' | 'dns'>('simple');

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSettings();
    }
  }, [profile?.tenant_id]);

  const fetchSettings = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from('communication_brand_settings')
        .select('custom_email_domain, email_domain_verified, email_verification_type, dkim_verified, spf_verified')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as EmailDomainSettings);
        setCustomEmail(data.custom_email_domain || '');
        setVerificationType((data.email_verification_type as 'simple' | 'dns') || 'simple');
      }
    } catch (error) {
      console.error('Error fetching email domain settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.tenant_id) return;

    setSaving(true);
    try {
      // Extract domain from email
      const domain = customEmail.includes('@') ? customEmail.split('@')[1] : null;

      const { error } = await supabase
        .from('communication_brand_settings')
        .upsert({
          tenant_id: profile.tenant_id,
          custom_email_domain: customEmail || null,
          email_verification_type: verificationType,
          email_domain_verified: false, // Reset verification when settings change
          dkim_verified: false,
          spf_verified: false,
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        custom_email_domain: customEmail || null,
        email_verification_type: verificationType,
        email_domain_verified: false,
        dkim_verified: false,
        spf_verified: false,
      }));

      toast({
        title: 'Settings Saved',
        description: 'Email domain settings have been updated. Please verify your domain.',
      });
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save email domain settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!profile?.tenant_id || !customEmail) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-email-domain', {
        body: {
          email: customEmail,
          verificationType,
        },
      });

      if (error) throw error;

      if (data.verified) {
        setSettings(prev => ({
          ...prev,
          email_domain_verified: true,
          dkim_verified: data.dkim_verified || false,
          spf_verified: data.spf_verified || false,
        }));

        toast({
          title: 'Domain Verified',
          description: 'Your email domain has been verified successfully.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Verification Failed',
          description: data.message || 'Could not verify domain. Please check your DNS settings.',
        });
      }
    } catch (error: any) {
      console.error('Error verifying domain:', error);
      toast({
        variant: 'destructive',
        title: 'Verification Error',
        description: error.message || 'Failed to verify email domain',
      });
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'DNS record copied to clipboard',
    });
  };

  const domain = customEmail.includes('@') ? customEmail.split('@')[1] : 'yourdomain.com';

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Domain Configuration
        </CardTitle>
        <CardDescription>
          Configure a custom sender email address for outgoing communications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Email Input */}
        <div className="space-y-2">
          <Label htmlFor="custom_email">Custom Sender Email</Label>
          <Input
            id="custom_email"
            type="email"
            placeholder="notifications@yourcompany.com"
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Emails will be sent from this address instead of the default
          </p>
        </div>

        {/* Verification Type */}
        <div className="space-y-3">
          <Label>Verification Method</Label>
          <RadioGroup
            value={verificationType}
            onValueChange={(value) => setVerificationType(value as 'simple' | 'dns')}
            className="space-y-2"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="simple" id="simple" className="mt-1" />
              <div>
                <Label htmlFor="simple" className="font-medium cursor-pointer">Simple Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Quick setup - we'll send a verification link to your email
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="dns" id="dns" className="mt-1" />
              <div>
                <Label htmlFor="dns" className="font-medium cursor-pointer">DNS Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Full email deliverability with SPF and DKIM records
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* DNS Instructions - Show when DNS verification is selected */}
        {verificationType === 'dns' && customEmail && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="space-y-4">
              <p className="font-medium">Add these DNS records to your domain:</p>
              
              <div className="space-y-3">
                <div className="bg-muted rounded p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">SPF Record (TXT)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => copyToClipboard(`v=spf1 include:_spf.resend.com ~all`)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <code className="text-xs block break-all">v=spf1 include:_spf.resend.com ~all</code>
                </div>

                <div className="bg-muted rounded p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">DKIM Record (TXT)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => copyToClipboard(`resend._domainkey.${domain}`)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <code className="text-xs block">Host: resend._domainkey.{domain}</code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Value will be provided after you save and verify
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Verification Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {settings.email_domain_verified ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                Not Verified
              </Badge>
            )}
          </div>

          {verificationType === 'dns' && settings.email_domain_verified && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">SPF:</span>
                {settings.spf_verified ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">DKIM:</span>
                {settings.dkim_verified ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !customEmail}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
          {customEmail && (
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={verifying || !settings.custom_email_domain}
            >
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Domain
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
