import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, Navigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Separator } from '@/components/ui/separator';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useAccountSidemarks } from '@/hooks/useAccountSidemarks';
import { useAccountRoomSuggestions } from '@/hooks/useAccountRoomSuggestions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUuid, cn } from '@/lib/utils';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { ItemFlagsSection } from '@/components/items/ItemFlagsSection';
import { ItemBillingEventsSection } from '@/components/items/ItemBillingEventsSection';
import { ItemNotesSection } from '@/components/items/ItemNotesSection';
import { usePermissions } from '@/hooks/usePermissions';
import { RepairQuoteSection } from '@/components/items/RepairQuoteSection';
import { ItemPhotoGallery } from '@/components/items/ItemPhotoGallery';
import { ItemHistoryTab } from '@/components/items/ItemHistoryTab';
import { ItemActivityFeed } from '@/components/items/ItemActivityFeed';
import { ItemEditDialog } from '@/components/items/ItemEditDialog';
import { useItemPhotos } from '@/hooks/useItemPhotos';
import { useItemNotes } from '@/hooks/useItemNotes';
import { useDocuments } from '@/hooks/useDocuments';
import { ItemAdvancedTab } from '@/components/items/ItemAdvancedTab';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { AddBillingChargeDialog } from '@/components/items/AddBillingChargeDialog';
import { AddCreditDialog } from '@/components/billing/AddCreditDialog';
import { LinkToShipmentDialog } from '@/components/items/LinkToShipmentDialog';
import { CoverageSelector } from '@/components/coverage/CoverageSelector';
import { ClaimCreateDialog } from '@/components/claims/ClaimCreateDialog';
import { ItemLabelData } from '@/lib/labelGenerator';
import { ScanDocumentButton, DocumentList } from '@/components/scanner';
import { format } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { QuickReleaseDialog } from '@/components/inventory/QuickReleaseDialog';
import { ReassignAccountDialog } from '@/components/common/ReassignAccountDialog';
import { logItemActivity } from '@/lib/activity/logItemActivity';

interface ReceivingShipment {
  id: string;
  shipment_number: string;
  shipment_type: string;
  status: string;
  received_at: string | null;
}

interface ItemDetail {
  id: string;
  item_code: string;
  description: string | null;
  status: string;
  quantity: number;
  client_account: string | null;
  sidemark: string | null;
  sidemark_id: string | null;
  account_id: string | null;
  vendor: string | null;
  size: number | null;
  size_unit: string | null;
  room: string | null;
  link: string | null;
  item_type_id: string | null;
  class_id: string | null;
  received_at: string | null;
  created_at: string;
  assembly_status: string | null;
  inspection_status: string | null;
  repair_status: string | null;
  photo_urls: string[] | null;
  inspection_photos: string[] | null;
  repair_photos: string[] | null;
  primary_photo_url: string | null;
  // Coverage fields
  coverage_type: string | null;
  declared_value: number | null;
  weight_lbs: number | null;
  // Receiving shipment
  receiving_shipment_id: string | null;
  receiving_shipment?: ReceivingShipment | null;
  // Flags
  is_overweight: boolean;
  is_oversize: boolean;
  is_unstackable: boolean;
  is_crated: boolean;
  needs_repair: boolean;
  needs_inspection: boolean;
  needs_warehouse_assembly: boolean;
  notify_dispatch: boolean;
  has_damage: boolean;
  // Relations
  location?: { id: string; code: string; name: string | null } | null;
  warehouse?: { id: string; name: string } | null;
  item_type?: { id: string; name: string } | null;
  class?: { id: string; code: string; name: string } | null;
  account?: { id: string; account_name: string; account_code: string } | null;
}

interface Movement {
  id: string;
  action_type: string;
  moved_at: string;
  note: string | null;
  from_location?: { code: string } | null;
  to_location?: { code: string } | null;
}

interface ItemTask {
  id: string;
  title: string;
  task_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
}

interface ShipmentLink {
  id: string;
  shipment_number: string;
  shipment_type: string;
  status: string;
  created_at: string;
  received_at?: string | null;
}

