import { useEffect, useState, useRef, useMemo } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, Package, Loader2, Truck, Trash2, ClipboardList, Upload, Printer, AlertTriangle, PackageX, ChevronUp, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { InventoryImportDialog } from '@/components/settings/InventoryImportDialog';
import { QuickReleaseDialog } from '@/components/inventory/QuickReleaseDialog';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { InventoryFiltersSheet, InventoryFilters } from '@/components/inventory/InventoryFiltersSheet';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useLocations } from '@/hooks/useLocations';
import { ItemLabelData } from '@/lib/labelGenerator';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { ItemPreviewCard } from '@/components/items/ItemPreviewCard';
import { InlineEditableCell } from '@/components/inventory/InlineEditableCell';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardDescription,
  MobileDataCardContent,
} from '@/components/ui/mobile-data-card';

interface Item {
  id: string;
  item_code: string;
  description: string | null;
  status: string;
  quantity: number;
  client_account: string | null;
  sidemark: string | null;
  vendor: string | null;
  room: string | null;
  location_id: string | null;
  location_code: string | null;
  location_name: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  account_id: string | null;
  received_at: string | null;
  primary_photo_url: string | null;
}

type SortField = 'item_code' | 'vendor' | 'description' | 'quantity' | 'location_code' | 'client_account' | 'sidemark' | 'room';
type SortDirection = 'asc' | 'desc' | null;

