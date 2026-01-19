import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Save, Loader2, Variable, Layers, Send, History, Monitor, Smartphone } from 'lucide-react';
import { 
  CommunicationTemplate, 
  CommunicationDesignElement, 
  COMMUNICATION_VARIABLES,
  CommunicationTemplateVersion 
} from '@/hooks/useCommunications';

interface EmailHtmlEditorProps {
  template: CommunicationTemplate | null;
  designElements: CommunicationDesignElement[];
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
  onGetVersions: (templateId: string) => Promise<CommunicationTemplateVersion[]>;
  onRevertVersion: (templateId: string, version: CommunicationTemplateVersion) => Promise<boolean>;
  onSendTest?: () => void;
}

export function EmailHtmlEditor({
  template,
  designElements,
  onUpdateTemplate,
  onGetVersions,
  onRevertVersion,
  onSendTest,
}: EmailHtmlEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [versions, setVersions] = useState<CommunicationTemplateVersion[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setSubject(template.subject_template || '');
      setBody(template.body_template || '');
      loadVersions();
    }
  }, [template]);

  const loadVersions = async () => {
    if (!template) return;
    const vers = await onGetVersions(template.id);
    setVersions(vers);
  };

  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newBody = body.substring(0, start) + text + body.substring(end);
    setBody(newBody);
    
    // Restore cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start + text.length;
        textareaRef.current.selectionEnd = start + text.length;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const insertVariable = (variable: string) => {
    insertAtCursor(`{{${variable}}}`);
  };

  const insertDesignElement = (element: CommunicationDesignElement) => {
    insertAtCursor(element.html_snippet);
  };

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await onUpdateTemplate(template.id, {
        subject_template: subject,
        body_template: body,
      });
      await loadVersions();
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (version: CommunicationTemplateVersion) => {
    if (!template) return;
    await onRevertVersion(template.id, version);
    setSubject(version.subject_template || '');
    setBody(version.body_template);
    await loadVersions();
  };

  // Generate preview HTML with sample data
  const getPreviewHtml = () => {
    let html = body;
    
    // Replace variables with sample data
    COMMUNICATION_VARIABLES.forEach((variable) => {
      const regex = new RegExp(`{{${variable.key}}}`, 'g');
      html = html.replace(regex, variable.sample);
    });
    
    return html;
  };

  const getPreviewSubject = () => {
    let subj = subject;
    COMMUNICATION_VARIABLES.forEach((variable) => {
      const regex = new RegExp(`{{${variable.key}}}`, 'g');
      subj = subj.replace(regex, variable.sample);
    });
    return subj;
  };

  // Group variables by category
  const groupedVariables = COMMUNICATION_VARIABLES.reduce((acc, variable) => {
    if (!acc[variable.group]) acc[variable.group] = [];
    acc[variable.group].push(variable);
    return acc;
  }, {} as Record<string, typeof COMMUNICATION_VARIABLES>);

  // Group design elements by category
  const groupedElements = designElements.reduce((acc, element) => {
    if (!acc[element.category]) acc[element.category] = [];
    acc[element.category].push(element);
    return acc;
  }, {} as Record<string, CommunicationDesignElement[]>);

  if (!template) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Email channel is not enabled for this alert. Enable it to edit the template.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subject Line */}
      <div className="space-y-2">
        <Label htmlFor="subject">Subject Line</Label>
        <Input
          id="subject"
          placeholder="Enter email subject..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="font-mono text-sm"
        />
        {mode === 'preview' && (
          <p className="text-sm text-muted-foreground">
            Preview: <span className="font-medium">{getPreviewSubject()}</span>
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          {/* Insert Variable */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Variable className="mr-2 h-4 w-4" />
                Insert Variable
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto w-72">
              {Object.entries(groupedVariables).map(([group, variables]) => (
                <div key={group}>
                  <DropdownMenuLabel>{group}</DropdownMenuLabel>
                  {variables.map((variable) => (
                    <DropdownMenuItem
                      key={variable.key}
                      onClick={() => insertVariable(variable.key)}
                      className="flex flex-col items-start"
                    >
                      <span className="font-mono text-xs">{`{{${variable.key}}}`}</span>
                      <span className="text-xs text-muted-foreground">{variable.description}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Insert Design Element */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Layers className="mr-2 h-4 w-4" />
                Insert Element
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto">
              {Object.entries(groupedElements).map(([category, elements]) => (
                <div key={category}>
                  <DropdownMenuLabel className="capitalize">{category.replace('_', ' ')}</DropdownMenuLabel>
                  {elements.map((element) => (
                    <DropdownMenuItem
                      key={element.id}
                      onClick={() => insertDesignElement(element)}
                    >
                      {element.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
              ))}
              {Object.keys(groupedElements).length === 0 && (
                <DropdownMenuItem disabled>No design elements available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Send Test */}
          {onSendTest && (
            <Button variant="outline" size="sm" onClick={onSendTest}>
              <Send className="mr-2 h-4 w-4" />
              Send Test
            </Button>
          )}

          {/* Version History */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="mr-2 h-4 w-4" />
                History ({versions.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto w-64">
              <DropdownMenuLabel>Version History</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {versions.length === 0 ? (
                <DropdownMenuItem disabled>No previous versions</DropdownMenuItem>
              ) : (
                versions.map((version) => (
                  <DropdownMenuItem
                    key={version.id}
                    onClick={() => handleRevert(version)}
                  >
                    <div className="flex flex-col">
                      <span>Version {version.version_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit/Preview Toggle */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'edit' | 'preview')}>
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Device Toggle (only in preview mode) */}
          {mode === 'preview' && (
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPreviewDevice('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPreviewDevice('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor / Preview */}
      {mode === 'edit' ? (
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Enter HTML email body..."
          className="min-h-[500px] font-mono text-sm"
        />
      ) : (
        <div className="border rounded-lg bg-background">
          <div className="p-4 border-b bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Preview with sample data. Variables are replaced with example values.
            </p>
          </div>
          <div 
            className={`mx-auto bg-white ${previewDevice === 'mobile' ? 'max-w-[375px]' : 'w-full'}`}
            style={{ transition: 'max-width 0.3s ease' }}
          >
            <iframe
              srcDoc={getPreviewHtml()}
              className="w-full min-h-[500px] border-0"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
