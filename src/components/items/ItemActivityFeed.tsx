/**
 * ItemActivityFeed - Unified activity timeline for an item.
 * Shows all logged events from item_activity with filters, actor name, and time.
 */

import { useState } from 'react';
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
import { useItemActivity, type ActivityFilterCategory, type ItemActivity } from '@/hooks/useItemActivity';
import { format, formatDistanceToNow } from 'date-fns';

interface ItemActivityFeedProps {
  itemId: string;
}

const FILTER_OPTIONS: { value: ActivityFilterCategory; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'list' },
  { value: 'movements', label: 'Movements', icon: 'location_on' },
  { value: 'billing', label: 'Billing', icon: 'attach_money' },
  { value: 'tasks', label: 'Tasks', icon: 'assignment' },
  { value: 'notes_photos', label: 'Notes/Photos', icon: 'photo_library' },
  { value: 'status_account_class', label: 'Status/Account', icon: 'tune' },
];

function getEventIcon(eventType: string): string {
  if (eventType.startsWith('item_flag')) return 'flag';
  if (eventType.startsWith('item_scan') || eventType.startsWith('billing')) return 'attach_money';
  if (eventType.startsWith('item_note')) return 'sticky_note_2';
  if (eventType.startsWith('item_photo')) return 'photo_camera';
  if (eventType.startsWith('item_status')) return 'swap_horiz';
  if (eventType.startsWith('item_account')) return 'business';
  if (eventType.startsWith('item_class')) return 'category';
  if (eventType.startsWith('item_moved') || eventType.startsWith('item_location')) return 'location_on';
  if (eventType.startsWith('item_field')) return 'edit';
  if (eventType.startsWith('task_')) return 'assignment';
  if (eventType.startsWith('inventory_count')) return 'inventory';
  return 'history';
}

function getEventColor(eventType: string): string {
  if (eventType.includes('flag_applied') || eventType.includes('billing_event_created') || eventType.includes('scan_charge'))
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (eventType.includes('flag_removed') || eventType.includes('voided'))
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (eventType.includes('moved') || eventType.includes('location'))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  if (eventType.startsWith('task_'))
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
  if (eventType.includes('note'))
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  if (eventType.includes('photo'))
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (eventType.includes('status') || eventType.includes('account') || eventType.includes('class') || eventType.includes('field'))
    return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
  if (eventType.includes('billing_charge_added'))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

function getEventCategory(eventType: string): string {
  if (eventType.includes('flag') || eventType.includes('billing') || eventType.includes('scan_charge'))
    return 'billing';
  if (eventType.includes('moved') || eventType.includes('location'))
    return 'movement';
  if (eventType.startsWith('task_'))
    return 'task';
  if (eventType.includes('note') || eventType.includes('photo'))
    return 'notes/photos';
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

export function ItemActivityFeed({ itemId }: ItemActivityFeedProps) {
  const { activities, loading, filter, setFilter } = useItemActivity(itemId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="timeline" size="md" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
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
          Activity
        </CardTitle>
        <CardDescription>
          Complete timeline of all changes to this item
        </CardDescription>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={filter === opt.value ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setFilter(opt.value)}
            >
              <MaterialIcon name={opt.icon} className="text-[12px] mr-1" />
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <MaterialIcon name="timeline" className="text-[36px] text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all' ? 'No activity recorded yet' : `No ${filter.replace('_', ' ')} activity`}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[450px] pr-4">
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
