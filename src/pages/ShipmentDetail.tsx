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
import { QRScanner } from '@/components/scan/QRScanner';
import { useLocations } from '@/hooks/useLocations';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { HelpButton, usePromptContextSafe } from '@/components/prompts';
import { SOPValidationDialog, SOPBlocker } from '@/components/common/SOPValidationDialog';

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

interface LastScanResult {
  itemCode: string;
  result: 'success' | 'duplicate' | 'invalid' | 'error';
  message: string;
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
  const [pullSessionActive, setPullSessionActive] = useState(false);
  const [releaseSessionActive, setReleaseSessionActive] = useState(false);
  const [processingScan, setProcessingScan] = useState(false);
  const [lastScan, setLastScan] = useState<LastScanResult | null>(null);
  const [manualScanValue, setManualScanValue] = useState('');
  const [manualOverrideItemId, setManualOverrideItemId] = useState('');
  const [showPartialReleaseDialog, setShowPartialReleaseDialog] = useState(false);
  const [partialReleaseNote, setPartialReleaseNote] = useState('');
  const [partialReleaseItems, setPartialReleaseItems] = useState<Set<string>>(new Set());
  const [sopValidationOpen, setSopValidationOpen] = useState(false);
  const [sopBlockers, setSopBlockers] = useState<SOPBlocker[]>([]);
  const [submittingPartialRelease, setSubmittingPartialRelease] = useState(false);
  const [accountSettings, setAccountSettings] = useState<{
    default_shipment_notes: string | null;
    highlight_shipment_notes: boolean;
  } | null>(null);

  // Receiving session hook
  const {
    session,
    loading: sessionLoading,
    fetchSession,
    startSession: rawStartSession,
    finishSession: rawFinishSession,
    cancelSession,
  } = useReceivingSession(id);

  const { locations } = useLocations(shipment?.warehouse_id || undefined);

  const normalizeLocationCode = (code?: string | null) =>
    (code || '').toUpperCase().replace(/[_\s]+/g, '-');
  const isOutboundDock = (code?: string | null) => normalizeLocationCode(code) === 'OUTBOUND-DOCK';
  const isReleasedLocation = (code?: string | null) =>
    ['RELEASED', 'RELEASE'].includes(normalizeLocationCode(code));
  const outboundDockLocation = locations.find(location => isOutboundDock(location.code));
  const releasedLocation = locations.find(location => normalizeLocationCode(location.code) === 'RELEASED')
    || locations.find(location => location.type === 'release');

  const logShipmentAudit = useCallback(async (action: string, changes: Record<string, unknown>) => {
    if (!profile?.tenant_id || !profile?.id || !shipment?.id) return;
    const { error } = await (supabase.from('admin_audit_log') as any).insert({
      action,
      actor_id: profile.id,
      tenant_id: profile.tenant_id,
      entity_type: 'shipment',
      entity_id: shipment.id,
      changes_json: changes as Json,
    });

    if (error) {
      console.error('Error logging shipment audit:', error);
    }
  }, [profile?.id, profile?.tenant_id, shipment?.id]);

  // Prompt context for guided prompts
  const promptContext = usePromptContextSafe();

  // Wrapped startSession with prompt trigger
  const startSession = useCallback(async () => {
    // Show pre-task prompt if available
    if (promptContext?.showPrompt) {
      const shown = promptContext.showPrompt('receiving_pre_task', {
        contextType: 'shipment',
        contextId: id,
      });
      // If prompt is shown, it will block; if not shown (advanced user), continue
      if (!shown) {
        await rawStartSession();
      }
      // If prompt is shown, user will confirm and we proceed after
    } else {
      await rawStartSession();
    }
  }, [rawStartSession, promptContext, id]);

  // Wrapped finishSession with prompt trigger and competency tracking
  const finishSession = useCallback(async (
    verificationData: Parameters<typeof rawFinishSession>[0],
    createItems?: Parameters<typeof rawFinishSession>[1]
  ) => {
    // Show completion prompt if available
    if (promptContext?.showPrompt) {
      promptContext.showPrompt('receiving_completion', {
        contextType: 'shipment',
        contextId: id,
      });
    }
    const result = await rawFinishSession(verificationData, createItems);
    // Track competency after completion
    if (promptContext?.trackCompetencyEvent) {
      promptContext.trackCompetencyEvent('receiving', 'task_completed');
    }
    return result;
  }, [rawFinishSession, promptContext, id]);

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

