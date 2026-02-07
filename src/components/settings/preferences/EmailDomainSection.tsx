import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
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
  use_default_email: boolean;
}

type SetupStep = 'choice' | 'enter-email' | 'select-registrar' | 'add-records' | 'verify' | 'complete';

const DEFAULT_EMAIL = 'noreply@stride-wms.com';

// Registrar-specific instructions
const REGISTRAR_INSTRUCTIONS: Record<string, { name: string; steps: string[] }> = {
  godaddy: {
    name: 'GoDaddy',
    steps: [
      'Log in to your GoDaddy account at godaddy.com',
      'Click "My Products" in the top menu',
      'Find your domain and click "DNS" button next to it',
      'Scroll down to the "Records" section',
      'Click "Add" button to add a new record',
      'Select the record Type from the dropdown (TXT or CNAME)',
      'Enter the Name (Host) - copy from below',
      'Enter the Value - copy from below',
      'Set TTL to "1 Hour" (or leave default)',
      'Click "Save" to add the record',
      'Repeat for each DNS record listed below',
      'Wait 15-30 minutes for changes to take effect',
    ],
  },
  cloudflare: {
    name: 'Cloudflare',
    steps: [
      'Log in to your Cloudflare dashboard at dash.cloudflare.com',
      'Select your domain from the list',
      'Click "DNS" in the left sidebar',
      'Click "Add record" button',
      'Select the Type (TXT or CNAME)',
      'Enter the Name - copy from below',
      'Enter the Content/Value - copy from below',
      'Make sure the Proxy status is "DNS only" (gray cloud)',
      'Click "Save"',
      'Repeat for each DNS record listed below',
      'Cloudflare updates are usually instant',
    ],
  },
  namecheap: {
    name: 'Namecheap',
    steps: [
      'Log in to your Namecheap account',
      'Click "Domain List" in the left sidebar',
      'Click "Manage" next to your domain',
      'Click "Advanced DNS" tab',
      'Click "Add New Record" button',
      'Select the Type from dropdown (TXT or CNAME)',
      'Enter the Host - copy from below (use @ for root domain)',
      'Enter the Value - copy from below',
      'Set TTL to "Automatic" or "30 min"',
      'Click the green checkmark to save',
      'Repeat for each DNS record listed below',
      'Wait 30 minutes to 2 hours for propagation',
    ],
  },
  google: {
    name: 'Google Domains / Squarespace',
    steps: [
      'Log in to domains.google.com (now Squarespace Domains)',
      'Click on your domain name',
      'Click "DNS" in the left menu',
      'Scroll to "Custom records" section',
      'Click "Manage custom records"',
      'Click "Create new record"',
      'Select the Type (TXT or CNAME)',
      'Enter the Host name - copy from below',
      'Enter the Data/Value - copy from below',
      'Leave TTL as default (3600)',
      'Click "Save"',
      'Repeat for each DNS record listed below',
      'Changes usually take 15-60 minutes',
    ],
  },
  hostinger: {
    name: 'Hostinger',
    steps: [
      'Log in to your Hostinger account',
      'Go to "Domains" section',
      'Click "Manage" on your domain',
      'Click "DNS / Nameservers" in the left menu',
      'Click "Manage DNS records"',
      'Click "Add Record"',
      'Select Type (TXT or CNAME)',
      'Enter Name - copy from below',
      'Enter the record Value - copy from below',
      'Set TTL to 14400 (or default)',
      'Click "Add Record" to save',
      'Repeat for each DNS record listed below',
      'Wait up to 24 hours for propagation',
    ],
  },
  bluehost: {
    name: 'Bluehost',
    steps: [
      'Log in to your Bluehost account',
      'Click "Domains" in the side menu',
      'Click the domain you want to manage',
      'Click "DNS" tab',
      'Scroll to the record type you need (TXT or CNAME)',
      'Click "Add Record"',
      'Enter the Host Record - copy from below',
      'Enter the Points To/Value - copy from below',
      'Leave TTL as default',
      'Click "Save"',
      'Repeat for each DNS record listed below',
      'Wait 4-24 hours for propagation',
    ],
  },
  other: {
    name: 'Other Provider',
    steps: [
      'Log in to your domain registrar or DNS provider',
      'Find the DNS management or DNS settings section',
      'Look for an option to "Add Record" or "Create Record"',
      'For each record below, create a new DNS record:',
      '  - Select the correct Type (TXT or CNAME as shown)',
      '  - Enter the Name/Host exactly as shown',
      '  - Enter the Value/Content exactly as shown',
      '  - Use default TTL or set to 3600 seconds',
      'Save each record',
      'DNS changes can take 15 minutes to 48 hours to propagate',
      'If you need help, contact your registrar\'s support',
    ],
  },
};

