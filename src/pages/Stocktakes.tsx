import { useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardContent,
  MobileDataCardActions,
} from '@/components/ui/mobile-data-card';
import { useStocktakes, StocktakeStatus } from '@/hooks/useStocktakes';
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
  Calendar,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<StocktakeStatus, string> = {
  planned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const statusLabels: Record<StocktakeStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function Stocktakes() {
  const [statusFilter, setStatusFilter] = useState<StocktakeStatus | 'all'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newStocktakeData, setNewStocktakeData] = useState({
    warehouse_id: '',
    scheduled_date: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isMobile = useIsMobile();
  const { warehouses } = useWarehouses();
  const { 
    stocktakes, 
    loading, 
    refetch, 
    createStocktake, 
    startStocktake, 
    completeStocktake,
    cancelStocktake,
  } = useStocktakes({
    status: statusFilter === 'all' ? undefined : statusFilter,
    warehouseId: warehouseFilter === 'all' ? undefined : warehouseFilter,
  });

  const filteredStocktakes = stocktakes.filter(st => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      st.stocktake_number.toLowerCase().includes(query) ||
      st.warehouse?.name?.toLowerCase().includes(query) ||
      st.location?.code?.toLowerCase().includes(query)
    );
  });

  const handleCreateStocktake = async () => {
    if (!newStocktakeData.warehouse_id) return;
    
    setIsSubmitting(true);
    try {
      await createStocktake({
        warehouse_id: newStocktakeData.warehouse_id,
        scheduled_date: newStocktakeData.scheduled_date || null,
        notes: newStocktakeData.notes || null,
      });
      setCreateDialogOpen(false);
      setNewStocktakeData({ warehouse_id: '', scheduled_date: '', notes: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = async (id: string) => {
    await startStocktake(id);
  };

  const handleComplete = async (id: string) => {
    await completeStocktake(id);
  };

  const handleCancel = async (id: string) => {
    await cancelStocktake(id);
  };

  const getStatusBadge = (status: string) => (
    <Badge className={statusColors[status as StocktakeStatus] || statusColors.planned}>
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
    planned: stocktakes.filter(s => s.status === 'planned').length,
    inProgress: stocktakes.filter(s => s.status === 'in_progress').length,
    completed: stocktakes.filter(s => s.status === 'completed').length,
    withVariance: stocktakes.filter(s => s.variance_count && s.variance_count > 0).length,
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-foreground">Cycle</span>{" "}
            <span className="text-primary">Counts</span>
          </h1>
          <p className="text-muted-foreground">Schedule and manage inventory stocktakes</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Count
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Planned</p>
                <p className="text-2xl font-bold text-blue-400">{stats.planned}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.inProgress}</p>
              </div>
              <Play className="h-8 w-8 text-yellow-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
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
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StocktakeStatus | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
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
                  <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
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
                Schedule your first cycle count
              </Button>
            </div>
          ) : isMobile ? (
            <div className="divide-y divide-border">
              {filteredStocktakes.map((st) => (
                <MobileDataCard key={st.id}>
                  <MobileDataCardHeader>
                    <MobileDataCardTitle>{st.stocktake_number}</MobileDataCardTitle>
                    {getStatusBadge(st.status)}
                  </MobileDataCardHeader>
                  <MobileDataCardContent>
                    <div className="space-y-1 text-muted-foreground">
                      <div><span className="font-medium">Warehouse:</span> {st.warehouse?.name || 'Unknown'}</div>
                      <div><span className="font-medium">Location:</span> {st.location?.code || 'All locations'}</div>
                      <div><span className="font-medium">Scheduled:</span> {st.scheduled_date ? format(new Date(st.scheduled_date), 'MMM d, yyyy') : '-'}</div>
                      <div><span className="font-medium">Items:</span> {st.counted_item_count || 0} / {st.expected_item_count || 0}</div>
                      <div><span className="font-medium">Assigned:</span> {st.assigned_user ? `${st.assigned_user.first_name} ${st.assigned_user.last_name}` : '-'}</div>
                    </div>
                  </MobileDataCardContent>
                  <MobileDataCardActions>
                    {st.status === 'planned' && (
                      <>
                        <Button size="sm" onClick={() => handleStart(st.id)}>
                          <Play className="h-4 w-4 mr-1" /> Start
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCancel(st.id)}>
                          Cancel
                        </Button>
                      </>
                    )}
                    {st.status === 'in_progress' && (
                      <Button size="sm" onClick={() => handleComplete(st.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Complete
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
                  <TableHead>Stocktake #</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStocktakes.map((st) => (
                  <TableRow key={st.id}>
                    <TableCell className="font-mono">{st.stocktake_number}</TableCell>
                    <TableCell>{st.warehouse?.name || '-'}</TableCell>
                    <TableCell>{st.location?.code || 'All'}</TableCell>
                    <TableCell>
                      {st.scheduled_date ? format(new Date(st.scheduled_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(st.status)}</TableCell>
                    <TableCell>
                      {st.counted_item_count || 0} / {st.expected_item_count || 0}
                    </TableCell>
                    <TableCell>{getVarianceBadge(st.variance_count)}</TableCell>
                    <TableCell>
                      {st.assigned_user 
                        ? `${st.assigned_user.first_name} ${st.assigned_user.last_name}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {st.status === 'planned' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleStart(st.id)}>
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCancel(st.id)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {st.status === 'in_progress' && (
                          <Button size="sm" variant="ghost" onClick={() => handleComplete(st.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
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
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Cycle Count</DialogTitle>
            <DialogDescription>
              Create a new inventory stocktake for a warehouse or location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Warehouse *</Label>
              <Select 
                value={newStocktakeData.warehouse_id} 
                onValueChange={(v) => setNewStocktakeData(d => ({ ...d, warehouse_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input
                type="date"
                value={newStocktakeData.scheduled_date}
                onChange={(e) => setNewStocktakeData(d => ({ ...d, scheduled_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newStocktakeData.notes}
                onChange={(e) => setNewStocktakeData(d => ({ ...d, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateStocktake} disabled={isSubmitting || !newStocktakeData.warehouse_id}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
