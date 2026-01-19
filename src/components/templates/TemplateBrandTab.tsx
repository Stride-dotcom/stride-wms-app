import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Palette, Globe, Mail, Image } from 'lucide-react';
import { CommunicationBrandSettings } from '@/hooks/useCommunications';
import { useToast } from '@/hooks/use-toast';

interface TemplateBrandTabProps {
  brandSettings: CommunicationBrandSettings | null;
  onUpdateBrandSettings: (updates: Partial<CommunicationBrandSettings>) => Promise<boolean>;
}

export function TemplateBrandTab({
  brandSettings,
  onUpdateBrandSettings,
}: TemplateBrandTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    brand_logo_url: '',
    brand_primary_color: '#FD5A2A',
    brand_support_email: '',
    portal_base_url: '',
    from_name: '',
    from_email: '',
    sms_sender_id: '',
  });

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
    const success = await onUpdateBrandSettings(formData);
    
    if (success) {
      toast({
        title: 'Brand settings saved',
        description: 'Your brand settings have been updated.',
      });
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Brand Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Identity
          </CardTitle>
          <CardDescription>
            These settings apply to all email templates and customer communications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand_logo_url" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Logo URL
              </Label>
              <Input
                id="brand_logo_url"
                placeholder="https://example.com/logo.png"
                value={formData.brand_logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_logo_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Recommended size: 200x50 pixels, PNG or SVG
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="brand_primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="brand_primary_color"
                  type="color"
                  value={formData.brand_primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand_primary_color: e.target.value }))}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.brand_primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand_primary_color: e.target.value }))}
                  placeholder="#FD5A2A"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand_support_email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Support Email
              </Label>
              <Input
                id="brand_support_email"
                type="email"
                placeholder="support@yourcompany.com"
                value={formData.brand_support_email}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_support_email: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="portal_base_url" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Customer Portal URL
              </Label>
              <Input
                id="portal_base_url"
                placeholder="https://portal.yourcompany.com"
                value={formData.portal_base_url}
                onChange={(e) => setFormData(prev => ({ ...prev, portal_base_url: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Sender Settings */}
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
              <Label htmlFor="from_name">Default From Name</Label>
              <Input
                id="from_name"
                placeholder="e.g., Stride Logistics"
                value={formData.from_name}
                onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="from_email">Default From Email</Label>
              <Input
                id="from_email"
                type="email"
                placeholder="e.g., notifications@stride.com"
                value={formData.from_email}
                onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sms_sender_id">Default SMS Sender ID</Label>
            <Input
              id="sms_sender_id"
              placeholder="e.g., STRIDE"
              value={formData.sms_sender_id}
              onChange={(e) => setFormData(prev => ({ ...prev, sms_sender_id: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Alphanumeric ID (max 11 chars) or phone number. Used when sending SMS.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logo Preview */}
      {formData.brand_logo_url && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Logo Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/30 rounded-lg flex items-center justify-center">
              <img
                src={formData.brand_logo_url}
                alt="Brand Logo Preview"
                className="max-h-16 max-w-[200px] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Brand Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
