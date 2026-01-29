import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { CommunicationBrandSettings } from '@/hooks/useCommunications';

interface BrandSettingsTabProps {
  brandSettings: CommunicationBrandSettings | null;
  onUpdateBrandSettings: (updates: Partial<CommunicationBrandSettings>) => Promise<boolean>;
}

export function BrandSettingsTab({
  brandSettings,
  onUpdateBrandSettings,
}: BrandSettingsTabProps) {
  const [formData, setFormData] = useState({
    brand_logo_url: '',
    brand_primary_color: '#FD5A2A',
    brand_support_email: '',
    portal_base_url: '',
    from_name: '',
    from_email: '',
    sms_sender_id: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (brandSettings) {
      setFormData({
        brand_logo_url: brandSettings.brand_logo_url || '',
        brand_primary_color: brandSettings.brand_primary_color || '#FD5A2A',
        brand_support_email: brandSettings.brand_support_email || '',
        portal_base_url: brandSettings.portal_base_url || '',
        from_name: brandSettings.from_name || '',
        from_email: brandSettings.from_email || '',
        sms_sender_id: brandSettings.sms_sender_id || '',
      });
    }
  }, [brandSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdateBrandSettings(formData);
    setIsSaving(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Settings Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="palette" size="md" />
              Brand Identity
            </CardTitle>
            <CardDescription>
              Customize how your brand appears in communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logo"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.brand_logo_url}
                  onChange={(e) => handleChange('brand_logo_url', e.target.value)}
                />
                {formData.brand_logo_url && (
                  <div className="w-10 h-10 border rounded flex items-center justify-center bg-muted overflow-hidden">
                    <img 
                      src={formData.brand_logo_url} 
                      alt="Logo preview" 
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.brand_primary_color}
                  onChange={(e) => handleChange('brand_primary_color', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.brand_primary_color}
                  onChange={(e) => handleChange('brand_primary_color', e.target.value)}
                  placeholder="#FD5A2A"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support">Support Email</Label>
              <Input
                id="support"
                type="email"
                placeholder="support@company.com"
                value={formData.brand_support_email}
                onChange={(e) => handleChange('brand_support_email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal">Portal URL</Label>
              <Input
                id="portal"
                type="url"
                placeholder="https://portal.company.com"
                value={formData.portal_base_url}
                onChange={(e) => handleChange('portal_base_url', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="mail" size="md" />
              Email Sender Settings
            </CardTitle>
            <CardDescription>
              Configure the sender details for outgoing emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                placeholder="Stride Logistics"
                value={formData.from_name}
                onChange={(e) => handleChange('from_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From Email</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder="notifications@company.com"
                value={formData.from_email}
                onChange={(e) => handleChange('from_email', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Requires a verified domain in your email settings
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smsId">SMS Sender ID</Label>
              <Input
                id="smsId"
                placeholder="STRIDE"
                value={formData.sms_sender_id}
                onChange={(e) => handleChange('sms_sender_id', e.target.value)}
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">
                Up to 11 alphanumeric characters (carrier restrictions may apply)
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            <MaterialIcon name="save" size="sm" className="mr-2" />
            {isSaving ? 'Saving...' : 'Save Brand Settings'}
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="lg:sticky lg:top-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="visibility" size="md" />
              Email Preview
            </CardTitle>
            <CardDescription>
              See how your brand appears in emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              {/* Email Header */}
              <div 
                className="p-6 text-center"
                style={{ backgroundColor: formData.brand_primary_color }}
              >
                {formData.brand_logo_url ? (
                  <img 
                    src={formData.brand_logo_url} 
                    alt="Logo" 
                    className="h-12 mx-auto object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="h-12 flex items-center justify-center">
                    <MaterialIcon name="image" size="lg" className="text-white/50" />
                  </div>
                )}
              </div>

              {/* Email Content */}
              <div className="p-6 bg-background space-y-4">
                <h2 className="text-xl font-semibold">Sample Email Title</h2>
                <p className="text-muted-foreground">
                  This is a preview of how your emails will look with the current brand settings.
                </p>
                <div 
                  className="inline-block px-6 py-3 rounded-md text-white font-medium"
                  style={{ backgroundColor: formData.brand_primary_color }}
                >
                  Action Button
                </div>
              </div>

              {/* Email Footer */}
              <div className="p-6 bg-muted/50 border-t text-center text-sm text-muted-foreground space-y-2">
                {formData.portal_base_url && (
                  <p>
                    <MaterialIcon name="language" size="sm" className="inline mr-1" />
                    {formData.portal_base_url}
                  </p>
                )}
                {formData.brand_support_email && (
                  <p>
                    <MaterialIcon name="mail" size="sm" className="inline mr-1" />
                    {formData.brand_support_email}
                  </p>
                )}
                {!formData.portal_base_url && !formData.brand_support_email && (
                  <p>Add portal URL or support email to see footer</p>
                )}
              </div>
            </div>

            {/* Sender Preview */}
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">From:</p>
              <p className="text-sm text-muted-foreground">
                {formData.from_name || 'Company Name'} &lt;{formData.from_email || 'no-reply@example.com'}&gt;
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
