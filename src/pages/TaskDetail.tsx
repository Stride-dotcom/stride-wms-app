import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { UnableToCompleteDialog } from '@/components/tasks/UnableToCompleteDialog';
import { PhotoScannerButton } from '@/components/common/PhotoScannerButton';
import { PhotoUploadButton } from '@/components/common/PhotoUploadButton';
import { PhotoGrid } from '@/components/common/PhotoGrid';
import { AddAddonDialog } from '@/components/billing/AddAddonDialog';
import { BillingChargesSection } from '@/components/billing/BillingChargesSection';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useRepairQuoteWorkflow } from '@/hooks/useRepairQuotes';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { ScanDocumentButton } from '@/components/scanner/ScanDocumentButton';
import { DocumentUploadButton } from '@/components/scanner/DocumentUploadButton';
import { DocumentList } from '@/components/scanner/DocumentList';

interface TaskDetail {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  warehouse_id: string | null;
  account_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  unable_to_complete_note: string | null;
  task_notes: string | null;
  inspection_status: string | null;
  photos: string[] | null;
  created_at: string;
  updated_at: string;
  // Billing rate fields
  billing_rate: number | null;
  billing_rate_overridden: boolean | null;
  billing_rate_override_by: string | null;
  assigned_user?: { id: string; first_name: string | null; last_name: string | null };
  warehouse?: { id: string; name: string };
  account?: { id: string; account_name: string };
  override_user?: { first_name: string | null; last_name: string | null };
}

interface TaskItemRow {
  id: string;
  item_id: string;
  quantity: number | null;
  item?: {
    id: string;
    item_code: string;
    description: string | null;
    vendor: string | null;
    inspection_status: string | null;
    current_location_id: string | null;
    location?: { code: string } | null;
    account?: { account_name: string } | null;
    sidemark: string | null;
  } | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  unable_to_complete: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  unable_to_complete: 'Unable to Complete',
};

