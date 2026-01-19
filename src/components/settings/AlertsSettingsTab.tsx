import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Users, Mail, FileText, MessageSquare, Palette } from 'lucide-react';
import { useCommunications, CommunicationAlert } from '@/hooks/useCommunications';
import { AlertList } from './alerts/AlertList';
import { AlertEditorHeader } from './alerts/AlertEditorHeader';
import { RecipientsTab } from './alerts/tabs/RecipientsTab';
import { EmailHtmlTab } from './alerts/tabs/EmailHtmlTab';
import { EmailTextTab } from './alerts/tabs/EmailTextTab';
import { SmsTab } from './alerts/tabs/SmsTab';
import { BrandSettingsTab } from './alerts/tabs/BrandSettingsTab';

export function AlertsSettingsTab() {
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

  const [selectedAlert, setSelectedAlert] = useState<CommunicationAlert | null>(null);
  const [activeTab, setActiveTab] = useState('recipients');

  const handleSelectAlert = (alert: CommunicationAlert) => {
    setSelectedAlert(alert);
    setActiveTab('recipients');
  };

  const handleBack = () => {
    setSelectedAlert(null);
  };

  // Get templates for the selected alert
  const emailTemplate = selectedAlert 
    ? templates.find(t => t.alert_id === selectedAlert.id && t.channel === 'email') 
    : null;
  const smsTemplate = selectedAlert 
    ? templates.find(t => t.alert_id === selectedAlert.id && t.channel === 'sms') 
    : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts
          </CardTitle>
          <CardDescription>Loading alert settings...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Show alert list when no alert is selected
  if (!selectedAlert) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts
          </CardTitle>
          <CardDescription>
            Configure notification alerts and manage their templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertList
            alerts={alerts}
            onCreateAlert={createAlert}
            onUpdateAlert={updateAlert}
            onDeleteAlert={deleteAlert}
            onSelectAlert={handleSelectAlert}
          />
        </CardContent>
      </Card>
    );
  }

  // Show 5-tab editor when alert is selected
  return (
    <div className="space-y-0 -m-6">
      <AlertEditorHeader
        alert={selectedAlert}
        onBack={handleBack}
        onUpdateAlert={updateAlert}
        onDeleteAlert={deleteAlert}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <div className="border-b bg-card">
          <TabsList className="h-auto p-0 bg-transparent rounded-none">
            <TabsTrigger 
              value="recipients" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2 px-6 py-3"
            >
              <Users className="h-4 w-4" />
              Recipients
            </TabsTrigger>
            <TabsTrigger 
              value="email-html" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2 px-6 py-3"
              disabled={!selectedAlert.channels.email}
            >
              <Mail className="h-4 w-4" />
              Email HTML
            </TabsTrigger>
            <TabsTrigger 
              value="email-text" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2 px-6 py-3"
              disabled={!selectedAlert.channels.email}
            >
              <FileText className="h-4 w-4" />
              Email Text
            </TabsTrigger>
            <TabsTrigger 
              value="sms" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2 px-6 py-3"
              disabled={!selectedAlert.channels.sms}
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger 
              value="brand" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2 px-6 py-3"
            >
              <Palette className="h-4 w-4" />
              Brand Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="recipients" className="p-6 m-0">
          <RecipientsTab alertId={selectedAlert.id} />
        </TabsContent>

        <TabsContent value="email-html" className="m-0 h-[calc(100vh-300px)]">
          <EmailHtmlTab
            template={emailTemplate || null}
            designElements={designElements}
            brandSettings={brandSettings}
            onUpdateTemplate={updateTemplate}
            onGetVersions={getTemplateVersions}
            onRevertToVersion={revertToVersion}
          />
        </TabsContent>

        <TabsContent value="email-text" className="m-0 h-[calc(100vh-300px)]">
          <EmailTextTab
            template={emailTemplate || null}
            onUpdateTemplate={updateTemplate}
          />
        </TabsContent>

        <TabsContent value="sms" className="m-0 h-[calc(100vh-300px)]">
          <SmsTab
            template={smsTemplate || null}
            onUpdateTemplate={updateTemplate}
          />
        </TabsContent>

        <TabsContent value="brand" className="p-6 m-0">
          <BrandSettingsTab
            brandSettings={brandSettings}
            onUpdateBrandSettings={updateBrandSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
