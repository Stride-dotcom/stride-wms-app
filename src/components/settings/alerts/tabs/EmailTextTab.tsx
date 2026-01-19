import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Eye, Save, FileText } from 'lucide-react';
import { 
  CommunicationTemplate, 
  COMMUNICATION_VARIABLES 
} from '@/hooks/useCommunications';
import { VariablesTable } from '../VariablesTable';

interface EmailTextTabProps {
  template: CommunicationTemplate | null;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
}

export function EmailTextTab({
  template,
  onUpdateTemplate,
}: EmailTextTabProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setSubject(template.subject_template || '');
      setBody(template.body_template || '');
    }
  }, [template]);

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    await onUpdateTemplate(template.id, {
      subject_template: subject,
      body_template: body,
      body_format: 'text',
    });
    setIsSaving(false);
  };

  const insertVariable = useCallback((variable: string) => {
    setBody(prev => prev + variable);
  }, []);

  const getSampleData = (): Record<string, string> => {
    const data: Record<string, string> = {};
    COMMUNICATION_VARIABLES.forEach(v => {
      data[v.key] = v.sample;
    });
    return data;
  };

  const renderPreview = () => {
    const sampleData = getSampleData();
    let text = body;
    let subjectPreview = subject;
    
    Object.entries(sampleData).forEach(([key, value]) => {
      // Support both {{}} and [[]] syntax
      const regexBraces = new RegExp(`{{${key}}}`, 'g');
      const regexBrackets = new RegExp(`\\[\\[${key}\\]\\]`, 'g');
      text = text.replace(regexBraces, value).replace(regexBrackets, value);
      subjectPreview = subjectPreview.replace(regexBraces, value).replace(regexBrackets, value);
    });

    return { text, subject: subjectPreview };
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
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Plain Text Email</span>
          </div>
          <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'edit' | 'preview')}>
            <TabsList>
              <TabsTrigger value="edit" className="gap-2">
                <Code className="h-4 w-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Subject Line */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium min-w-[60px]">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line..."
            className="flex-1 font-mono"
          />
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {editorMode === 'edit' ? (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-full font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0"
            placeholder="Enter your plain text email content here..."
          />
        ) : (
          <div className="h-full overflow-auto p-4 bg-muted/30">
            <Card className="max-w-[600px] mx-auto">
              <CardHeader className="border-b bg-muted/50">
                <CardTitle className="text-base">
                  <span className="text-muted-foreground font-normal">Subject:</span>{' '}
                  {preview.subject}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {preview.text}
                </pre>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Variables Table at bottom */}
      <VariablesTable onInsertVariable={insertVariable} />
    </div>
  );
}
