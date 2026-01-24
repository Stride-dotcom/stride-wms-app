import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileDataCard } from '@/components/ui/mobile-data-card';
import { Loader2, Plus, Search, Package, ArrowDownToLine, ArrowUpFromLine, CheckCircle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

// ============================================
// TYPES
// ============================================

interface Shipment {
  id: string;
  shipment_number: string;
  shipment_type: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  expected_arrival_date: string | null;
  received_at: string | null;
  release_type: string | null;
  created_at: string;
  account_name: string | null;
  warehouse_name: string | null;
}

type TabValue = 'incoming' | 'outbound' | 'received' | 'released';

// ============================================
// COMPONENT
// ============================================

const TAB_VALUES = ['incoming', 'outbound', 'received', 'released'] as const;

const TAB_CONFIG: Record<TabValue, { route: string }> = {
  incoming: { route: '/shipments/incoming' },
  outbound: { route: '/shipments/outbound' },
  received: { route: '/shipments/received' },
  released: { route: '/shipments/released' },
};

export default function ShipmentsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  // State
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const deriveTabFromRoute = (): TabValue => {
    const last = location.pathname.split('/').pop();
    if (last && TAB_VALUES.includes(last as TabValue)) return last as TabValue;
    return 'incoming';
  };

  const [activeTab, setActiveTab] = useState<TabValue>(() => deriveTabFromRoute());

  useEffect(() => {
    setActiveTab(deriveTabFromRoute());
    setStatusFilter('all');
    setSearchQuery('');
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
            query = query
              .in('status', ['received']);
            break;
          case 'released':
            query = query
              .in('status', ['released', 'completed']);
            break;
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error('[ShipmentsList] fetch failed:', error);
          return;
        }

        // Transform data to flatten nested objects
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
          warehouse_name: s.warehouses?.name || null,
        }));

        setShipments(transformedData);
      } catch (err) {
        console.error('[ShipmentsList] fetchShipments exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, [profile?.tenant_id, activeTab]);

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    const next = tab as TabValue;
    setActiveTab(next);
    setStatusFilter('all');
    setSearchQuery('');
    navigate(TAB_CONFIG[next].route);
  };

  // ------------------------------------------
  // Filter shipments
  // ------------------------------------------
  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          shipment.shipment_number.toLowerCase().includes(query) ||
          shipment.account_name?.toLowerCase().includes(query) ||
          shipment.carrier?.toLowerCase().includes(query) ||
          shipment.tracking_number?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && shipment.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [shipments, searchQuery, statusFilter]);

  // Get unique statuses for current tab
  const uniqueStatuses = useMemo(() => {
    return [...new Set(shipments.map(s => s.status))];
  }, [shipments]);

  // ------------------------------------------
  // Status badge helper
  // ------------------------------------------
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      expected: 'secondary',
      in_progress: 'default',
      received: 'default',
      released: 'default',
      completed: 'default',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  // ------------------------------------------
  // Tab content renderer
  // ------------------------------------------
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filteredShipments.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No shipments found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create a new shipment to get started'}
          </p>
          {activeTab === 'incoming' && (
            <Button onClick={() => navigate('/shipments/create')}>
              <Plus className="h-4 w-4 mr-2" />
              New Shipment
            </Button>
          )}
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="space-y-4 p-4">
          {filteredShipments.map((shipment) => (
            <MobileDataCard
              key={shipment.id}
              onClick={() => navigate(`/shipments/${shipment.id}`)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{shipment.shipment_number}</div>
                  <div className="text-sm text-muted-foreground">{shipment.account_name || 'No account'}</div>
                </div>
                <div className="flex gap-1">
                  {getStatusBadge(shipment.status)}
                  {shipment.release_type && (
                    <Badge variant="outline">{shipment.release_type}</Badge>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Carrier: </span>
                  {shipment.carrier || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Tracking: </span>
                  {shipment.tracking_number || '-'}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">
                    {activeTab === 'received' ? 'Received: ' : 'Expected: '}
                  </span>
                  {activeTab === 'received' && shipment.received_at
                    ? format(new Date(shipment.received_at), 'MMM d, yyyy')
                    : shipment.expected_arrival_date
                      ? format(new Date(shipment.expected_arrival_date), 'MMM d, yyyy')
                      : '-'}
                </div>
              </div>
            </MobileDataCard>
          ))}
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment #</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Carrier</TableHead>
            <TableHead>Tracking</TableHead>
            <TableHead>{activeTab === 'received' ? 'Received' : 'Expected'}</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredShipments.map((shipment) => (
            <TableRow
              key={shipment.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`/shipments/${shipment.id}`)}
            >
              <TableCell className="font-medium">{shipment.shipment_number}</TableCell>
              <TableCell>{shipment.account_name || '-'}</TableCell>
              <TableCell>{shipment.carrier || '-'}</TableCell>
              <TableCell>{shipment.tracking_number || '-'}</TableCell>
              <TableCell>
                {activeTab === 'received' && shipment.received_at
                  ? format(new Date(shipment.received_at), 'MMM d, yyyy')
                  : shipment.expected_arrival_date
                    ? format(new Date(shipment.expected_arrival_date), 'MMM d, yyyy')
                    : '-'}
              </TableCell>
              <TableCell>{getStatusBadge(shipment.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  // ------------------------------------------
  // Render
  // ------------------------------------------
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shipments')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader
            primaryText="Shipments"
            accentText="Management"
            description="Manage inbound and outbound shipments"
          />
        </div>
        <Button onClick={() => navigate('/shipments/create')}>
          <Plus className="h-4 w-4 mr-2" />
          New Shipment
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="incoming" className="gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            <span className="hidden sm:inline">Incoming</span>
          </TabsTrigger>
          <TabsTrigger value="outbound" className="gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            <span className="hidden sm:inline">Outbound</span>
          </TabsTrigger>
          <TabsTrigger value="received" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Received</span>
          </TabsTrigger>
          <TabsTrigger value="released" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Released</span>
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shipments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {uniqueStatuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tab Content */}
        <Card>
          <CardContent className="p-0 sm:p-6">
            {renderTabContent()}
          </CardContent>
        </Card>
      </Tabs>
    </DashboardLayout>
  );
}
