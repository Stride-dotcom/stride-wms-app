/**
 * Shipments Hub Page
 *
 * Clean implementation showing counts for incoming/outbound shipments.
 * Navigation to filtered lists for each category.
 * Design matches Dashboard "Command Center" card style.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AddShipmentDialog } from '@/components/shipments/AddShipmentDialog';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { getShipmentStatusClasses } from '@/lib/statusColors';
import { format } from 'date-fns';

interface ShipmentCounts {
  incoming: number;
  outbound: number;
  recentReceived: number;
  recentReleased: number;
}

interface RecentShipment {
  id: string;
  shipment_number: string;
  status: string;
  account_name?: string;
  carrier?: string;
  created_at: string;
  completed_at?: string;
}

type ExpandedCard = 'incoming' | 'outbound' | 'received' | 'released' | null;

export default function Shipments() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [counts, setCounts] = useState<ShipmentCounts>({
    incoming: 0,
    outbound: 0,
    recentReceived: 0,
    recentReleased: 0,
  });
  const [incomingShipments, setIncomingShipments] = useState<RecentShipment[]>([]);
  const [outboundShipments, setOutboundShipments] = useState<RecentShipment[]>([]);
  const [recentReceived, setRecentReceived] = useState<RecentShipment[]>([]);
  const [recentReleased, setRecentReleased] = useState<RecentShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addShipmentDialogOpen, setAddShipmentDialogOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchShipmentData();
    }
  }, [profile?.tenant_id]);

  const toggleCard = (key: ExpandedCard) => {
    setExpandedCard(expandedCard === key ? null : key);
  };

  const fetchShipmentData = async () => {
    try {
      // Fetch counts and items in parallel
      const [incomingRes, outboundRes, recentReceivedRes, recentReleasedRes, incomingItemsRes, outboundItemsRes] = await Promise.all([
        // Incoming count
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'inbound')
          .in('status', ['expected', 'in_progress', 'receiving'])
          .is('deleted_at', null),
        // Outbound count
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'outbound')
          .in('status', ['expected', 'in_progress'])
          .is('deleted_at', null),
        // Recent received
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, received_at, carrier, accounts(account_name)')
          .in('status', ['received'])
          .is('deleted_at', null)
          .order('received_at', { ascending: false })
          .limit(10),
        // Recent released
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, completed_at, carrier, accounts(account_name)')
          .in('status', ['released', 'completed'])
          .is('deleted_at', null)
          .order('completed_at', { ascending: false })
          .limit(10),
        // Incoming items for expandable list
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, carrier, accounts(account_name)')
          .eq('shipment_type', 'inbound')
          .in('status', ['expected', 'in_progress', 'receiving'])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
        // Outbound items for expandable list
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, carrier, accounts(account_name)')
          .eq('shipment_type', 'outbound')
          .in('status', ['expected', 'in_progress'])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setCounts({
        incoming: incomingRes.count || 0,
        outbound: outboundRes.count || 0,
        recentReceived: recentReceivedRes.data?.length || 0,
        recentReleased: recentReleasedRes.data?.length || 0,
      });

      setIncomingShipments(
        (incomingItemsRes.data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          account_name: s.accounts?.account_name,
          carrier: s.carrier,
          created_at: s.created_at,
        }))
      );

      setOutboundShipments(
        (outboundItemsRes.data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          account_name: s.accounts?.account_name,
          carrier: s.carrier,
          created_at: s.created_at,
        }))
      );

      setRecentReceived(
        (recentReceivedRes.data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          account_name: s.accounts?.account_name,
          carrier: s.carrier,
          created_at: s.created_at,
          completed_at: s.received_at,
        }))
      );

      setRecentReleased(
        (recentReleasedRes.data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          account_name: s.accounts?.account_name,
          carrier: s.carrier,
          created_at: s.created_at,
          completed_at: s.completed_at,
        }))
      );
    } catch (error: any) {
      console.error('[Shipments] Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load shipment data',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const getExpandedItems = (key: ExpandedCard): RecentShipment[] => {
    switch (key) {
      case 'incoming':
        return incomingShipments;
      case 'outbound':
        return outboundShipments;
      case 'received':
        return recentReceived;
      case 'released':
        return recentReleased;
      default:
        return [];
    }
  };

  const renderShipmentRow = (item: RecentShipment) => (
    <div
      key={item.id}
      className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/shipments/${item.id}`);
      }}
      role="button"
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-medium truncate">{item.shipment_number}</div>
        <div className="text-xs text-muted-foreground truncate">
          {item.account_name || 'No account'} • {item.carrier || 'No carrier'}
        </div>
      </div>
      <Badge className={cn('text-xs border-0 ml-2 flex-shrink-0', getShipmentStatusClasses(item.status))}>
        {item.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
      </Badge>
      <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
    </div>
  );

  const hubCards = [
    {
      key: 'incoming' as ExpandedCard,
      title: 'INCOMING SHIPMENTS',
      description: 'Track pending deliveries and manage receiving',
      count: counts.incoming,
      emoji: '📦',
      countColor: 'text-orange-500 dark:text-orange-400',
      href: '/shipments/incoming',
    },
    {
      key: 'outbound' as ExpandedCard,
      title: 'OUTBOUND SHIPMENTS',
      description: 'Manage outbound releases and dispatches',
      count: counts.outbound,
      emoji: '🚚',
      countColor: 'text-blue-600 dark:text-blue-400',
      href: '/shipments/outbound',
    },
    {
      key: 'received' as ExpandedCard,
      title: 'RECENT RECEIVED',
      description: 'Recently completed incoming deliveries',
      count: counts.recentReceived,
      emoji: '✅',
      countColor: 'text-green-600 dark:text-green-400',
      href: '/shipments/received',
    },
    {
      key: 'released' as ExpandedCard,
      title: 'RECENT RELEASED',
      description: 'Recently completed outbound releases',
      count: counts.recentReleased,
      emoji: '🕒',
      countColor: 'text-purple-600 dark:text-purple-400',
      href: '/shipments/released',
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            primaryText="Logistics"
            accentText="Console"
            description="Manage incoming and outbound shipments"
          />
          <Button onClick={() => setAddShipmentDialogOpen(true)}>
            <MaterialIcon name="add" size="sm" className="mr-2" />
            Add Shipment
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {hubCards.map((card) => {
            const isExpanded = expandedCard === card.key;
            const items = getExpandedItems(card.key);

            return (
              <Card key={card.key} className="hover:shadow-lg transition-shadow relative">
                {/* Expand/Collapse Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCard(card.key);
                  }}
                >
                  <MaterialIcon name="expand_more" size="sm" className={cn(
                    "transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )} />
                </Button>

                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pr-10">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                      {card.title}
                    </CardTitle>
                  </div>
                  <div className="emoji-tile emoji-tile-lg rounded-lg bg-card border border-border shadow-sm">
                    {card.emoji}
                  </div>
                </CardHeader>

                <CardContent>
                  <div
                    className="flex items-baseline gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(card.href)}
                    role="button"
                  >
                    <span className={`text-3xl font-bold ${card.countColor}`}>{card.count ?? 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{card.description}</p>

                  {/* Expandable Items List */}
                  {isExpanded && items.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <ScrollArea className="max-h-64">
                        <div className="space-y-1">
                          {items.slice(0, 10).map((item) => renderShipmentRow(item))}
                        </div>
                      </ScrollArea>
                      {card.count > 10 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(card.href);
                          }}
                        >
                          View all {card.count} shipments
                        </Button>
                      )}
                    </div>
                  )}

                  {isExpanded && items.length === 0 && (
                    <div className="mt-4 border-t pt-3 text-center text-sm text-muted-foreground">
                      No shipments to display
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add Shipment Dialog */}
      <AddShipmentDialog
        open={addShipmentDialogOpen}
        onOpenChange={setAddShipmentDialogOpen}
      />
    </DashboardLayout>
  );
}
