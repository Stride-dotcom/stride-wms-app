import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { useIncomingShipments, type InboundKind, type IncomingShipment } from '@/hooks/useIncomingShipments';

type TabValue = 'manifests' | 'expected' | 'dock_intakes';

const TAB_TO_KIND: Record<TabValue, InboundKind> = {
  manifests: 'manifest',
  expected: 'expected',
  dock_intakes: 'dock_intake',
};

const MANIFEST_STATUSES = ['all', 'draft', 'submitted', 'partially_allocated', 'fully_allocated', 'completed'];
const EXPECTED_STATUSES = ['all', 'open', 'partially_received', 'completed', 'cancelled'];
const DOCK_INTAKE_STATUSES = ['all', 'pending', 'matched', 'completed'];

function statusBadgeVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'outline';
  switch (status) {
    case 'completed':
    case 'fully_allocated':
    case 'matched':
      return 'default';
    case 'partially_allocated':
    case 'partially_received':
    case 'submitted':
    case 'open':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

interface ShipmentListProps {
  shipments: IncomingShipment[];
  loading: boolean;
  kind: InboundKind;
  onRowClick: (id: string) => void;
}

function ShipmentList({ shipments, loading, kind, onRowClick }: ShipmentListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-primary" />
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MaterialIcon name="inbox" size="xl" className="mb-2 opacity-40" />
        <p>No {kind === 'manifest' ? 'manifests' : kind === 'expected' ? 'expected shipments' : 'dock intakes'} found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment #</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Vendor</TableHead>
            {kind !== 'dock_intake' && <TableHead>ETA</TableHead>}
            <TableHead className="text-right">Pieces</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((s) => (
            <TableRow
              key={s.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(s.id)}
            >
              <TableCell className="font-mono font-medium">{s.shipment_number}</TableCell>
              <TableCell>{s.account_name || '-'}</TableCell>
              <TableCell>{s.vendor_name || '-'}</TableCell>
              {kind !== 'dock_intake' && (
                <TableCell>{formatDate(s.eta_start)}</TableCell>
              )}
              <TableCell className="text-right">{s.expected_pieces ?? '-'}</TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(s.inbound_status)}>
                  {s.inbound_status || 'draft'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(s.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function IncomingManager() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('manifests');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const currentKind = TAB_TO_KIND[activeTab];

  const { shipments, loading } = useIncomingShipments({
    inbound_kind: currentKind,
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const statusOptions = useMemo(() => {
    switch (activeTab) {
      case 'manifests':
        return MANIFEST_STATUSES;
      case 'expected':
        return EXPECTED_STATUSES;
      case 'dock_intakes':
        return DOCK_INTAKE_STATUSES;
    }
  }, [activeTab]);

  const handleTabChange = (val: string) => {
    setActiveTab(val as TabValue);
    setStatusFilter('all');
    setSearch('');
  };

  const handleRowClick = (id: string) => {
    if (activeTab === 'manifests') {
      navigate(`/incoming/manifest/${id}`);
    } else if (activeTab === 'expected') {
      navigate(`/incoming/expected/${id}`);
    } else {
      navigate(`/incoming/manifest/${id}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            primaryText="Incoming"
            accentText="Manager"
            description="Plan, track, and allocate inbound shipments"
          />
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="manifests" className="gap-2">
              <MaterialIcon name="list_alt" size="sm" />
              Manifests
            </TabsTrigger>
            <TabsTrigger value="expected" className="gap-2">
              <MaterialIcon name="schedule" size="sm" />
              Expected Shipments
            </TabsTrigger>
            <TabsTrigger value="dock_intakes" className="gap-2">
              <MaterialIcon name="local_shipping" size="sm" />
              Dock Intakes
            </TabsTrigger>
          </TabsList>

          {/* Shared toolbar */}
          <Card className="mt-4">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 w-full sm:max-w-xs">
                  <MaterialIcon
                    name="search"
                    size="sm"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    placeholder="Search by shipment # or vendor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <HelpTip tooltip="Filter and search inbound shipments. Click a row to view details, allocate items, or manage references." />
              </div>
            </CardContent>
          </Card>

          <TabsContent value="manifests" className="mt-4">
            <ShipmentList
              shipments={shipments}
              loading={loading}
              kind="manifest"
              onRowClick={handleRowClick}
            />
          </TabsContent>

          <TabsContent value="expected" className="mt-4">
            <ShipmentList
              shipments={shipments}
              loading={loading}
              kind="expected"
              onRowClick={handleRowClick}
            />
          </TabsContent>

          <TabsContent value="dock_intakes" className="mt-4">
            <ShipmentList
              shipments={shipments}
              loading={loading}
              kind="dock_intake"
              onRowClick={handleRowClick}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
