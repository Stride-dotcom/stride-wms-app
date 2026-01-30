import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useCommunications, CommunicationAlert } from '@/hooks/useCommunications';
import { useAuth } from '@/contexts/AuthContext';
import { AlertList } from './alerts/AlertList';
import { AlertEditorHeader } from './alerts/AlertEditorHeader';
import { RecipientsTab } from './alerts/tabs/RecipientsTab';
import { EmailHtmlTab } from './alerts/tabs/EmailHtmlTab';
import { EmailTextTab } from './alerts/tabs/EmailTextTab';
import { SmsTab } from './alerts/tabs/SmsTab';
import { BrandSettingsTab } from './alerts/tabs/BrandSettingsTab';
import { useIsMobile } from '@/hooks/use-mobile';

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
    createTemplate,
    updateTemplate,
    getTemplateVersions,
    revertToVersion,
    updateBrandSettings,
  } = useCommunications();

  const { profile } = useAuth();
  const [selectedAlert, setSelectedAlert] = useState<CommunicationAlert | null>(null);
  const [activeTab, setActiveTab] = useState('recipients');
  const isMobile = useIsMobile();
  const tenantId = profile?.tenant_id || '';

  const handleSelectAlert = (alert: CommunicationAlert) => {
    setSelectedAlert(alert);
    setActiveTab('recipients');
  };

  const handleBack = () => {
    setSelectedAlert(null);
  };

  // Sync selectedAlert with updated alerts from the hook
  useEffect(() => {
    if (selectedAlert) {
      const updatedAlert = alerts.find(a => a.id === selectedAlert.id);
      if (updatedAlert && JSON.stringify(updatedAlert) !== JSON.stringify(selectedAlert)) {
        setSelectedAlert(updatedAlert);
      }
    }
  }, [alerts, selectedAlert]);

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
            <MaterialIcon name="notifications" size="md" />
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
            <MaterialIcon name="notifications" size="md" />
            Alerts
          </CardTitle>
          <CardDescription>
            Configure notification alerts and manage their templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertList
            alerts={alerts}
            templates={templates}
            tenantId={tenantId}
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
    <div className="flex flex-col -m-6 min-h-0">
      <AlertEditorHeader
        alert={selectedAlert}
        emailTemplate={emailTemplate}
        smsTemplate={smsTemplate}
        onBack={handleBack}
        onUpdateAlert={updateAlert}
        onDeleteAlert={deleteAlert}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="border-b bg-card overflow-x-auto flex-shrink-0">
          <TabsList className="h-auto p-0 bg-transparent rounded-none flex-nowrap w-max min-w-full md:w-full">
            <TabsTrigger 
              value="recipients" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 md:gap-2 px-3 md:px-6 py-3 whitespace-nowrap"
            >
              <MaterialIcon name="group" size="sm" />
              <span className="hidden md:inline">Recipients</span>
            </TabsTrigger>
            <TabsTrigger 
              value="email-html" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 md:gap-2 px-3 md:px-6 py-3 whitespace-nowrap"
              disabled={!selectedAlert.channels.email}
            >
              <MaterialIcon name="mail" size="sm" />
              <span className="hidden md:inline">Email HTML</span>
            </TabsTrigger>
            <TabsTrigger 
              value="email-text" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 md:gap-2 px-3 md:px-6 py-3 whitespace-nowrap"
              disabled={!selectedAlert.channels.email}
            >
              <MaterialIcon name="description" size="sm" />
              <span className="hidden md:inline">Email Text</span>
            </TabsTrigger>
            <TabsTrigger 
              value="sms" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 md:gap-2 px-3 md:px-6 py-3 whitespace-nowrap"
              disabled={!selectedAlert.channels.sms}
            >
              <MaterialIcon name="chat" size="sm" />
              <span className="hidden md:inline">SMS</span>
            </TabsTrigger>
            <TabsTrigger 
              value="brand" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1 md:gap-2 px-3 md:px-6 py-3 whitespace-nowrap"
            >
              <MaterialIcon name="palette" size="sm" />
              <span className="hidden md:inline">Brand Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <TabsContent value="recipients" className="p-4 md:p-6 m-0 h-full">
            <RecipientsTab alertId={selectedAlert.id} />
          </TabsContent>

          <TabsContent value="email-html" className="m-0 h-full">
            <EmailHtmlTab
              template={emailTemplate || null}
              designElements={designElements}
              brandSettings={brandSettings}
              alertId={selectedAlert?.id}
              alertName={selectedAlert?.name}
              triggerEvent={selectedAlert?.trigger_event}
              onUpdateTemplate={updateTemplate}
              onCreateTemplate={createTemplate}
              onGetVersions={getTemplateVersions}
              onRevertToVersion={revertToVersion}
            />
          </TabsContent>

          <TabsContent value="email-text" className="m-0 h-full">
            <EmailTextTab
              template={emailTemplate || null}
              onUpdateTemplate={updateTemplate}
            />
          </TabsContent>

          <TabsContent value="sms" className="m-0 h-full">
            <SmsTab
              template={smsTemplate || null}
              alertId={selectedAlert?.id}
              alertName={selectedAlert?.name}
              triggerEvent={selectedAlert?.trigger_event}
              onUpdateTemplate={updateTemplate}
              onCreateTemplate={createTemplate}
            />
          </TabsContent>

          <TabsContent value="brand" className="p-4 md:p-6 m-0 h-full">
            <BrandSettingsTab
              brandSettings={brandSettings}
              onUpdateBrandSettings={updateBrandSettings}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
