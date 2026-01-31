import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface TemplateSettings {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  invoiceTitle: string;
  footerText: string;
  termsAndConditions: string;
  showLogo: boolean;
  showRemitAddress: boolean;
  showPaymentTerms: boolean;
  notesTemplate: string;
}

interface CompanySettings {
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  logo_url: string | null;
  remit_address_line1: string | null;
  remit_address_line2: string | null;
  remit_city: string | null;
  remit_state: string | null;
  remit_zip: string | null;
}

const DEFAULT_TEMPLATE: TemplateSettings = {
  primaryColor: '#1e40af',
  secondaryColor: '#64748b',
  fontFamily: 'Inter, sans-serif',
  invoiceTitle: 'INVOICE',
  footerText: 'Thank you for your business!',
  termsAndConditions: 'Payment is due within the terms specified above. Late payments may be subject to interest charges.',
  showLogo: true,
  showRemitAddress: true,
  showPaymentTerms: true,
  notesTemplate: '',
};

const STORAGE_KEY = 'invoice_template_settings';

// Available tokens for invoice templates
const AVAILABLE_TOKENS = [
  { token: '{{account_name}}', description: 'Customer account name' },
  { token: '{{account_code}}', description: 'Customer account code' },
  { token: '{{billing_contact_name}}', description: 'Billing contact name' },
  { token: '{{billing_contact_email}}', description: 'Billing contact email' },
  { token: '{{billing_address}}', description: 'Full billing address' },
  { token: '{{invoice_number}}', description: 'Invoice number' },
  { token: '{{invoice_date}}', description: 'Invoice date' },
  { token: '{{due_date}}', description: 'Payment due date' },
  { token: '{{period_start}}', description: 'Billing period start date' },
  { token: '{{period_end}}', description: 'Billing period end date' },
  { token: '{{subtotal}}', description: 'Invoice subtotal' },
  { token: '{{tax_amount}}', description: 'Tax amount' },
  { token: '{{total}}', description: 'Invoice total' },
  { token: '{{payment_terms}}', description: 'Account payment terms (Net 30, etc.)' },
  { token: '{{company_name}}', description: 'Your company name' },
  { token: '{{company_address}}', description: 'Your company address' },
  { token: '{{company_phone}}', description: 'Your company phone' },
  { token: '{{company_email}}', description: 'Your company email' },
  { token: '{{remit_address}}', description: 'Remit-to payment address' },
];

