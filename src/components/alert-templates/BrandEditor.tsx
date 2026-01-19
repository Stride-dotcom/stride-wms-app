import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Loader2, Image as ImageIcon } from 'lucide-react';
import { CommunicationBrandSettings } from '@/hooks/useCommunications';

interface BrandEditorProps {
  brandSettings: CommunicationBrandSettings | null;
  onUpdateBrandSettings: (updates: Partial<CommunicationBrandSettings>) => Promise<boolean>;
}

export function BrandEditor({ brandSettings, onUpdateBrandSettings }: BrandEditorProps) {
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FD5A2A');
  const [supportEmail, setSupportEmail] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');

  useEffect(() => {
    if (brandSettings) {
      setLogoUrl(brandSettings.brand_logo_url || '');
      setPrimaryColor(brandSettings.brand_primary_color || '#FD5A2A');
      setSupportEmail(brandSettings.brand_support_email || '');
      setPortalUrl(brandSettings.portal_base_url || '');
      setFromName(brandSettings.from_name || '');
      setFromEmail(brandSettings.from_email || '');
      setSmsSenderId(brandSettings.sms_sender_id || '');
    }
  }, [brandSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateBrandSettings({
        brand_logo_url: logoUrl || null,
        brand_primary_color: primaryColor,
        brand_support_email: supportEmail || null,
        portal_base_url: portalUrl || null,
        from_name: fromName || null,
        from_email: fromEmail || null,
        sms_sender_id: smsSenderId || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Brand Identity</CardTitle>
          <CardDescription>
            Configure your brand appearance in email communications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Recommended size: 200x50 pixels, PNG or SVG format
              </p>
            </div>
            <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30 min-h-[100px]">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Brand logo preview" 
                  className="max-h-16 max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Logo preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Brand Color</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32 font-mono"
                  placeholder="#FD5A2A"
                />
              </div>
              <div 
                className="h-10 flex-1 rounded-lg border"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for buttons, links, and accent elements in emails
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>
            These values are used as fallback defaults and available as template variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                placeholder="support@example.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portalUrl">Customer Portal URL</Label>
              <Input
                id="portalUrl"
                type="url"
                placeholder="https://portal.example.com"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Sender Settings</CardTitle>
          <CardDescription>
            Default sender information used when not overridden at the template level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">Default From Name</Label>
              <Input
                id="fromName"
                placeholder="Stride Logistics"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">Default From Email</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder="notifications@stride.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smsSenderIdBrand">Default SMS Sender ID</Label>
            <Input
              id="smsSenderIdBrand"
              placeholder="STRIDE"
              value={smsSenderId}
              onChange={(e) => setSmsSenderId(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Alphanumeric sender ID (max 11 characters) or phone number
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Brand Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
