import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Loader2,
  MapPin,
  DollarSign,
  ClipboardList,
  Package,
  StickyNote,
  Wrench,
  History,
} from 'lucide-react';

interface HistoryEvent {
  id: string;
  type: 'movement' | 'billing' | 'task' | 'shipment' | 'note' | 'repair';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ItemHistoryTabProps {
  itemId: string;
}

export function ItemHistoryTab({ itemId }: ItemHistoryTabProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [itemId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const allEvents: HistoryEvent[] = [];

      // 1. Fetch movements
      const { data: movements } = await (supabase.from('movements') as any)
        .select(`
          id,
          action_type,
          moved_at,
          note,
          from_location:from_location_id(code),
          to_location:to_location_id(code)
        `)
        .eq('item_id', itemId)
        .order('moved_at', { ascending: false })
        .limit(50);

      if (movements) {
        movements.forEach((m: any) => {
          allEvents.push({
            id: `movement-${m.id}`,
            type: 'movement',
            title: m.action_type.replace('_', ' ').toUpperCase(),
            description: m.from_location?.code && m.to_location?.code
              ? `Moved from ${m.from_location.code} to ${m.to_location.code}`
              : m.to_location?.code
              ? `Placed in ${m.to_location.code}`
              : m.note || 'Location updated',
            timestamp: m.moved_at,
            metadata: { note: m.note },
          });
        });
      }

      // 2. Fetch billing events
      const { data: billingEvents } = await (supabase.from('billing_events') as any)
        .select('id, event_type, charge_type, description, total_amount, created_at')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (billingEvents) {
        billingEvents.forEach((b: any) => {
          allEvents.push({
            id: `billing-${b.id}`,
            type: 'billing',
            title: b.charge_type.replace('_', ' ').toUpperCase(),
            description: `${b.description || b.event_type} - $${b.total_amount.toFixed(2)}`,
            timestamp: b.created_at,
            metadata: { amount: b.total_amount },
          });
        });
      }

      // 3. Fetch tasks via task_items
      const { data: taskItems } = await (supabase.from('task_items') as any)
        .select('task_id')
        .eq('item_id', itemId);

      if (taskItems && taskItems.length > 0) {
        const taskIds = taskItems.map((ti: any) => ti.task_id);
        const { data: tasks } = await (supabase.from('tasks') as any)
          .select('id, title, task_type, status, created_at, completed_at')
          .in('id', taskIds)
          .order('created_at', { ascending: false });

        if (tasks) {
          tasks.forEach((t: any) => {
            // Task created event
            allEvents.push({
              id: `task-created-${t.id}`,
              type: 'task',
              title: `${t.task_type} Task Created`,
              description: t.title,
              timestamp: t.created_at,
              metadata: { status: t.status },
            });

            // Task completed event (if applicable)
            if (t.completed_at) {
              allEvents.push({
                id: `task-completed-${t.id}`,
                type: 'task',
                title: `${t.task_type} Task Completed`,
                description: t.title,
                timestamp: t.completed_at,
                metadata: { status: 'completed' },
              });
            }
          });
        }
      }

      // 4. Fetch shipment items
      const { data: shipmentItems } = await (supabase.from('shipment_items') as any)
        .select(`
          id,
          created_at,
          shipments:shipment_id(id, shipment_number, shipment_type, status, received_at)
        `)
        .eq('item_id', itemId);

      if (shipmentItems) {
        shipmentItems.forEach((si: any) => {
          if (si.shipments) {
            const s = si.shipments;
            allEvents.push({
              id: `shipment-${si.id}`,
              type: 'shipment',
              title: s.shipment_type === 'inbound' ? 'Received in Shipment' : 'Released in Shipment',
              description: `Shipment ${s.shipment_number}`,
              timestamp: s.received_at || si.created_at,
              metadata: { shipmentId: s.id, status: s.status },
            });
          }
        });
      }

      // 5. Fetch item notes
      const { data: notes } = await (supabase.from('item_notes') as any)
        .select('id, note_type, content, created_at, created_by')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notes) {
        notes.forEach((n: any) => {
          allEvents.push({
            id: `note-${n.id}`,
            type: 'note',
            title: n.note_type ? n.note_type.replace('_', ' ').toUpperCase() : 'Note Added',
            description: n.content.substring(0, 100) + (n.content.length > 100 ? '...' : ''),
            timestamp: n.created_at,
          });
        });
      }

      // 6. Fetch repair quotes
      const { data: repairs } = await (supabase.from('repair_quotes') as any)
        .select('id, status, total_amount, created_at, approved_at')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (repairs) {
        repairs.forEach((r: any) => {
          allEvents.push({
            id: `repair-${r.id}`,
            type: 'repair',
            title: 'Repair Quote Created',
            description: `Quote for $${r.total_amount?.toFixed(2) || '0.00'} - ${r.status}`,
            timestamp: r.created_at,
            metadata: { status: r.status },
          });

          if (r.approved_at) {
            allEvents.push({
              id: `repair-approved-${r.id}`,
              type: 'repair',
              title: 'Repair Quote Approved',
              description: `Approved for $${r.total_amount?.toFixed(2) || '0.00'}`,
              timestamp: r.approved_at,
            });
          }
        });
      }

      // Sort all events by timestamp (newest first)
      allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(allEvents);
    } catch (error) {
      console.error('Error fetching item history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: HistoryEvent['type']) => {
    switch (type) {
      case 'movement':
        return <MapPin className="h-4 w-4" />;
      case 'billing':
        return <DollarSign className="h-4 w-4" />;
      case 'task':
        return <ClipboardList className="h-4 w-4" />;
      case 'shipment':
        return <Package className="h-4 w-4" />;
      case 'note':
        return <StickyNote className="h-4 w-4" />;
      case 'repair':
        return <Wrench className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: HistoryEvent['type']) => {
    switch (type) {
      case 'movement':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'billing':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'task':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'shipment':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'note':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'repair':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 text-center">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No history available for this item</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Item History
        </CardTitle>
        <CardDescription>
          Complete timeline of all events for this item
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            {/* Events */}
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="relative flex gap-4 pl-10">
                  {/* Timeline dot */}
                  <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${getEventColor(event.type)}`}>
                    {getEventIcon(event.type)}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm">{event.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {event.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
