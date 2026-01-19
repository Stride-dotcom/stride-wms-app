import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Users, Code, FileText, MessageSquare, Palette } from 'lucide-react';
import { useCommunications } from '@/hooks/useCommunications';
import { AlertTemplateHeader } from '@/components/alert-templates/AlertTemplateHeader';
import { RecipientsEditor } from '@/components/alert-templates/RecipientsEditor';
import { EmailHtmlEditor } from '@/components/alert-templates/EmailHtmlEditor';
import { EmailTextEditor } from '@/components/alert-templates/EmailTextEditor';
import { SmsEditor } from '@/components/alert-templates/SmsEditor';
import { BrandEditor } from '@/components/alert-templates/BrandEditor';

export default function AlertTemplateEditor() {
  const { alertId } = useParams<{ alertId: string }>();
  const {
    alerts,
    templates,
    designElements,
    brandSettings,
    loading,
    updateAlert,
    updateTemplate,
    getTemplateVersions,
    revertToVersion,
    updateBrandSettings,
  } = useCommunications();

  // Find the current alert
  const alert = alerts.find(a => a.id === alertId);
  
  // Find templates for this alert
  const emailTemplate = templates.find(t => t.alert_id === alertId && t.channel === 'email') || null;
  const smsTemplate = templates.find(t => t.alert_id === alertId && t.channel === 'sms') || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container py-4">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="container py-6">
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Alert Not Found</h2>
            <p className="text-muted-foreground">
              The alert you're looking for doesn't exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with alert info and toggles */}
      <AlertTemplateHeader alert={alert} onUpdateAlert={updateAlert} />

      {/* Main content with tabs */}
      <div className="container py-6">
        <Tabs defaultValue="recipients" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="recipients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Recipients</span>
            </TabsTrigger>
            <TabsTrigger value="email-html" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Email HTML</span>
            </TabsTrigger>
            <TabsTrigger value="email-text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Email Text</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">SMS</span>
            </TabsTrigger>
            <TabsTrigger value="brand" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Brand</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recipients">
            <RecipientsEditor
              emailTemplate={emailTemplate}
              smsTemplate={smsTemplate}
              brandSettings={brandSettings}
              onUpdateTemplate={updateTemplate}
            />
          </TabsContent>

          <TabsContent value="email-html">
            <EmailHtmlEditor
              template={emailTemplate}
              designElements={designElements}
              onUpdateTemplate={updateTemplate}
              onGetVersions={getTemplateVersions}
              onRevertVersion={revertToVersion}
            />
          </TabsContent>

          <TabsContent value="email-text">
            <EmailTextEditor
              template={emailTemplate}
              onUpdateTemplate={updateTemplate}
            />
          </TabsContent>

          <TabsContent value="sms">
            <SmsEditor
              template={smsTemplate}
              onUpdateTemplate={updateTemplate}
            />
          </TabsContent>

          <TabsContent value="brand">
            <BrandEditor
              brandSettings={brandSettings}
              onUpdateBrandSettings={updateBrandSettings}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