// Resolves non-UUID item_code params to UUID and redirects
function ItemCodeResolver({ itemCode }: { itemCode: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lookup = async () => {
      if (!profile?.tenant_id) return;

      const { data, error: fetchError } = await supabase
        .from('items')
        .select('id')
        .eq('item_code', itemCode)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (fetchError || !data) {
        setError('Item not found');
        toast({
          variant: 'destructive',
          title: 'Item Not Found',
          description: `No item found with code "${itemCode}".`,
        });
        setTimeout(() => navigate('/inventory', { replace: true }), 2000);
        return;
      }

      navigate(`/inventory/${data.id}`, { replace: true });
    };
    lookup();
  }, [itemCode, profile?.tenant_id, navigate, toast]);

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        {error ? (
          <>
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-muted-foreground text-sm">Redirecting to inventory...</p>
          </>
        ) : (
          <p className="text-muted-foreground">Looking up item...</p>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();

  // ============================================
  // RENDER-TIME GUARDS - execute before any hooks
  // ============================================
  if (!id) {
    return <Navigate to="/inventory" replace />;
  }

  // If param is not a UUID, try to resolve it as an item_code
  if (!isValidUuid(id)) {
    return <ItemCodeResolver itemCode={id} />;
  }

  // Now we know id is a valid UUID - safe to use hooks
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { profile } = useAuth();

  // Tab state - initialize from URL param if provided
  const initialTab = searchParams.get('tab') || 'details';
  const validTabs = ['details', 'photos', 'documents', 'notes', 'coverage', 'activity', 'history', 'advanced', 'repair'];
  const [activeTab, setActiveTab] = useState(validTabs.includes(initialTab) ? initialTab : 'details');

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [tasks, setTasks] = useState<ItemTask[]>([]);
  const [shipments, setShipments] = useState<ShipmentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountSettings, setAccountSettings] = useState<{
    default_item_notes: string | null;
    highlight_item_notes: boolean;
  } | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [billingChargeDialogOpen, setBillingChargeDialogOpen] = useState(false);
  const [addCreditDialogOpen, setAddCreditDialogOpen] = useState(false);
  const [linkShipmentDialogOpen, setLinkShipmentDialogOpen] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);
  const [activeIndicatorFlags, setActiveIndicatorFlags] = useState<Array<{ code: string; name: string }>>([]);

  // Inline edit state for autocomplete fields
  const [editVendor, setEditVendor] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSidemark, setEditSidemark] = useState('');
  const [editRoom, setEditRoom] = useState('');

  // Check if user is a client (simplified check)
  const isClientUser = false; // Will be determined by role system

  // Permission checks
  const { hasRole } = usePermissions();
  const canSeeBilling = hasRole('admin') || hasRole('tenant_admin') || hasRole('manager');
  const canAddCredit = hasRole('admin') || hasRole('tenant_admin');

  // Get counts for tab indicators
  const { allPhotos: photoList } = useItemPhotos(id);
  const { notes: notesList } = useItemNotes(id);
  const { documents: docsList } = useDocuments({ contextType: 'item', contextId: id });

  const photoCount = photoList.length;
  const notesCount = notesList.length;
  const docsCount = docsList.length;

  // Field suggestions for autocomplete
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: addDescSuggestion } = useFieldSuggestions('description');
  const { sidemarks } = useAccountSidemarks(item?.account_id);
  const { rooms } = useAccountRoomSuggestions(item?.account_id);

  // Fetch active indicator flags for this item
  const fetchIndicatorFlags = async () => {
    try {
      const { data, error } = await (supabase
        .from('item_flags') as any)
        .select('service_code, charge_types:charge_type_id(charge_name)')
        .eq('item_id', id);

      if (error) {
        // Table may not exist yet
        if (error.code !== '42P01') {
          console.error('[ItemDetail] Error fetching indicator flags:', error);
        }
        return;
      }

      setActiveIndicatorFlags(
        (data || []).map((f: any) => ({
          code: f.service_code,
          name: f.charge_types?.charge_name || f.service_code,
        }))
      );
    } catch (err) {
      // Silently handle - indicator flags are non-critical UI enhancement
    }
  };

  // Fetch data on mount (id is guaranteed valid UUID at this point)
  useEffect(() => {
    fetchItem();
    fetchMovements();
    fetchTasks();
    fetchShipments();
    fetchIndicatorFlags();
  }, [id]);

  // Sync local edit state when item changes
  useEffect(() => {
    if (item) {
      setEditVendor(item.vendor || '');
      setEditDescription(item.description || '');
      setEditSidemark(item.sidemark || '');
      setEditRoom(item.room || '');
    }
  }, [item?.vendor, item?.description, item?.sidemark, item?.room]);

  // Fetch account settings when item is loaded
  useEffect(() => {
    if (item?.account_id) {
      const fetchAccountSettings = async () => {
        const { data } = await (supabase.from('accounts') as any)
          .select('default_item_notes, highlight_item_notes')
          .eq('id', item.account_id)
          .single();
        if (data) {
          setAccountSettings(data);
        }
      };
      fetchAccountSettings();
    }
  }, [item?.account_id]);

  const fetchItem = async () => {
    try {
      // First fetch: item with joined relations
      const { data, error } = await (supabase.from('items') as any)
        .select(`
          *,
          locations!items_current_location_id_fkey(id, code, name),
          warehouses(id, name),
          item_types(id, name),
          accounts:account_id(id, account_name, account_code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch class separately (FK may not be in PostgREST schema cache)
      let itemClass: { id: string; code: string; name: string } | null = null;
      if (data.class_id) {
        const { data: classData } = await (supabase.from('classes') as any)
          .select('id, code, name')
          .eq('id', data.class_id)
          .single();

        if (classData) {
          itemClass = classData;
        }
      }

      // If item has a receiving_shipment_id, fetch the shipment details
      let receivingShipment: ReceivingShipment | null = null;
      if (data.receiving_shipment_id) {
        const { data: shipmentData } = await (supabase.from('shipments') as any)
          .select('id, shipment_number, shipment_type, status, received_at')
          .eq('id', data.receiving_shipment_id)
          .single();

        if (shipmentData) {
          receivingShipment = shipmentData;
        }
      }

      setItem({
        ...data,
        location: data.locations,
        warehouse: data.warehouses,
        item_type: data.item_types,
        class: itemClass,
        account: data.accounts,
        receiving_shipment: receivingShipment,
        room: data.room || null,
        link: data.link || null,
        photo_urls: data.photo_urls || [],
        inspection_photos: data.inspection_photos || [],
        repair_photos: data.repair_photos || [],
        coverage_type: data.coverage_type || null,
        declared_value: data.declared_value || null,
        weight_lbs: data.weight_lbs || null,
      });
    } catch (error) {
      console.error('Error fetching item:', error);
      toast({
        title: 'Error',
        description: 'Failed to load item details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const { data } = await (supabase.from('movements') as any)
        .select(`
          id,
          action_type,
          moved_at,
          note,
          from_location:from_location_id(code),
          to_location:to_location_id(code)
        `)
        .eq('item_id', id)
        .order('moved_at', { ascending: false })
        .limit(20);

      setMovements(data || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: taskItems } = await (supabase.from('task_items') as any)
        .select('task_id')
        .eq('item_id', id);

      if (!taskItems || taskItems.length === 0) {
        setTasks([]);
        return;
      }

      const taskIds = taskItems.map((ti: any) => ti.task_id);

      const { data } = await (supabase.from('tasks') as any)
        .select('id, title, task_type, status, priority, due_date, created_at')
        .in('id', taskIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchShipments = async () => {
    try {
      // Get shipments through shipment_items
      const { data: shipmentItems } = await (supabase.from('shipment_items') as any)
        .select(`
          shipment_id,
          shipments:shipment_id(id, shipment_number, shipment_type, status, created_at)
        `)
        .eq('item_id', id);

      if (!shipmentItems) {
        setShipments([]);
        return;
      }

      const uniqueShipments = shipmentItems
        .map((si: any) => si.shipments)
        .filter((s: any) => s)
        .reduce((acc: ShipmentLink[], s: any) => {
          if (!acc.find(existing => existing.id === s.id)) {
            acc.push(s);
          }
          return acc;
        }, []);

      setShipments(uniqueShipments);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    }
  };

  const handleFlagsChange = async () => {
    if (item) {
      // Refetch item to get updated status values from database
      await fetchItem();
      // Refresh billing events section so new flag charges appear immediately
      setBillingRefreshKey(prev => prev + 1);
      // Refresh indicator flag badges in header
      await fetchIndicatorFlags();
    }
  };

  const openTaskMenu = (taskType: string) => {
    // Check for existing open tasks of this type
    const openTasks = tasks.filter(
      t => t.task_type === taskType && 
      !['completed', 'cancelled', 'unable_to_complete'].includes(t.status)
    );

    if (openTasks.length === 1) {
      // Navigate to the existing task
      navigate(`/tasks?id=${openTasks[0].id}`);
    } else if (openTasks.length > 1) {
      // Show list - for now just navigate to tasks filtered
      navigate(`/tasks?type=${taskType}`);
    } else {
      // Create new task
      setSelectedTaskType(taskType);
      setTaskDialogOpen(true);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      released: 'outline',
      disposed: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>;
  };

  const getSubStatusBadge = (status: string | null, type: string) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-100 text-gray-800'}>
        {type}: {status.replace('_', ' ')}
      </Badge>
    );
  };

  const handleSidemarkSave = async (newValue: string): Promise<boolean> => {
    if (!item) return false;
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ sidemark: newValue || null })
        .eq('id', item.id);
      
      if (error) throw error;
      if (profile?.tenant_id && (newValue || null) !== (item.sidemark || null)) {
        logItemActivity({
          tenantId: profile.tenant_id,
          itemId: item.id,
          actorUserId: profile.id,
          eventType: 'item_field_updated',
          eventLabel: `Sidemark updated`,
          details: { field: 'sidemark', from: item.sidemark, to: newValue || null },
        });
      }
      setItem({ ...item, sidemark: newValue || null });
      toast({ title: 'Sidemark updated' });
      return true;
    } catch (error) {
      console.error('Error updating sidemark:', error);
      toast({ title: 'Error', description: 'Failed to update sidemark', variant: 'destructive' });
      return false;
    }
  };

  const handleRoomSave = async (newValue: string): Promise<boolean> => {
    if (!item) return false;
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ room: newValue || null })
        .eq('id', item.id);

      if (error) throw error;
      if (profile?.tenant_id && (newValue || null) !== (item.room || null)) {
        logItemActivity({
          tenantId: profile.tenant_id,
          itemId: item.id,
          actorUserId: profile.id,
          eventType: 'item_field_updated',
          eventLabel: `Room updated`,
          details: { field: 'room', from: item.room, to: newValue || null },
        });
      }
      setItem({ ...item, room: newValue || null });
      toast({ title: 'Room updated' });
      return true;
    } catch (error) {
      console.error('Error updating room:', error);
      toast({ title: 'Error', description: 'Failed to update room', variant: 'destructive' });
      return false;
    }
  };

  const handleVendorSave = async (newValue: string): Promise<boolean> => {
    if (!item) return false;
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ vendor: newValue || null })
        .eq('id', item.id);

      if (error) throw error;
      if (profile?.tenant_id && (newValue || null) !== (item.vendor || null)) {
        logItemActivity({
          tenantId: profile.tenant_id,
          itemId: item.id,
          actorUserId: profile.id,
          eventType: 'item_field_updated',
          eventLabel: `Vendor updated`,
          details: { field: 'vendor', from: item.vendor, to: newValue || null },
        });
      }
      setItem({ ...item, vendor: newValue || null });
      if (newValue) addVendorSuggestion(newValue);
      return true;
    } catch (error) {
      console.error('Error updating vendor:', error);
      toast({ title: 'Error', description: 'Failed to update vendor', variant: 'destructive' });
      return false;
    }
  };

  const handleDescriptionSave = async (newValue: string): Promise<boolean> => {
    if (!item) return false;
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ description: newValue || null })
        .eq('id', item.id);

      if (error) throw error;
      if (profile?.tenant_id && (newValue || null) !== (item.description || null)) {
        logItemActivity({
          tenantId: profile.tenant_id,
          itemId: item.id,
          actorUserId: profile.id,
          eventType: 'item_field_updated',
          eventLabel: `Description updated`,
          details: { field: 'description', from: item.description, to: newValue || null },
        });
      }
      setItem({ ...item, description: newValue || null });
      if (newValue) addDescSuggestion(newValue);
      return true;
    } catch (error) {
      console.error('Error updating description:', error);
      toast({ title: 'Error', description: 'Failed to update description', variant: 'destructive' });
      return false;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="text-5xl mb-4 opacity-50">📦</div>
          <h3 className="mt-4 text-lg font-semibold">Item not found</h3>
          <Button variant="link" onClick={() => navigate('/inventory')}>
            Back to Inventory
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <MaterialIcon name="arrow_back" size="md" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{item.item_code}</h1>
                {getStatusBadge(item.status)}
                {/* Repair Status - bold colored text */}
                {item.repair_status === 'completed' && (
                  <span className="font-bold text-green-600 dark:text-green-400">REPAIRED</span>
                )}
                {item.repair_status === 'in_progress' && (
                  <span className="font-bold text-orange-500 dark:text-orange-400">REPAIR IN PROGRESS</span>
                )}
                {item.needs_repair && !item.repair_status && (
                  <span className="font-bold text-red-600 dark:text-red-400">NEEDS REPAIR</span>
                )}
                {item.repair_status === 'pending' && (
                  <span className="font-bold text-red-600 dark:text-red-400">NEEDS REPAIR</span>
                )}
                {/* Coverage Badge */}
                {item.coverage_type && item.coverage_type !== 'standard' && item.coverage_type !== 'pending' && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    <MaterialIcon name="verified_user" size="sm" className="mr-1" />
                    {item.coverage_type === 'full_replacement_no_deductible' || item.coverage_type === 'full_no_deductible'
                      ? 'Full Coverage'
                      : item.coverage_type === 'full_replacement_deductible' || item.coverage_type === 'full_deductible'
                      ? `Full Coverage ($${item.declared_value?.toLocaleString() || '0'})`
                      : 'Covered'}
                  </Badge>
                )}
                {item.coverage_type === 'pending' && (
                  <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">
                    <MaterialIcon name="schedule" size="sm" className="mr-1" />
                    Coverage Pending
                  </Badge>
                )}
                {/* Active Indicator Flags — one label per indicator, dynamic service name */}
                {activeIndicatorFlags.map((flag) => (
                  <Badge
                    key={flag.code}
                    variant="outline"
                    className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-semibold"
                  >
                    {'\u26A0\uFE0F'} {flag.name}
                  </Badge>
                ))}
              </div>
              <p className="text-muted-foreground">
                {item.description || 'No description'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Task Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <span className="mr-2">📝</span>
                  Tasks
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openTaskMenu('Inspection')}>
                  🔍 Inspection
                  {tasks.filter(t => t.task_type === 'Inspection' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Inspection' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTaskMenu('Assembly')}>
                  🔧 Assembly
                  {tasks.filter(t => t.task_type === 'Assembly' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Assembly' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTaskMenu('Repair')}>
                  🔨 Repair
                  {tasks.filter(t => t.task_type === 'Repair' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Repair' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/shipments/outbound/new', { state: { itemIds: [item.id], accountId: item.account_id } })}>
                  🚚 Create Outbound
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTaskMenu('Disposal')}>
                  🗑️ Disposal
                  {tasks.filter(t => t.task_type === 'Disposal' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Disposal' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  setSelectedTaskType('');
                  setTaskDialogOpen(true);
                }}>
                  ➕ Other Task Type
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Release Button - Only show for active items */}
            {!isClientUser && item.status === 'active' && (
              <Button variant="default" onClick={() => setReleaseDialogOpen(true)}>
                <span className="mr-2">📤</span>
                Release
              </Button>
            )}

            {/* Actions Menu */}
            {!isClientUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    ⋯
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPrintDialogOpen(true)}>
                    🖨️ Print 4x6 Label
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBillingChargeDialogOpen(true)}>
                    💰 Add Charge
                  </DropdownMenuItem>
                  {canAddCredit && (
                    <DropdownMenuItem onClick={() => setAddCreditDialogOpen(true)}>
                      💸 Add Credit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setReassignDialogOpen(true)}>
                    <MaterialIcon name="swap_horiz" size="sm" className="mr-2" />
                    Reassign Account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setClaimDialogOpen(true)}>
                    ⚠️ File Claim
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                    ✏️ Edit Item
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Status Badges Row - Removed per UI update */}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="details">📋 Details</TabsTrigger>
            <TabsTrigger value="photos" className="relative">
              📷 Photos
              {photoCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium bg-red-500 text-white rounded-full">
                  {photoCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" className="relative">
              📄 Docs
              {docsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium bg-red-500 text-white rounded-full">
                  {docsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="relative">
              💬 Notes
              {notesCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium bg-red-500 text-white rounded-full">
                  {notesCount}
                </span>
              )}
            </TabsTrigger>
            {!isClientUser && (
              <TabsTrigger value="coverage">🛡️ Coverage</TabsTrigger>
            )}
            {!isClientUser && <TabsTrigger value="activity">📊 Activity</TabsTrigger>}
            {!isClientUser && <TabsTrigger value="history">📜 History</TabsTrigger>}
            {!isClientUser && (
              <TabsTrigger value="advanced">⚙️ Advanced</TabsTrigger>
            )}
            {item.needs_repair && <TabsTrigger value="repair">🔧 Repair</TabsTrigger>}
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-6">
            {/* Account Default Notes - Full width above details, only show if highlight enabled AND notes not blank */}
            {accountSettings?.highlight_item_notes && accountSettings?.default_item_notes?.trim() && (
              <Card className="bg-orange-50 dark:bg-orange-900/20 border-4 border-orange-500 dark:border-orange-400">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="text-orange-600 dark:text-orange-400">⚠️</span>
                    Account Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap font-bold text-orange-700 dark:text-orange-300">{accountSettings.default_item_notes}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {/* Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="emoji-tile emoji-tile-md bg-muted dark:bg-slate-700 rounded-lg">📦</div>
                    Item Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* Status - prominent with badge */}
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Status</span>
                      <div className="mt-1">
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                    {/* Class */}
                    <div>
                      <span className="text-muted-foreground">Class</span>
                      <p className="font-medium">
                        {item.class ? `${item.class.code} - ${item.class.name}` : '-'}
                      </p>
                    </div>
                    {/* Quantity */}
                    <div>
                      <span className="text-muted-foreground">Quantity</span>
                      <p className="font-medium">{item.quantity}</p>
                    </div>
                    {/* Vendor - inline editable with autocomplete */}
                    <div>
                      <span className="text-muted-foreground">Vendor</span>
                      {isClientUser ? (
                        <p className="font-medium">{item.vendor || '-'}</p>
                      ) : (
                        <AutocompleteInput
                          value={editVendor}
                          onChange={setEditVendor}
                          onBlur={() => {
                            if (editVendor !== (item.vendor || '')) {
                              handleVendorSave(editVendor);
                            }
                          }}
                          suggestions={vendorSuggestions.map(s => ({ value: s.value }))}
                          placeholder="Add vendor"
                          className="h-7 mt-1 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
                        />
                      )}
                    </div>
                    {/* Description - inline editable with autocomplete */}
                    <div>
                      <span className="text-muted-foreground">Description</span>
                      {isClientUser ? (
                        <p className="font-medium">{item.description || '-'}</p>
                      ) : (
                        <AutocompleteInput
                          value={editDescription}
                          onChange={setEditDescription}
                          onBlur={() => {
                            if (editDescription !== (item.description || '')) {
                              handleDescriptionSave(editDescription);
                            }
                          }}
                          suggestions={descriptionSuggestions.map(s => ({ value: s.value }))}
                          placeholder="Add description"
                          className="h-7 mt-1 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
                        />
                      )}
                    </div>
                    {/* Account */}
                    <div>
                      <span className="text-muted-foreground">Account</span>
                      <p className="font-medium">{item.account?.account_name || '-'}</p>
                    </div>
                    {/* Sidemark - inline editable with autocomplete */}
                    <div>
                      <span className="text-muted-foreground">Sidemark</span>
                      {isClientUser ? (
                        <p className="font-medium">{item.sidemark || '-'}</p>
                      ) : (
                        <AutocompleteInput
                          value={editSidemark}
                          onChange={setEditSidemark}
                          onBlur={() => {
                            if (editSidemark !== (item.sidemark || '')) {
                              handleSidemarkSave(editSidemark);
                            }
                          }}
                          suggestions={sidemarks.map(s => ({ value: s.sidemark }))}
                          placeholder="Add sidemark"
                          className="h-7 mt-1 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
                        />
                      )}
                    </div>
                    {/* Room - inline editable with autocomplete */}
                    <div>
                      <span className="text-muted-foreground">Room</span>
                      {isClientUser ? (
                        <p className="font-medium">{item.room || '-'}</p>
                      ) : (
                        <AutocompleteInput
                          value={editRoom}
                          onChange={setEditRoom}
                          onBlur={() => {
                            if (editRoom !== (item.room || '')) {
                              handleRoomSave(editRoom);
                            }
                          }}
                          suggestions={rooms.map(r => ({ value: r.room }))}
                          placeholder="Add room"
                          className="h-7 mt-1 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
                        />
                      )}
                    </div>
                    {/* Size */}
                    <div>
                      <span className="text-muted-foreground">Size</span>
                      <p className="font-medium">
                        {item.size ? `${item.size} ${item.size_unit || ''}` : '-'}
                      </p>
                    </div>
                    {item.link && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Link</span>
                        <p className="font-medium">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {item.link.length > 40 ? item.link.substring(0, 40) + '...' : item.link}
                            <MaterialIcon name="open_in_new" size="sm" />
                          </a>
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Warehouse</span>
                      <p className="font-medium">{item.warehouse?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location</span>
                      <p className="font-medium flex items-center gap-1">
                        📍 {item.location?.code || item.location?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Received</span>
                      <p className="font-medium">
                        {item.received_at
                          ? format(new Date(item.received_at), 'MMM d, yyyy')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created</span>
                      <p className="font-medium">
                        {format(new Date(item.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Flags Card - Dynamic flags from pricing_flags table */}
              <ItemFlagsSection
                itemId={item.id}
                accountId={item.account_id || undefined}
                onFlagsChange={handleFlagsChange}
                isClientUser={isClientUser}
              />

              {/* Billing Events - Manager/Admin Only */}
              {canSeeBilling && (
                <ItemBillingEventsSection itemId={item.id} refreshKey={billingRefreshKey} />
              )}
            </div>

            {/* Inbound History - Original inbound shipment */}
            {item.receiving_shipment && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>🚚</span>
                    Inbound History
                  </CardTitle>
                  <CardDescription>
                    The inbound shipment this item was received on
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/shipments/${item.receiving_shipment!.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate(`/shipments/${item.receiving_shipment!.id}`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <StatusIndicator status="inbound" label="Inbound" size="sm" />
                        <span className="font-medium text-lg">{item.receiving_shipment.shipment_number}</span>
                      </div>
                      <StatusIndicator status={item.receiving_shipment.status} size="sm" />
                      {item.receiving_shipment.received_at && (
                        <span className="text-sm text-muted-foreground">
                          Received: {format(new Date(item.receiving_shipment.received_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                    <MaterialIcon name="open_in_new" size="sm" className="text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tasks Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📝</span>
                  Tasks ({tasks.length})
                </CardTitle>
                <CardDescription>Tasks associated with this item</CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No tasks for this item</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task) => (
                        <TableRow
                          key={task.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/tasks/${task.id}`)}
                        >
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>{task.task_type}</TableCell>
                          <TableCell>
                            <span className={
                              task.status === 'pending' ? 'font-bold text-orange-500 dark:text-orange-400' :
                              task.status === 'in_progress' ? 'font-bold text-yellow-500 dark:text-yellow-400' :
                              task.status === 'completed' ? 'font-bold text-green-500 dark:text-green-400' :
                              task.status === 'unable_to_complete' ? 'font-bold text-red-500 dark:text-red-400' :
                              'font-bold text-gray-500 dark:text-gray-400'
                            }>
                              {task.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {task.priority === 'urgent' ? (
                              <span className="font-bold text-red-500 dark:text-red-400">URGENT</span>
                            ) : (
                              <span className="font-bold text-blue-500 dark:text-blue-400">NORMAL</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {task.due_date
                              ? format(new Date(task.due_date), 'MMM d, yyyy')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="photos" className="mt-6">
            <ItemPhotoGallery itemId={item.id} isClientUser={isClientUser} />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span>📄</span>
                      Documents
                    </CardTitle>
                    <CardDescription>
                      Scanned documents and files for this item
                    </CardDescription>
                  </div>
                  {!isClientUser && (
                    <ScanDocumentButton
                      context={{ type: 'item', itemId: item.id, description: item.description || undefined }}
                      onSuccess={() => {
                        toast({ title: 'Document saved' });
                      }}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <DocumentList
                  contextType="item"
                  contextId={item.id}
                  showSearch
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-6">
            <ItemNotesSection itemId={item.id} isClientUser={isClientUser} />
          </TabsContent>

          {!isClientUser && (
            <TabsContent value="coverage" className="mt-6">
              <CoverageSelector
                itemId={item.id}
                accountId={item.account_id}
                sidemarkId={item.sidemark_id}
                classId={item.class_id}
                currentCoverage={item.coverage_type as any}
                currentDeclaredValue={item.declared_value}
                currentWeight={item.weight_lbs}
                onUpdate={() => fetchItem()}
              />
            </TabsContent>
          )}

          {!isClientUser && (
            <TabsContent value="activity" className="mt-6">
              <ItemActivityFeed itemId={item.id} />
            </TabsContent>
          )}

          {!isClientUser && (
            <TabsContent value="history" className="mt-6">
              <ItemHistoryTab itemId={item.id} />
            </TabsContent>
          )}

          {!isClientUser && (
            <TabsContent value="advanced" className="mt-6">
              <ItemAdvancedTab itemId={item.id} />
            </TabsContent>
          )}

          {item.needs_repair && (
            <TabsContent value="repair" className="mt-6">
              <RepairQuoteSection itemId={item.id} canApprove={!isClientUser} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        selectedItemIds={[item.id]}
        preSelectedTaskType={selectedTaskType}
        onSuccess={() => {
          setTaskDialogOpen(false);
          fetchTasks();
        }}
      />

      <ItemEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={item}
        onSuccess={fetchItem}
      />

      <PrintLabelsDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        items={item ? [{
          id: item.id,
          itemCode: item.item_code,
          description: item.description || '',
          vendor: item.vendor || '',
          account: item.account?.account_name || '',
          sidemark: item.sidemark || '',
          room: item.room || '',
          warehouseName: item.warehouse?.name || '',
          locationCode: item.location?.code || '',
        }] : []}
      />

      <QuickReleaseDialog
        open={releaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
        selectedItems={item ? [{
          id: item.id,
          item_code: item.item_code,
          description: item.description,
          quantity: item.quantity,
          warehouse_id: item.warehouse?.id,
        }] : []}
        onSuccess={() => {
          setReleaseDialogOpen(false);
          fetchItem();
        }}
      />

      <AddBillingChargeDialog
        open={billingChargeDialogOpen}
        onOpenChange={setBillingChargeDialogOpen}
        itemId={item?.id || ''}
        itemCode={item?.item_code || ''}
        accountId={item?.account_id || null}
        sidemarkId={item?.sidemark_id || null}
        classId={item?.class_id || null}
        onSuccess={() => {
          setBillingChargeDialogOpen(false);
          setBillingRefreshKey(prev => prev + 1);
        }}
      />

      {/* Add Credit Dialog - Admin Only */}
      {item?.account_id && (
        <AddCreditDialog
          open={addCreditDialogOpen}
          onOpenChange={setAddCreditDialogOpen}
          accountId={item.account_id}
          accountName={item.account?.account_name}
          itemId={item.id}
          itemCode={item.item_code}
          sidemarkId={item.sidemark_id}
          classId={item.class_id}
          onSuccess={() => {
            setAddCreditDialogOpen(false);
            setBillingRefreshKey(prev => prev + 1);
          }}
        />
      )}

      <LinkToShipmentDialog
        open={linkShipmentDialogOpen}
        onOpenChange={setLinkShipmentDialogOpen}
        itemId={item?.id || ''}
        itemCode={item?.item_code || ''}
        onSuccess={() => {
          setLinkShipmentDialogOpen(false);
          fetchShipments();
        }}
      />

      {item && (
        <ClaimCreateDialog
          open={claimDialogOpen}
          onOpenChange={setClaimDialogOpen}
          itemId={item.id}
          accountId={item.account_id || undefined}
          sidemarkId={item.sidemark_id || undefined}
        />
      )}

      {item && (
        <ReassignAccountDialog
          open={reassignDialogOpen}
          onOpenChange={setReassignDialogOpen}
          entityType="item"
          entityIds={[item.id]}
          currentAccountId={item.account_id}
          currentAccountName={item.account?.account_name}
          onSuccess={fetchItem}
        />
      )}
    </DashboardLayout>
  );
}
