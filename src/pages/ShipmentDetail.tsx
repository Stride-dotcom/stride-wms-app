import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useReceivingSession } from '@/hooks/useReceivingSession';
import { usePermissions, PERMISSIONS } from '@/hooks/usePermissions';
import { isValidUuid, cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AddAddonDialog } from '@/components/billing/AddAddonDialog';
import { BillingCalculator } from '@/components/billing/BillingCalculator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ScanDocumentButton, DocumentUploadButton, DocumentList } from '@/components/scanner';
import { PhotoScannerButton } from '@/components/common/PhotoScannerButton';
import { PhotoUploadButton } from '@/components/common/PhotoUploadButton';
import { TaggablePhotoGrid, TaggablePhoto, getPhotoUrls } from '@/components/common/TaggablePhotoGrid';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { ItemLabelData } from '@/lib/labelGenerator';
import { AddShipmentItemDialog } from '@/components/shipments/AddShipmentItemDialog';
import { ShipmentItemRow } from '@/components/shipments/ShipmentItemRow';
import { ReassignAccountDialog } from '@/components/common/ReassignAccountDialog';
import { ShipmentHistoryTab } from '@/components/shipments/ShipmentHistoryTab';

// ============================================
// TYPES
// ============================================

interface ShipmentItem {
  id: string;
  expected_description: string | null;
  expected_vendor: string | null;
  expected_sidemark: string | null;
  expected_class_id: string | null;
  expected_quantity: number;
  actual_quantity: number | null;
  status: string;
  item_id: string | null;
  expected_class?: {
    id: string;
    code: string;
    name: string;
  } | null;
  item?: {
    id: string;
    item_code: string;
    description: string | null;
    vendor: string | null;
    sidemark: string | null;
    room: string | null;
    class_id: string | null;
    current_location?: { code: string } | null;
    account?: { account_name: string } | null;
    class?: { id: string; code: string; name: string } | null;
  } | null;
}

// Type adapter to match ShipmentItemRow expected interface
type ShipmentItemRowData = ShipmentItem & {
  expected_quantity: number | null;
};

// Local type for received item tracking in UI
interface ReceivedItemData {
  shipment_item_id: string;
  expected_description: string | null;
  expected_quantity: number;
  actual_quantity: number;
  expected_vendor: string | null;
  expected_sidemark: string | null;
  expected_item_type_id: string | null;
  notes: string | null;
  status: 'received' | 'partial' | 'missing';
}

interface Shipment {
  id: string;
  shipment_number: string;
  shipment_type: string;
  status: string;
  account_id: string | null;
  warehouse_id: string | null;
  carrier: string | null;
  tracking_number: string | null;
  po_number: string | null;
  expected_arrival_date: string | null;
  received_at: string | null;
  notes: string | null;
  receiving_notes: string | null;
  receiving_photos: (string | TaggablePhoto)[] | null;
  receiving_documents: string[] | null;
  release_type: string | null;
  sidemark_id: string | null;
  sidemark: string | null;
  created_at: string;
  accounts?: { id: string; name: string } | null;
  warehouses?: { id: string; name: string } | null;
}

