import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PhotoCapture } from '@/components/shipments/PhotoCapture';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  MapPin, 
  ClipboardList,
  History,
  Camera,
  Edit,
  Truck,
  Trash2
} from 'lucide-react';

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
  received_at: string | null;
  created_at: string;
  assembly_status: string | null;
  inspection_status: string | null;
  repair_status: string | null;
  photo_urls: string[] | null;
  inspection_photos: string[] | null;
  repair_photos: string[] | null;
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
}

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [tasks, setTasks] = useState<ItemTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchItem();
      fetchMovements();
      fetchTasks();
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
        .select('id, title, task_type, status, priority, due_date')
        .in('id', taskIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const handlePhotosChange = async (
    field: 'photo_urls' | 'inspection_photos' | 'repair_photos',
    urls: string[]
  ) => {
    if (!item) return;

    try {
      const updateData: any = {};
      updateData[field] = urls;

      const { error } = await (supabase.from('items') as any)
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      setItem(prev => prev ? { ...prev, [field]: urls } : null);
    } catch (error) {
      console.error('Error updating photos:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      available: 'default',
      in_stock: 'default',
      reserved: 'secondary',
      damaged: 'destructive',
      shipped: 'outline',
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
            <Button variant="outline" onClick={() => setTaskDialogOpen(true)}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Create Task
            </Button>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
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
                  <span className="text-muted-foreground">Size</span>
                  <p className="font-medium">
                    {item.size ? `${item.size} ${item.size_unit || ''}` : '-'}
                  </p>
                </div>
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

          {/* Photos Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="item">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="item">Item</TabsTrigger>
                  <TabsTrigger value="inspection">Inspection</TabsTrigger>
                  <TabsTrigger value="repair">Repair</TabsTrigger>
                </TabsList>

                <TabsContent value="item" className="mt-4">
                  <PhotoCapture
                    entityType="item"
                    entityId={item.id}
                    onPhotosChange={(urls) => handlePhotosChange('photo_urls', urls)}
                    existingPhotos={item.photo_urls || []}
                    label="Item Photos"
                  />
                </TabsContent>

                <TabsContent value="inspection" className="mt-4">
                  <PhotoCapture
                    entityType="inspection"
                    entityId={item.id}
                    onPhotosChange={(urls) => handlePhotosChange('inspection_photos', urls)}
                    existingPhotos={item.inspection_photos || []}
                    label="Inspection Photos"
                  />
                </TabsContent>

                <TabsContent value="repair" className="mt-4">
                  <PhotoCapture
                    entityType="repair"
                    entityId={item.id}
                    onPhotosChange={(urls) => handlePhotosChange('repair_photos', urls)}
                    existingPhotos={item.repair_photos || []}
                    label="Repair Photos"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

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

        {/* Movement History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Movement History
            </CardTitle>
            <CardDescription>Location changes and movements</CardDescription>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No movement history</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="font-medium">
                        {movement.action_type.replace('_', ' ')}
                      </TableCell>
                      <TableCell>{movement.from_location?.code || '-'}</TableCell>
                      <TableCell>{movement.to_location?.code || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(movement.moved_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {movement.note || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        selectedItemIds={[item.id]}
        onSuccess={() => {
          setTaskDialogOpen(false);
          fetchTasks();
        }}
      />
    </DashboardLayout>
  );
}
