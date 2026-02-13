import { useState, useMemo } from 'react';
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
import { HelpTip } from '@/components/ui/help-tip';
import { CommunicationAlert, CommunicationTemplate, TriggerCatalogEntry, TRIGGER_EVENTS } from '@/hooks/useCommunications';
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

// ---------------------------------------------------------------------------
// Module group display config
// ---------------------------------------------------------------------------

const MODULE_GROUP_ORDER = [
  'shipments', 'tasks', 'claims', 'quotes', 'items',
  'onboarding', 'stocktake', 'billing', 'system',
] as const;

const MODULE_GROUP_LABELS: Record<string, { label: string; icon: string; tooltip: string }> = {
  shipments:  { label: 'Shipments',  icon: 'local_shipping', tooltip: 'Alerts related to inbound/outbound shipments, releases, and receiving.' },
  tasks:      { label: 'Tasks',      icon: 'task_alt',       tooltip: 'Alerts related to tasks, inspections, and assignments.' },
  claims:     { label: 'Claims',     icon: 'gavel',          tooltip: 'Alerts related to claim filing, approval, and resolution.' },
  quotes:     { label: 'Quotes',     icon: 'request_quote',  tooltip: 'Alerts related to repair quotes and estimates.' },
  items:      { label: 'Items',      icon: 'inventory_2',    tooltip: 'Alerts related to inventory items, flags, and location changes.' },
  onboarding: { label: 'Onboarding', icon: 'person_add',     tooltip: 'Alerts when clients create shipments, tasks, or claims via the portal.' },
  stocktake:  { label: 'Stocktake',  icon: 'fact_check',     tooltip: 'Alerts related to stock counts and cycle counts.' },
  billing:    { label: 'Billing',    icon: 'receipt_long',   tooltip: 'Alerts related to billing events, invoices, and payments.' },
  system:     { label: 'System',     icon: 'settings',       tooltip: 'Custom and system-level alerts.' },
};

