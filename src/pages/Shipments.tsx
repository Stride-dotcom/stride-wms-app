/**
 * Shipments Hub Page - Logistics Console
 *
 * Hub / Incoming / Outbound tabs.
 * Hub shows 4 cards: Expected Today, Intakes In Progress, Received Today, Shipped Today.
 * Incoming tab renders IncomingContent inline.
 * Outbound tab renders OutboundContent inline.
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ShipmentNumberBadge } from '@/components/shipments/ShipmentNumberBadge';
import { IncomingContent } from '@/components/shipments/IncomingContent';
import { OutboundContent } from '@/components/shipments/OutboundContent';
import { useUnidentifiedAccount } from '@/hooks/useUnidentifiedAccount';
import { useAccounts } from '@/hooks/useAccounts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

interface ShipmentCounts {
  expectedToday: number;
  intakesInProgress: number;
  receivedToday: number;
  shippedToday: number;
}

interface RecentShipment {
  id: string;
  shipment_number: string;
  status: string;
  account_name?: string;
  carrier?: string;
  created_at: string;
  completed_at?: string;
  shipment_exception_type?: string | null;
}

type ExpandedCard = 'expectedToday' | 'intakesInProgress' | 'receivedToday' | 'shippedToday' | null;
type HubTab = 'hub' | 'incoming' | 'outbound';
type IncomingSubTab = 'manifests' | 'expected' | 'intakes' | undefined;

export default function Shipments() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { unidentifiedAccountId } = useUnidentifiedAccount();
  const { accounts } = useAccounts();
  const [intakeAccountId, setIntakeAccountId] = useState<string>('');

  // Default to UNIDENTIFIED account once loaded
  useEffect(() => {
    if (unidentifiedAccountId && !intakeAccountId) {
      setIntakeAccountId(unidentifiedAccountId);
    }
  }, [unidentifiedAccountId]);

  const [counts, setCounts] = useState<ShipmentCounts>({
    expectedToday: 0,
    intakesInProgress: 0,
    receivedToday: 0,
    shippedToday: 0,
  });
  const [expectedTodayShipments, setExpectedTodayShipments] = useState<RecentShipment[]>([]);
  const [intakesInProgressShipments, setIntakesInProgressShipments] = useState<RecentShipment[]>([]);
  const [receivedTodayShipments, setReceivedTodayShipments] = useState<RecentShipment[]>([]);
  const [shippedTodayShipments, setShippedTodayShipments] = useState<RecentShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null);
  const [activeTab, setActiveTab] = useState<HubTab>('hub');
  const [incomingSubTab, setIncomingSubTab] = useState<IncomingSubTab>(undefined);
  const [creatingIntake, setCreatingIntake] = useState(false);

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
      // UTC day window
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
      const todayISO = startOfToday.toISOString();
      const tomorrowISO = startOfTomorrow.toISOString();

      const [expectedTodayRes, intakesRes, receivedRes, shippedRes,
        expectedTodayItemsRes, intakesItemsRes, receivedItemsRes, shippedItemsRes] = await Promise.all([
        // Expected Today count
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'inbound')
          .eq('inbound_kind', 'expected')
          .lte('eta_start', todayISO)
          .gte('eta_end', todayISO)
          .is('deleted_at', null),
        // Intakes In Progress count
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'inbound')
          .eq('inbound_kind', 'dock_intake')
          .in('inbound_status', ['draft', 'stage1_complete', 'receiving'])
          .is('deleted_at', null),
        // Received Today count
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .in('status', ['received'])
          .gte('received_at', todayISO)
          .lt('received_at', tomorrowISO)
          .is('deleted_at', null),
        // Shipped Today count
        supabase
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('shipment_type', 'outbound')
          .in('status', ['released', 'completed'])
          .gte('completed_at', todayISO)
          .lt('completed_at', tomorrowISO)
          .is('deleted_at', null),
        // Expected Today items
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, carrier, shipment_exception_type, accounts(account_name)')
          .eq('shipment_type', 'inbound')
          .eq('inbound_kind', 'expected')
          .lte('eta_start', todayISO)
          .gte('eta_end', todayISO)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
        // Intakes In Progress items
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, carrier, shipment_exception_type, accounts(account_name)')
          .eq('shipment_type', 'inbound')
          .eq('inbound_kind', 'dock_intake')
          .in('inbound_status', ['draft', 'stage1_complete', 'receiving'])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
        // Received Today items
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, received_at, carrier, shipment_exception_type, accounts(account_name)')
          .in('status', ['received'])
          .gte('received_at', todayISO)
          .lt('received_at', tomorrowISO)
          .is('deleted_at', null)
          .order('received_at', { ascending: false })
          .limit(10),
        // Shipped Today items
        supabase
          .from('shipments')
          .select('id, shipment_number, status, created_at, completed_at, carrier, shipment_exception_type, accounts(account_name)')
          .eq('shipment_type', 'outbound')
          .in('status', ['released', 'completed'])
          .gte('completed_at', todayISO)
          .lt('completed_at', tomorrowISO)
          .is('deleted_at', null)
          .order('completed_at', { ascending: false })
          .limit(10),
      ]);

      setCounts({
        expectedToday: expectedTodayRes.count || 0,
        intakesInProgress: intakesRes.count || 0,
        receivedToday: receivedRes.count || 0,
        shippedToday: shippedRes.count || 0,
      });

      const mapShipments = (data: any[] | null): RecentShipment[] =>
        (data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          account_name: s.accounts?.account_name,
          carrier: s.carrier,
          created_at: s.created_at,
          completed_at: s.completed_at || s.received_at,
          shipment_exception_type: s.shipment_exception_type,
        }));

      setExpectedTodayShipments(mapShipments(expectedTodayItemsRes.data));
      setIntakesInProgressShipments(mapShipments(intakesItemsRes.data));
      setReceivedTodayShipments(mapShipments(receivedItemsRes.data));
      setShippedTodayShipments(mapShipments(shippedItemsRes.data));
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

  const getExpandedItems = (key: ExpandedCard): RecentShipment[] => {
    switch (key) {
      case 'expectedToday':
        return expectedTodayShipments;
      case 'intakesInProgress':
        return intakesInProgressShipments;
      case 'receivedToday':
        return receivedTodayShipments;
      case 'shippedToday':
        return shippedTodayShipments;
      default:
        return [];
    }
  };

  const handleStartDockIntake = useCallback(async () => {
    if (!profile?.tenant_id || creatingIntake) return;
    if (!intakeAccountId) {
      toast({
        variant: 'destructive',
        title: 'Account Required',
        description: 'Please select an account before starting a dock intake.',
      });
      return;
    }
    setCreatingIntake(true);
    try {
      // Insert with exact PF-1 payload (no account_id)
      const { data, error } = await (supabase as any)
        .from('shipments')
        .insert({
          tenant_id: profile.tenant_id,
          shipment_type: 'inbound',
          status: 'expected',
          inbound_kind: 'dock_intake',
          inbound_status: 'draft',
          created_by: profile.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Post-insert: set account_id
      const { error: updateError } = await (supabase as any)
        .from('shipments')
        .update({ account_id: intakeAccountId })
        .eq('id', data.id);

      if (updateError) throw updateError;

      navigate(`/incoming/dock-intake/${data.id}`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to start dock intake',
      });
    } finally {
      setCreatingIntake(false);
    }
  }, [profile, creatingIntake, intakeAccountId, navigate, toast]);

  const handleCardTap = (key: ExpandedCard) => {
    switch (key) {
      case 'expectedToday':
        setIncomingSubTab('expected');
        setActiveTab('incoming');
        break;
      case 'intakesInProgress':
        setIncomingSubTab('intakes');
        setActiveTab('incoming');
        break;
      case 'receivedToday':
        navigate('/shipments/received');
        break;
      case 'shippedToday':
        navigate('/shipments/released');
        break;
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
        <div className="flex items-center gap-2">
          <ShipmentNumberBadge
            shipmentNumber={item.shipment_number}
            exceptionType={item.shipment_exception_type}
          />
          <StatusIndicator status={item.status} size="sm" />
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {item.account_name || 'No account'} {item.carrier ? `/ ${item.carrier}` : ''}
        </div>
      </div>
      <MaterialIcon name="chevron_right" size="sm" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
    </div>
  );

  const hubCards = [
    {
      key: 'expectedToday' as ExpandedCard,
      title: 'EXPECTED TODAY',
      description: 'Expected shipments arriving today',
      count: counts.expectedToday,
      emoji: '\uD83D\uDCE6',
      countColor: 'text-orange-500 dark:text-orange-400',
    },
    {
      key: 'intakesInProgress' as ExpandedCard,
      title: 'INTAKES IN PROGRESS',
      description: 'Dock intakes currently being processed',
      count: counts.intakesInProgress,
      emoji: '\uD83C\uDFD7\uFE0F',
      countColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'receivedToday' as ExpandedCard,
      title: 'RECEIVED TODAY',
      description: 'Shipments received today',
      count: counts.receivedToday,
      emoji: '\u2705',
      countColor: 'text-green-600 dark:text-green-400',
    },
    {
      key: 'shippedToday' as ExpandedCard,
      title: 'SHIPPED TODAY',
      description: 'Outbound shipments completed today',
      count: counts.shippedToday,
      emoji: '\uD83D\uDE9A',
      countColor: 'text-purple-600 dark:text-purple-400',
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
          <div className="flex items-center gap-2">
            <Select value={intakeAccountId} onValueChange={setIntakeAccountId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select account *" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleStartDockIntake}
              disabled={creatingIntake || !intakeAccountId}
              className="gap-2"
            >
              {creatingIntake ? (
                <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
              ) : (
                <MaterialIcon name="add" size="sm" />
              )}
              Start Dock Intake
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as HubTab);
          if (v !== 'incoming') setIncomingSubTab(undefined);
        }}>
          <TabsList>
            <TabsTrigger value="hub" className="gap-2">
              <MaterialIcon name="dashboard" size="sm" />
              Hub
            </TabsTrigger>
            <TabsTrigger value="incoming" className="gap-2">
              <MaterialIcon name="move_to_inbox" size="sm" />
              Incoming
            </TabsTrigger>
            <TabsTrigger value="outbound" className="gap-2">
              <MaterialIcon name="outbox" size="sm" />
              Outbound
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hub" className="mt-4">
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
                        onClick={() => handleCardTap(card.key)}
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
                                handleCardTap(card.key);
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
          </TabsContent>

          <TabsContent value="incoming" className="mt-4">
            <div className="mb-4 flex items-center gap-2">
              <Select value={intakeAccountId} onValueChange={setIntakeAccountId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select account *" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleStartDockIntake}
                disabled={creatingIntake || !intakeAccountId}
                className="gap-2"
              >
                {creatingIntake ? (
                  <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                ) : (
                  <MaterialIcon name="add" size="sm" />
                )}
                Start Dock Intake
              </Button>
            </div>
            <IncomingContent
              initialSubTab={incomingSubTab}
              onStartDockIntake={handleStartDockIntake}
            />
          </TabsContent>

          <TabsContent value="outbound" className="mt-4">
            <div className="mb-4">
              <Button
                onClick={() => navigate('/shipments/outbound/new')}
                className="gap-2"
              >
                <MaterialIcon name="add" size="sm" />
                Create Outbound Shipment
              </Button>
            </div>
            <OutboundContent />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
