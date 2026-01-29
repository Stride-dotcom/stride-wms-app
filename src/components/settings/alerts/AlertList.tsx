import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { CommunicationAlert, CommunicationTemplate, TRIGGER_EVENTS } from '@/hooks/useCommunications';
import { format } from 'date-fns';
import { CreateAlertDialog } from './CreateAlertDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardDescription,
  MobileDataCardContent,
  MobileDataCardActions,
} from '@/components/ui/mobile-data-card';
import { SendTestDialog } from '@/components/settings/communications/SendTestDialog';

interface AlertListProps {
  alerts: CommunicationAlert[];
  templates: CommunicationTemplate[];
  tenantId: string;
  onCreateAlert: (alert: Omit<CommunicationAlert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<CommunicationAlert | null>;
  onUpdateAlert: (id: string, updates: Partial<CommunicationAlert>) => Promise<boolean>;
  onDeleteAlert: (id: string) => Promise<boolean>;
  onSelectAlert: (alert: CommunicationAlert) => void;
}

export function AlertList({
  alerts,
  templates,
  tenantId,
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
  onSelectAlert,
}: AlertListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState<CommunicationAlert | null>(null);
  const [testAlert, setTestAlert] = useState<CommunicationAlert | null>(null);
  const isMobile = useIsMobile();

  const getTemplateForAlert = (alertId: string, channel: 'email' | 'sms') => {
    return templates.find(t => t.alert_id === alertId && t.channel === channel);
  };

  const handleDeleteAlert = async () => {
    if (!alertToDelete) return;
    await onDeleteAlert(alertToDelete.id);
    setAlertToDelete(null);
  };

  const toggleEnabled = async (e: React.MouseEvent, alert: CommunicationAlert) => {
    e.stopPropagation();
    await onUpdateAlert(alert.id, { is_enabled: !alert.is_enabled });
  };

  const getTriggerLabel = (triggerEvent: string) => {
    return TRIGGER_EVENTS.find(e => e.value === triggerEvent)?.label || triggerEvent;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Alerts</h3>
          <p className="text-sm text-muted-foreground">
            Configure notification alerts and their templates
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <MaterialIcon name="add" size="sm" className="mr-2" />
          <span className="hidden sm:inline">Create Alert</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {isMobile ? (
        // Mobile card layout
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card">
              No alerts configured. Create your first alert to get started.
            </div>
          ) : (
            alerts.map((alert) => (
              <MobileDataCard key={alert.id} onClick={() => onSelectAlert(alert)}>
                <MobileDataCardHeader>
                  <div className="flex-1 min-w-0">
                    <MobileDataCardTitle>{alert.name}</MobileDataCardTitle>
                    <MobileDataCardDescription>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{alert.key}</code>
                    </MobileDataCardDescription>
                  </div>
                  <Switch
                    checked={alert.is_enabled}
                    onCheckedChange={() => {}}
                    onClick={(e) => toggleEnabled(e, alert)}
                  />
                </MobileDataCardHeader>
                <MobileDataCardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    {alert.channels.email && (
                      <Badge variant="secondary" className="gap-1">
                        <MaterialIcon name="mail" size="sm" />
                        Email
                      </Badge>
                    )}
                    {alert.channels.sms && (
                      <Badge variant="secondary" className="gap-1">
                        <MaterialIcon name="chat" size="sm" />
                        SMS
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {getTriggerLabel(alert.trigger_event)}
                    </Badge>
                  </div>
                </MobileDataCardContent>
                <MobileDataCardActions>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(alert.updated_at), 'MMM d, yyyy')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTestAlert(alert);
                    }}
                  >
                    <MaterialIcon name="send" size="sm" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlertToDelete(alert);
                    }}
                  >
                    <MaterialIcon name="delete" size="sm" className="text-destructive" />
                  </Button>
                  <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground" />
                </MobileDataCardActions>
              </MobileDataCard>
            ))
          )}
        </div>
      ) : (
        // Desktop table layout
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Trigger Event</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No alerts configured. Create your first alert to get started.
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert) => (
                  <TableRow 
                    key={alert.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectAlert(alert)}
                  >
                    <TableCell className="font-medium">{alert.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{alert.key}</code>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={alert.is_enabled}
                        onCheckedChange={() => {}}
                        onClick={(e) => toggleEnabled(e, alert)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {alert.channels.email && (
                          <Badge variant="secondary" className="gap-1">
                            <MaterialIcon name="mail" size="sm" />
                            Email
                          </Badge>
                        )}
                        {alert.channels.sms && (
                          <Badge variant="secondary" className="gap-1">
                            <MaterialIcon name="chat" size="sm" />
                            SMS
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTriggerLabel(alert.trigger_event)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(alert.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTestAlert(alert);
                          }}
                          title="Send Test"
                        >
                          <MaterialIcon name="send" size="sm" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlertToDelete(alert);
                          }}
                        >
                          <MaterialIcon name="delete" size="sm" className="text-destructive" />
                        </Button>
                        <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateAlertDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateAlert={onCreateAlert}
      />

      <AlertDialog open={!!alertToDelete} onOpenChange={() => setAlertToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{alertToDelete?.name}"? This will also delete all associated templates and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAlert} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Test Dialog */}
      {testAlert && (
        <SendTestDialog
          open={!!testAlert}
          onOpenChange={(open) => !open && setTestAlert(null)}
          tenantId={tenantId}
          channel={testAlert.channels.email ? 'email' : 'sms'}
          subject={getTemplateForAlert(testAlert.id, 'email')?.subject_template || ''}
          bodyHtml={getTemplateForAlert(testAlert.id, 'email')?.body_template || ''}
          bodyText={getTemplateForAlert(testAlert.id, 'sms')?.body_template || ''}
        />
      )}
    </div>
  );
}
