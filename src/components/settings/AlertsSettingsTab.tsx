import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';

export function AlertsSettingsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alerts
        </CardTitle>
        <CardDescription>
          Configure system alerts and notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Alert settings coming soon.
        </p>
      </CardContent>
    </Card>
  );
}
