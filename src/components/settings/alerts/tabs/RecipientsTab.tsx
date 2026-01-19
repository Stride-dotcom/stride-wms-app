import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { VariablesTable } from '../VariablesTable';

interface RecipientsTabProps {
  alertId: string;
}

export function RecipientsTab({ alertId }: RecipientsTabProps) {
  const [emailRecipient, setEmailRecipient] = useState('[[account_contact_email]]');
  const [fromEmail, setFromEmail] = useState('[[brand_support_email]]');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Save recipient configuration
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsSaving(false);
  };

  const insertVariable = (variable: string) => {
    // Insert into the focused field or email recipient by default
    const activeElement = document.activeElement as HTMLInputElement;
    if (activeElement?.name === 'fromEmail') {
      setFromEmail(prev => prev + variable);
    } else {
      setEmailRecipient(prev => prev + variable);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Save */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div>
          <h3 className="font-medium">Recipient Configuration</h3>
          <p className="text-sm text-muted-foreground">Configure who receives this alert</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Form Fields */}
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="max-w-2xl space-y-6">
          <div className="space-y-2">
            <Label htmlFor="emailRecipient">Email Recipient</Label>
            <Input
              id="emailRecipient"
              name="emailRecipient"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              placeholder="Enter email address or use a token like [[account_contact_email]]"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use tokens to dynamically send to account contacts, or enter a static email address.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail">From</Label>
            <Input
              id="fromEmail"
              name="fromEmail"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="Enter sender email or use a token"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The email address that will appear as the sender.
            </p>
          </div>
        </div>
      </div>

      {/* Variables Table at bottom */}
      <VariablesTable 
        onInsertVariable={insertVariable}
        filterGroups={['Account', 'Brand']}
      />
    </div>
  );
}