const AUDIENCE_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; className: string }> = {
  internal: { label: 'Internal',      variant: 'outline',    className: 'text-xs' },
  client:   { label: 'Client-Facing', variant: 'secondary',  className: 'text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  both:     { label: 'Both',          variant: 'secondary',  className: 'text-xs bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
};

const SEVERITY_ICONS: Record<string, { icon: string; className: string }> = {
  info:     { icon: 'info',    className: 'text-blue-500' },
  warn:     { icon: 'warning', className: 'text-amber-500' },
  critical: { icon: 'error',   className: 'text-red-500' },
};

type AudienceFilter = 'all' | 'internal' | 'client' | 'both';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertListProps {
  alerts: CommunicationAlert[];
  templates: CommunicationTemplate[];
  triggerCatalog: TriggerCatalogEntry[];
  tenantId: string;
  onCreateAlert: (alert: Omit<CommunicationAlert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<CommunicationAlert | null>;
  onUpdateAlert: (id: string, updates: Partial<CommunicationAlert>) => Promise<boolean>;
  onDeleteAlert: (id: string) => Promise<boolean>;
  onSelectAlert: (alert: CommunicationAlert) => void;
}

// Enriched alert = tenant alert + catalog metadata
interface EnrichedAlert {
  alert: CommunicationAlert;
  catalog: TriggerCatalogEntry | null;
  moduleGroup: string;
  audience: string;
  severity: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertList({
  alerts,
  templates,
  triggerCatalog,
  tenantId,
  onCreateAlert,
  onUpdateAlert,
  onDeleteAlert,
  onSelectAlert,
}: AlertListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [alertToDelete, setAlertToDelete] = useState<CommunicationAlert | null>(null);
  const [testAlert, setTestAlert] = useState<CommunicationAlert | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const isMobile = useIsMobile();

  // Build catalog lookup by trigger_event key
  const catalogByKey = useMemo(() => {
    const map = new Map<string, TriggerCatalogEntry>();
    for (const entry of triggerCatalog) {
      map.set(entry.key, entry);
    }
    return map;
  }, [triggerCatalog]);

  // Enrich alerts with catalog metadata
  const enrichedAlerts = useMemo((): EnrichedAlert[] => {
    return alerts.map((alert) => {
      const catalog = catalogByKey.get(alert.trigger_event) || null;
      return {
        alert,
        catalog,
        moduleGroup: catalog?.module_group || '_ungrouped',
        audience: catalog?.audience || 'internal',
        severity: catalog?.severity || 'info',
        displayName: catalog?.display_name || alert.name,
      };
    });
  }, [alerts, catalogByKey]);

  // Apply audience filter
  const filteredAlerts = useMemo(() => {
    if (audienceFilter === 'all') return enrichedAlerts;
    return enrichedAlerts.filter((ea) => {
      if (audienceFilter === 'internal') return ea.audience === 'internal' || ea.audience === 'both';
      if (audienceFilter === 'client') return ea.audience === 'client' || ea.audience === 'both';
      return ea.audience === audienceFilter;
    });
  }, [enrichedAlerts, audienceFilter]);

  // Group by module
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, EnrichedAlert[]>();

    // Initialise in display order
    for (const g of MODULE_GROUP_ORDER) {
      groups.set(g, []);
    }
    groups.set('_ungrouped', []);

    for (const ea of filteredAlerts) {
      const g = groups.get(ea.moduleGroup) || groups.get('_ungrouped')!;
      g.push(ea);
    }

    // Remove empty groups
    for (const [key, val] of groups) {
      if (val.length === 0) groups.delete(key);
    }

    return groups;
  }, [filteredAlerts]);

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

  // ─── Audience filter tabs ──────────────────────────────────────────────
  const audienceTabs = (
    <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
      {([
        { key: 'all', label: 'All' },
        { key: 'internal', label: 'Internal' },
        { key: 'client', label: 'Client-Facing' },
      ] as const).map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setAudienceFilter(key)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            audienceFilter === key
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
      <HelpTip tooltip="Internal alerts go to your team (warehouse staff, managers). Client-facing alerts go to your customers' contacts. 'Both' means the alert targets both audiences." />
    </div>
  );

  // ─── Render a single alert row ─────────────────────────────────────────
  const renderAlertRow = (ea: EnrichedAlert) => {
    const { alert, audience, severity } = ea;
    const severityInfo = SEVERITY_ICONS[severity] || SEVERITY_ICONS.info;
    const audienceInfo = AUDIENCE_BADGES[audience] || AUDIENCE_BADGES.internal;

    return (
      <TableRow
        key={alert.id}
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => onSelectAlert(alert)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <MaterialIcon name={severityInfo.icon} size="sm" className={severityInfo.className} />
            <span className="font-medium">{ea.displayName}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={audienceInfo.variant} className={audienceInfo.className}>
            {audienceInfo.label}
          </Badge>
        </TableCell>
        <TableCell>
          <Switch
            checked={alert.is_enabled}
            onCheckedChange={() => {}}
            onClick={(e) => toggleEnabled(e, alert)}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            {alert.channels.email && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <MaterialIcon name="mail" size="sm" />
                Email
              </Badge>
            )}
            {alert.channels.sms && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <MaterialIcon name="chat" size="sm" />
                SMS
              </Badge>
            )}
            {alert.channels.in_app && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <MaterialIcon name="notifications" size="sm" />
                In-App
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {format(new Date(alert.updated_at), 'MMM d, yyyy')}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setTestAlert(alert); }}
              title="Send Test"
            >
              <MaterialIcon name="send" size="sm" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setAlertToDelete(alert); }}
            >
              <MaterialIcon name="delete" size="sm" className="text-destructive" />
            </Button>
            <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground" />
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ─── Render a single mobile card ───────────────────────────────────────
  const renderMobileCard = (ea: EnrichedAlert) => {
    const { alert, audience, severity } = ea;
    const audienceInfo = AUDIENCE_BADGES[audience] || AUDIENCE_BADGES.internal;

    return (
      <MobileDataCard key={alert.id} onClick={() => onSelectAlert(alert)}>
        <MobileDataCardHeader>
          <div className="flex-1 min-w-0">
            <MobileDataCardTitle>{ea.displayName}</MobileDataCardTitle>
            <MobileDataCardDescription>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant={audienceInfo.variant} className={audienceInfo.className}>
                  {audienceInfo.label}
                </Badge>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{alert.key}</code>
              </div>
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
            {alert.channels.in_app && (
              <Badge variant="secondary" className="gap-1">
                <MaterialIcon name="notifications" size="sm" />
                In-App
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
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setTestAlert(alert); }}>
            <MaterialIcon name="send" size="sm" />
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setAlertToDelete(alert); }}>
            <MaterialIcon name="delete" size="sm" className="text-destructive" />
          </Button>
          <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground" />
        </MobileDataCardActions>
      </MobileDataCard>
    );
  };

  // ─── Main render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Alerts</h3>
          <p className="text-sm text-muted-foreground">
            Configure notification alerts and their templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grouped' ? 'flat' : 'grouped')}
            className="gap-1.5"
          >
            <MaterialIcon name={viewMode === 'grouped' ? 'view_list' : 'view_module'} size="sm" />
            {viewMode === 'grouped' ? 'Flat' : 'Grouped'}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <MaterialIcon name="add" size="sm" className="mr-2" />
            <span className="hidden sm:inline">Create Alert</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Audience filter */}
      {audienceTabs}

      {/* Content */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-card">
          {alerts.length === 0
            ? 'No alerts configured. Create your first alert to get started.'
            : 'No alerts match the selected audience filter.'}
        </div>
      ) : viewMode === 'grouped' ? (
        /* ── Grouped view ─────────────────────────────────────────── */
        <div className="space-y-6">
          {Array.from(groupedAlerts.entries()).map(([groupKey, groupAlerts]) => {
            const meta = MODULE_GROUP_LABELS[groupKey];
            const label = meta?.label || 'Ungrouped / Legacy';
            const icon = meta?.icon || 'help_outline';
            const tooltip = meta?.tooltip || 'Alerts that do not yet have a catalog entry. They will continue to work as before.';

            return (
              <div key={groupKey} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <MaterialIcon name={icon} size="sm" className="text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                  <HelpTip tooltip={tooltip} />
                  <Badge variant="outline" className="text-xs ml-auto">{groupAlerts.length}</Badge>
                </div>
                {isMobile ? (
                  <div className="space-y-3">
                    {groupAlerts.map(renderMobileCard)}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Audience</TableHead>
                          <TableHead>Enabled</TableHead>
                          <TableHead>Channels</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupAlerts.map(renderAlertRow)}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat view ────────────────────────────────────────────── */
        isMobile ? (
          <div className="space-y-3">
            {filteredAlerts.map(renderMobileCard)}
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map(renderAlertRow)}
              </TableBody>
            </Table>
          </div>
        )
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
              Are you sure you want to delete &ldquo;{alertToDelete?.name}&rdquo;? This will also delete all associated templates and cannot be undone.
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
