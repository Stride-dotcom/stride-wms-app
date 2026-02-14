import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { ShipmentNumberBadge } from '@/components/shipments/ShipmentNumberBadge';
import { ShipmentExceptionBadge } from '@/components/shipments/ShipmentExceptionBadge';
import { useIncomingShipments, type InboundKind, type IncomingShipment } from '@/hooks/useIncomingShipments';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUnidentifiedAccount } from '@/hooks/useUnidentifiedAccount';
import { useAccounts } from '@/hooks/useAccounts';
import { DraftQueueList } from '@/components/receiving/DraftQueueList';

type TabValue = 'manifests' | 'expected' | 'dock_intakes';

const TAB_TO_KIND: Record<TabValue, InboundKind> = {
  manifests: 'manifest',
  expected: 'expected',
  dock_intakes: 'dock_intake',
};

const MANIFEST_STATUSES = ['all', 'draft', 'submitted', 'partially_allocated', 'fully_allocated', 'completed'];
const EXPECTED_STATUSES = ['all', 'open', 'partially_received', 'completed', 'cancelled'];
const DOCK_INTAKE_STATUSES = ['all', 'draft', 'stage1_complete', 'receiving', 'matched', 'completed'];

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
    case 'receiving':
    case 'stage1_complete':
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

function formatStatus(status: string | null | undefined): string {
  if (!status) return 'draft';
  return status.replace(/_/g, ' ');
}

