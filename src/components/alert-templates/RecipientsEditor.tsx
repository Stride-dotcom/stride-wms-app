import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Save, Loader2 } from 'lucide-react';
import { CommunicationTemplate, CommunicationBrandSettings } from '@/hooks/useCommunications';

interface RecipientsEditorProps {
  emailTemplate: CommunicationTemplate | null;
  smsTemplate: CommunicationTemplate | null;
  brandSettings: CommunicationBrandSettings | null;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
}

export function RecipientsEditor({
  emailTemplate,
  smsTemplate,
  brandSettings,
  onUpdateTemplate,
}: RecipientsEditorProps) {
  const [saving, setSaving] = useState(false);
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);
  const [newTo, setNewTo] = useState('');
  const [newCc, setNewCc] = useState('');
  const [newBcc, setNewBcc] = useState('');

  useEffect(() => {
    if (emailTemplate) {
      setFromName(emailTemplate.from_name || brandSettings?.from_name || '');
      setFromEmail(emailTemplate.from_email || brandSettings?.from_email || '');
    }
    if (smsTemplate) {
      setSmsSenderId(smsTemplate.sms_sender_id || brandSettings?.sms_sender_id || '');
    }
  }, [emailTemplate, smsTemplate, brandSettings]);

  const addRecipient = (type: 'to' | 'cc' | 'bcc') => {
    const newValue = type === 'to' ? newTo : type === 'cc' ? newCc : newBcc;
    if (!newValue.trim()) return;

    const setter = type === 'to' ? setToRecipients : type === 'cc' ? setCcRecipients : setBccRecipients;
    const current = type === 'to' ? toRecipients : type === 'cc' ? ccRecipients : bccRecipients;
    
    setter([...current, newValue.trim()]);
    
    if (type === 'to') setNewTo('');
    else if (type === 'cc') setNewCc('');
    else setNewBcc('');
  };

  const removeRecipient = (type: 'to' | 'cc' | 'bcc', index: number) => {
    const setter = type === 'to' ? setToRecipients : type === 'cc' ? setCcRecipients : setBccRecipients;
    const current = type === 'to' ? toRecipients : type === 'cc' ? ccRecipients : bccRecipients;
    setter(current.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (emailTemplate) {
        await onUpdateTemplate(emailTemplate.id, {
          from_name: fromName || null,
          from_email: fromEmail || null,
        });
      }
      if (smsTemplate) {
        await onUpdateTemplate(smsTemplate.id, {
          sms_sender_id: smsSenderId || null,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Sender</CardTitle>
          <CardDescription>
            Configure the sender information for email notifications. Leave blank to use brand defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                placeholder={brandSettings?.from_name || 'e.g., Stride Logistics'}
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From Email</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder={brandSettings?.from_email || 'e.g., notifications@stride.com'}
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Recipients</CardTitle>
          <CardDescription>
            Add static email recipients. Dynamic recipients are resolved from alert trigger context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* To Recipients */}
          <div className="space-y-2">
            <Label>To Recipients</Label>
            <div className="flex gap-2">
              <Input
                placeholder="email@example.com"
                value={newTo}
                onChange={(e) => setNewTo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRecipient('to')}
              />
              <Button variant="outline" onClick={() => addRecipient('to')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {toRecipients.map((email, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {email}
                  <button onClick={() => removeRecipient('to', idx)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Badge variant="outline" className="text-muted-foreground">
                + Dynamic: Account Contact
              </Badge>
            </div>
          </div>

          {/* CC Recipients */}
          <div className="space-y-2">
            <Label>CC Recipients</Label>
            <div className="flex gap-2">
              <Input
                placeholder="cc@example.com"
                value={newCc}
                onChange={(e) => setNewCc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRecipient('cc')}
              />
              <Button variant="outline" onClick={() => addRecipient('cc')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {ccRecipients.map((email, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {email}
                  <button onClick={() => removeRecipient('cc', idx)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* BCC Recipients */}
          <div className="space-y-2">
            <Label>BCC Recipients</Label>
            <div className="flex gap-2">
              <Input
                placeholder="bcc@example.com"
                value={newBcc}
                onChange={(e) => setNewBcc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRecipient('bcc')}
              />
              <Button variant="outline" onClick={() => addRecipient('bcc')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {bccRecipients.map((email, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {email}
                  <button onClick={() => removeRecipient('bcc', idx)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMS Sender</CardTitle>
          <CardDescription>
            Configure the SMS sender ID for text notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="smsSenderId">SMS Sender ID</Label>
            <Input
              id="smsSenderId"
              placeholder={brandSettings?.sms_sender_id || 'e.g., STRIDE'}
              value={smsSenderId}
              onChange={(e) => setSmsSenderId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Alphanumeric sender ID (max 11 characters) or phone number
            </p>
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
              Save Recipients
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
