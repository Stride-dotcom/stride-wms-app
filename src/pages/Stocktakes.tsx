import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardContent,
  MobileDataCardActions,
} from '@/components/ui/mobile-data-card';
import { CreateStocktakeDialog } from '@/components/stocktakes/CreateStocktakeDialog';
import { useStocktakes, StocktakeStatus, CreateStocktakeData } from '@/hooks/useStocktakes';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Plus,
  Search,
  RefreshCw,
  ClipboardCheck,
  Play,
  CheckCircle,
  XCircle,
  FileEdit,
  Loader2,
  AlertTriangle,
  Lock,
  Wrench,
  DollarSign,
  ScanLine,
  FileBarChart,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<StocktakeStatus, string> = {
  draft: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  active: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  closed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const statusLabels: Record<StocktakeStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export default function Stocktakes() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StocktakeStatus | 'all'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'start' | 'close' | 'cancel';
    id: string;
    name: string;
  } | null>(null);

  const isMobile = useIsMobile();
  const { warehouses } = useWarehouses();
  const {
    stocktakes,
    loading,
    refetch,
    createStocktake,
    startStocktake,
    closeStocktake,
    cancelStocktake,
  } = useStocktakes({
    status: statusFilter === 'all' ? undefined : statusFilter,
    warehouseId: warehouseFilter === 'all' ? undefined : warehouseFilter,
  });

  const filteredStocktakes = stocktakes.filter((st) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      st.stocktake_number.toLowerCase().includes(query) ||
      st.name?.toLowerCase().includes(query) ||
      st.warehouse?.name?.toLowerCase().includes(query)
    );
  });

  const handleCreateStocktake = async (data: CreateStocktakeData) => {
    await createStocktake(data);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      switch (confirmAction.type) {
        case 'start':
          await startStocktake(confirmAction.id);
          break;
        case 'close':
          await closeStocktake(confirmAction.id);
          break;
        case 'cancel':
          await cancelStocktake(confirmAction.id);
          break;
      }
    } finally {
      setConfirmAction(null);
    }
  };

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status as StocktakeStatus] || statusColors.draft}>
      {statusLabels[status as StocktakeStatus] || status}
    </Badge>
  );

  const getVarianceBadge = (variance: number | null) => {
    if (variance === null || variance === 0) return null;
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {variance} variance{variance !== 1 ? 's' : ''}
      </Badge>
    );
  };

  const stats = {
    draft: stocktakes.filter((s) => s.status === 'draft').length,
    active: stocktakes.filter((s) => s.status === 'active').length,
    closed: stocktakes.filter((s) => s.status === 'closed').length,
    withVariance: stocktakes.filter((s) => s.variance_count && s.variance_count > 0).length,
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-foreground">Stock</span>{' '}
            <span className="text-primary">take</span>
          </h1>
          <p className="text-muted-foreground">Schedule and manage inventory cycle counts</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Stocktake
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold text-blue-400">{stats.draft}</p>
              </div>
              <FileEdit className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.active}</p>
              </div>
              <Play className="h-8 w-8 text-yellow-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed</p>
                <p className="text-2xl font-bold text-green-400">{stats.closed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Variance</p>
                <p className="text-2xl font-bold text-red-400">{stats.withVariance}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stocktakes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StocktakeStatus | 'all')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stocktakes List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStocktakes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No stocktakes found</p>
              <Button variant="link" onClick={() => setCreateDialogOpen(true)}>
                Create your first stocktake
              </Button>
            </div>
          ) : isMobile ? (
            <div className="divide-y divide-border">
              {filteredStocktakes.map((st) => (
                <MobileDataCard key={st.id}>
                  <MobileDataCardHeader>
                    <MobileDataCardTitle className="flex items-center gap-2">
                      {st.name || st.stocktake_number}
                      {st.freeze_moves && (
                        <Lock className="h-4 w-4 text-yellow-500" title="Movements frozen" />
                      )}
                      {st.allow_location_auto_fix && (
                        <Wrench className="h-4 w-4 text-blue-500" title="Auto-fix enabled" />
                      )}
                      {st.billable && (
                        <DollarSign className="h-4 w-4 text-green-500" title="Billable" />
                      )}
                    </MobileDataCardTitle>
                    {getStatusBadge(st.status)}
                  </MobileDataCardHeader>
                  <MobileDataCardContent>
                    <div className="space-y-1 text-muted-foreground">
                      <div>
                        <span className="font-medium">Number:</span> {st.stocktake_number}
                      </div>
                      <div>
                        <span className="font-medium">Warehouse:</span>{' '}
                        {st.warehouse?.name || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">Locations:</span>{' '}
                        {st.location_ids ? `${(st.location_ids as string[]).length} selected` : 'All'}
                      </div>
                      <div>
                        <span className="font-medium">Items:</span> {st.counted_item_count || 0} /{' '}
                        {st.expected_item_count || 0}
                      </div>
                      {st.closed_at && (
                        <div>
                          <span className="font-medium">Closed:</span>{' '}
                          {format(new Date(st.closed_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      )}
                      {st.variance_count !== null && st.variance_count > 0 && (
                        <div>{getVarianceBadge(st.variance_count)}</div>
                      )}
                    </div>
                  </MobileDataCardContent>
                  <MobileDataCardActions>
                    {st.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirmAction({ type: 'start', id: st.id, name: st.stocktake_number })
                          }
                        >
                          <Play className="h-4 w-4 mr-1" /> Start
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirmAction({ type: 'cancel', id: st.id, name: st.stocktake_number })
                          }
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    {st.status === 'active' && (
                      <>
                        <Button size="sm" onClick={() => navigate(`/stocktakes/${st.id}/scan`)}>
                          <ScanLine className="h-4 w-4 mr-1" /> Scan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirmAction({ type: 'close', id: st.id, name: st.stocktake_number })
                          }
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Close
                        </Button>
                      </>
                    )}
                    {st.status === 'closed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/stocktakes/${st.id}/report`)}
                      >
                        <FileBarChart className="h-4 w-4 mr-1" /> Report
                      </Button>
                    )}
                  </MobileDataCardActions>
                </MobileDataCard>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Number</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStocktakes.map((st) => (
                  <TableRow
                    key={st.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/stocktakes/${st.id}/scan`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{st.name || st.stocktake_number}</div>
                          {st.name && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {st.stocktake_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{st.warehouse?.name || '-'}</TableCell>
                    <TableCell>
                      {st.location_ids
                        ? `${(st.location_ids as string[]).length} locations`
                        : 'All'}
                    </TableCell>
                    <TableCell>{getStatusBadge(st.status)}</TableCell>
                    <TableCell>
                      {st.counted_item_count || 0} / {st.expected_item_count || 0}
                    </TableCell>
                    <TableCell>{getVarianceBadge(st.variance_count)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {st.freeze_moves && (
                          <Lock className="h-4 w-4 text-yellow-500" title="Movements frozen" />
                        )}
                        {st.allow_location_auto_fix && (
                          <Wrench className="h-4 w-4 text-blue-500" title="Auto-fix enabled" />
                        )}
                        {st.billable && (
                          <DollarSign className="h-4 w-4 text-green-500" title="Billable" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {st.status === 'draft' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'start',
                                  id: st.id,
                                  name: st.stocktake_number,
                                })
                              }
                              title="Start stocktake"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'cancel',
                                  id: st.id,
                                  name: st.stocktake_number,
                                })
                              }
                              title="Cancel stocktake"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {st.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/stocktakes/${st.id}/scan`)}
                              title="Scan items"
                            >
                              <ScanLine className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setConfirmAction({
                                  type: 'close',
                                  id: st.id,
                                  name: st.stocktake_number,
                                })
                              }
                              title="Close stocktake"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {st.status === 'closed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/stocktakes/${st.id}/report`)}
                            title="View report"
                          >
                            <FileBarChart className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/stocktakes/${st.id}/scan`)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Stocktake Dialog */}
      <CreateStocktakeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateStocktake}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'start' && 'Start Stocktake?'}
              {confirmAction?.type === 'close' && 'Close Stocktake?'}
              {confirmAction?.type === 'cancel' && 'Cancel Stocktake?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'start' && (
                <>
                  This will initialize the expected items list and activate the stocktake{' '}
                  <strong>{confirmAction.name}</strong>. You can then start scanning items.
                </>
              )}
              {confirmAction?.type === 'close' && (
                <>
                  This will finalize the stocktake <strong>{confirmAction.name}</strong> and
                  generate the variance report. Any unscanned items will be marked as missing.
                </>
              )}
              {confirmAction?.type === 'cancel' && (
                <>
                  This will cancel the stocktake <strong>{confirmAction.name}</strong>. This action
                  cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              {confirmAction?.type === 'start' && 'Start'}
              {confirmAction?.type === 'close' && 'Close'}
              {confirmAction?.type === 'cancel' && 'Cancel Stocktake'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
