import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CommunicationAlert, TRIGGER_EVENTS } from '@/hooks/useCommunications';
import { Bell, Zap } from 'lucide-react';

interface TemplateEditHeaderProps {
  alert: CommunicationAlert;
}

export function TemplateEditHeader({ alert }: TemplateEditHeaderProps) {
  const triggerEvent = TRIGGER_EVENTS.find(e => e.value === alert.trigger_event);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{alert.name}</h1>
              {alert.description && (
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:ml-auto">
            <Badge variant={alert.is_enabled ? 'default' : 'secondary'}>
              {alert.is_enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Zap className="h-3 w-3" />
              {triggerEvent?.label || alert.trigger_event}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
