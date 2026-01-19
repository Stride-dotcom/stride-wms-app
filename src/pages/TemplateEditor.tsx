import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  History, 
  Users, 
  Mail, 
  FileText, 
  MessageSquare, 
  Palette,
  Copy,
  Check,
  Loader2,
  Eye,
  Plus,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCommunications, CommunicationTemplateVersion, TRIGGER_EVENTS, COMMUNICATION_VARIABLES } from '@/hooks/useCommunications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export default function TemplateEditor() {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const {
    alerts,
    templates,
    designElements,
    brandSettings,
    loading,
    updateTemplate,
    updateAlert,
    getTemplateVersions,
    revertToVersion,
    updateBrandSettings,
  } = useCommunications();

  const [activeTab, setActiveTab] = useState('recipients');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [versions, setVersions] = useState<CommunicationTemplateVersion[]>([]);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Current alert based on URL param or first available
  const currentAlert = alerts.find(a => a.id === alertId) || alerts[0];
  const emailTemplate = templates.find(t => t.alert_id === currentAlert?.id && t.channel === 'email');
  const smsTemplate = templates.find(t => t.alert_id === currentAlert?.id && t.channel === 'sms');

  // Form state
  const [formData, setFormData] = useState({
    // Recipients
    to_addresses: '',
    cc_addresses: '',
    bcc_addresses: '',
    // Email HTML
    subject_template: '',
    body_template_html: '',
    // Email Text
    body_template_text: '',
    // SMS
    sms_body: '',
    // Brand
    brand_logo_url: '',
    brand_primary_color: '#FD5A2A',
    from_name: '',
    from_email: '',
  });

  // Load template data when alert changes
  useEffect(() => {
    if (emailTemplate) {
      setFormData(prev => ({
        ...prev,
        subject_template: emailTemplate.subject_template || '',
        body_template_html: emailTemplate.body_template || '',
        from_name: emailTemplate.from_name || brandSettings?.from_name || '',
        from_email: emailTemplate.from_email || brandSettings?.from_email || '',
      }));
    }
    if (smsTemplate) {
      setFormData(prev => ({
        ...prev,
        sms_body: smsTemplate.body_template || '',
      }));
    }
    if (brandSettings) {
      setFormData(prev => ({
        ...prev,
        brand_logo_url: brandSettings.brand_logo_url || '',
        brand_primary_color: brandSettings.brand_primary_color || '#FD5A2A',
        from_name: prev.from_name || brandSettings.from_name || '',
        from_email: prev.from_email || brandSettings.from_email || '',
      }));
    }
  }, [emailTemplate, smsTemplate, brandSettings]);

  // Set initial tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['recipients', 'email-html', 'email-text', 'sms', 'brand'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleAlertChange = (newAlertId: string) => {
    navigate(`/templates/${newAlertId}`);
  };

  const handleSave = async () => {
    if (!currentAlert) return;
    
    setIsSaving(true);
    try {
      // Save email template
      if (emailTemplate) {
        await updateTemplate(emailTemplate.id, {
          subject_template: formData.subject_template || null,
          body_template: formData.body_template_html,
          from_name: formData.from_name || null,
          from_email: formData.from_email || null,
        });
      }
      
      // Save SMS template
      if (smsTemplate) {
        await updateTemplate(smsTemplate.id, {
          body_template: formData.sms_body,
        });
      }

      // Save brand settings
      await updateBrandSettings({
        brand_logo_url: formData.brand_logo_url || null,
        brand_primary_color: formData.brand_primary_color,
        from_name: formData.from_name || null,
        from_email: formData.from_email || null,
      });

      toast({
        title: 'Template saved',
        description: 'All changes have been saved successfully.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !formData.subject_template || !currentAlert) return;
    
    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          to_email: testEmail,
          subject: formData.subject_template,
          body_html: formData.body_template_html,
          from_name: formData.from_name,
          from_email: formData.from_email,
          tenant_id: currentAlert.tenant_id,
        },
      });

      if (error) throw error;

      toast({
        title: 'Test email sent',
        description: `Email sent to ${testEmail}`,
      });
      setShowTestDialog(false);
      setTestEmail('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to send test',
        description: err.message,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const loadVersions = async () => {
    if (!emailTemplate) return;
    const vers = await getTemplateVersions(emailTemplate.id);
    setVersions(vers);
    setShowVersionsDialog(true);
  };

  const handleRevert = async (version: CommunicationTemplateVersion) => {
    if (!emailTemplate) return;
    await revertToVersion(emailTemplate.id, version);
    setShowVersionsDialog(false);
    // Reload form data
    if (version.body_template) {
      setFormData(prev => ({
        ...prev,
        body_template_html: version.body_template,
        subject_template: version.subject_template || prev.subject_template,
      }));
    }
  };

  const copyVariable = (varKey: string) => {
    navigator.clipboard.writeText(`{{${varKey}}}`);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const insertVariable = (varKey: string, target: 'html' | 'text' | 'sms' | 'subject') => {
    const variable = `{{${varKey}}}`;
    setFormData(prev => {
      switch (target) {
        case 'html':
          return { ...prev, body_template_html: prev.body_template_html + variable };
        case 'text':
          return { ...prev, body_template_text: prev.body_template_text + variable };
        case 'sms':
          return { ...prev, sms_body: prev.sms_body + variable };
        case 'subject':
          return { ...prev, subject_template: prev.subject_template + variable };
        default:
          return prev;
      }
    });
    toast({
      title: 'Variable inserted',
      description: `${variable} added to template`,
    });
  };

  // Group variables by category
  const groupedVariables = COMMUNICATION_VARIABLES.reduce((acc, v) => {
    if (!acc[v.group]) acc[v.group] = [];
    acc[v.group].push(v);
    return acc;
  }, {} as Record<string, typeof COMMUNICATION_VARIABLES>);

  const renderTokensPanel = (insertTarget: 'html' | 'text' | 'sms' | 'subject') => (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Available Tokens</CardTitle>
        <CardDescription>Click copy to copy, or insert to add to editor</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] sm:h-[400px]">
          <div className="space-y-6">
            {Object.entries(groupedVariables).map(([group, vars]) => (
              <div key={group}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {group}
                </h4>
                <div className="space-y-1">
                  {vars.map((variable) => (
                    <div
                      key={variable.key}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Badge variant="secondary" className="font-mono text-xs shrink-0">
                          {`[[${variable.key}]]`}
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => copyVariable(variable.key)}
                              >
                                {copiedVar === variable.key ? (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy to clipboard</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground hidden sm:inline">
                          {variable.label}
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => insertVariable(variable.key, insertTarget)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Insert at cursor</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderPreview = () => {
    if (!formData.body_template_html) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
          No template content to preview
        </div>
      );
    }

    // Replace variables with sample data
    let html = formData.body_template_html;
    COMMUNICATION_VARIABLES.forEach(v => {
      html = html.replace(new RegExp(`{{${v.key}}}`, 'g'), v.sample);
    });

    if (brandSettings) {
      html = html.replace(/{{brand_logo_url}}/g, brandSettings.brand_logo_url || '');
      html = html.replace(/{{brand_primary_color}}/g, brandSettings.brand_primary_color);
    }

    return (
      <iframe
        srcDoc={html}
        className="w-full h-full border-0 bg-white min-h-[400px] rounded-lg"
        title="Email Preview"
        sandbox="allow-same-origin"
      />
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!currentAlert) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-4">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Alerts Found</h3>
          <p className="text-muted-foreground mb-4">
            Create an alert first to start editing templates.
          </p>
          <Button onClick={() => navigate('/settings?tab=communications')}>
            Go to Communications Settings
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b bg-background px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/settings?tab=communications')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Edit Communication Template</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Configure template content and recipients
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadVersions}>
                <History className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Versions</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)}>
                <Send className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Send Test</span>
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Template Metadata Header */}
        <div className="border-b bg-muted/30 px-4 py-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Trigger Event */}
            <div className="space-y-2">
              <Label>Trigger Event</Label>
              <Select value={currentAlert.id} onValueChange={handleAlertChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {alerts.map((alert) => (
                    <SelectItem key={alert.id} value={alert.id}>
                      {TRIGGER_EVENTS.find(e => e.value === alert.trigger_event)?.label || alert.trigger_event}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template Name */}
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={currentAlert.name} readOnly className="bg-background" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <p className="text-sm text-muted-foreground py-2">
                {currentAlert.description || 'No description provided.'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 max-w-2xl mb-6">
              <TabsTrigger value="recipients" className="gap-1 sm:gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Recipients</span>
              </TabsTrigger>
              <TabsTrigger value="email-html" className="gap-1 sm:gap-2">
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Email HTML</span>
              </TabsTrigger>
              <TabsTrigger value="email-text" className="gap-1 sm:gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Email Text</span>
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-1 sm:gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">SMS</span>
              </TabsTrigger>
              <TabsTrigger value="brand" className="gap-1 sm:gap-2">
                <Palette className="h-4 w-4" />
                <span className="hidden sm:inline">Brand</span>
              </TabsTrigger>
            </TabsList>

            {/* Recipients Tab */}
            <TabsContent value="recipients" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Recipients</CardTitle>
                  <CardDescription>
                    Configure who receives this alert. Use tokens or comma-separated emails.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="to">To (comma-separated)</Label>
                    <Input
                      id="to"
                      placeholder="[[account_contact_email]], [[account_billing_contact_email]]"
                      value={formData.to_addresses}
                      onChange={(e) => setFormData(prev => ({ ...prev, to_addresses: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cc">CC (comma-separated)</Label>
                    <Input
                      id="cc"
                      placeholder="manager@company.com, [[account_operations_email]]"
                      value={formData.cc_addresses}
                      onChange={(e) => setFormData(prev => ({ ...prev, cc_addresses: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bcc">BCC (comma-separated)</Label>
                    <Input
                      id="bcc"
                      placeholder="archive@company.com"
                      value={formData.bcc_addresses}
                      onChange={(e) => setFormData(prev => ({ ...prev, bcc_addresses: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>
              {renderTokensPanel('subject')}
            </TabsContent>

            {/* Email HTML Content Tab */}
            <TabsContent value="email-html" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Editor */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject*</Label>
                    <Input
                      id="subject"
                      placeholder="Order Completed: [[delivery_contact_name]] — Service Order #[[service_order_number]]"
                      value={formData.subject_template}
                      onChange={(e) => setFormData(prev => ({ ...prev, subject_template: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="html-body">HTML Body</Label>
                    <Textarea
                      id="html-body"
                      placeholder="Enter your HTML email template..."
                      className="font-mono text-sm min-h-[400px]"
                      value={formData.body_template_html}
                      onChange={(e) => setFormData(prev => ({ ...prev, body_template_html: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Preview */}
                <Card className="h-fit">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <CardTitle className="text-sm">Live Preview</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden bg-white min-h-[400px]">
                      {renderPreview()}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {renderTokensPanel('html')}
            </TabsContent>

            {/* Email Text Content Tab */}
            <TabsContent value="email-text" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plain Text Email</CardTitle>
                  <CardDescription>
                    Some email clients prefer plain text. Provide a fallback version.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Enter plain text version of your email..."
                    className="min-h-[400px] font-mono text-sm"
                    value={formData.body_template_text}
                    onChange={(e) => setFormData(prev => ({ ...prev, body_template_text: e.target.value }))}
                  />
                </CardContent>
              </Card>
              {renderTokensPanel('text')}
            </TabsContent>

            {/* SMS Tab */}
            <TabsContent value="sms" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>SMS Message</CardTitle>
                  <CardDescription>
                    Keep messages short. Standard SMS is 160 characters.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Your order has been completed. View details: [[link]]"
                    className="min-h-[200px]"
                    value={formData.sms_body}
                    onChange={(e) => setFormData(prev => ({ ...prev, sms_body: e.target.value }))}
                  />
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="text-muted-foreground">
                      Characters: {formData.sms_body.length}
                    </span>
                    <span className={formData.sms_body.length > 160 ? 'text-destructive' : 'text-muted-foreground'}>
                      {Math.ceil(formData.sms_body.length / 160) || 1} SMS segment(s)
                    </span>
                  </div>
                </CardContent>
              </Card>
              {renderTokensPanel('sms')}
            </TabsContent>

            {/* Brand Settings Tab */}
            <TabsContent value="brand" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Settings</CardTitle>
                  <CardDescription>
                    Configure visual branding for all email templates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo_url">Logo URL</Label>
                        <Input
                          id="logo_url"
                          placeholder="https://example.com/logo.png"
                          value={formData.brand_logo_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, brand_logo_url: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="primary_color">Primary Color</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            id="primary_color"
                            value={formData.brand_primary_color}
                            onChange={(e) => setFormData(prev => ({ ...prev, brand_primary_color: e.target.value }))}
                            className="w-10 h-10 rounded border cursor-pointer"
                          />
                          <Input
                            value={formData.brand_primary_color}
                            onChange={(e) => setFormData(prev => ({ ...prev, brand_primary_color: e.target.value }))}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="from_name">Default From Name</Label>
                        <Input
                          id="from_name"
                          placeholder="Stride Logistics"
                          value={formData.from_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="from_email">Default From Email</Label>
                        <Input
                          id="from_email"
                          type="email"
                          placeholder="notifications@company.com"
                          value={formData.from_email}
                          onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo Preview */}
                  {formData.brand_logo_url && (
                    <div className="space-y-2">
                      <Label>Logo Preview</Label>
                      <div className="border rounded-lg p-4 bg-muted/30 inline-block">
                        <img
                          src={formData.brand_logo_url}
                          alt="Brand logo preview"
                          className="max-h-16 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Send Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Enter an email address to receive a test of this template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="your@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTest} disabled={isSendingTest || !testEmail}>
              {isSendingTest ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSendingTest ? 'Sending...' : 'Send Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionsDialog} onOpenChange={setShowVersionsDialog}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Template Version History</DialogTitle>
            <DialogDescription>
              View and restore previous versions of this template.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No version history available yet.
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {versions.map((version) => (
                  <Card key={version.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="outline">Version {version.version_number}</Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(version)}
                        >
                          Restore
                        </Button>
                      </div>
                      {version.subject_template && (
                        <p className="text-sm mt-2 truncate">
                          Subject: {version.subject_template}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
