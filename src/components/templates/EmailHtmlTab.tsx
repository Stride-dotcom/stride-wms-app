import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Save,
  Loader2,
  Eye,
  Code,
  History,
  Send,
  ChevronDown,
  Variable,
} from 'lucide-react';
import {
  CommunicationTemplate,
  CommunicationTemplateVersion,
  CommunicationDesignElement,
  CommunicationBrandSettings,
  COMMUNICATION_VARIABLES,
} from '@/hooks/useCommunications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { VariablesDrawer } from '@/components/settings/communications/VariablesDrawer';

interface EmailHtmlTabProps {
  template: CommunicationTemplate | undefined;
  designElements: CommunicationDesignElement[];
  brandSettings: CommunicationBrandSettings | null;
  tenantId: string;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
  getTemplateVersions: (templateId: string) => Promise<CommunicationTemplateVersion[]>;
  revertToVersion: (templateId: string, version: CommunicationTemplateVersion) => Promise<boolean>;
}

export function EmailHtmlTab({
  template,
  designElements,
  brandSettings,
  tenantId,
  onUpdateTemplate,
  getTemplateVersions,
  revertToVersion,
}: EmailHtmlTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [showVariablesDrawer, setShowVariablesDrawer] = useState(false);
  const [versions, setVersions] = useState<CommunicationTemplateVersion[]>([]);
  const [testEmail, setTestEmail] = useState('');

  const [formData, setFormData] = useState({
    subject_template: '',
    body_template: '',
  });

  useEffect(() => {
    if (template) {
      setFormData({
        subject_template: template.subject_template || '',
        body_template: template.body_template || '',
      });
    }
  }, [template]);

  const handleSave = async () => {
    if (!template) return;
    
    setIsSaving(true);
    const success = await onUpdateTemplate(template.id, {
      subject_template: formData.subject_template || null,
      body_template: formData.body_template,
    });
    
    if (success) {
      toast({
        title: 'Template saved',
        description: 'Your email HTML template has been saved.',
      });
    }
    setIsSaving(false);
  };

  const loadVersions = async () => {
    if (!template) return;
    const vers = await getTemplateVersions(template.id);
    setVersions(vers);
    setShowVersions(true);
  };

  const handleRevert = async (version: CommunicationTemplateVersion) => {
    if (!template) return;
    await revertToVersion(template.id, version);
    setShowVersions(false);
  };

  const handleSendTest = async () => {
    if (!testEmail || !formData.subject_template || !tenantId) return;
    
    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          to_email: testEmail,
          subject: formData.subject_template,
          body_html: formData.body_template,
          tenant_id: tenantId,
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

  const insertVariable = (varKey: string) => {
    const variable = varKey.startsWith('{{') ? varKey : `{{${varKey}}}`;
    setFormData(prev => ({ ...prev, body_template: prev.body_template + variable }));
  };

  const insertDesignElement = (element: CommunicationDesignElement) => {
    setFormData(prev => ({ ...prev, body_template: prev.body_template + element.html_snippet }));
  };

  const renderPreview = () => {
    if (!formData.body_template) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
          No template content to preview
        </div>
      );
    }

    // Replace variables with sample data
    let html = formData.body_template;
    COMMUNICATION_VARIABLES.forEach(v => {
      html = html.replace(new RegExp(`{{${v.key}}}`, 'g'), v.sample);
    });

    // Replace brand settings
    if (brandSettings) {
      html = html.replace(/{{brand_logo_url}}/g, brandSettings.brand_logo_url || '');
      html = html.replace(/{{brand_primary_color}}/g, brandSettings.brand_primary_color);
      html = html.replace(/{{brand_support_email}}/g, brandSettings.brand_support_email || 'support@example.com');
      html = html.replace(/{{portal_base_url}}/g, brandSettings.portal_base_url || 'https://portal.example.com');
    }

    return (
      <iframe
        srcDoc={html}
        className="w-full h-full border-0 bg-white min-h-[400px]"
        title="Email Preview"
        sandbox="allow-same-origin"
      />
    );
  };

  if (!template) {
    return (
      <Card className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-muted-foreground">No email template found for this alert.</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={showPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <Code className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showPreview ? 'Edit' : 'Preview'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Insert Element
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px]">
                {['icon', 'divider', 'callout', 'button', 'header_block'].map(category => {
                  const categoryElements = designElements.filter(e => e.category === category);
                  if (categoryElements.length === 0) return null;
                  return (
                    <div key={category}>
                      <DropdownMenuLabel className="capitalize">{category.replace('_', ' ')}</DropdownMenuLabel>
                      {categoryElements.map(element => (
                        <DropdownMenuItem
                          key={element.id}
                          onClick={() => insertDesignElement(element)}
                        >
                          {element.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={() => setShowVariablesDrawer(true)}>
              <Variable className="h-4 w-4 mr-2" />
              Variables
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send Test
            </Button>
            <Button variant="outline" size="sm" onClick={loadVersions}>
              <History className="h-4 w-4 mr-2" />
              Versions
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {showPreview ? (
          /* Preview Mode */
          <Card className="overflow-hidden">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 min-h-[500px]">
              {renderPreview()}
            </CardContent>
          </Card>
        ) : (
          /* Edit Mode */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor Panel */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Email subject with {{variables}}"
                  value={formData.subject_template}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject_template: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">HTML Body</Label>
                <Textarea
                  id="body"
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="HTML template with {{variables}}"
                  value={formData.body_template}
                  onChange={(e) => setFormData(prev => ({ ...prev, body_template: e.target.value }))}
                />
              </div>
            </div>

            {/* Preview Panel */}
            <Card className="overflow-hidden">
              <CardHeader className="py-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 min-h-[400px]">
                {renderPreview()}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Variables Drawer */}
      <VariablesDrawer
        open={showVariablesDrawer}
        onOpenChange={setShowVariablesDrawer}
        designElements={designElements}
        onInsertVariable={insertVariable}
        onInsertDesignElement={insertDesignElement}
      />

      {/* Version History Dialog */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
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

      {/* Send Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Enter an email address to send a test of this template
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
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
