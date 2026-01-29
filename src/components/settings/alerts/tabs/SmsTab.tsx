import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { 
  CommunicationTemplate, 
  COMMUNICATION_VARIABLES 
} from '@/hooks/useCommunications';
import { VariablesTable } from '../VariablesTable';
import { SendTestDialog } from '@/components/settings/communications/SendTestDialog';
import { useAuth } from '@/contexts/AuthContext';

interface SmsTabProps {
  template: CommunicationTemplate | null;
  alertId?: string;
  alertName?: string;
  triggerEvent?: string;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
  onCreateTemplate?: (alertId: string, channel: 'email' | 'sms', alertName: string, triggerEvent?: string) => Promise<CommunicationTemplate | null>;
}

const SMS_SEGMENT_LENGTH = 160;
const SMS_SEGMENT_LENGTH_UNICODE = 70;

export function SmsTab({
  template,
  alertId,
  alertName,
  triggerEvent,
  onUpdateTemplate,
  onCreateTemplate,
}: SmsTabProps) {
  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    if (template) {
      setBody(template.body_template || '');
    }
  }, [template]);

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    await onUpdateTemplate(template.id, {
      body_template: body,
      body_format: 'text',
    });
    setIsSaving(false);
  };

  const insertVariable = useCallback((variable: string) => {
    setBody(prev => prev + variable);
  }, []);

  // Check if text contains non-GSM characters (would require Unicode encoding)
  const isUnicode = (text: string) => {
    const gsmChars = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅå_ÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\[\]\\~|€]*$/;
    return !gsmChars.test(text);
  };

  const getCharacterInfo = () => {
    const charCount = body.length;
    const unicode = isUnicode(body);
    const segmentLength = unicode ? SMS_SEGMENT_LENGTH_UNICODE : SMS_SEGMENT_LENGTH;
    const segments = Math.ceil(charCount / segmentLength) || 1;
    const remaining = segmentLength - (charCount % segmentLength || segmentLength);
    
    return { charCount, segments, remaining, unicode, segmentLength };
  };

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
    
    Object.entries(sampleData).forEach(([key, value]) => {
      // Support both {{}} and [[]] syntax
      const regexBraces = new RegExp(`{{${key}}}`, 'g');
      const regexBrackets = new RegExp(`\\[\\[${key}\\]\\]`, 'g');
      text = text.replace(regexBraces, value).replace(regexBrackets, value);
    });

    return text;
  };

  const charInfo = getCharacterInfo();
  const previewText = renderPreview();

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTemplate = async () => {
    if (!alertId || !alertName || !onCreateTemplate) return;
    setIsCreating(true);
    await onCreateTemplate(alertId, 'sms', alertName, triggerEvent);
    setIsCreating(false);
  };

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <MaterialIcon name="chat" size="lg" className="opacity-50" />
        <p>No SMS template available for this alert.</p>
        {onCreateTemplate && alertId && alertName && (
          <Button onClick={handleCreateTemplate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create SMS Template'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MaterialIcon name="chat" size="md" className="text-muted-foreground" />
            <span className="font-medium">SMS Template</span>
          </div>
          <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'edit' | 'preview')}>
            <TabsList>
              <TabsTrigger value="edit" className="gap-2">
                <MaterialIcon name="code" size="sm" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <MaterialIcon name="visibility" size="sm" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTestDialog(true)}>
            <MaterialIcon name="send" size="sm" className="mr-2" />
            Send Test
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <MaterialIcon name="save" size="sm" className="mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Character Counter */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={charInfo.segments > 1 ? 'secondary' : 'outline'}>
              {charInfo.charCount} / {charInfo.segmentLength} chars
            </Badge>
            <Badge variant={charInfo.segments > 3 ? 'destructive' : 'secondary'}>
              {charInfo.segments} segment{charInfo.segments !== 1 ? 's' : ''}
            </Badge>
          </div>
          {charInfo.unicode && (
            <div className="flex items-center gap-1 text-yellow-600 text-sm">
              <MaterialIcon name="error" size="sm" />
              <span>Unicode detected (shorter segments)</span>
            </div>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {charInfo.remaining} characters remaining in segment
        </span>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {editorMode === 'edit' ? (
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-full min-h-[200px] font-mono text-sm resize-none"
            placeholder="Enter your SMS message here..."
          />
        ) : (
          <div className="flex justify-center">
            {/* iPhone-style SMS Preview */}
            <div className="w-[320px]">
              <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-xl">
                <div className="bg-background rounded-[2rem] overflow-hidden">
                  {/* Status Bar */}
                  <div className="h-6 bg-muted flex items-center justify-center">
                    <div className="w-20 h-1 bg-muted-foreground/30 rounded-full" />
                  </div>
                  
                  {/* Header */}
                  <div className="bg-muted/50 p-3 border-b">
                    <p className="text-center font-medium text-sm">Messages</p>
                  </div>
                  
                  {/* Message Area */}
                  <div className="min-h-[300px] p-4 bg-background">
                    {previewText ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2">
                          <p className="text-sm whitespace-pre-wrap">{previewText}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground text-sm">
                        Enter a message to see preview
                      </p>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="border-t p-2">
                    <div className="bg-muted rounded-full px-4 py-2 text-muted-foreground text-sm">
                      iMessage
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Segment Info */}
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  This message will be sent as <strong>{charInfo.segments}</strong> SMS segment{charInfo.segments !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Variables Table at bottom */}
      <div className="flex-shrink-0">
        <VariablesTable onInsertVariable={insertVariable} />
      </div>

      {/* Send Test Dialog */}
      {profile?.tenant_id && (
        <SendTestDialog
          open={showTestDialog}
          onOpenChange={setShowTestDialog}
          tenantId={profile.tenant_id}
          channel="sms"
          bodyText={body}
        />
      )}
    </div>
  );
}
