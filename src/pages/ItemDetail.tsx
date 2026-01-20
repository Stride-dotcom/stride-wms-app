import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { ItemFlagsSection } from '@/components/items/ItemFlagsSection';
import { ItemNotesSection } from '@/components/items/ItemNotesSection';
import { RepairQuoteSection } from '@/components/items/RepairQuoteSection';
import { ItemPhotoGallery } from '@/components/items/ItemPhotoGallery';
import { ItemHistoryTab } from '@/components/items/ItemHistoryTab';
import { ItemEditDialog } from '@/components/items/ItemEditDialog';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { ItemLabelData } from '@/lib/labelGenerator';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  MapPin, 
  ClipboardList,
  History,
  Edit,
  MoreHorizontal,
  Printer,
  Truck,
  Trash2,
  DollarSign,
  Link as LinkIcon,
  ExternalLink,
  PackageX,
} from 'lucide-react';
import { QuickReleaseDialog } from '@/components/inventory/QuickReleaseDialog';

interface ItemDetail {
  id: string;
  item_code: string;
  description: string | null;
  status: string;
  quantity: number;
  client_account: string | null;
  sidemark: string | null;
  vendor: string | null;
  size: number | null;
  size_unit: string | null;
  room: string | null;
  link: string | null;
  item_type_id: string | null;
  account_id: string | null;
  received_at: string | null;
  created_at: string;
  assembly_status: string | null;
  inspection_status: string | null;
  repair_status: string | null;
  photo_urls: string[] | null;
  inspection_photos: string[] | null;
  repair_photos: string[] | null;
  primary_photo_url: string | null;
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
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [tasks, setTasks] = useState<ItemTask[]>([]);
  const [shipments, setShipments] = useState<ShipmentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

  // Check if user is a client (simplified check)
  const isClientUser = false; // Will be determined by role system

  useEffect(() => {
    if (id) {
      fetchItem();
      fetchMovements();
      fetchTasks();
      fetchShipments();
    }
  }, [id]);

  const fetchItem = async () => {
    try {
      const { data, error } = await (supabase.from('items') as any)
        .select(`
          *,
          locations(id, code, name),
          warehouses(id, name),
          item_types(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setItem({
        ...data,
        location: data.locations,
        warehouse: data.warehouses,
        item_type: data.item_types,
        room: data.room || null,
        link: data.link || null,
        photo_urls: data.photo_urls || [],
        inspection_photos: data.inspection_photos || [],
        repair_photos: data.repair_photos || [],
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

  const handleFlagsChange = async (flags: any) => {
    if (item) {
      // Refetch item to get updated status values from database
      await fetchItem();
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
      in_queue: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge className={colors[status] || ''}>
        {type}: {status.replace('_', ' ')}
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

  if (!item) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
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
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{item.item_code}</h1>
                {getStatusBadge(item.status)}
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
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Tasks
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openTaskMenu('Inspection')}>
                  Inspection
                  {tasks.filter(t => t.task_type === 'Inspection' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Inspection' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTaskMenu('Assembly')}>
                  Assembly
                  {tasks.filter(t => t.task_type === 'Assembly' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Assembly' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTaskMenu('Repair')}>
                  Repair
                  {tasks.filter(t => t.task_type === 'Repair' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Repair' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTaskMenu('Will Call')}>
                  Will Call
                  {tasks.filter(t => t.task_type === 'Will Call' && t.status !== 'completed').length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {tasks.filter(t => t.task_type === 'Will Call' && t.status !== 'completed').length}
                    </Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTaskMenu('Disposal')}>
                  Disposal
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
                  Other Task Type
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Release Button - Only show for active items */}
            {!isClientUser && item.status === 'active' && (
              <Button variant="default" onClick={() => setReleaseDialogOpen(true)}>
                <PackageX className="mr-2 h-4 w-4" />
                Release
              </Button>
            )}

            {/* Actions Menu */}
            {!isClientUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setPrintDialogOpen(true)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print 4x6 Label
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedTaskType('Will Call');
                    setTaskDialogOpen(true);
                  }}>
                    <Truck className="mr-2 h-4 w-4" />
                    Create Will Call
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedTaskType('Disposal');
                    setTaskDialogOpen(true);
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Create Disposal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Add Billing Charge
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Link to Shipment
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Item
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Status Badges Row */}
        {(item.assembly_status || item.inspection_status || item.repair_status) && (
          <div className="flex gap-2 flex-wrap">
            {getSubStatusBadge(item.assembly_status, 'Assembly')}
            {getSubStatusBadge(item.inspection_status, 'Inspection')}
            {getSubStatusBadge(item.repair_status, 'Repair')}
          </div>
        )}

        <Tabs defaultValue="details" className="w-full">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            {!isClientUser && <TabsTrigger value="history">History</TabsTrigger>}
            {item.needs_repair && <TabsTrigger value="repair">Repair</TabsTrigger>}
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Item Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Quantity</span>
                      <p className="font-medium">{item.quantity}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Item Type</span>
                      <p className="font-medium">{item.item_type?.name || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Client Account</span>
                      <p className="font-medium">{item.client_account || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sidemark</span>
                      <p className="font-medium">{item.sidemark || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendor</span>
                      <p className="font-medium">{item.vendor || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Room</span>
                      <p className="font-medium">{item.room || '-'}</p>
                    </div>
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
                            <ExternalLink className="h-3 w-3" />
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
                        <MapPin className="h-3 w-3" />
                        {item.location?.code || item.location?.name || '-'}
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

              {/* Flags Card */}
              <ItemFlagsSection
                itemId={item.id}
                flags={{
                  is_overweight: item.is_overweight || false,
                  is_oversize: item.is_oversize || false,
                  is_unstackable: item.is_unstackable || false,
                  is_crated: item.is_crated || false,
                  needs_repair: item.needs_repair || false,
                  needs_inspection: item.needs_inspection || false,
                  needs_warehouse_assembly: item.needs_warehouse_assembly || false,
                  notify_dispatch: item.notify_dispatch || false,
                  has_damage: item.has_damage || false,
                  received_without_id: (item as any).received_without_id || false,
                  needs_minor_touchup: (item as any).needs_minor_touchup || false,
                }}
                onFlagsChange={handleFlagsChange}
                isClientUser={isClientUser}
              />
            </div>

            {/* Shipment Links */}
            {shipments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Linked Shipments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {shipments.map((shipment) => (
                      <div
                        key={shipment.id}
                        className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{shipment.shipment_type}</Badge>
                          <span className="font-medium">{shipment.shipment_number}</span>
                          <Badge variant="secondary">{shipment.status}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/shipments/${shipment.id}`)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tasks Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
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
                          onClick={() => navigate(`/tasks?id=${task.id}`)}
                        >
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>{task.task_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{task.status.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                task.priority === 'urgent'
                                  ? 'bg-red-100 text-red-800'
                                  : task.priority === 'high'
                                  ? 'bg-orange-100 text-orange-800'
                                  : ''
                              }
                            >
                              {task.priority}
                            </Badge>
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

          <TabsContent value="notes" className="mt-6">
            <ItemNotesSection itemId={item.id} isClientUser={isClientUser} />
          </TabsContent>

          {!isClientUser && (
            <TabsContent value="history" className="mt-6">
              <ItemHistoryTab itemId={item.id} />
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
          account: item.client_account || '',
          sidemark: item.sidemark || '',
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
    </DashboardLayout>
  );
}
