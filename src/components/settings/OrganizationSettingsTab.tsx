import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building, Loader2, Save, Mail, Globe, Phone, MapPin, Settings2, Bell, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantSettings } from '@/hooks/useTenantSettings';
import { OrganizationLogoUpload } from './OrganizationLogoUpload';
import { DueDateRulesSettingsTab } from './DueDateRulesSettingsTab';

const organizationSchema = z.object({
  // Company Info
  company_name: z.string().optional(),
  company_email: z.string().email().optional().or(z.literal('')),
  company_phone: z.string().optional(),
  company_website: z.string().optional(),
  company_address: z.string().optional(),
  // App Settings
  app_base_url: z.string().optional(),
  app_subdomain: z.string().optional(),
  // Email Settings
  email_signature_enabled: z.boolean().optional(),
  email_signature_custom_text: z.string().optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { value: 'UTC', label: 'UTC' },
];

export function OrganizationSettingsTab() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    settings: tenantSettings,
    loading: tenantSettingsLoading,
    uploading: logoUploading,
    uploadLogo,
    removeLogo,
    updateSettings,
  } = useTenantSettings();

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      company_name: '',
      company_email: '',
      company_phone: '',
      company_website: '',
      company_address: '',
      app_base_url: '',
      app_subdomain: '',
      email_signature_enabled: true,
      email_signature_custom_text: '',
    },
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchTenantData();
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (tenantSettings) {
      form.reset({
        company_name: tenantSettings.company_name || '',
        company_email: tenantSettings.company_email || '',
        company_phone: tenantSettings.company_phone || '',
        company_website: tenantSettings.company_website || '',
        company_address: tenantSettings.company_address || '',
        app_base_url: tenantSettings.app_base_url || '',
        app_subdomain: tenantSettings.app_subdomain || '',
        email_signature_enabled: tenantSettings.email_signature_enabled ?? true,
        email_signature_custom_text: tenantSettings.email_signature_custom_text || '',
      });
    }
  }, [tenantSettings]);

  const fetchTenantData = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id, name, slug, status')
        .eq('id', profile.tenant_id)
        .single();

      if (tenantData) setTenant(tenantData);
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: OrganizationFormData) => {
    setSaving(true);
    try {
      const success = await updateSettings({
        company_name: data.company_name || null,
        company_email: data.company_email || null,
        company_phone: data.company_phone || null,
        company_website: data.company_website || null,
        company_address: data.company_address || null,
        app_base_url: data.app_base_url || null,
        app_subdomain: data.app_subdomain || null,
        email_signature_enabled: data.email_signature_enabled ?? true,
        email_signature_custom_text: data.email_signature_custom_text || null,
      });

      if (success) {
        toast({
          title: 'Settings Saved',
          description: 'Organization settings have been updated.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || tenantSettingsLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-2">
            <Building className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <Phone className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="address" className="gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-2">
            <Mail className="h-4 w-4" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="due-dates" className="gap-2">
            <Bell className="h-4 w-4" />
            Due Dates
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* General Tab */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    General Information
                  </CardTitle>
                  <CardDescription>
                    Basic organization details and branding
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo Upload */}
                  <OrganizationLogoUpload
                    logoUrl={tenantSettings?.logo_url || null}
                    uploading={logoUploading}
                    onUpload={uploadLogo}
                    onRemove={removeLogo}
                    organizationName={tenant?.name}
                  />

                  <Separator />

                  {/* Tenant Info (Read-only) */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Organization Name</label>
                      <p className="text-lg font-medium">{tenant?.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Slug</label>
                      <p className="text-lg font-medium">{tenant?.slug}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge variant={tenant?.status === 'active' ? 'default' : 'secondary'}>
                        {tenant?.status}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Company Name Override */}
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company display name for emails and reports" {...field} />
                        </FormControl>
                        <FormDescription>
                          Override the organization name for external communications
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>
                    Primary contact details for your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="company_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="contact@company.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Used as the reply-to address for system emails
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="company_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Business Address
                  </CardTitle>
                  <CardDescription>
                    Your organization's physical address for invoices and reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="company_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Address</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="123 Main Street&#10;Suite 100&#10;City, State 12345"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This address will appear on invoices and official documents
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    System Preferences
                  </CardTitle>
                  <CardDescription>
                    Configure default behaviors and application settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="app_base_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Application URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://app.yourcompany.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Base URL for links in emails and notifications
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="app_subdomain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subdomain</FormLabel>
                          <FormControl>
                            <Input placeholder="yourcompany" {...field} />
                          </FormControl>
                          <FormDescription>
                            Custom subdomain for your organization
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Communications Tab */}
            <TabsContent value="communications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Settings
                  </CardTitle>
                  <CardDescription>
                    Configure email signatures and communication preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email_signature_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Email Signature</FormLabel>
                          <FormDescription>
                            Include organization signature in outgoing emails
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email_signature_custom_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Signature Text</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Best regards,&#10;The Team at [Company Name]&#10;Phone: (555) 123-4567"
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Custom text to append to all outgoing emails
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </form>
        </Form>

        {/* Due Dates Tab - uses existing component */}
        <TabsContent value="due-dates">
          <DueDateRulesSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