export function InvoiceTemplateTab() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_TEMPLATE);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load settings
  useEffect(() => {
    async function loadSettings() {
      setLoading(true);

      // Load template settings from localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setSettings({ ...DEFAULT_TEMPLATE, ...JSON.parse(stored) });
        } catch (e) {
          console.error('Failed to parse template settings:', e);
        }
      }

      // Load company settings from database
      if (profile?.tenant_id) {
        const { data } = await supabase
          .from('tenant_company_settings')
          .select('company_name, company_address, company_phone, company_email, company_website, logo_url, remit_address_line1, remit_address_line2, remit_city, remit_state, remit_zip')
          .eq('tenant_id', profile.tenant_id)
          .maybeSingle();

        setCompanySettings(data);
      }

      setLoading(false);
    }

    loadSettings();
  }, [profile?.tenant_id]);

  // Save template settings
  const handleSave = () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      toast({ title: 'Template saved', description: 'Invoice template settings have been saved.' });
    } catch (e) {
      console.error('Failed to save template settings:', e);
      toast({ title: 'Save failed', description: 'Could not save template settings.', variant: 'destructive' });
    }
    setSaving(false);
  };

  // Reset to defaults
  const handleReset = () => {
    setSettings(DEFAULT_TEMPLATE);
    localStorage.removeItem(STORAGE_KEY);
    toast({ title: 'Template reset', description: 'Invoice template reset to defaults.' });
  };

  // Copy token to clipboard
  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast({ title: 'Copied', description: `Token ${token} copied to clipboard.` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  const remitAddress = companySettings
    ? [
        companySettings.remit_address_line1,
        companySettings.remit_address_line2,
        [companySettings.remit_city, companySettings.remit_state, companySettings.remit_zip].filter(Boolean).join(', '),
      ].filter(Boolean).join('\n')
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Invoice Template</h2>
          <p className="text-muted-foreground text-sm">Customize how your invoices look</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <MaterialIcon name="save" size="sm" className="mr-2" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template Settings */}
        <div className="space-y-6">
          {/* Colors & Style */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Colors & Style</CardTitle>
              <CardDescription>Customize the appearance of your invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fontFamily">Font Family</Label>
                <Input
                  id="fontFamily"
                  value={settings.fontFamily}
                  onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                  placeholder="Inter, sans-serif"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceTitle">Invoice Title</Label>
                <Input
                  id="invoiceTitle"
                  value={settings.invoiceTitle}
                  onChange={(e) => setSettings({ ...settings, invoiceTitle: e.target.value })}
                  placeholder="INVOICE"
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content Settings</CardTitle>
              <CardDescription>Configure what appears on your invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showLogo}
                    onChange={(e) => setSettings({ ...settings, showLogo: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Show company logo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showRemitAddress}
                    onChange={(e) => setSettings({ ...settings, showRemitAddress: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Show remit-to address</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showPaymentTerms}
                    onChange={(e) => setSettings({ ...settings, showPaymentTerms: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Show payment terms</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="footerText">Footer Text</Label>
                <Input
                  id="footerText"
                  value={settings.footerText}
                  onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                  placeholder="Thank you for your business!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
                <Textarea
                  id="termsAndConditions"
                  value={settings.termsAndConditions}
                  onChange={(e) => setSettings({ ...settings, termsAndConditions: e.target.value })}
                  rows={3}
                  placeholder="Payment terms and conditions..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notesTemplate">Default Notes Template</Label>
                <Textarea
                  id="notesTemplate"
                  value={settings.notesTemplate}
                  onChange={(e) => setSettings({ ...settings, notesTemplate: e.target.value })}
                  rows={3}
                  placeholder="Default notes to include on invoices. You can use tokens like {{account_name}}."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview & Tokens */}
        <div className="space-y-6">
          {/* Available Tokens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Tokens</CardTitle>
              <CardDescription>Click to copy. Use these in notes and templates.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                {AVAILABLE_TOKENS.map((item) => (
                  <div
                    key={item.token}
                    className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted cursor-pointer"
                    onClick={() => copyToken(item.token)}
                  >
                    <div>
                      <code className="text-sm bg-muted px-2 py-0.5 rounded">{item.token}</code>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                    </div>
                    <MaterialIcon name="content_copy" size="sm" className="text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Company Info Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
              <CardDescription>This information is used on invoices. Edit in Settings &gt; Organization.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {companySettings ? (
                <>
                  <div className="flex items-start gap-4">
                    {companySettings.logo_url && settings.showLogo && (
                      <img
                        src={companySettings.logo_url}
                        alt="Company Logo"
                        className="w-16 h-16 object-contain"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{companySettings.company_name || 'Company Name'}</p>
                      <p className="text-sm text-muted-foreground">{companySettings.company_address}</p>
                      <p className="text-sm text-muted-foreground">{companySettings.company_phone}</p>
                      <p className="text-sm text-muted-foreground">{companySettings.company_email}</p>
                    </div>
                  </div>

                  {settings.showRemitAddress && remitAddress && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-1">Remit Payment To:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{remitAddress}</p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No company settings found. Configure in Settings &gt; Organization.</p>
              )}
            </CardContent>
          </Card>

          {/* Invoice Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice Preview</CardTitle>
              <CardDescription>A simplified preview of your invoice style</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border rounded-lg p-4 text-sm"
                style={{ fontFamily: settings.fontFamily }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    {settings.showLogo && companySettings?.logo_url && (
                      <img
                        src={companySettings.logo_url}
                        alt="Logo"
                        className="w-12 h-12 object-contain mb-2"
                      />
                    )}
                    <p className="font-semibold">{companySettings?.company_name || 'Your Company'}</p>
                  </div>
                  <h1
                    className="text-2xl font-bold"
                    style={{ color: settings.primaryColor }}
                  >
                    {settings.invoiceTitle}
                  </h1>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs" style={{ color: settings.secondaryColor }}>Bill To:</p>
                    <p>Sample Customer</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: settings.secondaryColor }}>Invoice #:</p>
                    <p>INV-ACME-00001</p>
                  </div>
                </div>

                <div
                  className="border-t border-b py-2 mb-4 text-xs"
                  style={{ borderColor: settings.primaryColor }}
                >
                  <div className="flex justify-between font-medium" style={{ color: settings.primaryColor }}>
                    <span>Description</span>
                    <span>Amount</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span>Sample Service</span>
                    <span>$100.00</span>
                  </div>
                </div>

                <div className="text-right mb-4">
                  <p style={{ color: settings.secondaryColor }}>Total:</p>
                  <p className="text-lg font-bold" style={{ color: settings.primaryColor }}>$100.00</p>
                </div>

                {settings.footerText && (
                  <p className="text-xs text-center" style={{ color: settings.secondaryColor }}>
                    {settings.footerText}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
