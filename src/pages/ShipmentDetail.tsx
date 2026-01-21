import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { SignaturePad } from '@/components/shipments/SignaturePad';
import { PhotoCapture } from '@/components/shipments/PhotoCapture';
import { ReceivingSession } from '@/components/shipments/ReceivingSession';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { ScanDocumentButton, DocumentList } from '@/components/scanner';
import { ShipmentItemRow } from '@/components/shipments/ShipmentItemRow';
import { AddShipmentItemDialog } from '@/components/shipments/AddShipmentItemDialog';
import { ShipmentEditDialog } from '@/components/shipments/ShipmentEditDialog';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock,
  FileText,
  Image as ImageIcon,
  Printer,
  ClipboardList,
  Trash2,
  ChevronDown,
  Pencil,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { ItemLabelData } from '@/lib/labelGenerator';

interface ShipmentDetail {
  id: string;
  shipment_number: string;
  shipment_type: string;
  release_type: string | null;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  po_number: string | null;
  expected_arrival_date: string | null;
  received_at: string | null;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
  receiving_notes: string | null;
  receiving_photos: string[] | null;
  receiving_documents: string[] | null;
  signature_data: string | null;
  signature_name: string | null;
  signature_timestamp: string | null;
  release_to_name: string | null;
  release_to_email: string | null;
  release_to_phone: string | null;
  account?: { id: string; account_name: string } | null;
  warehouse?: { id: string; name: string } | null;
  items: ShipmentItem[];
}

