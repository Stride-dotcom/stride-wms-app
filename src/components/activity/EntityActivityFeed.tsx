/**
 * EntityActivityFeed - Reusable activity timeline for shipments, tasks, and accounts.
 * Same visual pattern as ItemActivityFeed, parameterized by entity type.
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
  if (eventType.includes('invoiced') || eventType.includes('billing')) return 'receipt_long';
  if (eventType.includes('updated') || eventType.includes('edited')) return 'edit';
  if (eventType.includes('voided') || eventType.includes('uninvoiced')) return 'undo';
  if (eventType.includes('status')) return 'swap_horiz';
  if (eventType.includes('assigned')) return 'person';
  if (eventType.includes('completed')) return 'check_circle';
  if (eventType.includes('charge') || eventType.includes('billing_charge')) return 'attach_money';
  if (eventType.includes('received') || eventType.includes('scanned')) return 'qr_code_scanner';
  return 'history';
}

function getEventColor(eventType: string): string {
  if (eventType.includes('invoiced') && !eventType.includes('uninvoiced'))
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (eventType.includes('uninvoiced') || eventType.includes('voided'))
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (eventType.includes('updated') || eventType.includes('edited'))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  if (eventType.includes('completed'))
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (eventType.includes('charge') || eventType.includes('billing_charge'))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

function getEventCategory(eventType: string): string {
  if (eventType.includes('invoice') || eventType.includes('billing')) return 'billing';
  if (eventType.includes('status') || eventType.includes('completed') || eventType.includes('assigned')) return 'status';
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

export function EntityActivityFeed({ entityType, entityId, title, description }: EntityActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const mapping = TABLE_MAP[entityType];

  const fetchActivities = useCallback(async () => {
    if (!entityId || !mapping) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase.from(mapping.table) as any)
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
