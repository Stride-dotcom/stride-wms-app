import { useEffect, useState, useRef } from 'react';
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
import { Search, Package, Loader2, Filter, Truck, Trash2, ClipboardList, Upload, Printer, AlertTriangle } from 'lucide-react';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { InventoryImportDialog } from '@/components/settings/InventoryImportDialog';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useLocations } from '@/hooks/useLocations';
import { ItemLabelData } from '@/lib/labelGenerator';
import { useIsMobile } from '@/hooks/use-mobile';
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
  location_code: string | null;
  location_name: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  received_at: string | null;
  primary_photo_url: string | null;
}

export default function Inventory() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [preSelectedTaskType, setPreSelectedTaskType] = useState<string>('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [printLabelsDialogOpen, setPrintLabelsDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { warehouses } = useWarehouses();
  const { locations } = useLocations();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await (supabase
        .from('v_items_with_location') as any)
        .select('id, item_code, description, status, quantity, client_account, sidemark, vendor, location_code, location_name, warehouse_id, warehouse_name, received_at, primary_photo_url')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.client_account?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sidemark?.toLowerCase().includes(searchQuery.toLowerCase());

    // Active filter hides released and disposed items by default
    if (statusFilter === 'active') {
      return matchesSearch && item.status !== 'released' && item.status !== 'disposed';
    }
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      available: 'default',
      reserved: 'secondary',
      damaged: 'destructive',
      shipped: 'outline',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const uniqueStatuses = [...new Set(items.map((item) => item.status))];

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const getSelectedItemsData = () => {
    return items.filter(item => selectedItems.has(item.id)).map(item => ({
      id: item.id,
      item_code: item.item_code,
      description: item.description,
      quantity: item.quantity,
      client_account: item.client_account,
      warehouse_id: item.warehouse_id,
    }));
  };

  // Validation: Check if selected items have multiple accounts
  const getSelectedItemsAccounts = () => {
    const selectedData = items.filter(item => selectedItems.has(item.id));
    const accounts = new Set(selectedData.map(item => item.client_account).filter(Boolean));
    return accounts;
  };

  // Validation: Check if selected items have multiple warehouses
  const getSelectedItemsWarehouses = () => {
    const selectedData = items.filter(item => selectedItems.has(item.id));
    const warehouses = new Set(selectedData.map(item => item.warehouse_id).filter(Boolean));
    return warehouses;
  };

  const hasMultipleAccounts = getSelectedItemsAccounts().size > 1;
  const hasMultipleWarehouses = getSelectedItemsWarehouses().size > 1;

  const getSelectedItemsForLabels = (): ItemLabelData[] => {
    return items.filter(item => selectedItems.has(item.id)).map(item => ({
      id: item.id,
      itemCode: item.item_code,
      description: item.description || '',
      vendor: item.vendor || '',
      account: item.client_account || '',
      sidemark: item.sidemark || '',
      warehouseName: item.warehouse_name || '',
      locationCode: item.location_code || '',
    }));
  };

  const handleTaskSuccess = () => {
    setSelectedItems(new Set());
    setPreSelectedTaskType('');
    fetchItems();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportDialogOpen(true);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleImportSuccess = () => {
    setImportDialogOpen(false);
    setImportFile(null);
    fetchItems();
  };

  return (
    <DashboardLayout>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground">
              Manage and track all items in your warehouse
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedItems.size > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (hasMultipleAccounts) {
                      setValidationMessage('Cannot create a task for items from different accounts. Please select items from a single account.');
                      setValidationDialogOpen(true);
                      return;
                    }
                    if (hasMultipleWarehouses) {
                      setValidationMessage('Cannot create a task for items located in different warehouses. Please select items from a single warehouse.');
                      setValidationDialogOpen(true);
                      return;
                    }
                    setTaskDialogOpen(true);
                  }}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Create Task ({selectedItems.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (hasMultipleAccounts) {
                      setValidationMessage('Cannot create a will call for items from different accounts. Please select items from a single account.');
                      setValidationDialogOpen(true);
                      return;
                    }
                    setPreSelectedTaskType('Will Call');
                    setTaskDialogOpen(true);
                  }}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Will Call ({selectedItems.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (hasMultipleAccounts) {
                      setValidationMessage('Cannot create a disposal for items from different accounts. Please select items from a single account.');
                      setValidationDialogOpen(true);
                      return;
                    }
                    setPreSelectedTaskType('Disposal');
                    setTaskDialogOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Dispose ({selectedItems.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPrintLabelsDialogOpen(true)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Labels ({selectedItems.size})
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleImportClick}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button>
              <Package className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <CardDescription>
              {filteredItems.length} items found
              {selectedItems.size > 0 && ` • ${selectedItems.size} selected`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by item code, description, or client..."
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
                  <SelectItem value="active">Active (Default)</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  {uniqueStatuses.filter(s => s !== 'released' && s !== 'disposed').map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No items found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Get started by adding your first item'}
                </p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <MobileDataCard
                    key={item.id}
                    onClick={() => navigate(`/inventory/${item.id}`)}
                    selected={selectedItems.has(item.id)}
                  >
                    <MobileDataCardHeader>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => toggleItemSelection(item.id)}
                          aria-label={`Select ${item.item_code}`}
                          className="h-5 w-5"
                        />
                        <div>
                          <MobileDataCardTitle>{item.item_code}</MobileDataCardTitle>
                          <MobileDataCardDescription>{item.description || '-'}</MobileDataCardDescription>
                        </div>
                      </div>
                      {getStatusBadge(item.status)}
                    </MobileDataCardHeader>
                    <MobileDataCardContent>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span>Qty:</span>
                          <div className="text-foreground font-medium">{item.quantity}</div>
                        </div>
                        <div>
                          <span>Location:</span>
                          <div className="text-foreground">{item.location_code || '-'}</div>
                        </div>
                        <div>
                          <span>Client:</span>
                          <div className="text-foreground">{item.client_account || '-'}</div>
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead className="w-12">Photo</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Sidemark</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedItems.has(item.id) ? 'bg-muted/30' : ''}`}
                        onClick={() => navigate(`/inventory/${item.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                            aria-label={`Select ${item.item_code}`}
                          />
                        </TableCell>
                        <TableCell>
                          {item.primary_photo_url ? (
                            <img
                              src={item.primary_photo_url}
                              alt={item.item_code}
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{item.item_code}</TableCell>
                        <TableCell>{item.vendor || '-'}</TableCell>
                        <TableCell className="line-clamp-1">
                          {item.description || '-'}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell>
                          {item.location_code ? (
                            <span className="text-sm">
                              {item.location_code}
                              {item.warehouse_name && (
                                <span className="text-muted-foreground ml-1">
                                  ({item.warehouse_name})
                                </span>
                              )}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{item.client_account || '-'}</TableCell>
                        <TableCell>{item.sidemark || '-'}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setPreSelectedTaskType('');
        }}
        selectedItemIds={Array.from(selectedItems)}
        preSelectedTaskType={preSelectedTaskType}
        onSuccess={handleTaskSuccess}
      />

      <InventoryImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        file={importFile}
        warehouses={warehouses}
        locations={locations}
        onSuccess={handleImportSuccess}
      />

      <PrintLabelsDialog
        open={printLabelsDialogOpen}
        onOpenChange={setPrintLabelsDialogOpen}
        items={getSelectedItemsForLabels()}
      />

      {/* Validation Error Dialog */}
      <AlertDialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cannot Proceed
            </AlertDialogTitle>
            <AlertDialogDescription>
              {validationMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setValidationDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