      // Fetch classes first (needed for mapping)
      const { data: classesData } = await supabase
        .from('classes')
        .select('id, code, name')
        .eq('tenant_id', profile.tenant_id)
        .order('code');

      if (classesData) {
        setClasses(classesData);
      }

      // Build class lookup map
      const classById = new Map((classesData || []).map(c => [c.id, c]));

      // Fetch shipment items - avoid nested class joins that fail with PostgREST
      const { data: itemsData, error: itemsError } = await (supabase
        .from('shipment_items') as any)
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
          item:items(
            id,
            item_code,
            description,
            vendor,
            sidemark,
            room,
            class_id,
            current_location:locations(code),
            account:accounts(account_name)
          )
        `)
        .eq('shipment_id', id)
        .order('created_at');

      if (itemsError) {
        console.error('[ShipmentDetail] fetch items failed:', itemsError);
      }

      // Map classes manually to avoid PostgREST join issues
      const mappedItems = ((itemsData || []) as any[]).map(si => {
        // Map expected_class from expected_class_id
        if (si.expected_class_id) {
          si.expected_class = classById.get(si.expected_class_id) || null;
        }
        // Map item.class from item.class_id
        if (si.item?.class_id) {
          si.item.class = classById.get(si.item.class_id) || null;
        }
        return si;
      });

      setShipment(shipmentData as unknown as Shipment);
      setItems(mappedItems as unknown as ShipmentItem[]);
      setBillingRefreshKey(prev => prev + 1); // Trigger billing recalculation

      // Fetch account settings for shipment notes
      if (shipmentData.account_id) {
        const { data: accSettings } = await supabase
          .from('accounts')
          .select('default_shipment_notes, highlight_shipment_notes')
          .eq('id', shipmentData.account_id)
          .single();

        if (accSettings) {
          setAccountSettings({
            default_shipment_notes: accSettings.default_shipment_notes,
            highlight_shipment_notes: accSettings.highlight_shipment_notes || false,
          });
        }
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

  const outboundItems = items.filter(item => item.item?.id);
  const activeOutboundItems = outboundItems.filter(item => item.status !== 'cancelled');
  const allPulled = activeOutboundItems.length > 0
    && activeOutboundItems.every(item => isOutboundDock(item.item?.current_location?.code));
  const allReleased = activeOutboundItems.length > 0
    && activeOutboundItems.every(item => isReleasedLocation(item.item?.current_location?.code));

  const updateShipmentStatus = useCallback(async (status: string) => {
    if (!shipment) return;
    const { error } = await supabase
      .from('shipments')
      .update({ status })
      .eq('id', shipment.id);

    if (error) {
      console.error('Error updating shipment status:', error);
      return;
    }
    await fetchShipment();
  }, [fetchShipment, shipment]);

  useEffect(() => {
    if (!shipment || shipment.shipment_type !== 'outbound') return;
    if (pullSessionActive && allPulled) {
      setPullSessionActive(false);
      toast({
        title: 'Pull complete',
        description: 'All items are staged at Outbound Dock.',
      });
      logShipmentAudit('pull_completed', {
        shipment_id: shipment.id,
        item_count: activeOutboundItems.length,
      });
    }
  }, [activeOutboundItems.length, allPulled, logShipmentAudit, pullSessionActive, shipment, toast]);

  useEffect(() => {
    if (!shipment || shipment.shipment_type !== 'outbound') return;
    if (releaseSessionActive && allReleased) {
      setReleaseSessionActive(false);
      toast({
        title: 'Release scan complete',
        description: 'All items have been scanned as Released.',
      });
      logShipmentAudit('release_scan_completed', {
        shipment_id: shipment.id,
        item_count: activeOutboundItems.length,
      });
      if (shipment.status !== 'released') {
        updateShipmentStatus('released');
      }
    }
  }, [activeOutboundItems.length, allReleased, logShipmentAudit, releaseSessionActive, shipment, toast, updateShipmentStatus]);

  useEffect(() => {
    if (!shipment || shipment.shipment_type !== 'outbound') return;
    if (shipment.status === 'in_progress' && !allPulled && !pullSessionActive) {
      setPullSessionActive(true);
    }
    if (shipment.status === 'released' && !allReleased && !releaseSessionActive) {
      setReleaseSessionActive(true);
    }
  }, [allPulled, allReleased, pullSessionActive, releaseSessionActive, shipment]);

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

    // Call SOP validator RPC first
    try {
      const { data: validationResult, error: rpcError } = await (supabase as any).rpc(
        'validate_shipment_receiving_completion',
        { p_shipment_id: shipment.id }
      );

      if (rpcError) {
        console.error('Validation RPC error:', rpcError);
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Failed to validate receiving completion. Please try again.',
        });
        return;
      }

      const result = validationResult as { ok: boolean; blockers: SOPBlocker[] };
      const blockers = (result?.blockers || []).filter(
        (b: SOPBlocker) => b.severity === 'blocking' || !b.severity
      );

      if (!result?.ok && blockers.length > 0) {
        setSopBlockers(result.blockers);
        setSopValidationOpen(true);
        setShowFinishDialog(false);
        return;
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'An unexpected error occurred during validation.',
      });
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

  const findShipmentItemByScan = (scanValue: string) => {
    const normalized = scanValue.trim().toLowerCase();
    if (!normalized) return null;
    return activeOutboundItems.find(item =>
      item.item?.id?.toLowerCase() === normalized
      || item.item?.item_code?.toLowerCase() === normalized
    ) || null;
  };

  const updateItemLocation = async (itemId: string, locationId: string) => {
    const { error } = await (supabase.from('items') as any)
      .update({ current_location_id: locationId })
      .eq('id', itemId);

    if (error) {
      throw error;
    }
  };

  const updateItemReleasedState = async (itemId: string) => {
    const now = new Date().toISOString();
    const { error } = await (supabase.from('items') as any)
      .update({
        status: 'released',
        released_at: now,
        released_date: now,
      })
      .eq('id', itemId);

    if (error) {
      throw error;
    }
  };

  const updateShipmentItemRelease = async (shipmentItemId: string) => {
    const { error } = await (supabase.from('shipment_items') as any)
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
      })
      .eq('id', shipmentItemId);

    if (error) {
      throw error;
    }
  };

  const handleOutboundScan = async (scanValue: string, mode: 'pull' | 'release') => {
    if (!shipment) return;
    if (processingScan) return;
    const trimmed = scanValue.trim();
    if (!trimmed) return;

    setProcessingScan(true);
    setLastScan(null);

    try {
      const matched = findShipmentItemByScan(trimmed);
      if (!matched || !matched.item?.id) {
        const message = 'This is the wrong item. Please return the item to its previous location.';
        setLastScan({ itemCode: trimmed, result: 'invalid', message });
        hapticError();
        toast({
          variant: 'destructive',
          title: 'Wrong item',
          description: message,
        });
        await logShipmentAudit('scan_invalid', {
          scan_value: trimmed,
          mode,
          message,
        });
        return;
      }

      if (mode === 'pull') {
        if (!outboundDockLocation?.id) {
          toast({
            variant: 'destructive',
            title: 'Outbound Dock missing',
            description: 'Create an OUTBOUND-DOCK location before scanning.',
          });
          return;
        }

        if (isOutboundDock(matched.item.current_location?.code)) {
          const message = 'Item already staged at Outbound Dock.';
          setLastScan({ itemCode: matched.item.item_code, result: 'duplicate', message });
          hapticError();
          toast({ title: 'Duplicate scan', description: message });
          await logShipmentAudit('scan_duplicate', {
            scan_value: trimmed,
            mode,
            item_id: matched.item.id,
          });
          return;
        }

        await updateItemLocation(matched.item.id, outboundDockLocation.id);
        setLastScan({
          itemCode: matched.item.item_code,
          result: 'success',
          message: 'Moved to Outbound Dock.',
        });
        hapticSuccess();
        await logShipmentAudit('pull_scan_success', {
          item_id: matched.item.id,
          shipment_item_id: matched.id,
          location_id: outboundDockLocation.id,
        });
      }

      if (mode === 'release') {
        if (!releasedLocation?.id) {
          toast({
            variant: 'destructive',
            title: 'Released location missing',
            description: 'Create a RELEASED (or type Release) location before scanning.',
          });
          return;
        }

        if (isReleasedLocation(matched.item.current_location?.code)) {
          const message = 'Item already scanned as Released.';
          setLastScan({ itemCode: matched.item.item_code, result: 'duplicate', message });
          hapticError();
          toast({ title: 'Duplicate scan', description: message });
          await logShipmentAudit('scan_duplicate', {
            scan_value: trimmed,
            mode,
            item_id: matched.item.id,
          });
          return;
        }

        await updateItemLocation(matched.item.id, releasedLocation.id);
        await updateItemReleasedState(matched.item.id);
        await updateShipmentItemRelease(matched.id);
        setLastScan({
          itemCode: matched.item.item_code,
          result: 'success',
          message: 'Marked as Released.',
        });
        hapticSuccess();
        await logShipmentAudit('release_scan_success', {
          item_id: matched.item.id,
          shipment_item_id: matched.id,
          location_id: releasedLocation.id,
        });
      }

      await fetchShipment();
    } catch (error) {
      console.error('Error processing scan:', error);
      setLastScan({ itemCode: trimmed, result: 'error', message: 'Failed to process scan.' });
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Scan failed',
        description: 'Unable to update item. Please try again.',
      });
      await logShipmentAudit('scan_error', {
        scan_value: trimmed,
        mode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setProcessingScan(false);
    }
  };

  const handleStartPull = async () => {
    if (!shipment) return;
    if (!outboundDockLocation?.id) {
      toast({
        variant: 'destructive',
        title: 'Outbound Dock missing',
        description: 'Create an OUTBOUND-DOCK location before starting the pull.',
      });
      return;
    }
    setPullSessionActive(true);
    setReleaseSessionActive(false);
    if (['expected', 'pending'].includes(shipment.status)) {
      await updateShipmentStatus('in_progress');
    }
    await logShipmentAudit('pull_started', {
      shipment_id: shipment.id,
      item_count: activeOutboundItems.length,
    });
  };

  const handleStartRelease = async () => {
    if (!shipment) return;
    if (!allPulled) {
      toast({
        variant: 'destructive',
        title: 'Items not staged',
        description: 'All items must be at Outbound Dock before release scanning.',
      });
      return;
    }
    if (!releasedLocation?.id) {
      toast({
        variant: 'destructive',
        title: 'Released location missing',
        description: 'Create a RELEASED (or type Release) location before starting the release scan.',
      });
      return;
    }
    setReleaseSessionActive(true);
    setPullSessionActive(false);
    await logShipmentAudit('release_scan_started', {
      shipment_id: shipment.id,
      item_count: activeOutboundItems.length,
    });
  };

  const handleManualOverride = async (mode: 'pull' | 'release') => {
    if (!manualOverrideItemId) return;
    const targetItem = items.find(item => item.item?.id === manualOverrideItemId);
    if (!targetItem || !targetItem.item?.id) return;
    try {
      if (mode === 'pull') {
        if (!outboundDockLocation?.id) return;
        await updateItemLocation(targetItem.item.id, outboundDockLocation.id);
        await logShipmentAudit('pull_manual_override', {
          shipment_item_id: targetItem.id,
          item_id: targetItem.item.id,
        });
        toast({ title: 'Item staged', description: 'Marked as Outbound Dock.' });
      }

      if (mode === 'release') {
        if (!releasedLocation?.id) return;
        await updateItemLocation(targetItem.item.id, releasedLocation.id);
        await updateItemReleasedState(targetItem.item.id);
        await updateShipmentItemRelease(targetItem.id);
        await logShipmentAudit('release_manual_override', {
          shipment_item_id: targetItem.id,
          item_id: targetItem.item.id,
        });
        toast({ title: 'Item released', description: 'Marked as Released.' });
      }

      setManualOverrideItemId('');
      await fetchShipment();
    } catch (error) {
      console.error('Error applying manual override:', error);
      toast({
        variant: 'destructive',
        title: 'Manual override failed',
        description: 'Unable to update this item.',
      });
    }
  };

  const handleSubmitPartialRelease = async () => {
    if (!shipment || partialReleaseItems.size === 0) return;
    if (!partialReleaseNote.trim()) {
      toast({
        variant: 'destructive',
        title: 'Note required',
        description: 'Please add a note explaining the partial release.',
      });
      return;
    }
    setSubmittingPartialRelease(true);
    try {
      const ids = Array.from(partialReleaseItems);
      const { error } = await (supabase.from('shipment_items') as any)
        .update({
          status: 'cancelled',
          notes: partialReleaseNote || null,
        })
        .in('id', ids);

      if (error) throw error;
      await logShipmentAudit('partial_release', {
        shipment_id: shipment.id,
        removed_items: ids,
        note: partialReleaseNote || null,
      });
      setPartialReleaseItems(new Set());
      setPartialReleaseNote('');
      setShowPartialReleaseDialog(false);
      await fetchShipment();
      toast({ title: 'Items removed', description: 'Shipment updated for partial release.' });
    } catch (error) {
      console.error('Error applying partial release:', error);
      toast({
        variant: 'destructive',
        title: 'Partial release failed',
        description: 'Unable to update shipment items.',
      });
    } finally {
      setSubmittingPartialRelease(false);
    }
  };

  // ------------------------------------------
  // Handle complete outbound shipment
  // ------------------------------------------
  const handleCompleteOutbound = async () => {
    if (!shipment) return;

    // Call SOP validator RPC first
    try {
      const { data: validationResult, error: rpcError } = await (supabase as any).rpc(
        'validate_shipment_outbound_completion',
        { p_shipment_id: shipment.id }
      );

      if (rpcError) {
        console.error('Validation RPC error:', rpcError);
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Failed to validate outbound completion. Please try again.',
        });
        return;
      }

      const result = validationResult as { ok: boolean; blockers: SOPBlocker[] };
      const blockers = (result?.blockers || []).filter(
        (b: SOPBlocker) => b.severity === 'blocking' || !b.severity
      );

      if (!result?.ok && blockers.length > 0) {
        setSopBlockers(result.blockers);
        setSopValidationOpen(true);
        setShowOutboundCompleteDialog(false);
        return;
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'An unexpected error occurred during validation.',
      });
      return;
    }

    if (activeOutboundItems.length > 0 && !allReleased) {
      toast({
        variant: 'destructive',
        title: 'Release scanning incomplete',
        description: 'All items must be scanned as Released before completion.',
      });
      return;
    }

    setCompletingOutbound(true);
    try {
      const now = new Date().toISOString();
      // Update shipment status to completed
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({
          status: 'shipped',
          shipped_at: now,
          completed_at: now,
          completed_by: profile?.id || null,
        })
        .eq('id', shipment.id);

      if (shipmentError) throw shipmentError;

      // Update all items in the shipment to released status
      const itemIds = activeOutboundItems.filter(i => i.item_id).map(i => i.item_id);
      if (itemIds.length > 0) {
        const itemUpdate: Record<string, string | null> = {
          status: 'released',
          released_at: now,
          released_date: now,
        };
        if (releasedLocation?.id) {
          itemUpdate.current_location_id = releasedLocation.id;
        }
        const { error: itemsError } = await supabase
          .from('items')
          .update(itemUpdate)
          .in('id', itemIds);

        if (itemsError) throw itemsError;
      }

      // Update shipment_items status to released (valid values: pending, received, released, cancelled)
      const { error: shipmentItemsError } = await supabase
        .from('shipment_items')
        .update({
          status: 'released',
          released_at: now,
        })
        .eq('shipment_id', shipment.id)
        .neq('status', 'cancelled');

      if (shipmentItemsError) throw shipmentItemsError;

      await logShipmentAudit('shipment_completed', {
        shipment_id: shipment.id,
        item_count: activeOutboundItems.length,
      });
      toast({ title: 'Shipment Shipped', description: 'Items have been released.' });
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
      shipped: 'default',
      completed: 'default',
      cancelled: 'outline',
    };
    const labels: Record<string, string> = {
      expected: 'Expected',
      receiving: 'In Progress',
      in_progress: 'In Progress',
      received: 'Received',
      partial: 'Partial',
      shipped: 'Shipped',
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
  const isOutbound = shipment.shipment_type === 'outbound';
  const canReceive = isInbound && ['expected', 'receiving'].includes(shipment.status);
  const isReceiving = session !== null;
  const isReceived = shipment.status === 'received' || shipment.status === 'partial';
  const canStartPull = isOutbound && !pullSessionActive && !allPulled && ['expected', 'pending', 'in_progress'].includes(shipment.status);
  const canStartRelease = isOutbound && allPulled && !releaseSessionActive && !allReleased;
  const canCompleteOutbound = isOutbound && (activeOutboundItems.length === 0 || allReleased);
  const partialReleaseCandidates = activeOutboundItems.filter(item => !isReleasedLocation(item.item?.current_location?.code));

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
          {canStartPull && (
            <Button size="sm" onClick={handleStartPull}>
              <MaterialIcon name="qr_code_scanner" size="sm" className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Start Pull</span>
              <span className="sm:hidden">Pull</span>
            </Button>
          )}
          {canStartRelease && (
            <Button size="sm" onClick={handleStartRelease}>
              <MaterialIcon name="local_shipping" size="sm" className="mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Start Release Scan</span>
              <span className="sm:hidden">Release</span>
            </Button>
          )}
          {/* Complete Shipment button for outbound shipments */}
          {!isInbound && ['pending', 'expected', 'in_progress', 'released'].includes(shipment.status) && (
            <Button size="sm" onClick={() => setShowOutboundCompleteDialog(true)} disabled={!canCompleteOutbound}>
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
          {/* Help button for receiving workflow */}
          {isInbound && <HelpButton workflow="receiving" />}
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
      {isOutbound && ['expected', 'pending', 'in_progress', 'released'].includes(shipment.status) && (
        <Card className="mb-6 border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="font-medium">
                  {allReleased
                    ? 'Outbound release ready to complete'
                    : allPulled
                      ? 'Outbound items staged at dock'
                      : 'Outbound pull in progress'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(true)}>
                  <MaterialIcon name="cancel" size="sm" className="mr-2" />
                  Cancel
                </Button>
                {!allPulled && (
                  <Button size="sm" onClick={handleStartPull} disabled={pullSessionActive}>
                    <MaterialIcon name="qr_code_scanner" size="sm" className="mr-2" />
                    Pull Items
                  </Button>
                )}
                {allPulled && !allReleased && (
                  <Button size="sm" onClick={handleStartRelease} disabled={releaseSessionActive}>
                    <MaterialIcon name="local_shipping" size="sm" className="mr-2" />
                    Release Scan
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowOutboundCompleteDialog(true)} disabled={!canCompleteOutbound}>
                  <MaterialIcon name="check_circle" size="sm" className="mr-2" />
                  Complete Release
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outbound Scanning */}
      {isOutbound && (pullSessionActive || releaseSessionActive) && (
        <Card className="mb-6 border-primary/40">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Outbound Scanning</CardTitle>
                <CardDescription>
                  {pullSessionActive
                    ? 'Scan each item to stage it at Outbound Dock.'
                    : 'Scan each item to mark it Released.'}
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                {activeOutboundItems.length} item{activeOutboundItems.length !== 1 ? 's' : ''} •
                {' '}
                {pullSessionActive ? 'Staged' : 'Released'} {pullSessionActive ? activeOutboundItems.filter(item => isOutboundDock(item.item?.current_location?.code)).length : activeOutboundItems.filter(item => isReleasedLocation(item.item?.current_location?.code)).length}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <QRScanner
                  onScan={(value) => handleOutboundScan(value, pullSessionActive ? 'pull' : 'release')}
                  onError={() => {
                    setLastScan({ itemCode: '', result: 'error', message: 'Scanner error. Please try again.' });
                  }}
                  scanning={!processingScan}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={manualScanValue}
                    onChange={(e) => setManualScanValue(e.target.value)}
                    placeholder="Enter or scan item code"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleOutboundScan(manualScanValue, pullSessionActive ? 'pull' : 'release');
                        setManualScanValue('');
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      handleOutboundScan(manualScanValue, pullSessionActive ? 'pull' : 'release');
                      setManualScanValue('');
                    }}
                    disabled={!manualScanValue.trim() || processingScan}
                  >
                    Scan
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {lastScan && (
                  <div className={cn(
                    'rounded-lg border p-3 text-sm',
                    lastScan.result === 'success' && 'border-green-500/40 bg-green-500/10 text-green-500',
                    lastScan.result === 'duplicate' && 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
                    (lastScan.result === 'invalid' || lastScan.result === 'error') && 'border-red-500/40 bg-red-500/10 text-red-500'
                  )}>
                    <p className="font-semibold">{lastScan.itemCode || 'Scan Result'}</p>
                    <p>{lastScan.message}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm">Manual override</Label>
                  <Select value={manualOverrideItemId} onValueChange={setManualOverrideItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an item..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(pullSessionActive
                        ? activeOutboundItems.filter(item => !isOutboundDock(item.item?.current_location?.code))
                        : activeOutboundItems.filter(item => !isReleasedLocation(item.item?.current_location?.code))
                      ).map(item => (
                        <SelectItem key={item.id} value={item.item?.id || ''}>
                          {item.item?.item_code || item.expected_description || 'Unknown item'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => handleManualOverride(pullSessionActive ? 'pull' : 'release')}
                    disabled={!manualOverrideItemId}
                  >
                    Mark {pullSessionActive ? 'Pulled' : 'Released'}
                  </Button>
                </div>
                {releaseSessionActive && (
                  <Button variant="destructive" onClick={() => setShowPartialReleaseDialog(true)}>
                    Partial Release / Remove Items
                  </Button>
                )}
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

      {/* Account Default Shipment Notes - Full width, only show if highlight enabled AND notes not blank */}
      {accountSettings?.highlight_shipment_notes && accountSettings?.default_shipment_notes?.trim() && (
        <Card className="mb-6 bg-orange-50 dark:bg-orange-900/20 border-4 border-orange-500 dark:border-orange-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-orange-600 dark:text-orange-400">⚠️</span>
              Account Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap font-bold text-orange-700 dark:text-orange-300">{accountSettings.default_shipment_notes}</p>
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
                    isCompleted={shipment.status === 'completed' || shipment.status === 'cancelled' || shipment.status === 'shipped'}
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
              This will release {items.length} item(s) and mark the shipment as shipped.
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

      {/* Partial Release Dialog */}
      <AlertDialog open={showPartialReleaseDialog} onOpenChange={setShowPartialReleaseDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Partial Release</AlertDialogTitle>
            <AlertDialogDescription>
              Select items to remove from this shipment and add a required note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border p-3">
              {partialReleaseCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">All items are already released.</p>
              ) : (
                partialReleaseCandidates.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={partialReleaseItems.has(item.id)}
                        onCheckedChange={(checked) => {
                          setPartialReleaseItems(prev => {
                            const next = new Set(prev);
                            if (checked) {
                              next.add(item.id);
                            } else {
                              next.delete(item.id);
                            }
                            return next;
                          });
                        }}
                      />
                      <div className="text-sm">
                        <p className="font-medium">{item.item?.item_code || item.expected_description || 'Unknown item'}</p>
                        <p className="text-muted-foreground">
                          Location: {item.item?.current_location?.code || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <Label>Required note</Label>
              <Textarea
                value={partialReleaseNote}
                onChange={(e) => setPartialReleaseNote(e.target.value)}
                placeholder="Explain why items are not being released..."
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitPartialRelease}
              disabled={submittingPartialRelease || partialReleaseItems.size === 0 || !partialReleaseNote.trim()}
            >
              {submittingPartialRelease ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Remove Selected Items'
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

      {/* SOP Validation Dialog */}
      <SOPValidationDialog
        open={sopValidationOpen}
        onOpenChange={setSopValidationOpen}
        blockers={sopBlockers}
      />
    </DashboardLayout>
  );
}
