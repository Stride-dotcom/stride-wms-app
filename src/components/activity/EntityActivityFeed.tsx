/**
 * EntityActivityFeed - Reusable activity timeline for shipments, tasks, and accounts.
 * For shipments, aggregates data from multiple sources (activity table, audit log,
 * billing events, receiving sessions, photos) for a comprehensive timeline.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import type { ActivityEntityType } from '@/lib/activity/logActivity';

interface ActivityRow {
  id: string;
  actor_name: string | null;
  event_type: string;
  event_label: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface EntityActivityFeedProps {
  entityType: Exclude<ActivityEntityType, 'item'>;
  entityId: string;
  title?: string;
  description?: string;
}

const TABLE_MAP: Record<string, { table: string; idColumn: string }> = {
  shipment: { table: 'shipment_activity', idColumn: 'shipment_id' },
  task:     { table: 'task_activity',     idColumn: 'task_id' },
  account:  { table: 'account_activity',  idColumn: 'account_id' },
};

function getEventIcon(eventType: string): string {
  if (eventType.includes('photo')) return 'photo_camera';
  if (eventType.includes('created') || eventType.includes('creation')) return 'add_circle';
  if (eventType.includes('receiving') || eventType.includes('session')) return 'assignment_turned_in';
  if (eventType.includes('invoiced') || eventType.includes('billing')) return 'receipt_long';
  if (eventType.includes('updated') || eventType.includes('edited') || eventType.includes('field')) return 'edit';
  if (eventType.includes('voided') || eventType.includes('uninvoiced')) return 'undo';
  if (eventType.includes('cancel')) return 'block';
  if (eventType.includes('status') || eventType.includes('reassign')) return 'swap_horiz';
  if (eventType.includes('assigned') || eventType.includes('account')) return 'person';
  if (eventType.includes('completed') || eventType.includes('shipped')) return 'check_circle';
  if (eventType.includes('charge') || eventType.includes('credit') || eventType.includes('billing_charge')) return 'attach_money';
  if (eventType.includes('received') || eventType.includes('scanned') || eventType.includes('pull') || eventType.includes('release')) return 'qr_code_scanner';
  if (eventType.includes('item_added')) return 'inventory_2';
  if (eventType.includes('partial')) return 'content_cut';
  return 'history';
}

function getEventColor(eventType: string): string {
  if (eventType.includes('created') || eventType.includes('creation'))
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (eventType.includes('photo'))
    return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
  if (eventType.includes('receiving') || eventType.includes('session'))
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (eventType.includes('invoiced') && !eventType.includes('uninvoiced'))
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (eventType.includes('uninvoiced') || eventType.includes('voided') || eventType.includes('cancel'))
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (eventType.includes('updated') || eventType.includes('edited'))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  if (eventType.includes('completed') || eventType.includes('shipped'))
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (eventType.includes('charge') || eventType.includes('credit') || eventType.includes('billing_charge'))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
  if (eventType.includes('pull') || eventType.includes('release') || eventType.includes('scan'))
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
  if (eventType.includes('item'))
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  if (eventType.includes('status') || eventType.includes('reassign'))
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

function getEventCategory(eventType: string): string {
  if (eventType.includes('invoice') || eventType.includes('billing') || eventType.includes('charge') || eventType.includes('credit')) return 'billing';
  if (eventType.includes('status') || eventType.includes('completed') || eventType.includes('assigned') || eventType.includes('cancel') || eventType.includes('shipped')) return 'status';
  if (eventType.includes('receiving') || eventType.includes('session') || eventType.includes('pull') || eventType.includes('release') || eventType.includes('scan')) return 'operations';
  if (eventType.includes('photo')) return 'media';
  if (eventType.includes('item')) return 'items';
  return 'update';
}

function ActivityDetailsDisplay({ details }: { details: Record<string, unknown> }) {
  const [isOpen, setIsOpen] = useState(false);

  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-1 p-1 h-auto text-xs text-muted-foreground hover:text-foreground">
          <MaterialIcon name="info" className="text-[12px] mr-1" />
          {isOpen ? 'Hide' : 'View'} details
          <MaterialIcon name={isOpen ? 'expand_less' : 'expand_more'} className="text-[12px] ml-1" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 p-2 bg-background rounded border text-xs space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{key.replace(/_/g, ' ')}:</span>
              <span className="font-medium text-right truncate max-w-[200px]">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * For shipments, fetches activity from multiple sources to build a comprehensive timeline.
 */
