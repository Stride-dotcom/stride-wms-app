import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { CommunicationAlert, CommunicationTemplate, TRIGGER_EVENTS } from '@/hooks/useCommunications';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TestSendDialog } from './TestSendDialog';

interface AlertEditorHeaderProps {
  alert: CommunicationAlert;
  emailTemplate: CommunicationTemplate | null;
  smsTemplate: CommunicationTemplate | null;
  onBack: () => void;
  onUpdateAlert: (id: string, updates: Partial<CommunicationAlert>) => Promise<boolean>;
  onDeleteAlert: (id: string) => Promise<boolean>;
}

export function AlertEditorHeader({
  alert,
  emailTemplate,
  smsTemplate,
  onBack,
  onUpdateAlert,
  onDeleteAlert,
}: AlertEditorHeaderProps) {
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const toggleEnabled = async () => {
    await onUpdateAlert(alert.id, { is_enabled: !alert.is_enabled });
  };

  const toggleChannel = async (channel: 'email' | 'sms') => {
    const newChannels = {
      ...alert.channels,
      [channel]: !alert.channels[channel],
    };
    await onUpdateAlert(alert.id, { channels: newChannels });
  };

  const handleDelete = async () => {
    await onDeleteAlert(alert.id);
    onBack();
  };

  const triggerLabel = TRIGGER_EVENTS.find(e => e.value === alert.trigger_event)?.label || alert.trigger_event;

  return (
    <div className="border-b bg-card">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <MaterialIcon name="arrow_back" size="md" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{alert.name}</h2>
              <Badge variant="outline">
                <code className="text-xs">{alert.key}</code>
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Trigger: {triggerLabel}
              {alert.description && ` • ${alert.description}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Enabled</span>
            <Switch checked={alert.is_enabled} onCheckedChange={toggleEnabled} />
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={alert.channels.email}
                onCheckedChange={() => toggleChannel('email')}
              />
              <MaterialIcon name="mail" size="sm" />
              <span className="text-sm">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={alert.channels.sms}
                onCheckedChange={() => toggleChannel('sms')}
              />
              <MaterialIcon name="chat" size="sm" />
              <span className="text-sm">SMS</span>
            </label>
          </div>

          <div className="h-6 w-px bg-border" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestDialogOpen(true)}
            className="gap-2"
          >
            <MaterialIcon name="send" size="sm" />
            <span className="hidden sm:inline">Test Send</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <MaterialIcon name="delete" size="sm" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Alert</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{alert.name}"? This will also delete all associated templates and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <TestSendDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        alertName={alert.name}
        emailEnabled={alert.channels.email}
        smsEnabled={alert.channels.sms}
        emailTemplate={emailTemplate}
        smsTemplate={smsTemplate}
      />
    </div>
  );
}
