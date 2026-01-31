import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  CommunicationTemplate,
  CommunicationDesignElement,
  CommunicationBrandSettings,
  CommunicationTemplateVersion,
} from '@/hooks/useCommunications';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SendTestDialog } from '@/components/settings/communications/SendTestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { TemplateEditor } from '@/components/templateEditor';
import { EMAIL_TOKENS } from '@/lib/templateEditor/tokens';
import { getEmailTemplate } from '@/lib/emailTemplates/templates';

interface EmailHtmlTabProps {
  template: CommunicationTemplate | null;
  designElements: CommunicationDesignElement[];
  brandSettings: CommunicationBrandSettings | null;
  alertId?: string;
  alertName?: string;
  triggerEvent?: string;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
  onCreateTemplate?: (alertId: string, channel: 'email' | 'sms', alertName: string, triggerEvent?: string) => Promise<CommunicationTemplate | null>;
  onGetVersions: (templateId: string) => Promise<CommunicationTemplateVersion[]>;
  onRevertToVersion: (templateId: string, version: CommunicationTemplateVersion) => Promise<boolean>;
}

export function EmailHtmlTab({
  template,
  designElements,
  brandSettings,
  alertId,
  alertName,
  triggerEvent,
  onUpdateTemplate,
  onCreateTemplate,
  onGetVersions,
  onRevertToVersion,
}: EmailHtmlTabProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<CommunicationTemplateVersion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const { profile } = useAuth();

  // Get the default template for this trigger event
  const defaultTemplate = useMemo(() => {
    if (!triggerEvent) return null;
    return getEmailTemplate(triggerEvent);
  }, [triggerEvent]);

  // Check if body content is essentially empty
  const isBodyEmpty = (content: string) => {
    if (!content) return true;
    // Strip HTML tags and whitespace to check if there's actual content
    const stripped = content.replace(/<[^>]*>/g, '').trim();
    return stripped.length < 20; // Consider it empty if less than 20 chars of text
  };

  useEffect(() => {
    if (template) {
      // Use default template subject/body if the current one is empty
      const templateSubject = template.subject_template || '';
      const templateBody = template.body_template || '';

      if (defaultTemplate && isBodyEmpty(templateBody)) {
        // Load the default branded template
        setSubject(templateSubject || defaultTemplate.subject);
        setBody(defaultTemplate.html);
      } else {
        setSubject(templateSubject);
        setBody(templateBody);
      }
    }
  }, [template, defaultTemplate]);

  const handleLoadDefaultTemplate = () => {
    if (defaultTemplate) {
      setSubject(defaultTemplate.subject);
      setBody(defaultTemplate.html);
    }
  };

  const loadVersions = async () => {
    if (!template) return;
    const data = await onGetVersions(template.id);
    setVersions(data);
    setShowVersions(true);
  };

  const handleRevert = async (version: CommunicationTemplateVersion) => {
    if (!template) return;
    await onRevertToVersion(template.id, version);
    setShowVersions(false);
  };

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    await onUpdateTemplate(template.id, {
      subject_template: subject,
      body_template: body,
    } as Partial<CommunicationTemplate>);
    setIsSaving(false);
  };

  const handleBodyChange = (html: string) => {
    setBody(html);
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTemplate = async () => {
    if (!alertId || !alertName || !onCreateTemplate) return;
    setIsCreating(true);
    await onCreateTemplate(alertId, 'email', alertName, triggerEvent);
    setIsCreating(false);
  };

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <MaterialIcon name="mail" size="lg" className="opacity-50" />
        <p>No email template available for this alert.</p>
        {onCreateTemplate && alertId && alertName && (
          <Button onClick={handleCreateTemplate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Email Template'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'h-full min-h-0'}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Email Template Editor
          </span>
        </div>

        <div className="flex items-center gap-2">
          {defaultTemplate && (
            <Button variant="outline" size="sm" onClick={handleLoadDefaultTemplate}>
              <MaterialIcon name="refresh" size="sm" className="mr-2" />
              Load Default
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)}>
            <MaterialIcon name="send" size="sm" className="mr-2" />
            Send Test
          </Button>
          <Button variant="outline" size="sm" onClick={loadVersions}>
            <MaterialIcon name="history" size="sm" className="mr-2" />
            History
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <MaterialIcon name="close_fullscreen" size="sm" /> : <MaterialIcon name="open_in_full" size="sm" />}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
            ) : (
              <MaterialIcon name="save" size="sm" className="mr-2" />
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Subject Line */}
      <div className="p-4 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium min-w-[60px]">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line... Use {{variable_name}} for dynamic content"
            className="flex-1 font-mono"
          />
        </div>
      </div>

      {/* TipTap Template Editor */}
      <div className="flex-1 overflow-hidden min-h-0">
        <TemplateEditor
          initialContent={body}
          onChange={handleBodyChange}
          tokens={EMAIL_TOKENS}
          mode="email"
          showSettings={false}
        />
      </div>

      {/* Version History Sheet */}
      <Sheet open={showVersions} onOpenChange={setShowVersions}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
            <div className="space-y-2 pr-4">
              {versions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No previous versions found
                </p>
              ) : (
                versions.map((version) => (
                  <Card key={version.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="secondary">v{version.version_number}</Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(version.created_at).toLocaleString()}
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
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Send Test Dialog */}
      {profile?.tenant_id && (
        <SendTestDialog
          open={showTestDialog}
          onOpenChange={setShowTestDialog}
          tenantId={profile.tenant_id}
          channel="email"
          subject={subject}
          bodyHtml={body}
        />
      )}
    </div>
  );
}
