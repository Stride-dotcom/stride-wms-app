import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, FileText, Variable, Palette } from 'lucide-react';
import { useCommunications } from '@/hooks/useCommunications';
import { AlertsTab } from './communications/AlertsTab';
import { TemplatesTab } from './communications/TemplatesTab';
import { VariablesTab } from './communications/VariablesTab';
import { DesignElementsTab } from './communications/DesignElementsTab';
import { BrandSettingsCard } from './communications/BrandSettingsCard';

export function CommunicationsSettingsTab() {
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
