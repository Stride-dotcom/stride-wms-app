import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Mail, FileText, MessageSquare, Palette } from 'lucide-react';
import { useCommunications } from '@/hooks/useCommunications';
import { useAuth } from '@/contexts/AuthContext';
import { TemplateEditHeader } from '@/components/templates/TemplateEditHeader';
import { RecipientsTab } from '@/components/templates/RecipientsTab';
import { EmailHtmlTab } from '@/components/templates/EmailHtmlTab';
import { EmailTextTab } from '@/components/templates/EmailTextTab';
import { SmsTab } from '@/components/templates/SmsTab';
import { TemplateBrandTab } from '@/components/templates/TemplateBrandTab';

export default function TemplateEdit() {
  const { alertId } = useParams<{ alertId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const {
    alerts,
    templates,
    designElements,
    brandSettings,
    loading,
    updateTemplate,
    getTemplateVersions,
    revertToVersion,
    updateBrandSettings,
  } = useCommunications();

  // Get initial channel from URL params or default to email
  const initialChannel = searchParams.get('channel') as 'email' | 'sms' || 'email';
  const [activeTab, setActiveTab] = useState('recipients');

  const currentAlert = alerts.find(a => a.id === alertId);
  const emailTemplate = templates.find(t => t.alert_id === alertId && t.channel === 'email');
  const smsTemplate = templates.find(t => t.alert_id === alertId && t.channel === 'sms');

  // Set initial tab based on channel
  useEffect(() => {
    if (initialChannel === 'sms') {
      setActiveTab('sms');
    }
  }, [initialChannel]);

  const handleBack = () => {
    navigate('/settings?tab=communications');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!currentAlert) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <h2 className="text-xl font-semibold mb-2">Alert Not Found</h2>
          <p className="text-muted-foreground mb-4">The alert you're looking for doesn't exist.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Back Button */}
        <div className="px-4 md:px-6 pt-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </div>

        {/* Header */}
        <div className="px-4 md:px-6 py-4">
          <TemplateEditHeader alert={currentAlert} />
        </div>

        {/* 5-Tab Layout */}
        <div className="flex-1 px-4 md:px-6 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-5 max-w-full lg:max-w-[700px]">
              <TabsTrigger value="recipients" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Recipients</span>
              </TabsTrigger>
              <TabsTrigger value="email-html" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email HTML</span>
              </TabsTrigger>
              <TabsTrigger value="email-text" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Email Text</span>
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">SMS</span>
              </TabsTrigger>
              <TabsTrigger value="brand" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Brand</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-6 overflow-auto">
              <TabsContent value="recipients" className="mt-0 h-full">
                <RecipientsTab
                  alert={currentAlert}
                  emailTemplate={emailTemplate}
                  smsTemplate={smsTemplate}
                  onUpdateTemplate={updateTemplate}
                />
              </TabsContent>

              <TabsContent value="email-html" className="mt-0 h-full">
                <EmailHtmlTab
                  template={emailTemplate}
                  designElements={designElements}
                  brandSettings={brandSettings}
                  tenantId={profile?.tenant_id || ''}
                  onUpdateTemplate={updateTemplate}
                  getTemplateVersions={getTemplateVersions}
                  revertToVersion={revertToVersion}
                />
              </TabsContent>

              <TabsContent value="email-text" className="mt-0 h-full">
                <EmailTextTab
                  template={emailTemplate}
                  onUpdateTemplate={updateTemplate}
                />
              </TabsContent>

              <TabsContent value="sms" className="mt-0 h-full">
                <SmsTab
                  alert={currentAlert}
                  template={smsTemplate}
                  onUpdateTemplate={updateTemplate}
                />
              </TabsContent>

              <TabsContent value="brand" className="mt-0 h-full">
                <TemplateBrandTab
                  brandSettings={brandSettings}
                  onUpdateBrandSettings={updateBrandSettings}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
