import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, FileText, Variable, Palette, Building2 } from 'lucide-react';
import { useCommunications } from '@/hooks/useCommunications';
import { AlertsTab } from './communications/AlertsTab';
import { TemplatesTab } from './communications/TemplatesTab';
import { VariablesTab } from './communications/VariablesTab';
import { DesignElementsTab } from './communications/DesignElementsTab';
import { BrandSettingsCard } from './communications/BrandSettingsCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Account {
  id: string;
  account_name: string;
  account_code: string;
}

export function CommunicationsSettingsTab() {
  const { profile } = useAuth();
  const {
    alerts,
    templates,
    designElements,
    brandSettings,
    loading,
    createAlert,
    updateAlert,
    deleteAlert,
    updateTemplate,
    getTemplateVersions,
    revertToVersion,
    updateBrandSettings,
  } = useCommunications();

  const [activeTab, setActiveTab] = useState('alerts');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'sms' | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('global');

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!profile?.tenant_id) return;
      
      const { data } = await supabase
        .from('accounts')
        .select('id, account_name, account_code')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('account_name');
      
      setAccounts(data || []);
    };
    
    fetchAccounts();
  }, [profile?.tenant_id]);

  const handleEditTemplate = (alertId: string, channel: 'email' | 'sms') => {
    setSelectedAlertId(alertId);
    setSelectedChannel(channel);
    setActiveTab('templates');
  };

  const handleCloseTemplateEditor = () => {
    setSelectedAlertId(null);
    setSelectedChannel(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[400px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Scope Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Template Scope</CardTitle>
                <CardDescription>
                  Edit global templates or per-account overrides
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="account-scope" className="text-sm text-muted-foreground">
                Viewing:
              </Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-[280px]" id="account-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Global</Badge>
                      <span>Default Templates</span>
                    </div>
                  </SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <span>{account.account_name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">({account.account_code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        {selectedAccountId !== 'global' && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Templates edited here will override the global defaults for{' '}
              <strong>{accounts.find(a => a.id === selectedAccountId)?.account_name}</strong>.
              If no override exists, the global template will be used.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Brand Settings - Always visible at top */}
      <BrandSettingsCard
        brandSettings={brandSettings}
        onUpdate={updateBrandSettings}
      />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-[600px]">
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="variables" className="gap-2">
            <Variable className="h-4 w-4" />
            Variables
          </TabsTrigger>
          <TabsTrigger value="design" className="gap-2">
            <Palette className="h-4 w-4" />
            Design Elements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-6">
          <AlertsTab
            alerts={alerts}
            onCreateAlert={createAlert}
            onUpdateAlert={updateAlert}
            onDeleteAlert={deleteAlert}
            onEditTemplate={handleEditTemplate}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplatesTab
            alerts={alerts}
            templates={templates}
            designElements={designElements}
            brandSettings={brandSettings}
            selectedAlertId={selectedAlertId}
            selectedChannel={selectedChannel}
            onUpdateTemplate={updateTemplate}
            getTemplateVersions={getTemplateVersions}
            revertToVersion={revertToVersion}
            onClose={handleCloseTemplateEditor}
          />
        </TabsContent>

        <TabsContent value="variables" className="mt-6">
          <VariablesTab />
        </TabsContent>

        <TabsContent value="design" className="mt-6">
          <DesignElementsTab designElements={designElements} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
