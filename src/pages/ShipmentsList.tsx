import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Search, Package, Loader2, Filter, Plus, Truck, ArrowLeft, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardDescription,
  MobileDataCardContent,
} from '@/components/ui/mobile-data-card';

interface Shipment {
  id: string;
  shipment_number: string;
  shipment_type: string;
  release_type: string | null;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  expected_arrival_date: string | null;
  received_at: string | null;
  completed_at: string | null;
  created_at: string;
  account_name?: string;
  warehouse_name?: string;
  item_count?: number;
}

export default function ShipmentsList() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const directionParam = searchParams.get('direction');
  
  // Determine view mode based on URL path
  const getInitialTab = () => {
    if (location.pathname === '/shipments/received' || location.pathname === '/shipments/released') {
      return 'received';
    }
    if (location.pathname === '/shipments/outbound') {
      return 'outbound';
    }
    if (directionParam === 'outbound') {
      return 'outbound';
    }
    return 'inbound';
  };
  
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>(getInitialTab());

  useEffect(() => {
    fetchShipments();
  }, [activeTab]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const shipmentsTable = supabase.from('shipments') as any;
      
      let query = shipmentsTable
        .select(`
          id, 
          shipment_number, 
          shipment_type, 
          release_type,
          status, 
          carrier, 
          tracking_number,
          expected_arrival_date,
          received_at,
          completed_at,
          created_at,
          accounts(account_name),
          warehouses(name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      // Filter by status for received view, otherwise by shipment type
      // Also exclude received/completed items from inbound/outbound tabs
      if (activeTab === 'received') {
        query = query.in('status', ['received', 'completed']);
      } else if (activeTab === 'inbound') {
        query = query.eq('shipment_type', 'inbound').not('status', 'in', '("received","completed")');
      } else if (activeTab === 'outbound') {
        query = query.eq('shipment_type', 'outbound').not('status', 'in', '("received","completed")');
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setShipments(
        (data || []).map((s: any) => ({
          ...s,
          account_name: s.accounts?.account_name,
          warehouse_name: s.warehouses?.name,
        }))
      );
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch =
      shipment.shipment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.carrier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      expected: 'secondary',
      in_progress: 'default',
      in_transit: 'default',
      received: 'outline',
      completed: 'outline',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  const getReleaseTypeBadge = (type: string | null) => {
    if (!type) return null;
    const colors: Record<string, string> = {
      will_call: 'bg-amber-100 text-amber-800',
      disposal: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[type] || ''}>
        {type === 'will_call' ? 'Will Call' : type}
      </Badge>
    );
  };

  const uniqueStatuses = [...new Set(shipments.map((s) => s.status))];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/shipments')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {activeTab === 'received' 
                  ? 'Received Shipments' 
                  : activeTab === 'inbound' 
                    ? 'Incoming Shipments' 
                    : 'Outbound Shipments'}
              </h1>
              <p className="text-muted-foreground">
                {activeTab === 'received'
                  ? 'View completed receiving shipments'
                  : activeTab === 'inbound' 
                    ? 'Manage receiving and incoming shipments' 
                    : 'Manage will call and disposal releases'}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/shipments/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Shipment
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbound" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Incoming
            </TabsTrigger>
            <TabsTrigger value="outbound" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Outbound
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Received
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === 'inbound' ? 'Incoming' : 'Outbound'} Shipments
                </CardTitle>
                <CardDescription>
                  {filteredShipments.length} shipments found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by shipment #, account, carrier..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {uniqueStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredShipments.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No shipments found</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Get started by creating a new shipment'}
                    </p>
                  </div>
                ) : isMobile ? (
                  <div className="space-y-3">
                    {filteredShipments.map((shipment) => (
                      <MobileDataCard
                        key={shipment.id}
                        onClick={() => navigate(`/shipments/${shipment.id}`)}
                      >
                        <MobileDataCardHeader>
                          <div>
                            <MobileDataCardTitle>{shipment.shipment_number}</MobileDataCardTitle>
                            <MobileDataCardDescription>{shipment.account_name || '-'}</MobileDataCardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(shipment.status)}
                            {activeTab === 'outbound' && getReleaseTypeBadge(shipment.release_type)}
                          </div>
                        </MobileDataCardHeader>
                        <MobileDataCardContent>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            {activeTab === 'inbound' && (
                              <div>
                                <span>Carrier:</span>
                                <div className="text-foreground">{shipment.carrier || '-'}</div>
                              </div>
                            )}
                            <div>
                              <span>{activeTab === 'inbound' ? 'Expected:' : 'Created:'}</span>
                              <div className="text-foreground">
                                {activeTab === 'inbound'
                                  ? shipment.expected_arrival_date
                                    ? format(new Date(shipment.expected_arrival_date), 'MMM d, yyyy')
                                    : '-'
                                  : format(new Date(shipment.created_at), 'MMM d, yyyy')}
                              </div>
                            </div>
                            <div>
                              <span>Warehouse:</span>
                              <div className="text-foreground">{shipment.warehouse_name || '-'}</div>
                            </div>
                          </div>
                        </MobileDataCardContent>
                      </MobileDataCard>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shipment #</TableHead>
                          {activeTab === 'outbound' && <TableHead>Type</TableHead>}
                          <TableHead>Status</TableHead>
                          <TableHead>Account</TableHead>
                          {activeTab === 'inbound' && <TableHead>Carrier</TableHead>}
                          <TableHead>
                            {activeTab === 'inbound' ? 'Expected' : 'Created'}
                          </TableHead>
                          <TableHead>Warehouse</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredShipments.map((shipment) => (
                          <TableRow
                            key={shipment.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/shipments/${shipment.id}`)}
                          >
                            <TableCell className="font-medium">
                              {shipment.shipment_number}
                            </TableCell>
                            {activeTab === 'outbound' && (
                              <TableCell>
                                {getReleaseTypeBadge(shipment.release_type)}
                              </TableCell>
                            )}
                            <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                            <TableCell>{shipment.account_name || '-'}</TableCell>
                            {activeTab === 'inbound' && (
                              <TableCell>{shipment.carrier || '-'}</TableCell>
                            )}
                            <TableCell>
                              {activeTab === 'inbound'
                                ? shipment.expected_arrival_date
                                  ? format(new Date(shipment.expected_arrival_date), 'MMM d, yyyy')
                                  : '-'
                                : format(new Date(shipment.created_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>{shipment.warehouse_name || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
