import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CommunicationAlert, TRIGGER_EVENTS } from '@/hooks/useCommunications';

interface AlertTemplateHeaderProps {
  alert: CommunicationAlert;
  onUpdateAlert: (id: string, updates: Partial<CommunicationAlert>) => Promise<boolean>;
}

export function AlertTemplateHeader({ alert, onUpdateAlert }: AlertTemplateHeaderProps) {
  const navigate = useNavigate();

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

  const triggerLabel = TRIGGER_EVENTS.find(e => e.value === alert.trigger_event)?.label || alert.trigger_event;

  return (
    <div className="border-b bg-card">
      <div className="container py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/settings?tab=communications')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Alerts
        </Button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{alert.name}</h1>
              <Badge variant={alert.is_enabled ? 'default' : 'secondary'}>
                {alert.is_enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            {alert.description && (
              <p className="text-muted-foreground mt-1">{alert.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{triggerLabel}</Badge>
              <code className="text-xs bg-muted px-2 py-1 rounded">{alert.key}</code>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Enabled</span>
              <Switch checked={alert.is_enabled} onCheckedChange={toggleEnabled} />
            </div>
            
            <div className="flex items-center gap-4 border-l pl-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={alert.channels.email}
                  onCheckedChange={() => toggleChannel('email')}
                />
                <Mail className="h-4 w-4" />
                <span className="text-sm">Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={alert.channels.sms}
                  onCheckedChange={() => toggleChannel('sms')}
                />
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm">SMS</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
