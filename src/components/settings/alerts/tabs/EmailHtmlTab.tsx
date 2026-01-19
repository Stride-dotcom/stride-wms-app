import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Code, 
  Eye, 
  Variable, 
  Save, 
  Send, 
  History,
  Smartphone,
  Monitor,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { 
  CommunicationTemplate, 
  CommunicationDesignElement, 
  CommunicationBrandSettings,
  CommunicationTemplateVersion,
  COMMUNICATION_VARIABLES 
} from '@/hooks/useCommunications';
import { VariablesDrawer } from '@/components/settings/communications/VariablesDrawer';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

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
  const [editorMode, setEditorMode] = useState<'code' | 'preview'>('code');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showVariables, setShowVariables] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<CommunicationTemplateVersion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (template) {
      setSubject(template.subject_template || '');
      setBody(template.body_template || '');
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
    });
    setIsSaving(false);
  };

  const insertVariable = useCallback((variable: string) => {
    setBody(prev => prev + variable);
  }, []);

  const insertDesignElement = useCallback((element: CommunicationDesignElement) => {
    setBody(prev => prev + element.html_snippet);
  }, []);

  const getSampleData = (): Record<string, string> => {
    const data: Record<string, string> = {};
    COMMUNICATION_VARIABLES.forEach(v => {
      data[v.key] = v.sample;
    });
    if (brandSettings) {
      data.brand_logo_url = brandSettings.brand_logo_url || '';
      data.brand_primary_color = brandSettings.brand_primary_color || '#FD5A2A';
      data.brand_support_email = brandSettings.brand_support_email || '';
      data.portal_base_url = brandSettings.portal_base_url || '';
    }
    return data;
  };

  const renderPreview = () => {
    const sampleData = getSampleData();
    let html = body;
    let subjectPreview = subject;
    
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
      subjectPreview = subjectPreview.replace(regex, value);
    });

    return { html, subject: subjectPreview };
  };

  const preview = renderPreview();

  if (!template) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No email template available. Enable email channel for this alert.
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'code' | 'preview')}>
            <TabsList>
              <TabsTrigger value="code" className="gap-2">
                <Code className="h-4 w-4" />
                Code
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {editorMode === 'preview' && (
            <div className="flex items-center gap-1 ml-4">
              <Button
                variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowVariables(true)}>
            <Variable className="h-4 w-4 mr-2" />
            Variables
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
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Subject Line */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium min-w-[60px]">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line..."
            className="flex-1"
          />
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-hidden">
        {editorMode === 'code' ? (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-full font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0"
            placeholder="Enter your HTML template here..."
          />
        ) : (
          <div className="h-full overflow-auto p-4 bg-muted/30">
            <div 
              className={`mx-auto bg-background border rounded-lg shadow-sm overflow-hidden transition-all ${
                previewMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[800px]'
              }`}
            >
              {/* Email Header Preview */}
              <div className="border-b p-4 bg-muted/50">
                <p className="text-sm">
                  <span className="text-muted-foreground">Subject:</span>{' '}
                  <span className="font-medium">{preview.subject}</span>
                </p>
              </div>
              {/* Email Body Preview */}
              <div 
                className="p-4"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Variables Drawer */}
      <VariablesDrawer
        open={showVariables}
        onOpenChange={setShowVariables}
        designElements={designElements}
        onInsertVariable={insertVariable}
        onInsertDesignElement={insertDesignElement}
      />

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
    </div>
  );
}