export default function Inventory() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [filters, setFilters] = useState<InventoryFilters>({
    vendor: '',
    accountId: '',
    sidemark: '',
    locationId: '',
    warehouseId: '',
  });
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [preSelectedTaskType, setPreSelectedTaskType] = useState<string>('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [printLabelsDialogOpen, setPrintLabelsDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { warehouses } = useWarehouses();
  const { locations } = useLocations();
  const { toast } = useToast();
  const { profile } = useAuth();

  // Compute unique suggestions for inline editing
  const sidemarkSuggestions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => { if (item.sidemark) set.add(item.sidemark); });
    return Array.from(set).sort();
  }, [items]);

  const roomSuggestions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => { if (item.room) set.add(item.room); });
    return Array.from(set).sort();
  }, [items]);

  const handleInlineUpdate = async (itemId: string, field: 'sidemark' | 'room', value: string) => {
    const { error } = await supabase
      .from('items')
      .update({ [field]: value })
      .eq('id', itemId);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      throw error;
    }
    // Update local state
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await (supabase
        .from('v_items_with_location') as any)
        .select('id, item_code, description, status, quantity, client_account, sidemark, vendor, room, location_id, location_code, location_name, warehouse_id, warehouse_name, account_id, received_at, primary_photo_url')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter((item) => {
      // Enhanced search - includes vendor, sidemark, description, item_code, client_account
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        item.item_code.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.client_account?.toLowerCase().includes(searchLower) ||
        item.sidemark?.toLowerCase().includes(searchLower) ||
        item.vendor?.toLowerCase().includes(searchLower);

      // Status filter
      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = item.status !== 'released' && item.status !== 'disposed';
      } else if (statusFilter !== 'all') {
        matchesStatus = item.status === statusFilter;
      }

      // Advanced filters
      const matchesVendor = !filters.vendor || item.vendor === filters.vendor;
      const matchesAccount = !filters.accountId || item.account_id === filters.accountId;
      const matchesSidemark = !filters.sidemark || item.sidemark === filters.sidemark;
      const matchesLocation = !filters.locationId || item.location_id === filters.locationId;
      const matchesWarehouse = !filters.warehouseId || item.warehouse_id === filters.warehouseId;

      return matchesSearch && matchesStatus && matchesVendor && matchesAccount && matchesSidemark && matchesLocation && matchesWarehouse;
    });

    // Sort
    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [items, searchQuery, statusFilter, filters, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortField(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) newSelected.delete(itemId);
    else newSelected.add(itemId);
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredAndSortedItems.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)));
  };

  const getSelectedItemsData = () => items.filter(item => selectedItems.has(item.id)).map(item => ({
    id: item.id, item_code: item.item_code, description: item.description, quantity: item.quantity, client_account: item.client_account, warehouse_id: item.warehouse_id,
  }));

  const getSelectedItemsAccounts = () => new Set(items.filter(item => selectedItems.has(item.id)).map(item => item.client_account).filter(Boolean));
  const getSelectedItemsWarehouses = () => new Set(items.filter(item => selectedItems.has(item.id)).map(item => item.warehouse_id).filter(Boolean));
  const hasMultipleAccounts = getSelectedItemsAccounts().size > 1;
  const hasMultipleWarehouses = getSelectedItemsWarehouses().size > 1;

  const getSelectedItemsForLabels = (): ItemLabelData[] => items.filter(item => selectedItems.has(item.id)).map(item => ({
    id: item.id, itemCode: item.item_code, description: item.description || '', vendor: item.vendor || '', account: item.client_account || '', sidemark: item.sidemark || '', warehouseName: item.warehouse_name || '', locationCode: item.location_code || '',
  }));

  const handleExportExcel = () => {
    const selectedData = items.filter(item => selectedItems.has(item.id)).map(item => ({
      'Item Code': item.item_code, 'Vendor': item.vendor || '', 'Description': item.description || '', 'Qty': item.quantity, 'Location': item.location_code || '', 'Client': item.client_account || '', 'Sidemark': item.sidemark || '', 'Room': item.room || '',
    }));
    const ws = XLSX.utils.json_to_sheet(selectedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `inventory-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleTaskSuccess = () => { setSelectedItems(new Set()); setPreSelectedTaskType(''); fetchItems(); };
  const handleReleaseSuccess = () => { setSelectedItems(new Set()); fetchItems(); };
  const handleImportClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setImportFile(file); setImportDialogOpen(true); } e.target.value = ''; };
  const handleImportSuccess = () => { setImportDialogOpen(false); setImportFile(null); fetchItems(); };

  return (
    <DashboardLayout>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.csv" className="hidden" />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader primaryText="Asset" accentText="Registry" description="Manage and track all items in your warehouse" />
          <div className="flex items-center gap-2 flex-wrap">
            {selectedItems.size > 0 && (
              <>
                <Button variant="outline" onClick={() => { if (hasMultipleAccounts) { setValidationMessage('Cannot create a task for items from different accounts.'); setValidationDialogOpen(true); return; } if (hasMultipleWarehouses) { setValidationMessage('Cannot create a task for items in different warehouses.'); setValidationDialogOpen(true); return; } setTaskDialogOpen(true); }}><ClipboardList className="mr-2 h-4 w-4" />Task ({selectedItems.size})</Button>
                <Button variant="outline" onClick={() => { if (hasMultipleAccounts) { setValidationMessage('Cannot create a will call for items from different accounts.'); setValidationDialogOpen(true); return; } setPreSelectedTaskType('Will Call'); setTaskDialogOpen(true); }}><Truck className="mr-2 h-4 w-4" />Will Call</Button>
                <Button variant="outline" onClick={() => { if (hasMultipleAccounts) { setValidationMessage('Cannot create a disposal for items from different accounts.'); setValidationDialogOpen(true); return; } setPreSelectedTaskType('Disposal'); setTaskDialogOpen(true); }}><Trash2 className="mr-2 h-4 w-4" />Dispose</Button>
                <Button variant="outline" onClick={() => setPrintLabelsDialogOpen(true)}><Printer className="mr-2 h-4 w-4" />Print</Button>
                <Button variant="outline" onClick={handleExportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Export</Button>
                <Button variant="default" onClick={() => setReleaseDialogOpen(true)}><PackageX className="mr-2 h-4 w-4" />Release</Button>
              </>
            )}
            <Button variant="secondary" onClick={handleImportClick}><Upload className="mr-2 h-4 w-4" />Import</Button>
            <Button><Package className="mr-2 h-4 w-4" />Add Item</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Items</CardTitle><CardDescription>{filteredAndSortedItems.length} items found{selectedItems.size > 0 && ` • ${selectedItems.size} selected`}</CardDescription></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search item code, description, vendor, sidemark, client..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="all">All</SelectItem><SelectItem value="released">Released</SelectItem><SelectItem value="disposed">Disposed</SelectItem></SelectContent></Select>
              <InventoryFiltersSheet filters={filters} onFiltersChange={setFilters} />
            </div>

            {loading ? (<div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filteredAndSortedItems.length === 0 ? (<div className="text-center py-12"><Package className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No items found</h3><p className="text-muted-foreground">{searchQuery || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Get started by adding your first item'}</p></div>
            ) : isMobile ? (
              <div className="space-y-3">{filteredAndSortedItems.map((item) => (<MobileDataCard key={item.id} onClick={() => navigate(`/inventory/${item.id}`)} selected={selectedItems.has(item.id)}><MobileDataCardHeader><div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItemSelection(item.id)} className="h-5 w-5" /><div><MobileDataCardTitle>{item.item_code}</MobileDataCardTitle><MobileDataCardDescription>{item.description || '-'}</MobileDataCardDescription></div></div></MobileDataCardHeader><MobileDataCardContent><div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground"><div><span>Qty:</span><div className="text-foreground font-medium">{item.quantity}</div></div><div><span>Location:</span><div className="text-foreground">{item.location_code || '-'}</div></div><div><span>Room:</span><div className="text-foreground">{item.room || '-'}</div></div></div></MobileDataCardContent></MobileDataCard>))}</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-10"><Checkbox checked={selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0} onCheckedChange={toggleSelectAll} className="h-3.5 w-3.5" /></TableHead>
                    <TableHead className="w-12">Photo</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('item_code')}><div className="flex items-center gap-1">Item Code<SortIcon field="item_code" /></div></TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('quantity')}><div className="flex items-center justify-end gap-1">Qty<SortIcon field="quantity" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('vendor')}><div className="flex items-center gap-1">Vendor<SortIcon field="vendor" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('description')}><div className="flex items-center gap-1">Description<SortIcon field="description" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location_code')}><div className="flex items-center gap-1">Location<SortIcon field="location_code" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('sidemark')}><div className="flex items-center gap-1">Sidemark<SortIcon field="sidemark" /></div></TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('room')}><div className="flex items-center gap-1">Room<SortIcon field="room" /></div></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{filteredAndSortedItems.map((item) => (
                    <TableRow key={item.id} className={`cursor-pointer hover:bg-muted/50 ${selectedItems.has(item.id) ? 'bg-muted/30' : ''}`} onClick={() => navigate(`/inventory/${item.id}`)}>
                      <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItemSelection(item.id)} className="h-3.5 w-3.5" /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ItemPreviewCard itemId={item.id}>
                          {item.primary_photo_url ? <img src={item.primary_photo_url} alt={item.item_code} className="h-8 w-8 rounded object-cover cursor-pointer" /> : <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                        </ItemPreviewCard>
                      </TableCell>
                      <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                        <ItemPreviewCard itemId={item.id}>
                          <span className="text-primary hover:underline cursor-pointer" onClick={() => navigate(`/inventory/${item.id}`)}>{item.item_code}</span>
                        </ItemPreviewCard>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell>{item.vendor || '-'}</TableCell>
                      <TableCell className="line-clamp-1">{item.description || '-'}</TableCell>
                      <TableCell>{item.location_code ? <span className="text-sm">{item.location_code}{item.warehouse_name && <span className="text-muted-foreground ml-1">({item.warehouse_name})</span>}</span> : '-'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <InlineEditableCell
                          value={item.sidemark}
                          suggestions={sidemarkSuggestions}
                          onSave={(val) => handleInlineUpdate(item.id, 'sidemark', val)}
                          placeholder="-"
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <InlineEditableCell
                          value={item.room}
                          suggestions={roomSuggestions}
                          onSave={(val) => handleInlineUpdate(item.id, 'room', val)}
                          placeholder="-"
                        />
                      </TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDialog open={taskDialogOpen} onOpenChange={(open) => { setTaskDialogOpen(open); if (!open) setPreSelectedTaskType(''); }} selectedItemIds={Array.from(selectedItems)} preSelectedTaskType={preSelectedTaskType} onSuccess={handleTaskSuccess} />
      <InventoryImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} file={importFile} warehouses={warehouses} locations={locations} onSuccess={handleImportSuccess} />
      <PrintLabelsDialog open={printLabelsDialogOpen} onOpenChange={setPrintLabelsDialogOpen} items={getSelectedItemsForLabels()} />
      <QuickReleaseDialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen} selectedItems={getSelectedItemsData()} onSuccess={handleReleaseSuccess} />
      <AlertDialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Cannot Proceed</AlertDialogTitle><AlertDialogDescription>{validationMessage}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction onClick={() => setValidationDialogOpen(false)}>OK</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </DashboardLayout>
  );
}