// Status text classes for bold colored text
const getStatusTextClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'font-bold text-orange-500 dark:text-orange-400';
    case 'in_progress':
      return 'font-bold text-yellow-500 dark:text-yellow-400';
    case 'completed':
      return 'font-bold text-green-500 dark:text-green-400';
    case 'unable_to_complete':
      return 'font-bold text-red-500 dark:text-red-400';
    case 'cancelled':
      return 'font-bold text-gray-500 dark:text-gray-400';
    default:
      return '';
  }
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [taskItems, setTaskItems] = useState<TaskItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [unableDialogOpen, setUnableDialogOpen] = useState(false);
  const [addAddonDialogOpen, setAddAddonDialogOpen] = useState(false);
  const [taskNotes, setTaskNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [creatingQuote, setCreatingQuote] = useState(false);

  const { activeTechnicians } = useTechnicians();
  const { createWorkflowQuote, sendToTechnician } = useRepairQuoteWorkflow();
  const { hasRole } = usePermissions();

  // Only managers and admins can see billing
  const canSeeBilling = hasRole('admin') || hasRole('tenant_admin') || hasRole('manager');

  const fetchTask = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('tasks') as any)
        .select(`
          *,
          assigned_user:users!tasks_assigned_to_fkey(id, first_name, last_name),
          warehouse:warehouses(id, name),
          account:accounts(id, account_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setTask(data);
      setTaskNotes(data.task_notes || '');
      setPhotos(data.photos || []);
    } catch (error) {
      console.error('Error fetching task:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load task' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  const fetchTaskItems = useCallback(async () => {
    if (!id) return;
    try {
      // First get task_items for this task
      const { data: taskItemsData, error: taskItemsError } = await (supabase
        .from('task_items') as any)
        .select('id, item_id, quantity')
        .eq('task_id', id);

      if (taskItemsError) {
        console.error('Error fetching task_items:', taskItemsError);
        return;
      }

      if (!taskItemsData || taskItemsData.length === 0) {
        setTaskItems([]);
        return;
      }

      // Get the item IDs
      const itemIds = taskItemsData.map((ti: any) => ti.item_id).filter(Boolean);

      if (itemIds.length === 0) {
        setTaskItems(taskItemsData.map((ti: any) => ({ ...ti, item: null })));
        return;
      }

      // Fetch items with their details
      const { data: items, error: itemsError } = await (supabase
        .from('items') as any)
        .select(`
          id, item_code, description, vendor, sidemark, inspection_status,
          current_location_id,
          location:locations!items_current_location_id_fkey(code),
          account:accounts!items_account_id_fkey(account_name)
        `)
        .in('id', itemIds);

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        // Still return task items without item details
        setTaskItems(taskItemsData.map((ti: any) => ({ ...ti, item: null })));
        return;
      }

      // Map items to task_items
      const itemMap = Object.fromEntries((items || []).map((i: any) => [i.id, i]));
      setTaskItems(taskItemsData.map((ti: any) => ({
        ...ti,
        item: itemMap[ti.item_id] || null,
      })));
    } catch (error) {
      console.error('Error fetching task items:', error);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
    fetchTaskItems();
  }, [fetchTask, fetchTaskItems]);

  const handleStartTask = async () => {
    if (!id || !profile?.id) return;
    setActionLoading(true);
    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({ status: 'in_progress', assigned_to: profile.id })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Task Started' });
      fetchTask();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to start task' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!id || !profile?.id) return;
    setActionLoading(true);
    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: profile.id,
        })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Task Completed' });
      fetchTask();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to complete task' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnableToComplete = async (note: string) => {
    if (!id || !profile?.id) return false;
    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({
          status: 'unable_to_complete',
          unable_to_complete_note: note,
          completed_at: new Date().toISOString(),
          completed_by: profile.id,
        })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Task Marked', description: 'Task marked as unable to complete.' });
      setUnableDialogOpen(false);
      fetchTask();
      return true;
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update task' });
      return false;
    }
  };

  // Handle individual item inspection result
  const handleItemInspectionResult = async (itemId: string, result: 'pass' | 'fail') => {
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ inspection_status: result })
        .eq('id', itemId);
      if (error) throw error;

      // Update local state
      setTaskItems(prev => prev.map(ti =>
        ti.item_id === itemId
          ? { ...ti, item: ti.item ? { ...ti.item, inspection_status: result } : ti.item }
          : ti
      ));

      toast({ title: `Item ${result === 'pass' ? 'Passed' : 'Failed'}` });

      // Refresh task items to get updated data
      fetchTaskItems();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save inspection result' });
    }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    try {
      const { error } = await (supabase.from('tasks') as any)
        .update({ task_notes: taskNotes })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Notes Saved' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save notes' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handlePhotosChange = async (newPhotos: string[]) => {
    setPhotos(newPhotos);
    if (!id) return;
    try {
      await (supabase.from('tasks') as any)
        .update({ photos: newPhotos })
        .eq('id', id);
    } catch (error) {
      console.error('Error saving photos:', error);
    }
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    fetchTask();
    fetchTaskItems();
  };

  const handleCreateQuote = async () => {
    if (!task || taskItems.length === 0) return;

    setCreatingQuote(true);
    try {
      // Get the first item's account and sidemark info
      const firstItem = taskItems[0];
      if (!firstItem?.item) {
        toast({ variant: 'destructive', title: 'Error', description: 'No item data available' });
        return;
      }

      // Fetch account and sidemark from first item
      const { data: itemData } = await supabase
        .from('items')
        .select('account_id, sidemark_id')
        .eq('id', firstItem.item_id)
        .single();

      if (!itemData?.account_id) {
        toast({ variant: 'destructive', title: 'Error', description: 'Item must have an account' });
        return;
      }

      // Create the quote
      const quote = await createWorkflowQuote({
        item_id: firstItem.item_id,
        account_id: itemData.account_id,
        sidemark_id: itemData.sidemark_id || undefined,
        source_task_id: task.id,
        technician_id: selectedTechnicianId || undefined,
        item_ids: taskItems.slice(1).map(ti => ti.item_id), // Additional items
      });

      if (quote) {
        // If technician was selected, automatically send to them
        if (selectedTechnicianId) {
          const token = await sendToTechnician(quote.id);
          if (token) {
            const link = `${window.location.origin}/quote/tech?token=${token}`;
            await navigator.clipboard.writeText(link);
            toast({
              title: 'Quote Created & Link Copied',
              description: 'The technician quote link has been copied to your clipboard.',
            });
          }
        } else {
          toast({
            title: 'Quote Created',
            description: 'Repair quote created. Assign a technician from the Repair Quotes page.',
          });
        }

        setQuoteDialogOpen(false);
        setSelectedTechnicianId('');
        navigate('/repair-quotes');
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create repair quote' });
    } finally {
      setCreatingQuote(false);
    }
  };

  // Check if task can have a quote requested
  const canRequestQuote = task && taskItems.length > 0 && !['completed', 'unable_to_complete'].includes(task.status);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Task not found</p>
          <Button variant="outline" onClick={() => navigate('/tasks')}>
            <MaterialIcon name="arrow_back" size="sm" className="mr-2" />
            Back to Tasks
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const notesLabel = `${task.task_type} Notes`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <MaterialIcon name="arrow_back" size="md" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{task.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant="outline">{task.task_type}</Badge>
                <span className={getStatusTextClass(task.status)}>
                  {(statusLabels[task.status] || task.status).toUpperCase()}
                </span>
                {task.priority === 'urgent' ? (
                  <span className="font-bold text-red-500 dark:text-red-400">URGENT</span>
                ) : (
                  <span className="font-bold text-blue-500 dark:text-blue-400">NORMAL</span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <MaterialIcon name="edit" size="sm" className="mr-2" />
            Edit Task
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {task.status === 'pending' && (
            <Button onClick={handleStartTask} disabled={actionLoading}>
              <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
              Start Task
            </Button>
          )}
          {task.status === 'in_progress' && (
            <>
              <Button onClick={handleCompleteTask} disabled={actionLoading}>
                <MaterialIcon name="check" size="sm" className="mr-2" />
                Complete Task
              </Button>
              <Button variant="destructive" onClick={() => setUnableDialogOpen(true)} disabled={actionLoading}>
                <MaterialIcon name="cancel" size="sm" className="mr-2" />
                Unable to Complete
              </Button>
            </>
          )}
          {/* Request Quote Button */}
          {canRequestQuote && (
            <Button
              variant="secondary"
              onClick={() => setQuoteDialogOpen(true)}
              disabled={actionLoading}
            >
              <MaterialIcon name="build" size="sm" className="mr-2" />
              Request Repair Quote
            </Button>
          )}
          {/* Add Charge Button - Manager/Admin Only */}
          {task.account_id && canSeeBilling && (
            <Button
              variant="secondary"
              onClick={() => setAddAddonDialogOpen(true)}
            >
              <MaterialIcon name="attach_money" size="sm" className="mr-2" />
              Add Charge
            </Button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Description */}
            {task.description && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Inspection Summary */}
            {task.task_type === 'Inspection' && taskItems.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Inspection Summary:</span>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800">
                        {taskItems.filter(ti => ti.item?.inspection_status === 'pass').length} Passed
                      </Badge>
                      <Badge className="bg-red-100 text-red-800">
                        {taskItems.filter(ti => ti.item?.inspection_status === 'fail').length} Failed
                      </Badge>
                      <Badge variant="outline">
                        {taskItems.filter(ti => !ti.item?.inspection_status).length} Pending
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items Table */}
            {taskItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MaterialIcon name="assignment" size="sm" />
                    Items ({taskItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Code</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Location</TableHead>
                        {task.task_type === 'Inspection' ? (
                          <>
                            <TableHead className="text-center">Pass</TableHead>
                            <TableHead className="text-center">Fail</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Account</TableHead>
                            <TableHead>Sidemark</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {taskItems.map((ti) => (
                        <TableRow
                          key={ti.id}
                          className={task.task_type !== 'Inspection' ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/50"}
                          onClick={() => task.task_type !== 'Inspection' && ti.item?.id && navigate(`/inventory/${ti.item.id}`)}
                        >
                          <TableCell
                            className="font-medium text-primary cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              ti.item?.id && navigate(`/inventory/${ti.item.id}`);
                            }}
                          >
                            {ti.item?.item_code || ti.item_id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{ti.quantity || 1}</TableCell>
                          <TableCell>{ti.item?.vendor || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{ti.item?.description || '-'}</TableCell>
                          <TableCell>{(ti.item as any)?.location?.code || '-'}</TableCell>
                          {task.task_type === 'Inspection' ? (
                            <>
                              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                {ti.item?.inspection_status === 'pass' ? (
                                  <Badge className="bg-green-100 text-green-800">PASSED</Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-green-500 text-green-700 hover:bg-green-50 h-7 px-2"
                                    onClick={() => ti.item_id && handleItemInspectionResult(ti.item_id, 'pass')}
                                    disabled={task.status !== 'in_progress'}
                                  >
                                    <MaterialIcon name="check_circle" size="sm" />
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                {ti.item?.inspection_status === 'fail' ? (
                                  <Badge className="bg-red-100 text-red-800">FAILED</Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500 text-red-700 hover:bg-red-50 h-7 px-2"
                                    onClick={() => ti.item_id && handleItemInspectionResult(ti.item_id, 'fail')}
                                    disabled={task.status !== 'in_progress'}
                                  >
                                    <MaterialIcon name="close" size="sm" />
                                  </Button>
                                )}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{(ti.item as any)?.account?.account_name || '-'}</TableCell>
                              <TableCell>{ti.item?.sidemark || '-'}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Task Notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MaterialIcon name="comment" size="sm" />
                  {notesLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder={`Add ${task.task_type.toLowerCase()} notes...`}
                  rows={4}
                />
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={savingNotes || taskNotes === (task.task_notes || '')}
                >
                  {savingNotes && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                  Save Notes
                </Button>
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <MaterialIcon name="photo_camera" size="sm" />
                  Photos ({photos.length})
                </CardTitle>
                <div className="flex gap-2">
                  <PhotoScannerButton
                    entityType="task"
                    entityId={task.id}
                    tenantId={task.tenant_id}
                    existingPhotos={photos}
                    maxPhotos={20}
                    onPhotosSaved={handlePhotosChange}
                    size="sm"
                    label="Take Photos"
                    showCount={false}
                  />
                  <PhotoUploadButton
                    entityType="task"
                    entityId={task.id}
                    tenantId={task.tenant_id}
                    existingPhotos={photos}
                    maxPhotos={20}
                    onPhotosSaved={handlePhotosChange}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {photos.length > 0 ? (
                  <PhotoGrid
                    photos={photos}
                    onPhotosChange={handlePhotosChange}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No photos yet. Tap "Take Photos" to capture.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <MaterialIcon name="qr_code_scanner" size="sm" />
                  Documents
                </CardTitle>
                <div className="flex gap-2">
                  <ScanDocumentButton
                    context={{ type: 'general', label: `Task: ${task.title}` }}
                    onSuccess={() => {
                      // Trigger a refetch
                    }}
                    label="Scan"
                    size="sm"
                    directToCamera
                  />
                  <DocumentUploadButton
                    context={{ type: 'general', label: `Task: ${task.title}` }}
                    onSuccess={() => {
                      // Trigger a refetch
                    }}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <DocumentList
                  contextType="general"
                  contextId={task.id}
                />
              </CardContent>
            </Card>

            {task.status === 'unable_to_complete' && task.unable_to_complete_note && (
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-destructive">Unable to Complete</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{task.unable_to_complete_note}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="person" size="sm" className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    <p className="text-sm font-medium">
                      {task.assigned_user
                        ? `${task.assigned_user.first_name} ${task.assigned_user.last_name}`
                        : 'Unassigned'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MaterialIcon name="calendar_today" size="sm" className="text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className={`text-sm font-medium ${
                      task.due_date && new Date(task.due_date) < new Date() &&
                      task.status !== 'completed' && task.status !== 'unable_to_complete'
                        ? 'text-red-600' : ''
                    }`}>
                      {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}
                    </p>
                  </div>
                </div>

                {task.warehouse && (
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="business" size="sm" className="text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Warehouse</p>
                      <p className="text-sm font-medium">{task.warehouse.name}</p>
                    </div>
                  </div>
                )}

                {task.account && (
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="business" size="sm" className="text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Account</p>
                      <p className="text-sm font-medium">{task.account.account_name}</p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 space-y-2 text-xs text-muted-foreground">
                  <p>Created: {format(new Date(task.created_at), 'MMM d, yyyy h:mm a')}</p>
                  {task.completed_at && (
                    <p>Completed: {format(new Date(task.completed_at), 'MMM d, yyyy h:mm a')}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Billing Charges - Manager/Admin Only */}
            {canSeeBilling && task.account_id && (
              <BillingChargesSection
                taskId={task.id}
                accountId={task.account_id}
                taskType={task.task_type}
                itemCount={taskItems.length}
                baseRate={task.billing_rate}
                onBaseRateChange={async (rate) => {
                  if (!profile?.id) return;
                  try {
                    const { error } = await (supabase.from('tasks') as any)
                      .update({
                        billing_rate: rate,
                        billing_rate_overridden: rate !== null,
                        billing_rate_override_by: rate !== null ? profile.id : null,
                      })
                      .eq('id', task.id);
                    if (error) throw error;
                    fetchTask();
                  } catch (error) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Failed to save billing rate' });
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <TaskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        task={task as any}
        onSuccess={handleEditSuccess}
      />

      {/* Unable to Complete Dialog */}
      <UnableToCompleteDialog
        open={unableDialogOpen}
        onOpenChange={setUnableDialogOpen}
        taskTitle={task.title}
        onConfirm={handleUnableToComplete}
      />

      {/* Request Quote Dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MaterialIcon name="build" size="md" />
              Request Repair Quote
            </DialogTitle>
            <DialogDescription>
              Create a repair quote for the {taskItems.length} item{taskItems.length !== 1 ? 's' : ''} in this task.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Items to Quote</Label>
              <div className="bg-muted rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                {taskItems.map((ti) => (
                  <div key={ti.id} className="text-sm flex justify-between">
                    <span className="font-medium">{ti.item?.item_code || 'Unknown'}</span>
                    <span className="text-muted-foreground truncate ml-2">
                      {ti.item?.description || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technician">Assign Technician (optional)</Label>
              <Select
                value={selectedTechnicianId || '_none'}
                onValueChange={(val) => setSelectedTechnicianId(val === '_none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a technician..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No technician (assign later)</SelectItem>
                  {activeTechnicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name} ({tech.markup_percent}% markup)
                      {tech.hourly_rate && ` - $${tech.hourly_rate}/hr`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedTechnicianId
                  ? 'A quote link will be created and copied to your clipboard.'
                  : 'You can assign a technician later from the Repair Quotes page.'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuoteDialogOpen(false)}
              disabled={creatingQuote}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateQuote} disabled={creatingQuote}>
              {creatingQuote && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Create Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Charge Dialog */}
      {task.account_id && (
        <AddAddonDialog
          open={addAddonDialogOpen}
          onOpenChange={setAddAddonDialogOpen}
          accountId={task.account_id}
          accountName={task.account?.account_name}
          taskId={task.id}
          onSuccess={fetchTask}
        />
      )}
    </DashboardLayout>
  );
}