interface ShipmentItem {
  id: string;
  item_id: string | null;
  expected_description: string | null;
  expected_vendor: string | null;
  expected_sidemark: string | null;
  expected_item_type_id: string | null;
  expected_quantity: number | null;
  actual_quantity: number | null;
  status: string;
  item?: {
    item_code: string;
    description: string | null;
    vendor: string | null;
  } | null;
}

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole, isAdmin } = usePermissions();

  // Permission check for printing: warehouse staff+
  const canPrintLabels = isAdmin || 
    hasRole('tenant_admin') ||
    hasRole('warehouse_staff') || 
    hasRole('warehouse') ||
    hasRole('manager');

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [receivedItemsForLabels, setReceivedItemsForLabels] = useState<ItemLabelData[]>([]);
  
  // For item selection and task creation
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [preSelectedTaskType, setPreSelectedTaskType] = useState<string | undefined>(undefined);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditDetailsDialog, setShowEditDetailsDialog] = useState(false);
  
  // For signature
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');

  useEffect(() => {
    if (id) {
      fetchShipment();
    }
  }, [id]);

  const fetchShipment = async () => {
    try {
      const shipmentsTable = supabase.from('shipments') as any;
      
      const { data, error } = await shipmentsTable
        .select(`
          *,
          accounts(id, account_name),
          warehouses(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch shipment items with vendor data
      const { data: items } = await (supabase.from('shipment_items') as any)
        .select(`
          *,
          items(item_code, description, vendor)
        `)
        .eq('shipment_id', id);

      setShipment({
        ...data,
        account: data.accounts,
        warehouse: data.warehouses,
        items: items || [],
        receiving_photos: data.receiving_photos || [],
        receiving_documents: data.receiving_documents || [],
      });
    } catch (error) {
      console.error('Error fetching shipment:', error);
      toast({
        title: 'Error',
        description: 'Failed to load shipment details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteShipment = async () => {
    if (!shipment) return;

    // For will call, require signature
    if (shipment.release_type === 'will_call' && !signatureData && !signatureName) {
      toast({
        title: 'Signature required',
        description: 'Please provide a signature before completing the will call.',
        variant: 'destructive',
      });
      return;
    }

    setCompleting(true);
    try {
      const shipmentsTable = supabase.from('shipments') as any;
      
      const updateData: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      if (shipment.shipment_type === 'inbound') {
        updateData.status = 'received';
        updateData.received_at = new Date().toISOString();
      }

      if (signatureData) {
        updateData.signature_data = signatureData;
        updateData.signature_timestamp = new Date().toISOString();
      }
      if (signatureName) {
        updateData.signature_name = signatureName;
        updateData.signature_timestamp = new Date().toISOString();
      }

      const { error } = await shipmentsTable
        .update(updateData)
        .eq('id', shipment.id);

      if (error) throw error;

      // Update items status if this is an outbound (will call/disposal)
      if (shipment.shipment_type === 'outbound') {
        const itemIds = shipment.items
          .map(i => i.item_id)
          .filter((id): id is string => id !== null);

        if (itemIds.length > 0) {
          await (supabase.from('items') as any)
            .update({ 
              status: shipment.release_type === 'disposal' ? 'disposed' : 'released',
              deleted_at: shipment.release_type === 'disposal' ? new Date().toISOString() : null,
            })
            .in('id', itemIds);
        }
      }

      toast({
        title: 'Shipment completed',
        description: `${shipment.shipment_number} has been marked as ${shipment.shipment_type === 'inbound' ? 'received' : 'completed'}.`,
      });

      // For inbound shipments, prompt to print labels for received items
      if (shipment.shipment_type === 'inbound') {
        // Fetch the actual items that were created/received
        const itemIds = shipment.items
          .map(i => i.item_id)
          .filter((id): id is string => id !== null);

        if (itemIds.length > 0) {
          const { data: receivedItems } = await (supabase.from('items') as any)
            .select('id, item_code, description, vendor, client_account, sidemark, location_id, warehouse_id, locations(code), warehouses(name)')
            .in('id', itemIds);

          if (receivedItems && receivedItems.length > 0) {
            const labelsData: ItemLabelData[] = receivedItems.map((item: any) => ({
              id: item.id,
              itemCode: item.item_code,
              description: item.description || '',
              vendor: item.vendor || '',
              account: item.client_account || shipment.account?.account_name || '',
              sidemark: item.sidemark || '',
              warehouseName: item.warehouses?.name || shipment.warehouse?.name || '',
              locationCode: item.locations?.code || '',
            }));
            setReceivedItemsForLabels(labelsData);
            setShowPrintPrompt(true);
          }
        }
      }

      fetchShipment();
      setShowCompleteDialog(false);
    } catch (error: any) {
      console.error('Error completing shipment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to complete shipment.',
        variant: 'destructive',
      });
    } finally {
      setCompleting(false);
    }
  };

  const handlePhotosChange = async (type: 'photos' | 'documents', urls: string[]) => {
    if (!shipment) return;

    try {
      const shipmentsTable = supabase.from('shipments') as any;
      const updateData: any = {};
      
      if (type === 'photos') {
        updateData.receiving_photos = urls;
      } else {
        updateData.receiving_documents = urls;
      }

      const { error } = await shipmentsTable
        .update(updateData)
        .eq('id', shipment.id);

      if (error) throw error;

      setShipment(prev => prev ? {
        ...prev,
        [type === 'photos' ? 'receiving_photos' : 'receiving_documents']: urls,
      } : null);
    } catch (error) {
      console.error('Error updating photos:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      expected: { variant: 'secondary', icon: Clock },
      in_progress: { variant: 'default', icon: Package },
      in_transit: { variant: 'default', icon: Truck },
      received: { variant: 'outline', icon: CheckCircle },
      completed: { variant: 'outline', icon: CheckCircle },
      cancelled: { variant: 'destructive', icon: null },
    };
    const statusConfig = config[status] || config.expected;
    const Icon = statusConfig.icon;
    
    return (
      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  // Get selectable items (only those with item_id) - must be before early returns
  const selectableItems = useMemo(() => 
    shipment?.items.filter(item => item.item_id !== null) || [],
    [shipment?.items]
  );

  // Check if there are any received items for printing
  const hasReceivedItems = useMemo(() => 
    shipment?.items.some(i => i.item_id !== null) || false,
    [shipment?.items]
  );

  // Handler for receiving session completion - triggers print prompt
  const handleReceivingComplete = useCallback(async (itemIds: string[]) => {
    if (itemIds.length === 0) return;

    // Fetch item details for labels
    const { data: receivedItems } = await (supabase.from('items') as any)
      .select('id, item_code, description, vendor, client_account, sidemark, locations(code), warehouses(name)')
      .in('id', itemIds);

    if (receivedItems && receivedItems.length > 0) {
      const labelsData: ItemLabelData[] = receivedItems.map((item: any) => ({
        id: item.id,
        itemCode: item.item_code,
        description: item.description || '',
        vendor: item.vendor || '',
        account: item.client_account || shipment?.account?.account_name || '',
        sidemark: item.sidemark || '',
        warehouseName: item.warehouses?.name || shipment?.warehouse?.name || '',
        locationCode: item.locations?.code || '',
      }));
      setReceivedItemsForLabels(labelsData);
      setShowPrintPrompt(true);
    }
  }, [shipment?.account?.account_name, shipment?.warehouse?.name]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(selectableItems.map(item => item.item_id!)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const allSelected = selectableItems.length > 0 && selectableItems.every(item => selectedItems.has(item.item_id!));
  const someSelected = selectableItems.some(item => selectedItems.has(item.item_id!));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!shipment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Shipment not found</h3>
          <Button variant="link" onClick={() => navigate('/shipments')}>
            Back to Shipments
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Only truly lock editing for 'completed' status (outbound shipments)
  // For 'received' status (inbound shipments), allow editing
  const isCompleted = shipment.status === 'completed';
  const isReceived = shipment.status === 'received';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {shipment.shipment_number}
                </h1>
                {getStatusBadge(shipment.status)}
              </div>
              <p className="text-muted-foreground">
                {shipment.shipment_type === 'inbound' ? 'Shipment Order' : 
                  shipment.release_type === 'will_call' ? 'Will Call Pickup' : 'Disposal'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* Print Labels - always visible for inbound when user has permission */}
            {shipment.shipment_type === 'inbound' && canPrintLabels && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button 
                        variant="outline" 
                        disabled={!hasReceivedItems}
                        onClick={() => {
                          // Fetch items for printing
                          const itemIds = shipment.items
                            .map(i => i.item_id)
                            .filter((id): id is string => id !== null);
                          
                          (async () => {
                            const { data: receivedItems } = await (supabase.from('items') as any)
                              .select('id, item_code, description, vendor, client_account, sidemark, locations(code), warehouses(name)')
                              .in('id', itemIds);
                            
                            if (receivedItems && receivedItems.length > 0) {
                              const labelsData: ItemLabelData[] = receivedItems.map((item: any) => ({
                                id: item.id,
                                itemCode: item.item_code,
                                description: item.description || '',
                                vendor: item.vendor || '',
                                account: item.client_account || shipment.account?.account_name || '',
                                sidemark: item.sidemark || '',
                                warehouseName: item.warehouses?.name || shipment.warehouse?.name || '',
                                locationCode: item.locations?.code || '',
                              }));
                              setReceivedItemsForLabels(labelsData);
                              setShowPrintDialog(true);
                            }
                          })();
                        }}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print Labels
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!hasReceivedItems && (
                    <TooltipContent>
                      <p>Complete receiving first to print labels</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
            
            {!isCompleted && (
              <Button onClick={() => setShowCompleteDialog(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                {shipment.shipment_type === 'inbound' ? 'Mark as Received' : 'Complete'}
              </Button>
            )}
          </div>
        </div>

        {/* Receiving Session - Only show for inbound shipments that aren't completed */}
        {shipment.shipment_type === 'inbound' && !isCompleted && (
          <ReceivingSession
            shipmentId={shipment.id}
            shipmentNumber={shipment.shipment_number}
            expectedItems={shipment.items.map(item => ({
              id: item.id,
              expected_description: item.expected_description,
              expected_quantity: item.expected_quantity,
              actual_quantity: item.actual_quantity,
            }))}
            onComplete={fetchShipment}
            onReceivingComplete={handleReceivingComplete}
            onPhotosChange={handlePhotosChange}
            existingPhotos={shipment.receiving_photos || []}
            existingDocuments={shipment.receiving_documents || []}
          />
        )}

        {/* Photos & Documents - visible for received inbound shipments */}
        {shipment.shipment_type === 'inbound' && isReceived && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="h-4 w-4" />
                  Receiving Photos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoCapture
                  entityType="shipment"
                  entityId={shipment.id}
                  onPhotosChange={(urls) => handlePhotosChange('photos', urls)}
                  existingPhotos={shipment.receiving_photos || []}
                  label=""
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Receiving Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoCapture
                  entityType="shipment"
                  entityId={shipment.id}
                  onPhotosChange={(urls) => handlePhotosChange('documents', urls)}
                  existingPhotos={shipment.receiving_documents || []}
                  label=""
                  acceptDocuments={true}
                />
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Shipment Details</CardTitle>
              {shipment.shipment_type === 'inbound' && !isCompleted && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowEditDetailsDialog(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Account</span>
                  <p className="font-medium">{shipment.account?.account_name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Warehouse</span>
                  <p className="font-medium">{shipment.warehouse?.name || '-'}</p>
                </div>
                {shipment.shipment_type === 'inbound' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Carrier</span>
                      <p className="font-medium">{shipment.carrier || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tracking #</span>
                      <p className="font-medium">{shipment.tracking_number || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PO Number</span>
                      <p className="font-medium">{shipment.po_number || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expected Arrival</span>
                      <p className="font-medium">
                        {shipment.expected_arrival_date 
                          ? format(new Date(shipment.expected_arrival_date), 'MMM d, yyyy')
                          : '-'}
                      </p>
                    </div>
                  </>
                )}
                {shipment.shipment_type === 'outbound' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Release To</span>
                      <p className="font-medium">{shipment.release_to_name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact Email</span>
                      <p className="font-medium">{shipment.release_to_email || '-'}</p>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">
                    {format(new Date(shipment.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                {(shipment.received_at || shipment.completed_at) && (
                  <div>
                    <span className="text-muted-foreground">
                      {shipment.shipment_type === 'inbound' ? 'Received' : 'Completed'}
                    </span>
                    <p className="font-medium">
                      {format(
                        new Date(shipment.received_at || shipment.completed_at!),
                        'MMM d, yyyy h:mm a'
                      )}
                    </p>
                  </div>
                )}
              </div>

              {shipment.notes && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Notes</span>
                    <p className="mt-1 text-sm">{shipment.notes}</p>
                  </div>
                </>
              )}

              {/* Signature Display */}
              {(shipment.signature_data || shipment.signature_name) && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Signature</span>
                    {shipment.signature_data ? (
                      <img 
                        src={shipment.signature_data} 
                        alt="Signature" 
                        className="mt-2 max-h-24 border rounded"
                      />
                    ) : (
                      <p className="mt-1 text-2xl font-cursive italic">
                        {shipment.signature_name}
                      </p>
                    )}
                    {shipment.signature_timestamp && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Signed: {format(new Date(shipment.signature_timestamp), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Items Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Items ({shipment.items.length})</CardTitle>
              <CardDescription>
                {shipment.shipment_type === 'inbound' 
                  ? 'Items expected in this shipment'
                  : 'Items included in this release'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Add Item Button - only for inbound, not completed, not received */}
              {shipment.shipment_type === 'inbound' && !isCompleted && !isReceived && (
                <Button variant="outline" onClick={() => setShowAddItemDialog(true)}>
                  <Package className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              )}
              
              {selectedItems.size > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Create Task ({selectedItems.size})
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => {
                      setPreSelectedTaskType(undefined);
                      setShowTaskDialog(true);
                    }}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Create Task
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      setPreSelectedTaskType('Will Call');
                      setShowTaskDialog(true);
                    }}>
                      <Truck className="mr-2 h-4 w-4" />
                      Will Call
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setPreSelectedTaskType('Disposal');
                      setShowTaskDialog(true);
                    }}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Disposal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {shipment.items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No items in this shipment</p>
                {shipment.shipment_type === 'inbound' && !isCompleted && !isReceived && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowAddItemDialog(true)}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Add Expected Item
                  </Button>
                )}
              </div>
            ) : (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all items"
                        disabled={selectableItems.length === 0}
                      />
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-28">Item Code</TableHead>
                    <TableHead className="w-32">Vendor</TableHead>
                    <TableHead className="min-w-[180px]">Description</TableHead>
                    <TableHead className="w-28 text-right">Expected Qty</TableHead>
                    <TableHead className="w-28 text-right">Received Qty</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipment.items.map((item) => (
                    <ShipmentItemRow
                      key={item.id}
                      item={item}
                      isSelected={item.item_id ? selectedItems.has(item.item_id) : false}
                      onSelect={(checked) => item.item_id && handleSelectItem(item.item_id, checked)}
                      onUpdate={fetchShipment}
                      isInbound={shipment.shipment_type === 'inbound'}
                      isCompleted={isCompleted}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Complete Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {shipment.shipment_type === 'inbound' ? 'Mark as Received' : 'Complete Release'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {shipment.release_type === 'will_call'
                ? 'Please capture the signature from the person picking up the items.'
                : 'This will mark the shipment as completed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {shipment.release_type === 'will_call' && (
            <div className="py-4">
              <SignaturePad
                onSignatureChange={({ signatureData: sd, signatureName: sn }) => {
                  setSignatureData(sd);
                  setSignatureName(sn);
                }}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteShipment} disabled={completing}>
              {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {shipment.shipment_type === 'inbound' ? 'Mark as Received' : 'Complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Labels Dialog */}
      <PrintLabelsDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        items={receivedItemsForLabels}
        title="Print Item Labels"
        description={`Print 4x6 labels for ${receivedItemsForLabels.length} received items`}
      />

      {/* Auto-prompt after receiving */}
      <AlertDialog open={showPrintPrompt} onOpenChange={setShowPrintPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Print Labels?</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to print 4x6 labels for the {receivedItemsForLabels.length} items that were just received?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Skip</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowPrintPrompt(false);
              setShowPrintDialog(true);
            }}>
              <Printer className="mr-2 h-4 w-4" />
              Print Labels
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={(open) => {
          setShowTaskDialog(open);
          if (!open) {
            setSelectedItems(new Set());
            setPreSelectedTaskType(undefined);
          }
        }}
        selectedItemIds={Array.from(selectedItems)}
        preSelectedTaskType={preSelectedTaskType}
        onSuccess={() => {
          setSelectedItems(new Set());
          setPreSelectedTaskType(undefined);
          setShowTaskDialog(false);
        }}
      />

      {/* Add Item Dialog */}
      <AddShipmentItemDialog
        open={showAddItemDialog}
        onOpenChange={setShowAddItemDialog}
        shipmentId={shipment.id}
        accountId={shipment.account?.id}
        onSuccess={fetchShipment}
      />

      {/* Edit Shipment Details Dialog */}
      <ShipmentEditDialog
        open={showEditDetailsDialog}
        onOpenChange={setShowEditDetailsDialog}
        shipment={{
          id: shipment.id,
          carrier: shipment.carrier,
          tracking_number: shipment.tracking_number,
          po_number: shipment.po_number,
          expected_arrival_date: shipment.expected_arrival_date,
          notes: shipment.notes,
        }}
        onSuccess={fetchShipment}
      />
    </DashboardLayout>
  );
}