export function EmailDomainSection() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settings, setSettings] = useState<EmailDomainSettings>({
    custom_email_domain: null,
    email_domain_verified: false,
    dkim_verified: false,
    spf_verified: false,
    resend_domain_id: null,
    resend_dns_records: null,
    use_default_email: true,
  });

  // Wizard state
  const [emailChoice, setEmailChoice] = useState<'default' | 'custom'>('default');
  const [customEmail, setCustomEmail] = useState('');
  const [selectedRegistrar, setSelectedRegistrar] = useState('');
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [currentStep, setCurrentStep] = useState<SetupStep>('choice');
  const [isEditingVerified, setIsEditingVerified] = useState(false);

  // Determine the actual current step based on settings
  useEffect(() => {
    if (isEditingVerified) return; // Don't auto-set step while user is editing
    if (settings.email_domain_verified) {
      setCurrentStep('complete');
      setEmailChoice('custom');
    } else if (settings.resend_domain_id && dnsRecords.length > 0) {
      setCurrentStep('add-records');
      setEmailChoice('custom');
    } else if (settings.resend_domain_id) {
      setCurrentStep('select-registrar');
      setEmailChoice('custom');
    } else if (settings.custom_email_domain && !settings.use_default_email) {
      setCurrentStep('enter-email');
      setEmailChoice('custom');
    } else {
      setCurrentStep('choice');
      setEmailChoice(settings.use_default_email ? 'default' : 'custom');
    }
  }, [settings, dnsRecords.length, isEditingVerified]);

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
        .select('custom_email_domain, email_domain_verified, dkim_verified, spf_verified, resend_domain_id, resend_dns_records, use_default_email')
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
          use_default_email: data.use_default_email ?? true,
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

  const handleChoiceChange = async (choice: 'default' | 'custom') => {
    setEmailChoice(choice);

    if (choice === 'default') {
      // Save the choice to use default email
      setSaving(true);
      try {
        const { error } = await supabase
          .from('communication_brand_settings')
          .upsert({
            tenant_id: profile?.tenant_id,
            use_default_email: true,
            custom_email_domain: null,
          }, {
            onConflict: 'tenant_id',
          });

        if (error) throw error;

        setSettings(prev => ({
          ...prev,
          use_default_email: true,
          custom_email_domain: null,
        }));
        setCurrentStep('choice');

        toast({
          title: 'Settings Saved',
          description: `Emails will be sent from ${DEFAULT_EMAIL}`,
        });
      } catch (error) {
        console.error('Error saving email settings:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save email settings',
        });
      } finally {
        setSaving(false);
      }
    } else {
      setCurrentStep('enter-email');
    }
  };

  const handleEmailSubmit = async () => {
    if (!customEmail || !customEmail.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Invalid Email',
        description: 'Please enter a valid email address (e.g., alerts@yourcompany.com)',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('communication_brand_settings')
        .upsert({
          tenant_id: profile?.tenant_id,
          custom_email_domain: customEmail,
          use_default_email: false,
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        custom_email_domain: customEmail,
        use_default_email: false,
      }));

      // Auto-register the domain
      await handleRegisterDomain();
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save email settings',
      });
      setSaving(false);
    }
  };

  const handleRegisterDomain = async () => {
    if (!profile?.tenant_id || !customEmail) return;

    const domain = customEmail.split('@')[1];
    if (!domain) return;

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

        if (data.status === 'verified') {
          setCurrentStep('complete');
          setIsEditingVerified(false);
          toast({
            title: 'Domain Already Verified!',
            description: 'Your domain was already set up. You\'re ready to send emails!',
          });
        } else {
          setCurrentStep('select-registrar');
          toast({
            title: 'Domain Registered',
            description: 'Now select your domain registrar to get setup instructions.',
          });
        }
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
      setSaving(false);
    }
  };

  const handleRegistrarSelect = (registrar: string) => {
    setSelectedRegistrar(registrar);
    setCurrentStep('add-records');
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
        setCurrentStep('complete');
        setIsEditingVerified(false);

        toast({
          title: 'Domain Verified!',
          description: 'Your email domain is now active. Emails will be sent from your custom address.',
        });
      } else {
        if (data.records) {
          setDnsRecords(data.records);
        }
        toast({
          variant: 'destructive',
          title: 'Not Verified Yet',
          description: 'DNS records haven\'t propagated yet. This can take up to 48 hours. Please try again later.',
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

  const handleStartOver = async () => {
    // Reset to default
    setSaving(true);
    try {
      const { error } = await supabase
        .from('communication_brand_settings')
        .upsert({
          tenant_id: profile?.tenant_id,
          use_default_email: true,
          custom_email_domain: null,
          resend_domain_id: null,
          resend_dns_records: null,
          email_domain_verified: false,
          dkim_verified: false,
          spf_verified: false,
        }, {
          onConflict: 'tenant_id',
        });

      if (error) throw error;

      setSettings({
        custom_email_domain: null,
        email_domain_verified: false,
        dkim_verified: false,
        spf_verified: false,
        resend_domain_id: null,
        resend_dns_records: null,
        use_default_email: true,
      });
      setCustomEmail('');
      setDnsRecords([]);
      setSelectedRegistrar('');
      setCurrentStep('choice');
      setEmailChoice('default');
      setIsEditingVerified(false);

      toast({
        title: 'Reset Complete',
        description: 'Email settings have been reset.',
      });
    } catch (error) {
      console.error('Error resetting:', error);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Value copied to clipboard',
    });
  };

  const domain = customEmail.includes('@') ? customEmail.split('@')[1] : '';

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
          Email Sender Configuration
        </CardTitle>
        <CardDescription>
          Configure the sender address for outgoing email alerts. This controls what address appears in the "From" field &mdash; it does not control who receives the emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Step Indicator */}
        {emailChoice === 'custom' && currentStep !== 'choice' && currentStep !== 'complete' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span className={currentStep === 'enter-email' ? 'text-primary font-medium' : ''}>1. Enter Email</span>
            <MaterialIcon name="chevron_right" size="sm" />
            <span className={currentStep === 'select-registrar' ? 'text-primary font-medium' : ''}>2. Select Provider</span>
            <MaterialIcon name="chevron_right" size="sm" />
            <span className={currentStep === 'add-records' ? 'text-primary font-medium' : ''}>3. Add DNS Records</span>
            <MaterialIcon name="chevron_right" size="sm" />
            <span className={currentStep === 'verify' ? 'text-primary font-medium' : ''}>4. Verify</span>
          </div>
        )}

        {/* STEP: Choice - Default or Custom */}
        {currentStep === 'choice' && (
          <div className="space-y-4">
            <RadioGroup
              value={emailChoice}
              onValueChange={(v) => handleChoiceChange(v as 'default' | 'custom')}
              className="space-y-4"
            >
              <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${emailChoice === 'default' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}>
                <RadioGroupItem value="default" id="default" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="default" className="text-base font-medium cursor-pointer">
                    Use Default Email (Recommended)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Emails will be sent from <strong>{DEFAULT_EMAIL}</strong>
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <MaterialIcon name="bolt" size="sm" className="mr-1" />
                      Works Immediately
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <MaterialIcon name="check" size="sm" className="mr-1" />
                      No Setup Required
                    </Badge>
                  </div>
                </div>
              </div>

              <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${emailChoice === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}>
                <RadioGroupItem value="custom" id="custom" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="custom" className="text-base font-medium cursor-pointer">
                    Use My Company Email
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send emails from your own domain (e.g., alerts@yourcompany.com)
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      <MaterialIcon name="schedule" size="sm" className="mr-1" />
                      10-15 min setup
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <MaterialIcon name="dns" size="sm" className="mr-1" />
                      Requires DNS Access
                    </Badge>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {emailChoice === 'default' && (
              <Alert className="border-green-200 bg-green-50">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <AlertDescription className="text-green-800">
                  You're all set! Notification emails will be sent from <strong>{DEFAULT_EMAIL}</strong>.
                  Customers can still reply - replies will go to your company email configured in Contact settings.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* STEP: Enter Email */}
        {currentStep === 'enter-email' && (
          <div className="space-y-4">
            <Alert>
              <MaterialIcon name="info" size="sm" />
              <AlertDescription>
                <strong>Step 1:</strong> Enter the email address you want notifications sent from.
                You'll need access to your domain's DNS settings to complete setup.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="custom_email">Your Sender Email Address</Label>
              <Input
                id="custom_email"
                type="email"
                placeholder="alerts@yourcompany.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                Example: notifications@yourcompany.com, alerts@yourbusiness.com
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setCurrentStep('choice'); setEmailChoice('default'); }}>
                <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
                Back
              </Button>
              <Button onClick={handleEmailSubmit} disabled={saving || registering || !customEmail}>
                {(saving || registering) && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                Continue
                <MaterialIcon name="arrow_forward" size="sm" className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Select Registrar */}
        {currentStep === 'select-registrar' && (
          <div className="space-y-4">
            <Alert>
              <MaterialIcon name="info" size="sm" />
              <AlertDescription>
                <strong>Step 2:</strong> Where did you buy your domain <strong>{domain}</strong>?
                Select your provider to get specific instructions.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Select Your Domain Provider</Label>
              <Select value={selectedRegistrar} onValueChange={handleRegistrarSelect}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Choose where you bought your domain..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="godaddy">GoDaddy</SelectItem>
                  <SelectItem value="cloudflare">Cloudflare</SelectItem>
                  <SelectItem value="namecheap">Namecheap</SelectItem>
                  <SelectItem value="google">Google Domains / Squarespace</SelectItem>
                  <SelectItem value="hostinger">Hostinger</SelectItem>
                  <SelectItem value="bluehost">Bluehost</SelectItem>
                  <SelectItem value="other">Other / I'm not sure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep('enter-email')}>
                <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
                Back
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Add DNS Records */}
        {currentStep === 'add-records' && selectedRegistrar && (
          <div className="space-y-4">
            <Alert>
              <MaterialIcon name="info" size="sm" />
              <AlertDescription>
                <strong>Step 3:</strong> Add these DNS records to your domain. Follow the instructions below for {REGISTRAR_INSTRUCTIONS[selectedRegistrar]?.name || 'your provider'}.
              </AlertDescription>
            </Alert>

            {/* Step-by-step instructions */}
            <Accordion type="single" collapsible defaultValue="instructions">
              <AccordionItem value="instructions">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="list_alt" size="sm" />
                    Step-by-Step Instructions for {REGISTRAR_INSTRUCTIONS[selectedRegistrar]?.name}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground pl-2">
                    {REGISTRAR_INSTRUCTIONS[selectedRegistrar]?.steps.map((step, index) => (
                      <li key={index} className="leading-relaxed">{step}</li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            {/* DNS Records to add */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <MaterialIcon name="dns" size="sm" />
                DNS Records to Add ({dnsRecords.length})
              </h4>

              {dnsRecords.map((record, index) => (
                <div key={index} className="bg-muted/50 rounded-lg p-4 space-y-3 border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{record.record || record.type}</Badge>
                      {record.status && (
                        <Badge
                          variant={record.status === 'verified' ? 'default' : 'secondary'}
                          className={record.status === 'verified' ? 'bg-green-600' : ''}
                        >
                          {record.status === 'verified' ? 'Done' : 'Pending'}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Record {index + 1} of {dnsRecords.length}</span>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-16">Type:</span>
                      <code className="flex-1 bg-background px-2 py-1 rounded text-sm">{record.type}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-16">Name:</span>
                      <code className="flex-1 bg-background px-2 py-1 rounded text-sm truncate">{record.name}</code>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyToClipboard(record.name)}>
                        <MaterialIcon name="content_copy" size="sm" />
                      </Button>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-16 mt-1">Value:</span>
                      <code className="flex-1 bg-background px-2 py-1 rounded text-xs break-all">{record.value}</code>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyToClipboard(record.value)}>
                        <MaterialIcon name="content_copy" size="sm" />
                      </Button>
                    </div>
                    {record.priority !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-16">Priority:</span>
                        <code className="bg-background px-2 py-1 rounded text-sm">{record.priority}</code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Alert className="bg-amber-50 border-amber-200">
              <MaterialIcon name="schedule" size="sm" className="text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Important:</strong> After adding all records, wait 15-30 minutes (up to 48 hours in some cases)
                before clicking Verify. DNS changes take time to propagate across the internet.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setCurrentStep('select-registrar'); setSelectedRegistrar(''); }}>
                <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
                Back
              </Button>
              <Button onClick={handleVerify} disabled={verifying}>
                {verifying && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                <MaterialIcon name="verified_user" size="sm" className="mr-2" />
                Verify DNS Records
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Complete - Verified status card */}
        {currentStep === 'complete' && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
              <AlertDescription className="text-green-800">
                <p className="font-medium text-base mb-1">Your Custom Email is Active!</p>
                <p>
                  All notification emails will now be sent from <strong>{customEmail}</strong>.
                </p>
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Verification Status:</span>
                <Badge variant="default" className="gap-1 bg-green-600">
                  <MaterialIcon name="verified_user" size="sm" />
                  Verified
                </Badge>
              </div>
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
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditingVerified(true);
                  setCurrentStep('choice');
                }}
              >
                <MaterialIcon name="edit" size="sm" className="mr-2" />
                Edit Configuration
              </Button>
              <Button variant="ghost" size="sm" onClick={handleStartOver} disabled={saving}>
                {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                <MaterialIcon name="refresh" size="sm" className="mr-2" />
                Reset &amp; Start Over
              </Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
