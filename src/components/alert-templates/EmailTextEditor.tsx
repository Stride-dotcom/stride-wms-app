import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Save, Loader2, Variable } from 'lucide-react';
import { CommunicationTemplate, COMMUNICATION_VARIABLES } from '@/hooks/useCommunications';

interface EmailTextEditorProps {
  template: CommunicationTemplate | null;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
}

export function EmailTextEditor({ template, onUpdateTemplate }: EmailTextEditorProps) {
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
      setSubject(template.subject_template || '');
      // For text version, we might want to strip HTML or use a separate field
      // For now, we'll use the same body template
      setBody(template.body_template || '');
    }
  }, [template]);

  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newBody = body.substring(0, start) + text + body.substring(end);
    setBody(newBody);
    
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

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await onUpdateTemplate(template.id, {
        subject_template: subject,
        body_template: body,
      });
    } finally {
      setSaving(false);
    }
  };

  // Group variables by category
  const groupedVariables = COMMUNICATION_VARIABLES.reduce((acc, variable) => {
    if (!acc[variable.group]) acc[variable.group] = [];
    acc[variable.group].push(variable);
    return acc;
  }, {} as Record<string, typeof COMMUNICATION_VARIABLES>);

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Plain Text Email</CardTitle>
          <CardDescription>
            The plain text version is shown when HTML emails cannot be displayed. 
            Keep it simple and readable without formatting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subject Line */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
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
          </div>

          {/* Plain Text Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter plain text email body..."
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
