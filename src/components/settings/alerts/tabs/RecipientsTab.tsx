import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, X, Users, Mail, Phone } from 'lucide-react';

interface RecipientsTabProps {
  alertId: string;
}

export function RecipientsTab({ alertId }: RecipientsTabProps) {
  const [recipientType, setRecipientType] = useState<'account' | 'custom' | 'both'>('account');
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [customPhones, setCustomPhones] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [useAccountEmail, setUseAccountEmail] = useState(true);
  const [useAccountPhone, setUseAccountPhone] = useState(true);
  const [useBillingEmail, setUseBillingEmail] = useState(false);

  const addEmail = () => {
    if (newEmail && !customEmails.includes(newEmail)) {
      setCustomEmails([...customEmails, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setCustomEmails(customEmails.filter(e => e !== email));
  };

  const addPhone = () => {
    if (newPhone && !customPhones.includes(newPhone)) {
      setCustomPhones([...customPhones, newPhone]);
      setNewPhone('');
    }
  };

  const removePhone = (phone: string) => {
    setCustomPhones(customPhones.filter(p => p !== phone));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recipient Configuration
          </CardTitle>
          <CardDescription>
            Choose who receives this alert notification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={recipientType} onValueChange={(v) => setRecipientType(v as 'account' | 'custom' | 'both')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="account" id="account" />
              <Label htmlFor="account" className="cursor-pointer">
                Account Contacts Only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="cursor-pointer">
                Custom Recipients Only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both" className="cursor-pointer">
                Both Account Contacts and Custom Recipients
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {(recipientType === 'account' || recipientType === 'both') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Contact Settings</CardTitle>
            <CardDescription>
              Use dynamic variables to send to account contacts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Primary Contact Email</Label>
                <p className="text-xs text-muted-foreground">
                  Uses <code className="bg-muted px-1 rounded">{'{{account_contact_email}}'}</code>
                </p>
              </div>
              <Switch checked={useAccountEmail} onCheckedChange={setUseAccountEmail} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Primary Contact Phone</Label>
                <p className="text-xs text-muted-foreground">
                  Uses <code className="bg-muted px-1 rounded">{'{{account_contact_phone}}'}</code>
                </p>
              </div>
              <Switch checked={useAccountPhone} onCheckedChange={setUseAccountPhone} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Billing Contact Email</Label>
                <p className="text-xs text-muted-foreground">
                  Uses <code className="bg-muted px-1 rounded">{'{{account_billing_contact_email}}'}</code>
                </p>
              </div>
              <Switch checked={useBillingEmail} onCheckedChange={setUseBillingEmail} />
            </div>
          </CardContent>
        </Card>
      )}

      {(recipientType === 'custom' || recipientType === 'both') && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Custom Email Recipients
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                />
                <Button onClick={addEmail} size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {customEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button onClick={() => removeEmail(email)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {customEmails.length === 0 && (
                  <p className="text-sm text-muted-foreground">No custom email recipients added</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Custom Phone Recipients (SMS)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="+1-555-123-4567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPhone()}
                />
                <Button onClick={addPhone} size="icon" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {customPhones.map((phone) => (
                  <Badge key={phone} variant="secondary" className="gap-1">
                    {phone}
                    <button onClick={() => removePhone(phone)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {customPhones.length === 0 && (
                  <p className="text-sm text-muted-foreground">No custom phone recipients added</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button>Save Recipients</Button>
      </div>
    </div>
  );
}
