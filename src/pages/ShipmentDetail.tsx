import { useEffect, useState, useMemo } from 'react';
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
import { SignaturePad } from '@/components/shipments/SignaturePad';
import { PhotoCapture } from '@/components/shipments/PhotoCapture';
import { ReceivingSession } from '@/components/shipments/ReceivingSession';
import { TaskDialog } from '@/components/tasks/TaskDialog';
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  expected_quantity: number | null;
  received_quantity: number | null;
  status: string;
  item?: {
    item_code: string;
    description: string | null;
  } | null;
}

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

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

      // Fetch shipment items
      const { data: items } = await (supabase.from('shipment_items') as any)
        .select(`
          *,
          items(item_code, description)
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

  const isCompleted = shipment.status === 'completed' || shipment.status === 'received';

  // Get selectable items (only those with item_id)
  const selectableItems = useMemo(() => 
    shipment.items.filter(item => item.item_id !== null),
    [shipment.items]
  );

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
                {shipment.shipment_type === 'inbound' ? 'Incoming Shipment' : 
                  shipment.release_type === 'will_call' ? 'Will Call Pickup' : 'Disposal'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {shipment.shipment_type === 'inbound' && (
              <Button variant="outline" onClick={() => {
                // Fetch items for printing
                const itemIds = shipment.items
                  .map(i => i.item_id)
                  .filter((id): id is string => id !== null);
                
                if (itemIds.length === 0) {
                  toast({
                    title: 'No items to print',
                    description: 'Complete receiving first to create items for labeling.',
                    variant: 'destructive',
                  });
                  return;
                }
                
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
                  } else {
                    toast({
                      title: 'No items to print',
                      description: 'Complete receiving first to create items for labeling.',
                      variant: 'destructive',
                    });
                  }
                })();
              }}>
                <Printer className="mr-2 h-4 w-4" />
                Print Labels
              </Button>
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
              received_quantity: item.received_quantity,
            }))}
            onComplete={fetchShipment}
            onPhotosChange={handlePhotosChange}
            existingPhotos={shipment.receiving_photos || []}
            existingDocuments={shipment.receiving_documents || []}
          />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
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

          {/* Photos & Documents Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Photos & Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoCapture
                entityType="shipment"
                entityId={shipment.id}
                onPhotosChange={(urls) => handlePhotosChange('photos', urls)}
                existingPhotos={shipment.receiving_photos || []}
                label="Receiving Photos"
              />
              
              <Separator />
              
              <PhotoCapture
                entityType="shipment"
                entityId={shipment.id}
                onPhotosChange={(urls) => handlePhotosChange('documents', urls)}
                existingPhotos={shipment.receiving_documents || []}
                label="Documents"
                acceptDocuments
              />
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
          </CardHeader>
          <CardContent>
            {shipment.items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No items in this shipment</p>
            ) : (
              <Table>
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
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Expected Qty</TableHead>
                    <TableHead className="text-right">Received Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipment.items.map((item) => (
                    <TableRow 
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {item.item_id && (
                          <Checkbox
                            checked={selectedItems.has(item.item_id)}
                            onCheckedChange={(checked) => handleSelectItem(item.item_id!, !!checked)}
                            aria-label={`Select ${item.item?.item_code || 'item'}`}
                          />
                        )}
                      </TableCell>
                      <TableCell 
                        className="font-medium"
                        onClick={() => item.item_id && navigate(`/inventory/${item.item_id}`)}
                      >
                        {item.item?.item_code || '-'}
                      </TableCell>
                      <TableCell onClick={() => item.item_id && navigate(`/inventory/${item.item_id}`)}>
                        {item.item?.description || item.expected_description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.expected_quantity || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.received_quantity || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                    </TableRow>
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
    </DashboardLayout>
  );
}
