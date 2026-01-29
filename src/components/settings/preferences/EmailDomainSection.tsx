import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DnsRecord {
  record?: string;
  name: string;
  type: string;
  value: string;
  status?: string;
  ttl?: string;
  priority?: number;
}

interface EmailDomainSettings {
  custom_email_domain: string | null;
  email_domain_verified: boolean;
  dkim_verified: boolean;
  spf_verified: boolean;
  resend_domain_id: string | null;
  resend_dns_records: DnsRecord[] | null;
}

type RegistrationStatus = 'not_registered' | 'pending_dns' | 'verified';

export function EmailDomainSection() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<EmailDomainSettings>({
    custom_email_domain: null,
    email_domain_verified: false,
    dkim_verified: false,
    spf_verified: false,
    resend_domain_id: null,
    resend_dns_records: null,
  });
  const [customEmail, setCustomEmail] = useState('');
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);

  const registrationStatus: RegistrationStatus = settings.email_domain_verified
    ? 'verified'
    : settings.resend_domain_id
    ? 'pending_dns'
    : 'not_registered';

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
        .select('custom_email_domain, email_domain_verified, dkim_verified, spf_verified, resend_domain_id, resend_dns_records')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const records = Array.isArray(data.resend_dns_records) 
          ? data.resend_dns_records as unknown as DnsRecord[]
          : null;
        
        setSettings({
          custom_email_domain: data.custom_email_domain,
          email_domain_verified: data.email_domain_verified || false,
          dkim_verified: data.dkim_verified || false,
          spf_verified: data.spf_verified || false,
          resend_domain_id: data.resend_domain_id,
          resend_dns_records: records,
        });
        setCustomEmail(data.custom_email_domain || '');
        if (records) {
          setDnsRecords(records);
        }
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
      const { error } = await supabase
        .from('communication_brand_settings')
        .upsert({
          tenant_id: profile.tenant_id,
          custom_email_domain: customEmail || null,
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        custom_email_domain: customEmail || null,
      }));

      toast({
        title: 'Settings Saved',
        description: 'Email address has been updated.',
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

  const handleRegisterDomain = async () => {
    if (!profile?.tenant_id || !customEmail) return;

    const domain = customEmail.includes('@') ? customEmail.split('@')[1] : null;
    if (!domain) {
      toast({
        variant: 'destructive',
        title: 'Invalid Email',
        description: 'Please enter a valid email address with a domain.',
      });
      return;
    }

    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-email-domain', {
        body: { domain },
      });

      if (error) throw error;

      if (data.success) {
        setSettings(prev => ({
          ...prev,
          resend_domain_id: data.domain_id,
          resend_dns_records: data.records,
          email_domain_verified: data.status === 'verified',
        }));
        setDnsRecords(data.records || []);

        toast({
          title: 'Domain Registered',
          description: data.message || 'Domain registered with Resend. Please add the DNS records below.',
        });
      } else {
        throw new Error(data.error || 'Failed to register domain');
      }
    } catch (error: any) {
      console.error('Error registering domain:', error);
      toast({
        variant: 'destructive',
        title: 'Registration Error',
        description: error.message || 'Failed to register email domain',
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleVerify = async () => {
    if (!profile?.tenant_id || !settings.resend_domain_id) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-email-domain', {
        body: {},
      });

      if (error) throw error;

      if (data.verified) {
        setSettings(prev => ({
          ...prev,
          email_domain_verified: true,
          dkim_verified: data.dkim_verified || false,
          spf_verified: data.spf_verified || false,
        }));
        if (data.records) {
          setDnsRecords(data.records);
        }

        toast({
          title: 'Domain Verified',
          description: 'Your email domain has been verified successfully. Emails will now be sent from your custom domain.',
        });
      } else {
        if (data.records) {
          setDnsRecords(data.records);
        }
        toast({
          variant: 'destructive',
          title: 'Verification Pending',
          description: data.message || 'Please check your DNS settings and try again.',
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

  const handleRefreshRecords = async () => {
    if (!settings.resend_domain_id) return;
    
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-email-domain', {
        body: {},
      });

      if (error) throw error;

      if (data?.records) {
        setDnsRecords(data.records);
        setSettings(prev => ({
          ...prev,
          resend_dns_records: data.records,
        }));
        toast({
          title: 'Records Refreshed',
          description: 'DNS records have been updated.',
        });
      }
    } catch (error: any) {
      console.error('Error refreshing records:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to refresh DNS records',
      });
    } finally {
      setRefreshing(false);
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
          <MaterialIcon name="progress_activity" size="md" className="animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon name="mail" size="md" />
          Email Domain Configuration
        </CardTitle>
        <CardDescription>
          Configure a custom sender email address for outgoing communications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Registration Status */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {registrationStatus === 'verified' ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <MaterialIcon name="verified_user" size="sm" />
                Verified & Active
              </Badge>
            ) : registrationStatus === 'pending_dns' ? (
              <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-200">
                <MaterialIcon name="public" size="sm" />
                Pending DNS Setup
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <MaterialIcon name="cancel" size="sm" />
                Not Registered
              </Badge>
            )}
          </div>

          {registrationStatus === 'verified' && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">SPF:</span>
                {settings.spf_verified ? (
                  <MaterialIcon name="check_circle" size="sm" className="text-green-500" />
                ) : (
                  <MaterialIcon name="cancel" size="sm" className="text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">DKIM:</span>
                {settings.dkim_verified ? (
                  <MaterialIcon name="check_circle" size="sm" className="text-green-500" />
                ) : (
                  <MaterialIcon name="cancel" size="sm" className="text-muted-foreground" />
                )}
              </div>
            </>
          )}
        </div>

        {/* Custom Email Input */}
        <div className="space-y-2">
          <Label htmlFor="custom_email">Custom Sender Email</Label>
          <Input
            id="custom_email"
            type="email"
            placeholder="notifications@yourcompany.com"
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            disabled={registrationStatus === 'verified'}
          />
          <p className="text-xs text-muted-foreground">
            {registrationStatus === 'verified'
              ? 'Emails are being sent from this address.'
              : 'Emails will be sent from this address once verified.'}
          </p>
        </div>

        {/* Step 1: Save & Register */}
        {registrationStatus === 'not_registered' && (
          <div className="space-y-4">
            <Alert>
              <MaterialIcon name="info" size="sm" />
              <AlertDescription>
                <p className="font-medium mb-2">Step 1: Register Your Domain</p>
                <p className="text-sm text-muted-foreground">
                  Enter your desired sender email address above, then click "Register Domain" to start the verification process.
                  We'll provide you with DNS records to add to your domain.
                </p>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !customEmail} variant="outline">
                {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                Save Email
              </Button>
              <Button onClick={handleRegisterDomain} disabled={registering || !customEmail}>
                {registering && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                <MaterialIcon name="public" size="sm" className="mr-2" />
                Register Domain
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: DNS Records - with records */}
        {registrationStatus === 'pending_dns' && dnsRecords.length > 0 && (
          <div className="space-y-4">
            <Alert>
              <MaterialIcon name="info" size="sm" />
              <AlertDescription>
                <p className="font-medium mb-2">Step 2: Add DNS Records to Your Domain</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Add these records to your domain's DNS settings. You can find this in your domain registrar 
                  (GoDaddy, Cloudflare, Namecheap, Google Domains, etc.):
                </p>
                <ol className="text-sm text-muted-foreground mb-4 list-decimal list-inside space-y-1">
                  <li>Log into your domain registrar (where you bought <strong>{domain}</strong>)</li>
                  <li>Go to <strong>DNS Settings</strong> or <strong>DNS Management</strong></li>
                  <li>Add each record below exactly as shown</li>
                  <li>Save changes and wait up to 48 hours for propagation</li>
                  <li>Return here and click "Verify Domain"</li>
                </ol>
                
                <div className="space-y-3">
                  {dnsRecords.map((record, index) => (
                    <div key={index} className="bg-background rounded p-3 space-y-2 border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {record.record || record.type}
                          </Badge>
                          {record.status && (
                            <Badge 
                              variant={record.status === 'verified' ? 'default' : 'secondary'}
                              className={record.status === 'verified' ? 'bg-green-600 text-xs' : 'text-xs'}
                            >
                              {record.status}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => copyToClipboard(record.value)}
                        >
                          <MaterialIcon name="content_copy" size="sm" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex gap-2 text-xs">
                          <span className="font-medium text-muted-foreground w-12">Name:</span>
                          <code className="flex-1 break-all bg-muted px-1 rounded">{record.name}</code>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="font-medium text-muted-foreground w-12">Type:</span>
                          <code className="bg-muted px-1 rounded">{record.type}</code>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="font-medium text-muted-foreground w-12">Value:</span>
                          <code className="flex-1 break-all text-[10px] bg-muted px-1 rounded">{record.value}</code>
                        </div>
                        {record.priority !== undefined && (
                          <div className="flex gap-2 text-xs">
                            <span className="font-medium text-muted-foreground w-12">Priority:</span>
                            <code className="bg-muted px-1 rounded">{record.priority}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-muted-foreground mt-4">
                  <strong>Note:</strong> DNS changes can take 15 minutes to 48 hours to propagate. 
                  If verification fails, wait a few hours and try again.
                </p>
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button onClick={handleVerify} disabled={verifying}>
                {verifying && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                <MaterialIcon name="verified_user" size="sm" className="mr-2" />
                Verify Domain
              </Button>
              <Button variant="outline" onClick={handleRefreshRecords} disabled={refreshing}>
                {refreshing && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                <MaterialIcon name="refresh" size="sm" className="mr-2" />
                Refresh Status
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: DNS Records - empty records, need to refresh */}
        {registrationStatus === 'pending_dns' && dnsRecords.length === 0 && (
          <div className="space-y-4">
            <Alert>
              <MaterialIcon name="info" size="sm" />
              <AlertDescription>
                <p className="font-medium mb-2">Loading DNS Records...</p>
                <p className="text-sm text-muted-foreground mb-4">
                  DNS records weren't loaded. Click the button below to refresh and retrieve the records you need to add to your domain.
                </p>
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button onClick={handleRefreshRecords} disabled={refreshing}>
                {refreshing && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                <MaterialIcon name="refresh" size="sm" className="mr-2" />
                Load DNS Records
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Verified */}
        {registrationStatus === 'verified' && (
          <Alert className="border-green-200 bg-green-50">
            <MaterialIcon name="verified_user" size="sm" className="text-green-600" />
            <AlertDescription className="text-green-800">
              <p className="font-medium">Domain Verified!</p>
              <p className="text-sm">
                Your email domain has been verified. All communication alerts will be sent from{' '}
                <strong>{customEmail}</strong>.
              </p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
