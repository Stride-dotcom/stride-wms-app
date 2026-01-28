import { useState, useEffect, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Save,
  History,
  Maximize2,
  Minimize2,
  Send,
  Loader2,
} from 'lucide-react';
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
import { TReaderDocument } from '@usewaypoint/email-builder';

// Lazy load the WYSIWYG editor to reduce initial bundle size
const EmailWysiwygEditor = lazy(() =>
  import('@/components/settings/communications/EmailWysiwygEditor').then((mod) => ({
    default: mod.EmailWysiwygEditor,
  }))
);

interface EmailHtmlTabProps {
  template: CommunicationTemplate | null;
  designElements: CommunicationDesignElement[];
  brandSettings: CommunicationBrandSettings | null;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
  onGetVersions: (templateId: string) => Promise<CommunicationTemplateVersion[]>;
  onRevertToVersion: (templateId: string, version: CommunicationTemplateVersion) => Promise<boolean>;
}

export function EmailHtmlTab({
  template,
  designElements,
  brandSettings,
  onUpdateTemplate,
  onGetVersions,
  onRevertToVersion,
}: EmailHtmlTabProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editorJson, setEditorJson] = useState<TReaderDocument | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<CommunicationTemplateVersion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    if (template) {
      setSubject(template.subject_template || '');
      setBody(template.body_template || '');
      // Parse stored editor JSON if available
      if ((template as any).editor_json) {
        try {
          setEditorJson((template as any).editor_json as TReaderDocument);
        } catch {
          setEditorJson(null);
        }
      } else {
        setEditorJson(null);
      }
    }
  }, [template]);

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
      editor_json: editorJson,
    } as Partial<CommunicationTemplate>);
    setIsSaving(false);
  };

  const handleJsonChange = (json: TReaderDocument) => {
    setEditorJson(json);
  };

  const handleHtmlChange = (html: string) => {
    setBody(html);
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No email template available. Enable email channel for this alert.
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
          <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Test
          </Button>
          <Button variant="outline" size="sm" onClick={loadVersions}>
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
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

      {/* WYSIWYG Editor */}
      <div className="flex-1 overflow-hidden min-h-0">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading editor...</p>
            </div>
          }
        >
          <EmailWysiwygEditor
            initialJson={editorJson}
            initialHtml={body}
            brandSettings={brandSettings}
            onJsonChange={handleJsonChange}
            onHtmlChange={handleHtmlChange}
          />
        </Suspense>
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
