import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { ShipmentNumberBadge } from '@/components/shipments/ShipmentNumberBadge';
import { format } from 'date-fns';

interface OutboundShipment {
  id: string;
  shipment_number: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  expected_arrival_date: string | null;
  shipped_at: string | null;
  release_type: string | null;
  outbound_type_name: string | null;
  created_at: string;
  account_name: string | null;
  shipment_exception_type: string | null;
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  expected: 'Expected',
  in_progress: 'In Progress',
  released: 'Released',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function OutboundContent() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<OutboundShipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const fetchShipments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('shipments')
          .select(`
            id,
            shipment_number,
            status,
            carrier,
            tracking_number,
            expected_arrival_date,
            shipped_at,
            release_type,
            created_at,
            shipment_exception_type,
            accounts:account_id(account_name),
            outbound_type:outbound_types(name)
          `)
          .eq('tenant_id', profile.tenant_id)
          .eq('shipment_type', 'outbound')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[OutboundContent] fetch failed:', error);
          return;
        }

        const transformed: OutboundShipment[] = (data || []).map((s: any) => ({
          id: s.id,
          shipment_number: s.shipment_number,
          status: s.status,
          carrier: s.carrier,
          tracking_number: s.tracking_number,
          expected_arrival_date: s.expected_arrival_date,
          shipped_at: s.shipped_at,
          release_type: s.release_type,
          outbound_type_name: s.outbound_type?.name || null,
          created_at: s.created_at,
          account_name: s.accounts?.account_name || null,
          shipment_exception_type: s.shipment_exception_type || null,
        }));

        setShipments(transformed);
      } catch (err) {
        console.error('[OutboundContent] exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, [profile?.tenant_id]);

  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          shipment.shipment_number.toLowerCase().includes(query) ||
          shipment.account_name?.toLowerCase().includes(query) ||
          shipment.tracking_number?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (statusFilter !== 'all' && shipment.status !== statusFilter) return false;
      if (accountFilter !== 'all' && shipment.account_name !== accountFilter) return false;
      return true;
    });
  }, [shipments, searchQuery, statusFilter, accountFilter]);

  const uniqueStatuses = useMemo(() => [...new Set(shipments.map(s => s.status))], [shipments]);
  const uniqueAccounts = useMemo(() => [...new Set(shipments.map(s => s.account_name).filter(Boolean))] as string[], [shipments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filteredShipments.length === 0) {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search outbound..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <MaterialIcon name="outbox" size="xl" className="mb-2 opacity-40" />
          <p>No outbound shipments found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search outbound..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {uniqueAccounts.map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {uniqueStatuses.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards */}
      {isMobile ? (
        <div className="space-y-3">
          {filteredShipments.map((shipment) => (
            <Card key={shipment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/shipments/${shipment.id}`)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <ShipmentNumberBadge shipmentNumber={shipment.shipment_number} exceptionType={shipment.shipment_exception_type} />
                  <StatusIndicator status={shipment.status} label={statusLabels[shipment.status]} size="sm" />
                </div>
                <div className="text-sm text-muted-foreground">{shipment.account_name || 'No account'}</div>
                <div className="text-xs text-muted-foreground">
                  {shipment.outbound_type_name || '-'} / {shipment.shipped_at ? format(new Date(shipment.shipped_at), 'MMM d, yyyy') : '-'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShipments.map((shipment) => (
                <TableRow
                  key={shipment.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/shipments/${shipment.id}`)}
                >
                  <TableCell>
                    <ShipmentNumberBadge shipmentNumber={shipment.shipment_number} exceptionType={shipment.shipment_exception_type} />
                  </TableCell>
                  <TableCell>{shipment.account_name || '-'}</TableCell>
                  <TableCell>
                    {shipment.outbound_type_name ? (
                      <Badge variant="outline">{shipment.outbound_type_name}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <StatusIndicator status={shipment.status} label={statusLabels[shipment.status]} size="sm" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(shipment.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
