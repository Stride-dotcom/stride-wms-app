import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import { CommunicationAlert, CommunicationTemplate, COMMUNICATION_VARIABLES } from '@/hooks/useCommunications';
import { useToast } from '@/hooks/use-toast';

interface SmsTabProps {
  alert: CommunicationAlert;
  template: CommunicationTemplate | undefined;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
}

export function SmsTab({
  alert,
  template,
  onUpdateTemplate,
}: SmsTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [bodyTemplate, setBodyTemplate] = useState('');

  useEffect(() => {
    if (template) {
      setBodyTemplate(template.body_template || '');
    }
  }, [template]);

  const handleSave = async () => {
    if (!template) return;
    
    setIsSaving(true);
    const success = await onUpdateTemplate(template.id, {
      body_template: bodyTemplate,
    });
    
    if (success) {
      toast({
        title: 'SMS template saved',
        description: 'Your SMS template has been saved.',
      });
    }
    setIsSaving(false);
  };

  const characterCount = bodyTemplate.length;
  const segmentCount = Math.ceil(characterCount / 160) || 1;
  const isOverLimit = characterCount > 480; // 3 segments max recommended

  const renderPreview = () => {
    if (!bodyTemplate) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
          No message content
        </div>
      );
    }

    // Replace variables with sample data
    let text = bodyTemplate;
    COMMUNICATION_VARIABLES.forEach(v => {
      text = text.replace(new RegExp(`{{${v.key}}}`, 'g'), v.sample);
    });

    return (
      <div className="bg-[#007AFF] text-white rounded-2xl rounded-tl-sm p-3 max-w-[85%] text-sm whitespace-pre-wrap">
        {text}
      </div>
    );
  };

  if (!alert.channels.sms) {
    return (
      <Card className="flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">SMS is disabled for this alert.</p>
          <p className="text-sm text-muted-foreground">
            Enable SMS in the Alerts tab to configure SMS templates.
          </p>
        </div>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-muted-foreground">No SMS template found for this alert.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS Message
            </CardTitle>
            <CardDescription>
              Compose your SMS message. Use variables like {'{{account_name}}'} for dynamic content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="min-h-[200px] font-mono text-sm resize-none"
              placeholder="Your SMS message with {{variables}}..."
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
            />

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {characterCount} characters
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={isOverLimit ? 'destructive' : 'secondary'}>
                  {segmentCount} SMS segment{segmentCount !== 1 ? 's' : ''}
                </Badge>
                {isOverLimit && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Too long
                  </span>
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Tips:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Keep messages under 160 characters for 1 segment</li>
                <li>Each additional 153 chars adds a segment (GSM encoding)</li>
                <li>Emoji and special chars may use more characters</li>
                <li>3+ segments significantly increases cost</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-sm">Phone Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="w-full max-w-[280px] mx-auto rounded-[32px] bg-[#111111] p-3 shadow-xl">
              <div className="rounded-[24px] bg-white overflow-hidden">
                <div className="bg-muted p-2 text-center text-xs font-medium border-b">
                  Messages
                </div>
                <div className="p-3 min-h-[200px] bg-[#f3f4f6]">
                  {renderPreview()}
                  <div className="text-xs text-muted-foreground text-center mt-2">
                    Now
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Common Variables */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Common SMS Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['account_name', 'shipment_number', 'task_number', 'item_id', 'items_count', 'task_due_date'].map(key => (
              <Badge
                key={key}
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => setBodyTemplate(prev => prev + `{{${key}}}`)}
              >
                {`{{${key}}}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save SMS Template
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
