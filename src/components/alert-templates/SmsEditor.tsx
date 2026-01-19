import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
import { Save, Loader2, Variable, MessageSquare } from 'lucide-react';
import { CommunicationTemplate, COMMUNICATION_VARIABLES } from '@/hooks/useCommunications';

interface SmsEditorProps {
  template: CommunicationTemplate | null;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
}

const SMS_CHAR_LIMIT = 160;
const SMS_CONCAT_LIMIT = 153; // Characters per segment for concatenated SMS

export function SmsEditor({ template, onUpdateTemplate }: SmsEditorProps) {
  const [saving, setSaving] = useState(false);
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (template) {
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
        body_template: body,
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate character count and segments
  const charCount = body.length;
  const segments = charCount <= SMS_CHAR_LIMIT ? 1 : Math.ceil(charCount / SMS_CONCAT_LIMIT);
  const isOverLimit = charCount > SMS_CHAR_LIMIT;

  // Generate preview with sample data
  const getPreviewText = () => {
    let text = body;
    COMMUNICATION_VARIABLES.forEach((variable) => {
      const regex = new RegExp(`{{${variable.key}}}`, 'g');
      text = text.replace(regex, variable.sample);
    });
    return text;
  };

  // Group variables by category (only non-HTML ones for SMS)
  const smsVariables = COMMUNICATION_VARIABLES.filter(v => 
    !v.key.includes('_html') && !v.key.includes('_table')
  );
  
  const groupedVariables = smsVariables.reduce((acc, variable) => {
    if (!acc[variable.group]) acc[variable.group] = [];
    acc[variable.group].push(variable);
    return acc;
  }, {} as Record<string, typeof COMMUNICATION_VARIABLES>);

  if (!template) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          SMS channel is not enabled for this alert. Enable it to edit the template.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle>SMS Message</CardTitle>
            <CardDescription>
              Keep SMS messages concise. Standard SMS is 160 characters.
              Longer messages are split into multiple segments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {/* SMS Body */}
            <div className="space-y-2">
              <Label htmlFor="smsBody">Message Body</Label>
              <Textarea
                id="smsBody"
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter SMS message..."
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            {/* Character Count */}
            <div className="flex items-center justify-between text-sm">
              <div className={`${isOverLimit ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {charCount} characters ({segments} segment{segments !== 1 ? 's' : ''})
              </div>
              {isOverLimit && (
                <div className="text-amber-600 text-xs">
                  Message will be split into multiple segments
                </div>
              )}
            </div>

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
                    Save SMS
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Phone Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Phone Preview
            </CardTitle>
            <CardDescription>
              Preview how the SMS will appear on a mobile device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto max-w-[280px]">
              {/* Phone Frame */}
              <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-xl">
                <div className="bg-gray-800 rounded-[2rem] p-2">
                  {/* Screen */}
                  <div className="bg-white rounded-[1.5rem] overflow-hidden">
                    {/* Status Bar */}
                    <div className="bg-gray-100 px-4 py-2 flex justify-between items-center text-xs text-gray-600">
                      <span>9:41</span>
                      <div className="flex items-center gap-1">
                        <span>📶</span>
                        <span>🔋</span>
                      </div>
                    </div>
                    
                    {/* Message Header */}
                    <div className="bg-gray-100 px-4 py-3 border-b">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <p className="text-sm font-medium mt-1">STRIDE</p>
                      </div>
                    </div>

                    {/* Message Content */}
                    <div className="p-4 min-h-[200px] bg-gray-50">
                      <div className="inline-block max-w-[85%] bg-gray-200 rounded-2xl rounded-tl-sm px-4 py-2">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                          {getPreviewText() || 'Your SMS message will appear here...'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-2">
                        Just now
                      </p>
                    </div>

                    {/* Input Area */}
                    <div className="bg-white border-t px-4 py-3 flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-400">
                        iMessage
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Character info */}
              <p className="text-center text-xs text-muted-foreground mt-4">
                Preview shows variables replaced with sample data
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
