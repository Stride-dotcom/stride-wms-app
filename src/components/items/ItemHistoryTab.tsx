import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ShipmentExceptionBadge } from '@/components/shipments/ShipmentExceptionBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface HistoryEvent {
  id: string;
  type: 'movement' | 'billing' | 'billing_void' | 'task' | 'shipment' | 'note' | 'repair';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ItemHistoryTabProps {
  itemId: string;
}

export function ItemHistoryTab({ itemId }: ItemHistoryTabProps) {
  const navigate = useNavigate();
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

      // 2. Fetch billing events with calculation metadata (including voided ones for audit)
      const { data: billingEvents } = await (supabase.from('billing_events') as any)
        .select('id, event_type, charge_type, description, total_amount, status, created_at, updated_at, calculation_metadata')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (billingEvents) {
        billingEvents.forEach((b: any) => {
          const isVoid = b.status === 'void';
          allEvents.push({
            id: `billing-${b.id}`,
            type: isVoid ? 'billing_void' : 'billing',
            title: isVoid 
              ? 'BILLING CHARGE VOIDED' 
              : (b.charge_type?.replace('_', ' ').toUpperCase() || 'CHARGE'),
            description: isVoid
              ? `VOIDED: ${b.description || b.event_type} - $${Math.abs(b.total_amount)?.toFixed(2) || '0.00'}`
              : `${b.description || b.event_type} - $${b.total_amount?.toFixed(2) || '0.00'}`,
            timestamp: isVoid && b.updated_at ? b.updated_at : b.created_at,
            metadata: {
              amount: b.total_amount,
              status: b.status,
              calculation: b.calculation_metadata,
            },
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
          shipments:shipment_id(id, shipment_number, shipment_type, inbound_kind, status, received_at)
        `)
        .eq('item_id', itemId);

      if (shipmentItems) {
        const shipmentIds = shipmentItems
          .map((si: any) => si.shipments?.id)
          .filter(Boolean) as string[];
        const exceptionCounts: Record<string, number> = {};

        if (shipmentIds.length > 0) {
          const { data: openExceptions } = await supabase
            .from('shipment_exceptions')
            .select('shipment_id')
            .in('shipment_id', shipmentIds)
            .eq('status', 'open');

          (openExceptions || []).forEach((row) => {
            exceptionCounts[row.shipment_id] = (exceptionCounts[row.shipment_id] || 0) + 1;
          });
        }

        shipmentItems.forEach((si: any) => {
          if (si.shipments) {
            const s = si.shipments;
            allEvents.push({
              id: `shipment-${si.id}`,
              type: 'shipment',
              title: s.shipment_type === 'inbound' ? 'Received in Shipment' : 'Released in Shipment',
              description: `Shipment ${s.shipment_number}`,
              timestamp: s.received_at || si.created_at,
              metadata: {
                shipmentId: s.id,
                shipmentNumber: s.shipment_number,
                status: s.status,
                shipmentType: s.shipment_type,
                inboundKind: s.inbound_kind || null,
                exceptionOpenCount: exceptionCounts[s.id] || 0,
              },
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
        return <MaterialIcon name="location_on" size="sm" />;
      case 'billing':
        return <MaterialIcon name="attach_money" size="sm" />;
      case 'billing_void':
        return <MaterialIcon name="money_off" size="sm" />;
      case 'task':
        return <MaterialIcon name="assignment" size="sm" />;
      case 'shipment':
        return <MaterialIcon name="inventory_2" size="sm" />;
      case 'note':
        return <MaterialIcon name="sticky_note_2" size="sm" />;
      case 'repair':
        return <MaterialIcon name="handyman" size="sm" />;
      default:
        return <MaterialIcon name="history" size="sm" />;
    }
  };

  const getEventColor = (type: HistoryEvent['type']) => {
    switch (type) {
      case 'movement':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'billing':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'billing_void':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
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
          <MaterialIcon name="progress_activity" className="text-[32px] animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 text-center">
          <MaterialIcon name="history" className="text-[48px] text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No history available for this item</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MaterialIcon name="history" size="md" />
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
                    {event.type === 'shipment' && event.metadata?.shipmentId ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          className="text-sm font-medium underline-offset-2 hover:underline"
                          onClick={() => navigate(`/shipments/${event.metadata.shipmentId}`)}
                        >
                          Shipment {event.metadata.shipmentNumber || 'Unknown'}
                        </button>
                        {event.metadata.shipmentType === 'inbound' && event.metadata.inboundKind === 'dock_intake' && (
                          <ShipmentExceptionBadge
                            shipmentId={event.metadata.shipmentId}
                            count={event.metadata.exceptionOpenCount}
                            onClick={() => navigate(`/incoming/dock-intake/${event.metadata.shipmentId}?tab=exceptions`)}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}

                    {/* Shipment Status and Type Badges */}
                    {event.type === 'shipment' && event.metadata && (
                      <div className="flex items-center gap-2 mt-1">
                        {event.metadata.shipmentType && (
                          <StatusIndicator status={event.metadata.shipmentType} size="sm" />
                        )}
                        {event.metadata.status && (
                          <StatusIndicator status={event.metadata.status} size="sm" />
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                    </p>

                    {/* Billing Calculation Metadata */}
                    {event.type === 'billing' && event.metadata?.calculation && (
                      <BillingMetadataDisplay calculation={event.metadata.calculation} />
                    )}
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

// ============================================================================
// Billing Metadata Display Component
// Shows detailed calculation breakdown for billing events
// ============================================================================

interface BillingMetadataDisplayProps {
  calculation: {
    service_code?: string;
    base_rate_source?: string;
    base_rate?: number;
    size_category?: string;
    assembly_tier?: number;
    flags_applied?: Array<{
      flag: string;
      source: string;
      adds_percent: number;
      adds_flat: number;
      adds_minutes: number;
    }>;
    rate_after_flags?: number;
    account_adjustment_percent?: number;
    rate_after_account_adj?: number;
    final_rate?: number;
    final_minutes?: number;
    flag_key?: string;
    flag_display_name?: string;
    triggered_by?: string;
  };
}

function BillingMetadataDisplay({ calculation }: BillingMetadataDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!calculation || Object.keys(calculation).length === 0) {
    return null;
  }

  const hasDetailedBreakdown = calculation.base_rate !== undefined ||
    (calculation.flags_applied && calculation.flags_applied.length > 0) ||
    calculation.account_adjustment_percent !== undefined;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-2 p-1 h-auto text-xs text-muted-foreground hover:text-foreground">
          <MaterialIcon name="info" className="text-[12px] mr-1" />
          View calculation details
          {isOpen ? (
            <MaterialIcon name="expand_less" className="text-[12px] ml-1" />
          ) : (
            <MaterialIcon name="expand_more" className="text-[12px] ml-1" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 p-2 bg-background rounded border text-xs space-y-1">
          {calculation.triggered_by && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Triggered by:</span>
              <span className="font-medium">{calculation.triggered_by}</span>
            </div>
          )}

          {calculation.flag_display_name && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flag:</span>
              <span className="font-medium">{calculation.flag_display_name}</span>
            </div>
          )}

          {calculation.service_code && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service:</span>
              <span className="font-medium">{calculation.service_code}</span>
            </div>
          )}

          {calculation.base_rate_source && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate source:</span>
              <span className="font-medium">{calculation.base_rate_source.replace(/_/g, ' ')}</span>
            </div>
          )}

          {calculation.size_category && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size category:</span>
              <span className="font-medium">{calculation.size_category}</span>
            </div>
          )}

          {calculation.assembly_tier && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assembly tier:</span>
              <span className="font-medium">Tier {calculation.assembly_tier}</span>
            </div>
          )}

          {calculation.base_rate !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base rate:</span>
              <span className="font-medium">${calculation.base_rate.toFixed(2)}</span>
            </div>
          )}

          {calculation.flags_applied && calculation.flags_applied.length > 0 && (
            <div className="border-t pt-1 mt-1">
              <span className="text-muted-foreground font-medium">Flags applied:</span>
              {calculation.flags_applied.map((flag, i) => (
                <div key={i} className="ml-2 flex justify-between text-xs">
                  <span>{flag.flag}</span>
                  <span className="text-muted-foreground">
                    {flag.adds_percent > 0 && `+${flag.adds_percent}%`}
                    {flag.adds_flat > 0 && ` +$${flag.adds_flat.toFixed(2)}`}
                    {flag.adds_minutes > 0 && ` +${flag.adds_minutes}min`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {calculation.rate_after_flags !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">After flags:</span>
              <span className="font-medium">${calculation.rate_after_flags.toFixed(2)}</span>
            </div>
          )}

          {calculation.account_adjustment_percent !== undefined && calculation.account_adjustment_percent !== 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account adjustment:</span>
              <span className="font-medium">
                {calculation.account_adjustment_percent > 0 ? '+' : ''}
                {calculation.account_adjustment_percent}%
              </span>
            </div>
          )}

          {calculation.final_rate !== undefined && (
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-muted-foreground font-medium">Final rate:</span>
              <span className="font-bold text-green-600">${calculation.final_rate.toFixed(2)}</span>
            </div>
          )}

          {calculation.final_minutes !== undefined && calculation.final_minutes > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated time:</span>
              <span className="font-medium">{calculation.final_minutes} min</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
