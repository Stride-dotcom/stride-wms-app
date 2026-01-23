import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TabValue = 'incoming' | 'outbound' | 'received' | 'released';

interface Shipment {
  id: string;
  shipment_number: string;
  shipment_type: string;
  status: string;
  carrier?: string | null;
  tracking_number?: string | null;
  expected_arrival_date?: string | null;
  received_at?: string | null;
  release_type?: string | null;
  created_at?: string | null;
  account_name?: string | null;
  account_code?: string | null;
  warehouse_name?: string | null;
}

function tabFromPathname(pathname: string): TabValue | null {
  // Supports:
  // /shipments/incoming, /shipments/outbound, /shipments/received, /shipments/released
  // also tolerates /shipments/list
  if (pathname.includes('/shipments/incoming')) return 'incoming';
  if (pathname.includes('/shipments/outbound')) return 'outbound';
  if (pathname.includes('/shipments/received')) return 'received';
  if (pathname.includes('/shipments/released')) return 'released';
  return null;
}

export default function ShipmentsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  // ----- Determine initial tab -----
  const urlTab = (searchParams.get('tab') as TabValue) || null;
  const pathTab = tabFromPathname(location.pathname);

  const initialTab: TabValue = urlTab || pathTab || 'incoming';

  // State
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  // ----- Keep tab in sync when user navigates via cards/routes -----
  useEffect(() => {
    const currentUrlTab = (searchParams.get('tab') as TabValue) || null;
    const inferred = tabFromPathname(location.pathname);

    // If URL already has ?tab=..., trust it
    if (currentUrlTab) {
      if (currentUrlTab !== activeTab) setActiveTab(currentUrlTab);
      return;
    }

    // If URL has NO tab, infer from path and set it (and write ?tab=... so future loads are consistent)
    const next = inferred || 'incoming';
    if (next !== activeTab) setActiveTab(next);

    // Write tab into querystring without pushing a new history entry loop
    setSearchParams({ tab: next }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ------------------------------------------
  // Fetch shipments based on active tab
  // ------------------------------------------
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const fetchShipments = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('shipments')
          .select(`
            id,
            shipment_number,
            shipment_type,
            status,
            carrier,
            tracking_number,
            expected_arrival_date,
            received_at,
            release_type,
            created_at,
            accounts:account_id(account_name, account_code),
            warehouses:warehouse_id(name)
          `)
          .eq('tenant_id', profile.tenant_id)
          .is('deleted_at', null);

        // Apply tab-specific filters (using valid DB statuses only)
        switch (activeTab) {
          case 'incoming':
            query = query
              .eq('shipment_type', 'inbound')
              .in('status', ['expected', 'in_progress']);
            break;
          case 'outbound':
            query = query
              .eq('shipment_type', 'outbound')
              .in('status', ['expected', 'in_progress']);
            break;
          case 'received':
            query = query.in('status', ['received']);
            break;
          case 'released':
            query = query.in('status', ['released', 'completed']);
            break;
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error('[ShipmentsList] fetch failed:', error);
          return;
        }

        const transformedData: Shipment[] = (data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          shipment_type: s.shipment_type,
          status: s.status,
          carrier: s.carrier,
          tracking_number: s.tracking_number,
          expected_arrival_date: s.expected_arrival_date,
          received_at: s.received_at,
          release_type: s.release_type,
          created_at: s.created_at,
          account_name: s.accounts?.account_name || null,
          account_code: s.accounts?.account_code || null,
          warehouse_name: s.warehouses?.name || null,
        }));

        setShipments(transformedData);
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, [profile?.tenant_id, activeTab]);

  // Update URL when tab changes (user clicks Tabs)
  const handleTabChange = (tab: string) => {
    const t = tab as TabValue;
    setActiveTab(t);
    setSearchParams({ tab: t }, { replace: true });
    setStatusFilter('all');
  };

  // Filter shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          shipment.shipment_number?.toLowerCase().includes(q) ||
          shipment.account_name?.toLowerCase().includes(q) ||
          shipment.carrier?.toLowerCase().includes(q) ||
          shipment.tracking_number?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (statusFilter !== 'all' && shipment.status !== statusFilter) return false;

      return true;
    });
  }, [shipments, searchQuery, statusFilter]);

  const titleMap: Record<TabValue, string> = {
    incoming: 'Incoming Shipments',
    outbound: 'Outbound (Will Call / Disposal)',
    received: 'Recently Received',
    released: 'Recently Released',
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={titleMap[activeTab]}
        description="Manage inbound and outbound shipments"
        actions={
          <Button onClick={() => navigate('/shipments/new')}>
            New Shipment
          </Button>
        }
      />

      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="incoming">Incoming</TabsTrigger>
            <TabsTrigger value="outbound">Outbound</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="released">Released</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              placeholder="Search shipment #, account, carrier, tracking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={isMobile ? 'w-full' : 'w-[420px]'}
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={isMobile ? 'w-full' : 'w-[220px]'}>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="expected">Expected</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value={activeTab} className="space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : filteredShipments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No shipments found.</div>
            ) : (
              filteredShipments.map((s) => (
                <Card
                  key={s.id}
                  className="p-4 cursor-pointer hover:bg-muted/30 transition"
                  onClick={() => navigate(`/shipments/${s.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold">{s.shipment_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {s.account_name ? `${s.account_name}${s.account_code ? ` (${s.account_code})` : ''}` : 'No account'}
                        {s.warehouse_name ? ` • ${s.warehouse_name}` : ''}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {s.carrier ? `${s.carrier}` : '—'}
                        {s.tracking_number ? ` • ${s.tracking_number}` : ''}
                      </div>
                    </div>

                    <Badge variant="secondary">{s.status}</Badge>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
