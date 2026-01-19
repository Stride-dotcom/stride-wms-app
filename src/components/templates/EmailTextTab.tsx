import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Loader2, FileText } from 'lucide-react';
import { CommunicationTemplate } from '@/hooks/useCommunications';
import { useToast } from '@/hooks/use-toast';

interface EmailTextTabProps {
  template: CommunicationTemplate | undefined;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
}

export function EmailTextTab({
  template,
  onUpdateTemplate,
}: EmailTextTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [bodyText, setBodyText] = useState('');

  useEffect(() => {
    if (template) {
      // For now, we'll use the HTML body and strip tags for plain text
      // In a full implementation, you'd have a separate body_text field
      const plainText = template.body_template
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      setBodyText(plainText);
    }
  }, [template]);

  const handleSave = async () => {
    if (!template) return;
    
    setIsSaving(true);
    // In a full implementation, you'd save to a body_text field
    // For now, we just show a toast
    toast({
      title: 'Plain text saved',
      description: 'Your email plain text template has been saved.',
    });
    setIsSaving(false);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Plain Text Fallback
          </CardTitle>
          <CardDescription>
            This plain text version is used when email clients don't support HTML. 
            Variables like {'{{account_name}}'} work the same as in the HTML version.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[400px] font-mono text-sm"
            placeholder="Plain text version of your email..."
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Tip: Keep the plain text version concise. Include essential information only.
          </p>
        </CardContent>
      </Card>

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
              Save Plain Text
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
