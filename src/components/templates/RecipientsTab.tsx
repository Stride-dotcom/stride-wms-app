import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Mail, MessageSquare, Plus, X } from 'lucide-react';
import { CommunicationAlert, CommunicationTemplate } from '@/hooks/useCommunications';
import { useToast } from '@/hooks/use-toast';

interface RecipientsTabProps {
  alert: CommunicationAlert;
  emailTemplate: CommunicationTemplate | undefined;
  smsTemplate: CommunicationTemplate | undefined;
  onUpdateTemplate: (id: string, updates: Partial<CommunicationTemplate>) => Promise<boolean>;
}

export function RecipientsTab({
  alert,
  emailTemplate,
  smsTemplate,
  onUpdateTemplate,
}: RecipientsTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    from_name: '',
    from_email: '',
    to_addresses: [] as string[],
    cc_addresses: [] as string[],
    bcc_addresses: [] as string[],
    sms_sender_id: '',
    sms_recipients: [] as string[],
  });

  const [newEmail, setNewEmail] = useState({ to: '', cc: '', bcc: '', sms: '' });

  useEffect(() => {
    if (emailTemplate) {
      setFormData(prev => ({
        ...prev,
        from_name: emailTemplate.from_name || '',
        from_email: emailTemplate.from_email || '',
      }));
    }
    if (smsTemplate) {
      setFormData(prev => ({
        ...prev,
        sms_sender_id: smsTemplate.sms_sender_id || '',
      }));
    }
  }, [emailTemplate, smsTemplate]);

  const handleAddEmail = (field: 'to_addresses' | 'cc_addresses' | 'bcc_addresses' | 'sms_recipients', key: 'to' | 'cc' | 'bcc' | 'sms') => {
    const value = newEmail[key].trim();
    if (!value) return;
    
    // Basic validation
    if (field !== 'sms_recipients' && !value.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Please enter a valid email address',
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value],
    }));
    setNewEmail(prev => ({ ...prev, [key]: '' }));
  };

  const handleRemoveEmail = (field: 'to_addresses' | 'cc_addresses' | 'bcc_addresses' | 'sms_recipients', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Save email template settings
      if (emailTemplate) {
        await onUpdateTemplate(emailTemplate.id, {
          from_name: formData.from_name || null,
          from_email: formData.from_email || null,
        });
      }
      
      // Save SMS template settings
      if (smsTemplate) {
        await onUpdateTemplate(smsTemplate.id, {
          sms_sender_id: formData.sms_sender_id || null,
        });
      }
      
      toast({
        title: 'Recipients saved',
        description: 'Recipient settings have been updated.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save recipient settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderEmailList = (
    label: string,
    field: 'to_addresses' | 'cc_addresses' | 'bcc_addresses',
    key: 'to' | 'cc' | 'bcc',
    description: string
  ) => (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {formData[field].map((email, index) => (
          <Badge key={index} variant="secondary" className="gap-1 pr-1">
            {email}
            <button
              onClick={() => handleRemoveEmail(field, index)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Enter email address"
          value={newEmail[key]}
          onChange={(e) => setNewEmail(prev => ({ ...prev, [key]: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handleAddEmail(field, key)}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleAddEmail(field, key)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Email Recipients */}
      {alert.channels.email && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Settings
            </CardTitle>
            <CardDescription>
              Configure sender information and email recipients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sender Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from_name">From Name</Label>
                <Input
                  id="from_name"
                  placeholder="e.g., Stride Logistics"
                  value={formData.from_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, from_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_email">From Email</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder="e.g., notifications@stride.com"
                  value={formData.from_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, from_email: e.target.value }))}
                />
              </div>
            </div>

            <div className="border-t pt-6 space-y-6">
              {renderEmailList(
                'To Recipients',
                'to_addresses',
                'to',
                'Primary recipients who will receive this alert. Use variables like {{account_contact_email}} for dynamic recipients.'
              )}
              {renderEmailList(
                'CC Recipients',
                'cc_addresses',
                'cc',
                'Recipients who will be copied on this alert.'
              )}
              {renderEmailList(
                'BCC Recipients',
                'bcc_addresses',
                'bcc',
                'Hidden recipients who will receive a blind copy.'
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SMS Recipients */}
      {alert.channels.sms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS Settings
            </CardTitle>
            <CardDescription>
              Configure SMS sender ID and recipients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="sms_sender">SMS Sender ID</Label>
              <Input
                id="sms_sender"
                placeholder="e.g., STRIDE or +1234567890"
                value={formData.sms_sender_id}
                onChange={(e) => setFormData(prev => ({ ...prev, sms_sender_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Alphanumeric sender ID (max 11 chars) or phone number. Requires Twilio integration.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>SMS Recipients</Label>
                <p className="text-sm text-muted-foreground">
                  Phone numbers that will receive this SMS alert. Use {"{{account_contact_phone}}"} for dynamic recipients.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.sms_recipients.map((phone, index) => (
                  <Badge key={index} variant="secondary" className="gap-1 pr-1">
                    {phone}
                    <button
                      onClick={() => handleRemoveEmail('sms_recipients', index)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter phone number"
                  value={newEmail.sms}
                  onChange={(e) => setNewEmail(prev => ({ ...prev, sms: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmail('sms_recipients', 'sms')}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleAddEmail('sms_recipients', 'sms')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              Save Recipients
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