// ============================================
// COMPONENT
// ============================================

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();

  // ============================================
  // RENDER-TIME UUID GUARD - executes before any hooks
  // ============================================
  if (!id || !isValidUuid(id)) {
    return <Navigate to="/shipments" replace />;
  }

  // Now we know id is a valid UUID - safe to use hooks
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { hasPermission, hasRole } = usePermissions();

  // Only managers and admins can see billing fields
  const canSeeBilling = hasRole('admin') || hasRole('tenant_admin') || hasRole('manager');

  // State
  const [loading, setLoading] = useState(true);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [items, setItems] = useState<ShipmentItem[]>([]);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [receivedItems, setReceivedItems] = useState<ReceivedItemData[]>([]);
  const [receivingPhotos, setReceivingPhotos] = useState<(string | TaggablePhoto)[]>([]);
  const [receivingDocuments, setReceivingDocuments] = useState<string[]>([]);
  const [showPrintLabelsDialog, setShowPrintLabelsDialog] = useState(false);
  const [createdItemIds, setCreatedItemIds] = useState<string[]>([]);
  const [createdItemsForLabels, setCreatedItemsForLabels] = useState<ItemLabelData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editCarrier, setEditCarrier] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editPoNumber, setEditPoNumber] = useState('');
  const [editExpectedArrival, setEditExpectedArrival] = useState<Date | undefined>(undefined);
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [addAddonDialogOpen, setAddAddonDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<string>('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [showOutboundCompleteDialog, setShowOutboundCompleteDialog] = useState(false);
  const [completingOutbound, setCompletingOutbound] = useState(false);
  const [classes, setClasses] = useState<{ id: string; code: string; name: string }[]>([]);
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);

  // Receiving session hook
  const {
    session,
    loading: sessionLoading,
    fetchSession,
    startSession,
    finishSession,
    cancelSession,
  } = useReceivingSession(id);

  // ------------------------------------------
  // Fetch shipment data
  // ------------------------------------------
  const fetchShipment = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch shipment with related data
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select(`
          *,
          accounts:account_id(id, account_name, account_code),
          warehouses:warehouse_id(id, name)
        `)
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .single();

      if (shipmentError) {
        console.error('[ShipmentDetail] fetch shipment failed:', shipmentError);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load shipment' });
        return;
      }

      // Fetch shipment items with full item details
      const { data: itemsData, error: itemsError } = await supabase
        .from('shipment_items')
        .select(`
          id,
          expected_description,
          expected_vendor,
          expected_sidemark,
          expected_class_id,
          expected_quantity,
          actual_quantity,
          status,
          item_id,
          expected_class:classes!shipment_items_expected_class_id_fkey(
            id,
            code,
            name
          ),
          item:items!shipment_items_item_id_fkey(
            id,
            item_code,
            description,
            vendor,
            sidemark,
            room,
            class_id,
            current_location:locations!items_current_location_id_fkey(code),
            account:accounts!items_account_id_fkey(account_name),
            class:classes(id, code, name)
          )
        `)
        .eq('shipment_id', id)
        .order('created_at');

      if (itemsError) {
        console.error('[ShipmentDetail] fetch items failed:', itemsError);
      }

      setShipment(shipmentData as unknown as Shipment);
      setItems((itemsData || []) as unknown as ShipmentItem[]);
      setBillingRefreshKey(prev => prev + 1); // Trigger billing recalculation

      // Fetch classes for autocomplete
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, code, name')
        .eq('tenant_id', profile.tenant_id)
        .order('code');

      if (classesData) {
        setClasses(classesData);
      }

      // Initialize receiving photos/documents from shipment
      if (shipmentData.receiving_photos) {
        setReceivingPhotos(shipmentData.receiving_photos as string[]);
      }
      if (shipmentData.receiving_documents) {
        setReceivingDocuments(shipmentData.receiving_documents as string[]);
      }

      // Check for active session
      await fetchSession();
    } catch (err) {
      console.error('[ShipmentDetail] fetchShipment exception:', err);
    } finally {
      setLoading(false);
    }
  }, [id, profile?.tenant_id, fetchSession, toast]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  // ------------------------------------------
  // Initialize received items for finish dialog
  // ------------------------------------------
  const openFinishDialog = () => {
    const initialReceivedItems: ReceivedItemData[] = items.map(item => ({
      shipment_item_id: item.id,
      expected_description: item.expected_description,
      expected_quantity: item.expected_quantity,
      actual_quantity: item.actual_quantity ?? item.expected_quantity,
      expected_vendor: item.expected_vendor,
      expected_sidemark: item.expected_sidemark,
      expected_item_type_id: null,
      notes: null,
      status: 'received' as const,
    }));
    setReceivedItems(initialReceivedItems);
    setShowFinishDialog(true);
  };

  // ------------------------------------------
  // Update received item quantity
  // ------------------------------------------
  const updateReceivedQuantity = (shipmentItemId: string, quantity: number) => {
    setReceivedItems(prev => prev.map(item => {
      if (item.shipment_item_id === shipmentItemId) {
        const status = quantity === 0 ? 'missing' : 
                       quantity < item.expected_quantity ? 'partial' : 'received';
        return { ...item, actual_quantity: quantity, status };
      }
      return item;
    }));
  };

  // ------------------------------------------
  // Handle finish receiving
  // ------------------------------------------
  const handleFinishReceiving = async () => {
    if (!shipment) return;

    // Validate photos are required
    if (receivingPhotos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Photos Required',
        description: 'Please add at least one photo before completing the receiving process.',
      });
      setShowFinishDialog(false);
      return;
    }

    // Validate all items have a class assigned for billing
    const itemsWithoutClass = items.filter(item => {
      // For received items, check item.class_id; for pending items, check expected_class_id
      const hasClass = item.item?.class_id || item.expected_class_id;
      return !hasClass;
    });

    if (itemsWithoutClass.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Class Required',
        description: `${itemsWithoutClass.length} item(s) need a class assigned for billing. Please update them before finishing.`,
      });
      setShowFinishDialog(false);
      return;
    }

    // Convert local ReceivedItemData to VerificationData format expected by hook
    const verificationData = {
      expected_items: items.map(item => ({
        description: item.expected_description || '',
        quantity: item.expected_quantity,
      })),
      received_items: receivedItems
        .filter(item => item.status !== 'missing')
        .map(item => ({
          description: item.expected_description || '',
          quantity: item.actual_quantity,
          shipment_item_id: item.shipment_item_id,
        })),
      discrepancies: receivedItems
        .filter(item => item.actual_quantity !== item.expected_quantity)
        .map(item => ({
          description: item.expected_description || '',
          expected: item.expected_quantity,
          received: item.actual_quantity,
        })),
      backorder_items: receivedItems
        .filter(item => item.actual_quantity < item.expected_quantity)
        .map(item => ({
          description: item.expected_description || '',
          quantity: item.expected_quantity - item.actual_quantity,
        })),
    };

    const result = await finishSession(verificationData, true);

    if (result.success) {
      setShowFinishDialog(false);
      setCreatedItemIds(result.createdItemIds);
      
      // Fetch created items for label printing
      if (result.createdItemIds.length > 0) {
        const { data: createdItems } = await supabase
          .from('items')
          .select('id, item_code, description, vendor, sidemark_id, room')
          .in('id', result.createdItemIds);

        if (createdItems) {
          const labelData: ItemLabelData[] = createdItems.map(item => ({
            id: item.id,
            itemCode: item.item_code || '',
            description: item.description || '',
            vendor: item.vendor || '',
            account: shipment?.accounts?.name || '',
            sidemark: '', // Would need to join sidemark table
            room: (item as any).room || '',
            warehouseName: shipment?.warehouses?.name || '',
            locationCode: 'RECV-DOCK',
          }));
          setCreatedItemsForLabels(labelData);
          setShowPrintLabelsDialog(true);
        }
      }
      
      await fetchShipment();
    }
  };

  // ------------------------------------------
  // Handle cancel receiving
  // ------------------------------------------
  const handleCancelReceiving = async () => {
    await cancelSession();
    await fetchShipment();
  };

  // ------------------------------------------
  // Item selection helpers
  // ------------------------------------------
  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const receivedItems = items.filter(i => i.item?.id);
    if (selectedItemIds.size === receivedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(receivedItems.map(i => i.item!.id)));
    }
  };

  const handleCreateTask = () => {
    if (selectedItemIds.size === 0 || !selectedTaskType) return;
    // Navigate to create task page with selected items
    const itemIds = Array.from(selectedItemIds).join(',');
    navigate(`/tasks/new?items=${itemIds}&type=${selectedTaskType}`);
  };

  // ------------------------------------------
  // Handle duplicate shipment item
  // ------------------------------------------
  const handleDuplicateItem = async (itemToDuplicate: ShipmentItem) => {
    if (!shipment || !profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from('shipment_items')
        .insert({
          shipment_id: shipment.id,
          expected_description: itemToDuplicate.expected_description,
          expected_vendor: itemToDuplicate.expected_vendor,
          expected_sidemark: itemToDuplicate.expected_sidemark,
          expected_quantity: itemToDuplicate.expected_quantity,
          status: 'pending',
        });

      if (error) throw error;

      toast({ title: 'Item duplicated' });
      fetchShipment();
    } catch (error) {
      console.error('Error duplicating item:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to duplicate item' });
    }
  };

  // ------------------------------------------
  // Handle cancel shipment
  // ------------------------------------------
  const handleCancelShipment = async () => {
    if (!shipment) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ status: 'cancelled' })
        .eq('id', shipment.id);

      if (error) throw error;

      toast({ title: 'Shipment Cancelled' });
      setShowCancelDialog(false);
      fetchShipment();
    } catch (error) {
      console.error('Error cancelling shipment:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel shipment' });
    } finally {
      setCancelling(false);
    }
  };

  // ------------------------------------------
  // Handle complete outbound shipment
  // ------------------------------------------
  const handleCompleteOutbound = async () => {
    if (!shipment) return;

    // Validate photos are required
    if (receivingPhotos.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Photos Required',
        description: 'Please add at least one photo before completing the shipment.',
      });
      setShowOutboundCompleteDialog(false);
      return;
    }

    setCompletingOutbound(true);
    try {
      // Update shipment status to completed
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      if (shipmentError) throw shipmentError;

      // Update all items in the shipment to released status
      const itemIds = items.filter(i => i.item_id).map(i => i.item_id);
      if (itemIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('items')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
          })
          .in('id', itemIds);

        if (itemsError) throw itemsError;
      }

      // Update shipment_items status to released (valid values: pending, received, released, cancelled)
      const { error: shipmentItemsError } = await supabase
        .from('shipment_items')
        .update({ status: 'released' })
        .eq('shipment_id', shipment.id);

      if (shipmentItemsError) throw shipmentItemsError;

      toast({ title: 'Shipment Completed', description: 'Items have been released.' });
      setShowOutboundCompleteDialog(false);
      fetchShipment();
    } catch (error) {
      console.error('Error completing outbound shipment:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to complete shipment' });
    } finally {
      setCompletingOutbound(false);
    }
  };

  // ------------------------------------------
  // Status badge helper
  // ------------------------------------------
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      expected: 'secondary',
      receiving: 'default',
      in_progress: 'default',
      received: 'default',
      partial: 'destructive',
      completed: 'default',
      cancelled: 'outline',
    };
    const labels: Record<string, string> = {
      expected: 'Expected',
      receiving: 'In Progress',
      in_progress: 'In Progress',
      received: 'Received',
      partial: 'Partial',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  // ------------------------------------------
  // Render loading state
  // ------------------------------------------
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // ------------------------------------------
  // Render not found
  // ------------------------------------------
  if (!shipment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <MaterialIcon name="inventory_2" size="xl" className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Shipment Not Found</h2>
          <p className="text-muted-foreground mb-4">This shipment doesn't exist or you don't have access.</p>
          <Button onClick={() => navigate('/shipments')}>
            <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
            Back to Shipments
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isInbound = shipment.shipment_type === 'inbound' || shipment.shipment_type === 'return';
  const canReceive = isInbound && ['expected', 'receiving'].includes(shipment.status);
  const isReceiving = session !== null;
  const isReceived = shipment.status === 'received' || shipment.status === 'partial';

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <MaterialIcon name="arrow_back" size="md" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{shipment.shipment_number}</h1>
              {getStatusBadge(shipment.status)}
              {shipment.release_type && (
                <Badge variant="outline" className="text-xs">{shipment.release_type}</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm truncate">
              {shipment.accounts?.name || 'No account'} • {shipment.warehouses?.name || 'No warehouse'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Button variant="outline" size="sm" onClick={() => {
            if (!isEditing) {
              setEditCarrier(shipment.carrier || '');
              setEditTrackingNumber(shipment.tracking_number || '');
              setEditPoNumber(shipment.po_number || '');
              setEditExpectedArrival(shipment.expected_arrival_date ? new Date(shipment.expected_arrival_date) : undefined);
              setEditNotes(shipment.notes || '');
            }
            setIsEditing(!isEditing);
          }}>
            <MaterialIcon name="edit" size="sm" className="mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{isEditing ? 'Cancel Edit' : 'Edit'}</span>
            <span className="sm:hidden">{isEditing ? 'Cancel' : 'Edit'}</span>
          </Button>
          {canReceive && !isReceiving && hasPermission(PERMISSIONS.SHIPMENTS_RECEIVE) && (
            <Button size="sm" onClick={startSession} disabled={sessionLoading}>
              <MaterialIcon name="play_arrow" size="sm" className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Start Receiving</span>
              <span className="sm:hidden">Receive</span>
            </Button>
          )}
          {/* Complete Shipment button for outbound shipments */}
          {!isInbound && ['pending', 'expected', 'in_progress'].includes(shipment.status) && (
            <Button size="sm" onClick={() => setShowOutboundCompleteDialog(true)}>
              <MaterialIcon name="check_circle" size="sm" className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Complete Shipment</span>
              <span className="sm:hidden">Complete</span>
            </Button>
          )}
          {shipment.account_id && canSeeBilling && (
            <Button variant="secondary" size="sm" onClick={() => setAddAddonDialogOpen(true)}>
              <MaterialIcon name="attach_money" size="sm" className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Charge</span>
              <span className="sm:hidden">Charge</span>
            </Button>
          )}
          {/* Reassign Account */}
          {shipment.account_id && (
            <Button variant="outline" size="sm" onClick={() => setShowReassignDialog(true)}>
              <MaterialIcon name="swap_horiz" size="sm" className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Reassign</span>
            </Button>
          )}
          {/* Cancel Shipment - only for expected, pending, or receiving shipments */}
          {['expected', 'pending', 'receiving', 'in_progress'].includes(shipment.status) && (
            <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(true)}>
              <MaterialIcon name="block" size="sm" className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Receiving In Progress Banner */}
      {isReceiving && (
        <Card className="mb-6 border-primary bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-primary rounded-full animate-pulse" />
                <span className="font-medium">Receiving in progress</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelReceiving}>
                  <MaterialIcon name="cancel" size="sm" className="mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={openFinishDialog}>
                  <MaterialIcon name="check_circle" size="sm" className="mr-2" />
                  Finish Receiving
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outbound Status Banner */}
      {!isInbound && ['expected', 'in_progress'].includes(shipment.status) && (
        <Card className="mb-6 border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="font-medium">
                  {shipment.status === 'expected' ? 'Outbound shipment pending' : 'Outbound release in progress'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(true)}>
                  <MaterialIcon name="cancel" size="sm" className="mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={() => setShowOutboundCompleteDialog(true)}>
                  <MaterialIcon name="check_circle" size="sm" className="mr-2" />
                  Complete Release
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <Card className="mb-6 border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Edit Shipment</CardTitle>
            <CardDescription>Update shipment details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carrier</Label>
                <Input
                  value={editCarrier}
                  onChange={(e) => setEditCarrier(e.target.value)}
                  placeholder="e.g., FedEx, UPS, Local Delivery"
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking Number</Label>
                <Input
                  value={editTrackingNumber}
                  onChange={(e) => setEditTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>
              <div className="space-y-2">
                <Label>PO Number</Label>
                <Input
                  value={editPoNumber}
                  onChange={(e) => setEditPoNumber(e.target.value)}
                  placeholder="Enter PO number"
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Arrival</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !editExpectedArrival && 'text-muted-foreground'
                      )}
                    >
                      <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                      {editExpectedArrival ? format(editExpectedArrival, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editExpectedArrival}
                      onSelect={setEditExpectedArrival}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this shipment..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  setSavingEdit(true);
                  try {
                    const { error } = await supabase
                      .from('shipments')
                      .update({
                        carrier: editCarrier || null,
                        tracking_number: editTrackingNumber || null,
                        po_number: editPoNumber || null,
                        expected_arrival_date: editExpectedArrival?.toISOString() || null,
                        notes: editNotes || null,
                      })
                      .eq('id', shipment.id);
                    if (error) throw error;
                    toast({ title: 'Shipment Updated' });
                    setIsEditing(false);
                    fetchShipment();
                  } catch (error) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to update shipment' });
                  } finally {
                    setSavingEdit(false);
                  }
                }}
                disabled={savingEdit}
              >
                {savingEdit && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Calculator - Full width at top right area */}
      {canSeeBilling && shipment.account_id && (
        <div className="flex justify-end mb-6">
          <div className="w-full lg:w-1/3">
            <BillingCalculator
              shipmentId={shipment.id}
              shipmentDirection={shipment.shipment_type as 'inbound' | 'outbound' | 'return'}
              refreshKey={billingRefreshKey}
              title="Billing Calculator"
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Shipment Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Shipment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <p className="font-medium capitalize">{shipment.shipment_type}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Carrier</Label>
                <p className="font-medium">{shipment.carrier || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Tracking</Label>
                <p className="font-medium">{shipment.tracking_number || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">PO Number</Label>
                <p className="font-medium">{shipment.po_number || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Expected Arrival</Label>
                <p className="font-medium">
                  {shipment.expected_arrival_date 
                    ? format(new Date(shipment.expected_arrival_date), 'MMM d, yyyy')
                    : '-'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Received At</Label>
                <p className="font-medium">
                  {shipment.received_at 
                    ? format(new Date(shipment.received_at), 'MMM d, yyyy h:mm a')
                    : '-'}
                </p>
              </div>
            </div>
            {shipment.notes && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <p className="mt-1">{shipment.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Info / Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected Items</span>
              <span className="font-medium">{items.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Received Items</span>
              <span className="font-medium">
                {items.filter(i => i.status === 'received').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">
                {format(new Date(shipment.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipment Items */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>Expected and received items for this shipment</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Add Items button for inbound/return shipments that are not completed */}
              {(shipment.shipment_type === 'inbound' || shipment.shipment_type === 'return') &&
               shipment.status !== 'completed' && shipment.status !== 'cancelled' && (
                <Button variant="outline" size="sm" onClick={() => setAddItemDialogOpen(true)}>
                  <MaterialIcon name="add" size="sm" className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Add Items</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              )}
            {/* Create Task from selected items */}
            {selectedItemIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedItemIds.size} selected</span>
                <Select value={selectedTaskType} onValueChange={setSelectedTaskType}>
                  <SelectTrigger className="w-[130px] sm:w-[160px]">
                    <SelectValue placeholder="Task type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inspection">Inspection</SelectItem>
                    <SelectItem value="Assembly">Assembly</SelectItem>
                    <SelectItem value="Repair">Repair</SelectItem>
                    <SelectItem value="Will Call">Will Call</SelectItem>
                    <SelectItem value="Disposal">Disposal</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleCreateTask}
                  disabled={!selectedTaskType}
                >
                  <MaterialIcon name="assignment" size="sm" className="mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Create Task</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </div>
            )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={items.filter(i => i.item?.id).length > 0 && selectedItemIds.size === items.filter(i => i.item?.id).length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-28">Item Code</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-32">Vendor</TableHead>
                <TableHead className="min-w-[140px]">Description</TableHead>
                <TableHead className="w-24">Location</TableHead>
                <TableHead className="w-24">Class</TableHead>
                <TableHead className="w-28">Sidemark</TableHead>
                <TableHead className="w-24">Room</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    No items in this shipment
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <ShipmentItemRow
                    key={item.id}
                    item={item as ShipmentItemRowData}
                    isSelected={item.item?.id ? selectedItemIds.has(item.item.id) : false}
                    onSelect={(checked) => {
                      if (item.item?.id) {
                        if (checked) {
                          setSelectedItemIds(prev => new Set([...prev, item.item!.id]));
                        } else {
                          setSelectedItemIds(prev => {
                            const next = new Set(prev);
                            next.delete(item.item!.id);
                            return next;
                          });
                        }
                      }
                    }}
                    onUpdate={fetchShipment}
                    onDelete={() => fetchShipment()}
                    onDuplicate={handleDuplicateItem}
                    isInbound={isInbound}
                    isCompleted={shipment.status === 'completed' || shipment.status === 'cancelled'}
                    classes={classes}
                    accountId={shipment.account_id || undefined}
                  />
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Photos Section */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Capture or upload photos</CardDescription>
          </div>
          <div className="flex gap-2">
            <PhotoScannerButton
              entityType="shipment"
              entityId={shipment.id}
              tenantId={profile?.tenant_id}
              existingPhotos={getPhotoUrls(receivingPhotos)}
              maxPhotos={20}
              onPhotosSaved={async (urls) => {
                // Convert new URLs to TaggablePhoto format and merge with existing
                const existingUrls = getPhotoUrls(receivingPhotos);
                const newUrls = urls.filter(u => !existingUrls.includes(u));
                const newTaggablePhotos: TaggablePhoto[] = newUrls.map(url => ({
                  url,
                  isPrimary: false,
                  needsAttention: false,
                  isRepair: false,
                }));
                const normalizedExisting: TaggablePhoto[] = receivingPhotos.map(p =>
                  typeof p === 'string'
                    ? { url: p, isPrimary: false, needsAttention: false, isRepair: false }
                    : p
                );
                const allPhotos = [...normalizedExisting, ...newTaggablePhotos];
                setReceivingPhotos(allPhotos);
                await supabase
                  .from('shipments')
                  .update({ receiving_photos: allPhotos as unknown as Json })
                  .eq('id', shipment.id);
              }}
              label="Take Photos"
            />
            <PhotoUploadButton
              entityType="shipment"
              entityId={shipment.id}
              tenantId={profile?.tenant_id}
              existingPhotos={getPhotoUrls(receivingPhotos)}
              maxPhotos={20}
              onPhotosSaved={async (urls) => {
                // Convert new URLs to TaggablePhoto format and merge with existing
                const existingUrls = getPhotoUrls(receivingPhotos);
                const newUrls = urls.filter(u => !existingUrls.includes(u));
                const newTaggablePhotos: TaggablePhoto[] = newUrls.map(url => ({
                  url,
                  isPrimary: false,
                  needsAttention: false,
                  isRepair: false,
                }));
                const normalizedExisting: TaggablePhoto[] = receivingPhotos.map(p =>
                  typeof p === 'string'
                    ? { url: p, isPrimary: false, needsAttention: false, isRepair: false }
                    : p
                );
                const allPhotos = [...normalizedExisting, ...newTaggablePhotos];
                setReceivingPhotos(allPhotos);
                await supabase
                  .from('shipments')
                  .update({ receiving_photos: allPhotos as unknown as Json })
                  .eq('id', shipment.id);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {receivingPhotos.length > 0 ? (
            <TaggablePhotoGrid
              photos={receivingPhotos}
              onPhotosChange={async (photos) => {
                setReceivingPhotos(photos);
                await supabase
                  .from('shipments')
                  .update({ receiving_photos: photos as unknown as Json })
                  .eq('id', shipment.id);
              }}
              enableTagging={true}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No photos yet. Tap "Take Photos" to capture.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Scan or upload receiving paperwork, BOLs, and delivery receipts</CardDescription>
          </div>
          <div className="flex gap-2">
            <ScanDocumentButton
              context={{ type: 'shipment', shipmentId: shipment.id }}
              onSuccess={() => {
                // Documents will auto-refresh via the DocumentList
              }}
              label="Scan"
              size="sm"
              directToCamera
            />
            <DocumentUploadButton
              context={{ type: 'shipment', shipmentId: shipment.id }}
              onSuccess={() => {
                // Documents will auto-refresh via the DocumentList
              }}
              size="sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <DocumentList
            contextType="shipment"
            contextId={shipment.id}
          />
        </CardContent>
      </Card>

      {/* Receiving Notes (shown when received) */}
      {isReceived && shipment.receiving_notes && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Receiving Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{shipment.receiving_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Shipment History */}
      <div className="mt-6">
        <ShipmentHistoryTab shipmentId={shipment.id} />
      </div>

      {/* Finish Receiving Dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Finish Receiving</AlertDialogTitle>
            <AlertDialogDescription>
              Verify the quantities received for each item. This will create inventory items.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Expected</TableHead>
                  <TableHead className="text-center w-32">Received</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivedItems.map((item) => (
                  <TableRow key={item.shipment_item_id}>
                    <TableCell>{item.expected_description || '-'}</TableCell>
                    <TableCell className="text-center">{item.expected_quantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={item.actual_quantity}
                        onChange={(e) => updateReceivedQuantity(
                          item.shipment_item_id,
                          parseInt(e.target.value) || 0
                        )}
                        className="w-20 text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        item.status === 'received' ? 'default' :
                        item.status === 'partial' ? 'secondary' : 'destructive'
                      }>
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {receivedItems.some(i => i.status !== 'received') && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md text-sm">
              <MaterialIcon name="warning" size="sm" className="text-yellow-600" />
              <span>Some items have discrepancies. These will be flagged for review.</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinishReceiving}>
              Complete Receiving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Labels Dialog */}
      <PrintLabelsDialog
        open={showPrintLabelsDialog}
        onOpenChange={setShowPrintLabelsDialog}
        items={createdItemsForLabels}
        title="Print Item Labels"
        description={`${createdItemsForLabels.length} items were created from receiving. Print labels now?`}
      />

      {/* Add Charge Dialog - Manager/Admin Only */}
      {shipment.account_id && canSeeBilling && (
        <AddAddonDialog
          open={addAddonDialogOpen}
          onOpenChange={setAddAddonDialogOpen}
          accountId={shipment.account_id}
          accountName={shipment.accounts?.name}
          shipmentId={shipment.id}
          onSuccess={() => {
            // Refresh both shipment data and billing calculator
            fetchShipment();
            setBillingRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* Add Item Dialog for Inbound Shipments */}
      <AddShipmentItemDialog
        open={addItemDialogOpen}
        onOpenChange={setAddItemDialogOpen}
        shipmentId={shipment.id}
        accountId={shipment.account_id || undefined}
        warehouseId={shipment.warehouse_id || undefined}
        sidemarkId={shipment.sidemark_id || undefined}
        tenantId={profile?.tenant_id}
        classes={classes}
        onSuccess={() => {
          fetchShipment();
        }}
      />

      {/* Cancel Shipment Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Shipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this shipment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Shipment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelShipment}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Shipment'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Outbound Completion Dialog */}
      <AlertDialog open={showOutboundCompleteDialog} onOpenChange={setShowOutboundCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Shipment</AlertDialogTitle>
            <AlertDialogDescription>
              This will release {items.length} item(s) and mark the shipment as completed.
              {receivingPhotos.length === 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Note: At least one photo is required to complete this shipment.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteOutbound}
              disabled={completingOutbound || receivingPhotos.length === 0}
            >
              {completingOutbound ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                'Complete Shipment'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassign Account Dialog */}
      {shipment.account_id && (
        <ReassignAccountDialog
          open={showReassignDialog}
          onOpenChange={setShowReassignDialog}
          entityType="shipment"
          entityIds={[shipment.id]}
          currentAccountId={shipment.account_id}
          currentAccountName={shipment.accounts?.name}
          onSuccess={fetchShipment}
        />
      )}
    </DashboardLayout>
  );
}