/* -- Manifest List -- */
function ManifestList({
  shipments,
  loading,
  onRowClick,
}: {
  shipments: IncomingShipment[];
  loading: boolean;
  onRowClick: (id: string) => void;
}) {
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
        <MaterialIcon name="list_alt" size="xl" className="mb-2 opacity-40" />
        <p>No manifests found.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        {shipments.map((s) => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onRowClick(s.id)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShipmentNumberBadge shipmentNumber={s.shipment_number} exceptionType={s.shipment_exception_type} />
                  <ShipmentExceptionBadge shipmentId={s.id} count={s.exception_count} />
                </div>
                <Badge variant={statusBadgeVariant(s.inbound_status)}>
                  {formatStatus(s.inbound_status)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{s.account_name || '-'}</div>
              <div className="text-xs text-muted-foreground">
                {s.expected_pieces ?? '-'} pcs / {s.open_items_count ?? '-'} items
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Manifest #</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead className="text-right">Pieces</TableHead>
              <TableHead className="text-right">Items</TableHead>
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
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ShipmentNumberBadge shipmentNumber={s.shipment_number} exceptionType={s.shipment_exception_type} />
                    <ShipmentExceptionBadge shipmentId={s.id} count={s.exception_count} />
                  </div>
                </TableCell>
                <TableCell>{s.account_name || '-'}</TableCell>
                <TableCell>{s.vendor_name || '-'}</TableCell>
                <TableCell>{formatDate(s.eta_start)}</TableCell>
                <TableCell className="text-right">{s.expected_pieces ?? '-'}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {s.open_items_count ?? '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(s.inbound_status)}>
                    {formatStatus(s.inbound_status)}
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
    </>
  );
}

/* -- Expected Shipments List -- */
function ExpectedList({
  shipments,
  loading,
  onRowClick,
}: {
  shipments: IncomingShipment[];
  loading: boolean;
  onRowClick: (id: string) => void;
}) {
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
        <MaterialIcon name="schedule" size="xl" className="mb-2 opacity-40" />
        <p>No expected shipments found.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        {shipments.map((s) => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onRowClick(s.id)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShipmentNumberBadge shipmentNumber={s.shipment_number} exceptionType={s.shipment_exception_type} />
                  <ShipmentExceptionBadge shipmentId={s.id} count={s.exception_count} />
                </div>
                <Badge variant={statusBadgeVariant(s.inbound_status)}>
                  {formatStatus(s.inbound_status)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{s.account_name || '-'}</div>
              <div className="text-xs text-muted-foreground">
                {s.expected_pieces ?? '-'} pcs / {s.open_items_count ?? '-'} items
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expected #</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>ETA Window</TableHead>
              <TableHead className="text-right">Expected Pieces</TableHead>
              <TableHead className="text-right">Items</TableHead>
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
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ShipmentNumberBadge shipmentNumber={s.shipment_number} exceptionType={s.shipment_exception_type} />
                    <ShipmentExceptionBadge shipmentId={s.id} count={s.exception_count} />
                  </div>
                </TableCell>
                <TableCell>{s.account_name || '-'}</TableCell>
                <TableCell>{s.vendor_name || '-'}</TableCell>
                <TableCell>
                  {s.eta_start || s.eta_end ? (
                    <span className="text-sm">
                      {formatDate(s.eta_start)}
                      {s.eta_end ? ` - ${formatDate(s.eta_end)}` : ''}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">{s.expected_pieces ?? '-'}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {s.open_items_count ?? '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(s.inbound_status)}>
                    {formatStatus(s.inbound_status)}
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
    </>
  );
}

/* -- Dock Intakes List -- */
function DockIntakeList({
  shipments,
  loading,
  onRowClick,
}: {
  shipments: IncomingShipment[];
  loading: boolean;
  onRowClick: (id: string) => void;
}) {
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
        <MaterialIcon name="local_shipping" size="xl" className="mb-2 opacity-40" />
        <p>No dock intakes found.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        {shipments.map((s) => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onRowClick(s.id)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShipmentNumberBadge shipmentNumber={s.shipment_number} exceptionType={s.shipment_exception_type} />
                  <ShipmentExceptionBadge shipmentId={s.id} count={s.exception_count} />
                </div>
                <Badge variant={statusBadgeVariant(s.inbound_status)}>
                  {formatStatus(s.inbound_status)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{s.account_name || 'Unknown'}</div>
              <div className="text-xs text-muted-foreground">
                {s.signed_pieces ?? '-'} signed pcs
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Intake #</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Signed Pieces</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Arrived</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(s.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ShipmentNumberBadge shipmentNumber={s.shipment_number} exceptionType={s.shipment_exception_type} />
                    <ShipmentExceptionBadge shipmentId={s.id} count={s.exception_count} />
                  </div>
                </TableCell>
                <TableCell>
                  {s.account_name || (
                    <span className="text-muted-foreground italic">Unknown</span>
                  )}
                </TableCell>
                <TableCell>{s.vendor_name || '-'}</TableCell>
                <TableCell className="text-right">{s.signed_pieces ?? '-'}</TableCell>
                <TableCell>
                  <Badge variant={statusBadgeVariant(s.inbound_status)}>
                    {formatStatus(s.inbound_status)}
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
    </>
  );
}

/* -- Main IncomingContent component -- */
interface IncomingContentProps {
  initialSubTab?: 'manifests' | 'expected' | 'intakes';
  onStartDockIntake?: () => void;
}

export function IncomingContent({ initialSubTab, onStartDockIntake }: IncomingContentProps) {
  const navigate = useNavigate();
  const mapInitialTab = (): TabValue => {
    if (initialSubTab === 'intakes') return 'dock_intakes';
    if (initialSubTab === 'expected') return 'expected';
    return 'manifests';
  };

  const [activeTab, setActiveTab] = useState<TabValue>(mapInitialTab);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creating, setCreating] = useState(false);

  // Keep active tab aligned with parent-provided sub-tab.
  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(mapInitialTab());
    }
  }, [initialSubTab]);

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

  const { profile } = useAuth();
  const { toast } = useToast();
  const { unidentifiedAccountId } = useUnidentifiedAccount();
  const { accounts } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Default selected account to UNIDENTIFIED once loaded
  useEffect(() => {
    if (unidentifiedAccountId && !selectedAccountId) {
      setSelectedAccountId(unidentifiedAccountId);
    }
  }, [unidentifiedAccountId, selectedAccountId]);

  const handleRowClick = (id: string) => {
    if (activeTab === 'manifests') {
      navigate(`/incoming/manifest/${id}`);
    } else if (activeTab === 'expected') {
      navigate(`/incoming/expected/${id}`);
    } else {
      navigate(`/incoming/dock-intake/${id}`);
    }
  };

  const handleCreateInbound = async (kind: InboundKind) => {
    if (!profile?.tenant_id) return;
    if (!selectedAccountId) {
      toast({
        variant: 'destructive',
        title: 'Account Required',
        description: 'Please select an account before creating a shipment.',
      });
      return;
    }
    try {
      setCreating(true);

      // Insert with exact PF-1 payload (no account_id)
      const { data, error } = await (supabase as any)
        .from('shipments')
        .insert({
          tenant_id: profile.tenant_id,
          shipment_type: 'inbound',
          status: 'expected',
          inbound_kind: kind,
          inbound_status: 'draft',
          created_by: profile.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Post-insert: set account_id
      const { error: updateError } = await (supabase as any)
        .from('shipments')
        .update({ account_id: selectedAccountId })
        .eq('id', data.id);

      if (updateError) throw updateError;

      const routeMap: Record<InboundKind, string> = {
        manifest: `/incoming/manifest/${data.id}`,
        expected: `/incoming/expected/${data.id}`,
        dock_intake: `/incoming/dock-intake/${data.id}`,
      };

      navigate(routeMap[kind]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create record';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
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
                  placeholder="Search #, account, vendor, notes, refs..."
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

              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
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

              <div className="flex gap-2 ml-auto">
                {activeTab === 'manifests' && (
                  <Button
                    size="sm"
                    onClick={() => handleCreateInbound('manifest')}
                    disabled={creating || !selectedAccountId}
                  >
                    <MaterialIcon name="add" size="sm" className="mr-1" />
                    New Manifest
                  </Button>
                )}
                {activeTab === 'expected' && (
                  <Button
                    size="sm"
                    onClick={() => handleCreateInbound('expected')}
                    disabled={creating || !selectedAccountId}
                  >
                    <MaterialIcon name="add" size="sm" className="mr-1" />
                    New Expected Shipment
                  </Button>
                )}
              </div>

              <HelpTip
                tooltip="Filter and search inbound shipments. Click a row to view details, allocate items, or manage references."
                pageKey="incoming.list"
                fieldKey="filters_toolbar"
              />
            </div>
          </CardContent>
        </Card>

        <TabsContent value="manifests" className="mt-4">
          <ManifestList
            shipments={shipments}
            loading={loading}
            onRowClick={handleRowClick}
          />
        </TabsContent>

        <TabsContent value="expected" className="mt-4">
          <ExpectedList
            shipments={shipments}
            loading={loading}
            onRowClick={handleRowClick}
          />
        </TabsContent>

        <TabsContent value="dock_intakes" className="mt-4 space-y-6">
          {/* Draft Queue */}
          <DraftQueueList
            onSelect={(id) => navigate(`/incoming/dock-intake/${id}`)}
            onCreateNew={() => onStartDockIntake ? onStartDockIntake() : handleCreateInbound('dock_intake')}
          />

          {/* All dock intakes (including closed) */}
          <div>
            <h3 className="font-medium text-sm text-muted-foreground mb-3">All Dock Intakes</h3>
            <DockIntakeList
              shipments={shipments}
              loading={loading}
              onRowClick={handleRowClick}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