async function fetchShipmentComprehensiveActivity(shipmentId: string): Promise<ActivityRow[]> {
  const allRows: ActivityRow[] = [];

  // 1. Fetch from shipment_activity table (if it exists)
  try {
    const { data: activityData, error: activityError } = await (supabase as any)
      .from('shipment_activity')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!activityError && activityData) {
      for (const row of activityData) {
        allRows.push({
          id: row.id,
          actor_name: row.actor_name || null,
          event_type: row.event_type,
          event_label: row.event_label,
          details: row.details || {},
          created_at: row.created_at,
        });
      }
    }
  } catch {
    // Table may not exist yet - continue
  }

  // 2. Fetch shipment creation/status info
  try {
    const { data: shipment } = await supabase
      .from('shipments')
      .select('id, shipment_number, status, shipment_type, created_at, received_at, completed_at, created_by')
      .eq('id', shipmentId)
      .single();

    if (shipment) {
      const s = shipment as any;

      // Resolve creator name separately
      let creatorName: string | null = null;
      if (s.created_by) {
        try {
          const { data: creator } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', s.created_by)
            .single();
          if (creator) creatorName = `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || null;
        } catch { /* ignore */ }
      }

      allRows.push({
        id: 'shipment-created',
        actor_name: creatorName,
        event_type: 'shipment_created',
        event_label: `${(s.shipment_type || '').replace('_', ' ')} shipment ${s.shipment_number} created`,
        details: { type: s.shipment_type },
        created_at: s.created_at,
      });

      if (s.received_at) {
        allRows.push({
          id: 'shipment-received',
          actor_name: null,
          event_type: 'status_completed',
          event_label: 'Receiving completed',
          details: {},
          created_at: s.received_at,
        });
      }

      if (s.completed_at && s.completed_at !== s.received_at) {
        allRows.push({
          id: 'shipment-completed',
          actor_name: null,
          event_type: 'status_shipped',
          event_label: 'Shipment completed',
          details: {},
          created_at: s.completed_at,
        });
      }

      if (s.status === 'cancelled') {
        allRows.push({
          id: 'shipment-cancelled',
          actor_name: null,
          event_type: 'status_cancelled',
          event_label: 'Shipment cancelled',
          details: {},
          created_at: s.created_at,
        });
      }
    }
  } catch (err) {
    console.error('[EntityActivityFeed] shipment info fetch failed:', err);
  }

  // 3. Fetch billing events
  try {
    const { data: billingEvents } = await supabase
      .from('billing_events')
      .select('id, event_type, charge_type, description, total_amount, created_at')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false });

    if (billingEvents) {
      for (const b of billingEvents as any[]) {
        allRows.push({
          id: `billing-${b.id}`,
          actor_name: null,
          event_type: b.charge_type === 'CREDIT' ? 'billing_credit' : 'billing_charge_added',
          event_label: `${b.description || b.event_type} ${b.total_amount != null ? `$${Number(b.total_amount).toFixed(2)}` : ''}`,
          details: { charge_type: b.charge_type, amount: b.total_amount },
          created_at: b.created_at,
        });
      }
    }
  } catch (err) {
    console.error('[EntityActivityFeed] billing_events fetch failed:', err);
  }

  // 4. Fetch receiving sessions
  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('receiving_sessions')
      .select('id, started_at, finished_at, started_by')
      .eq('shipment_id', shipmentId)
      .order('started_at', { ascending: false });

    if (sessionsError) {
      console.error('[EntityActivityFeed] receiving_sessions query error:', sessionsError);
    }

    if (sessions) {
      // Batch resolve session user names
      const sessionUserIds = [...new Set(sessions.map((s: any) => s.started_by).filter(Boolean))] as string[];
      const sessionUserMap = new Map<string, string>();
      if (sessionUserIds.length > 0) {
        try {
          const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', sessionUserIds);
          if (users) {
            for (const u of users) sessionUserMap.set(u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim());
          }
        } catch { /* ignore */ }
      }

      for (const session of sessions as any[]) {
        const userName = session.started_by ? (sessionUserMap.get(session.started_by) || null) : null;
        allRows.push({
          id: `session-start-${session.id}`,
          actor_name: userName,
          event_type: 'receiving_session_started',
          event_label: 'Receiving session started',
          details: {},
          created_at: session.started_at,
        });

        if (session.finished_at) {
          allRows.push({
            id: `session-end-${session.id}`,
            actor_name: userName,
            event_type: 'receiving_session_completed',
            event_label: 'Receiving session completed',
            details: {},
            created_at: session.finished_at,
          });
        }
      }
    }
  } catch (err) {
    console.error('[EntityActivityFeed] receiving_sessions fetch failed:', err);
  }

  // 5. Fetch photos
  try {
    const { data: photos, error: photosError } = await (supabase as any)
      .from('photos')
      .select('id, created_at, uploaded_by')
      .eq('entity_type', 'shipment')
      .eq('entity_id', shipmentId)
      .order('created_at', { ascending: false });

    if (photosError && photosError.code !== '42P01') {
      console.error('[EntityActivityFeed] photos query error:', photosError);
    }

    if (photos && photos.length > 0) {
      // Batch resolve uploader names
      const uploaderIds = [...new Set(photos.map((p: any) => p.uploaded_by).filter(Boolean))] as string[];
      const uploaderMap = new Map<string, string>();
      if (uploaderIds.length > 0) {
        try {
          const { data: uploaders } = await supabase.from('users').select('id, first_name, last_name').in('id', uploaderIds);
          if (uploaders) {
            for (const u of uploaders) uploaderMap.set(u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim());
          }
        } catch { /* ignore */ }
      }

      for (const photo of photos) {
        allRows.push({
          id: `photo-${photo.id}`,
          actor_name: photo.uploaded_by ? (uploaderMap.get(photo.uploaded_by) || null) : null,
          event_type: 'photo_added',
          event_label: 'Photo uploaded',
          details: {},
          created_at: photo.created_at,
        });
      }
    }
  } catch (err) {
    console.error('[EntityActivityFeed] photos fetch failed:', err);
  }

  // 6. Fetch audit log entries (scans, overrides, partial releases, status changes)
  try {
    // First, fetch audit entries without the actor join (more reliable)
    const { data: auditEntries, error: auditError } = await (supabase as any)
      .from('admin_audit_log')
      .select('id, action, changes_json, created_at, actor_id')
      .eq('entity_type', 'shipment')
      .eq('entity_id', shipmentId)
      .order('created_at', { ascending: false });

    if (auditError) {
      console.error('[EntityActivityFeed] audit_log query error:', auditError);
    }

    if (auditEntries && auditEntries.length > 0) {
      // Batch-resolve actor names
      const actorIds = [...new Set(auditEntries.map((e: any) => e.actor_id).filter(Boolean))] as string[];
      const actorNameMap = new Map<string, string>();

      if (actorIds.length > 0) {
        try {
          const { data: actors } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', actorIds);
          if (actors) {
            for (const a of actors) {
              actorNameMap.set(a.id, `${a.first_name || ''} ${a.last_name || ''}`.trim());
            }
          }
        } catch {
          // Actor name resolution is optional
        }
      }

      for (const entry of auditEntries) {
        const action = String(entry.action || 'audit_event');

        let label = '';
        const changes = entry.changes_json || {};
        if (entry.action === 'account_reassigned') {
          const fromName = changes.previous_account_name || 'Unknown';
          const toName = changes.new_account_name || 'Unknown';
          label = `Account changed from "${fromName}" to "${toName}"`;
        } else if (entry.action === 'status_changed') {
          const actionNote = changes.action || '';
          const prevStatus = changes.previous_status || 'unknown';
          const newStatus = changes.new_status || 'unknown';
          label = actionNote || `Status changed from ${prevStatus} to ${newStatus}`;
        } else if (entry.action === 'pull_manual_override') {
          label = 'Item manually marked as pulled';
        } else if (entry.action === 'release_manual_override') {
          label = 'Item manually marked as released';
        } else if (entry.action === 'pull_scan_success') {
          label = 'Item scanned and pulled to dock';
        } else if (entry.action === 'release_scan_success') {
          label = 'Item scanned and released';
        } else if (entry.action === 'scan_invalid') {
          label = `Invalid scan: ${changes.message || 'wrong item'}`;
        } else if (entry.action === 'scan_duplicate') {
          label = `Duplicate scan: item already ${changes.message || 'processed'}`;
        } else if (entry.action === 'partial_release') {
          label = `Partial release: ${changes.removed_items?.length || 0} item(s) removed`;
        } else if (entry.action === 'pull_started') {
          label = 'Pull session started';
        } else if (entry.action === 'pull_completed') {
          label = 'Pull session completed - all items staged';
        } else if (entry.action === 'release_scan_started') {
          label = 'Release scanning started';
        } else if (entry.action === 'release_scan_completed') {
          label = 'Release scanning completed - all items released';
        } else if (entry.action === 'shipment_completed') {
          const overrides = changes.warnings_overridden;
          label = overrides
            ? `Shipment completed with ${overrides.length} warning override(s)`
            : 'Shipment marked as shipped';
        } else if (entry.action === 'scan_error') {
          label = `Scan error: ${changes.error || 'unknown error'}`;
        } else {
          label = changes.message || changes.note || action.replace(/_/g, ' ');
        }

        // Skip duplicate created events (already captured from shipment table)
        if (action === 'shipment_created') continue;

        allRows.push({
          id: `audit-${entry.id}`,
          actor_name: entry.actor_id ? (actorNameMap.get(entry.actor_id) || null) : null,
          event_type: action,
          event_label: label,
          details: changes,
          created_at: entry.created_at,
        });
      }
    }
  } catch (err) {
    console.error('[EntityActivityFeed] audit_log fetch failed:', err);
  }

  // 7. Fetch shipment items (additions)
  try {
    const { data: shipmentItems, error: siError } = await supabase
      .from('shipment_items')
      .select(`
        id, created_at, status, expected_quantity, actual_quantity,
        item:item_id(item_code)
      `)
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false });

    if (siError) console.error('[EntityActivityFeed] shipment_items query error:', siError);

    if (shipmentItems) {
      for (const si of shipmentItems as any[]) {
        allRows.push({
          id: `item-${si.id}`,
          actor_name: null,
          event_type: 'item_added',
          event_label: si.item?.item_code
            ? `Item ${si.item.item_code} added to shipment`
            : `Expected ${si.expected_quantity || 1} item(s) added`,
          details: {
            item_code: si.item?.item_code,
            expected_qty: si.expected_quantity,
            actual_qty: si.actual_quantity,
            status: si.status,
          },
          created_at: si.created_at,
        });
      }
    }
  } catch (err) {
    console.error('[EntityActivityFeed] shipment_items fetch failed:', err);
  }

  // Deduplicate by id and sort newest first
  const seen = new Set<string>();
  const deduplicated = allRows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  deduplicated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return deduplicated;
}

export function EntityActivityFeed({ entityType, entityId, title, description }: EntityActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const mapping = TABLE_MAP[entityType];

  const fetchActivities = useCallback(async () => {
    if (!entityId) return;

    setLoading(true);
    try {
      // For shipments, use comprehensive multi-source fetch
      if (entityType === 'shipment') {
        const rows = await fetchShipmentComprehensiveActivity(entityId);
        setActivities(rows);
        return;
      }

      // For other entity types, use the single activity table
      if (!mapping) return;

      const { data, error } = await (supabase as any).from(mapping.table)
        .select('*')
        .eq(mapping.idColumn, entityId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (error.code !== '42P01') {
          console.error(`[EntityActivityFeed] Error for ${entityType}:`, error);
        }
        setActivities([]);
        return;
      }

      setActivities(data || []);
    } catch (err) {
      console.error(`[EntityActivityFeed] Unexpected error:`, err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, mapping]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const displayTitle = title || 'Activity';
  const displayDescription = description || `Timeline of changes to this ${entityType}`;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="timeline" size="md" />
            {displayTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 pl-10">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon name="timeline" size="md" />
          {displayTitle}
        </CardTitle>
        <CardDescription>{displayDescription}</CardDescription>
      </CardHeader>

      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <MaterialIcon name="timeline" className="text-[36px] text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              {/* Events */}
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative flex gap-3 pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${getEventColor(activity.event_type)}`}>
                      <MaterialIcon name={getEventIcon(activity.event_type)} className="text-[12px]" />
                    </div>

                    {/* Event content */}
                    <div className="flex-1 bg-muted/50 rounded-lg p-3 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="font-medium text-sm leading-tight">{activity.event_label}</span>
                        <Badge variant="outline" className="text-[10px] px-1 flex-shrink-0">
                          {getEventCategory(activity.event_type)}
                        </Badge>
                      </div>

                      {/* Actor + time */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {activity.actor_name && (
                          <>
                            <span className="font-medium">{activity.actor_name}</span>
                            <span>-</span>
                          </>
                        )}
                        <span title={format(new Date(activity.created_at), 'MMM d, yyyy h:mm:ss a')}>
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Expandable details */}
                      <ActivityDetailsDisplay details={activity.details} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
