import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskTypes, useDueDateRules, Task } from '@/hooks/useTasks';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useUsers } from '@/hooks/useUsers';
import { useTaskCustomCharges } from '@/hooks/useTaskCustomCharges';
import { format } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { TaskCustomChargesSection } from './TaskCustomChargesSection';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  selectedItemIds?: string[];
  preSelectedTaskType?: string;
  onSuccess: () => void;
}

interface Account {
  id: string;
  account_name: string;
}

interface InventoryItem {
  id: string;
  item_code: string;
  description: string | null;
  vendor: string | null;
  sidemark: string | null;
  client_account: string | null;
  account_id: string | null;
  warehouse_id: string | null;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  selectedItemIds = [],
  preSelectedTaskType,
  onSuccess,
}: TaskDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { taskTypes, createTaskType } = useTaskTypes();
  const { getDueDateForTaskType } = useDueDateRules();
  const { warehouses } = useWarehouses();
  const { users } = useUsers();
  
  // Custom charges for editing existing tasks
  const {
    charges,
    templates,
    loading: chargesLoading,
    addCharge,
    updateCharge,
    deleteCharge,
    totalCharges,
  } = useTaskCustomCharges(task?.id || null);

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [showNewTaskType, setShowNewTaskType] = useState(false);
  const [newTaskTypeName, setNewTaskTypeName] = useState('');
  
  // For item search when creating from tasks menu
  const [accountItems, setAccountItems] = useState<InventoryItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  const [formData, setFormData] = useState({
    description: '',
    task_type: '',
    priority: 'normal',
    due_date: null as Date | null,
    assigned_to: 'unassigned',
    assigned_department: '',
    warehouse_id: 'none',
    account_id: 'none',
    bill_to: 'account' as 'account' | 'customer' | 'no_charge',
    bill_to_customer_name: '',
    bill_to_customer_email: '',
  });

  // Check if we're creating from inventory (items pre-selected)
  const isFromInventory = selectedItemIds.length > 0;

  useEffect(() => {
    if (open) {
      fetchAccounts();
      if (selectedItemIds.length > 0) {
        fetchSelectedItems();
      }
    }
  }, [open, selectedItemIds]);

  // Track if the dialog has been initialized for this open session
  const initializedRef = useRef(false);

  // Initialize form only when dialog opens or task changes - NOT on every getDueDateForTaskType change
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }

    // Only initialize once per dialog open
    if (initializedRef.current && !task) {
      return;
    }

    if (task) {
      setFormData({
        description: task.description || '',
        task_type: task.task_type,
        priority: task.priority || 'normal',
        due_date: task.due_date ? new Date(task.due_date) : null,
        assigned_to: task.assigned_to || 'unassigned',
        assigned_department: task.assigned_department || '',
        warehouse_id: task.warehouse_id || 'none',
        account_id: task.account_id || 'none',
        bill_to: ((task as any).bill_to as 'account' | 'customer' | 'no_charge') || 'account',
        bill_to_customer_name: (task as any).bill_to_customer_name || '',
        bill_to_customer_email: (task as any).bill_to_customer_email || '',
      });
    } else {
      // Reset form and apply preSelectedTaskType if provided
      const initialTaskType = preSelectedTaskType || '';
      const dueDate = initialTaskType ? getDueDateForTaskType(initialTaskType) : null;
      
      setFormData({
        description: '',
        task_type: initialTaskType,
        priority: 'normal',
        due_date: dueDate,
        assigned_to: 'unassigned',
        assigned_department: '',
        warehouse_id: 'none',
        account_id: 'none',
        bill_to: 'account',
        bill_to_customer_name: '',
        bill_to_customer_email: '',
      });
      setSelectedItems([]);
      setAccountItems([]);
      setItemSearchQuery('');
    }

    initializedRef.current = true;
  }, [task, open, preSelectedTaskType]);

  // Auto-populate account and warehouse when items are selected from inventory
  useEffect(() => {
    if (selectedItems.length > 0) {
      // Auto-populate account directly from item's account_id
      if (formData.account_id === 'none') {
        const firstItemAccountId = selectedItems[0]?.account_id;
        if (firstItemAccountId) {
          setFormData(prev => ({ ...prev, account_id: firstItemAccountId }));
        }
      }
      // Auto-populate warehouse from items
      const firstItemWarehouse = selectedItems[0]?.warehouse_id;
      if (firstItemWarehouse) {
        setFormData(prev => ({ ...prev, warehouse_id: firstItemWarehouse }));
      }
    }
  }, [selectedItems]);

  // Validation: Check for multiple accounts/warehouses
  const hasMultipleAccounts = (() => {
    const accounts = new Set(selectedItems.map(i => i.client_account).filter(Boolean));
    return accounts.size > 1;
  })();

  const hasMultipleWarehouses = (() => {
    const warehouses = new Set(selectedItems.map(i => i.warehouse_id).filter(Boolean));
    return warehouses.size > 1;
  })();

  // Fetch items when account is selected (only when creating from tasks menu)
  useEffect(() => {
    if (!isFromInventory && formData.account_id && formData.account_id !== 'none') {
      fetchAccountItems(formData.account_id);
    } else if (!isFromInventory) {
      setAccountItems([]);
    }
  }, [formData.account_id, isFromInventory]);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, account_name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('account_name');

    setAccounts(data || []);
  };

  const fetchSelectedItems = async () => {
    if (selectedItemIds.length === 0) return;

    const { data } = await (supabase
      .from('items') as any)
      .select('id, item_code, description, vendor, sidemark, client_account, account_id, warehouse_id')
      .in('id', selectedItemIds);

    setSelectedItems(data || []);
  };

  const fetchAccountItems = async (accountId: string) => {
    setLoadingItems(true);
    try {
      const { data, error } = await (supabase
        .from('items') as any)
        .select('id, item_code, description, vendor, sidemark, client_account, account_id, warehouse_id')
        .eq('account_id', accountId)
        // Items status is now 'active' (legacy 'in_stock' was migrated)
        .neq('status', 'released')
        .neq('status', 'disposed')
        .is('deleted_at', null)
        .order('item_code');

      if (error) throw error;

      setAccountItems(data || []);
    } catch (error: any) {
      console.error('Error fetching account items:', error);
      toast({
        variant: 'destructive',
        title: 'Could not load items',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setLoadingItems(false);
    }
  };

  const handleTaskTypeChange = (value: string) => {
    if (value === 'new') {
      setShowNewTaskType(true);
      return;
    }

    setFormData(prev => ({
      ...prev,
      task_type: value,
      due_date: getDueDateForTaskType(value),
    }));
  };

  const handleCreateTaskType = async () => {
    if (!newTaskTypeName.trim()) return;

    const newType = await createTaskType(newTaskTypeName);
    if (newType) {
      setFormData(prev => ({
        ...prev,
        task_type: newType.name,
        due_date: getDueDateForTaskType(newType.name),
      }));
      setShowNewTaskType(false);
      setNewTaskTypeName('');
    }
  };

  const handleAccountChange = (value: string) => {
    setFormData(prev => ({ ...prev, account_id: value }));
    // Clear selected items when account changes (only when not from inventory)
    if (!isFromInventory) {
      setSelectedItems([]);
      setItemSearchQuery('');
    }
  };

  const toggleItemSelection = (item: InventoryItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, item];
    });
  };

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return accountItems;
    
    const query = itemSearchQuery.toLowerCase();
    return accountItems.filter(item => 
      item.item_code?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.vendor?.toLowerCase().includes(query) ||
      item.sidemark?.toLowerCase().includes(query) ||
      item.client_account?.toLowerCase().includes(query)
    );
  }, [accountItems, itemSearchQuery]);

  // Generate title from task type and items
  const generateTitle = () => {
    const itemCount = selectedItems.length || selectedItemIds.length;
    if (formData.task_type && itemCount > 0) {
      return `${formData.task_type} - ${itemCount} item${itemCount > 1 ? 's' : ''}`;
    }
    return formData.task_type || 'New Task';
  };

  // Map task types to inventory status fields
  const getInventoryStatusField = (taskType: string): string | null => {
    const mapping: Record<string, string> = {
      'Assembly': 'assembly_status',
      'Inspection': 'inspection_status',
      'Repair': 'repair_status',
    };
    return mapping[taskType] || null;
  };

  // Update inventory status for items
  const updateInventoryStatus = async (itemIds: string[], taskType: string, status: string) => {
    const statusField = getInventoryStatusField(taskType);
    if (!statusField || itemIds.length === 0) return;

    try {
      const updateData: Record<string, string> = {};
      updateData[statusField] = status;

      await (supabase
        .from('items') as any)
        .update(updateData)
        .in('id', itemIds);
    } catch (error) {
      console.error('Error updating inventory status:', error);
    }
  };

  // Task types that require one task per item
  const SINGLE_ITEM_TASK_TYPES = ['Assembly', 'Inspection'];

  const handleSubmit = async () => {
    if (!profile?.tenant_id || !formData.task_type) return;

    try {
      setLoading(true);

      // Collect all item IDs
      const allItemIds = isFromInventory
        ? selectedItemIds
        : selectedItems.map(i => i.id);

      // Check if this is a single-item task type with multiple items
      const isSingleItemTaskType = SINGLE_ITEM_TASK_TYPES.includes(formData.task_type);
      const hasMultipleItems = allItemIds.length > 1;

      if (isSingleItemTaskType && hasMultipleItems && !task) {
        // Create one task per item
        const tasksToCreate = allItemIds.map((itemId, index) => ({
          tenant_id: profile.tenant_id,
          title: `${formData.task_type} - Item ${index + 1}`,
          description: formData.description || null,
          task_type: formData.task_type,
          priority: formData.priority,
          due_date: formData.due_date?.toISOString() || null,
          assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to || null,
          assigned_department: formData.assigned_department || null,
          warehouse_id: formData.warehouse_id === 'none' ? null : formData.warehouse_id || null,
          account_id: formData.account_id === 'none' ? null : formData.account_id || null,
          status: 'pending',
          bill_to: formData.bill_to,
          bill_to_customer_name:
            formData.bill_to === 'customer' ? formData.bill_to_customer_name : null,
          bill_to_customer_email:
            formData.bill_to === 'customer' ? formData.bill_to_customer_email : null,
        }));

        // Insert all tasks
        const { data: newTasks, error: tasksError } = await (supabase
          .from('tasks') as any)
          .insert(tasksToCreate)
          .select();

        if (tasksError) throw tasksError;

        // Create task_items linking each task to its single item
        if (newTasks && newTasks.length > 0) {
          const taskItems = newTasks.map((task: any, index: number) => ({
            task_id: task.id,
            item_id: allItemIds[index],
          }));

          const { error: taskItemsError } = await (supabase
            .from('task_items') as any)
            .insert(taskItems);

          if (taskItemsError) throw taskItemsError;

          // Update inventory status to pending for all items
          await updateInventoryStatus(allItemIds, formData.task_type, 'pending');
        }

        toast({
          title: `${allItemIds.length} Tasks Created`,
          description: `Created one ${formData.task_type} task per item.`,
        });
      } else {
        // Original logic: create single task with all items
        const taskData = {
          tenant_id: profile.tenant_id,
          title: generateTitle(),
          description: formData.description || null,
          task_type: formData.task_type,
          priority: formData.priority,
          due_date: formData.due_date?.toISOString() || null,
          assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to || null,
          assigned_department: formData.assigned_department || null,
          warehouse_id: formData.warehouse_id === 'none' ? null : formData.warehouse_id || null,
          account_id: formData.account_id === 'none' ? null : formData.account_id || null,
          status: task ? task.status : 'pending',
          bill_to: formData.bill_to,
          bill_to_customer_name:
            formData.bill_to === 'customer' ? formData.bill_to_customer_name : null,
          bill_to_customer_email:
            formData.bill_to === 'customer' ? formData.bill_to_customer_email : null,
        };

        if (task) {
          const { error } = await (supabase
            .from('tasks') as any)
            .update(taskData)
            .eq('id', task.id);

          if (error) throw error;

          toast({
            title: 'Task Updated',
            description: 'Your changes were saved.',
          });
        } else {
          const { data: newTask, error } = await (supabase
            .from('tasks') as any)
            .insert(taskData)
            .select()
            .single();

          if (error) throw error;

          // Add task items
          if (allItemIds.length > 0 && newTask) {
            const taskItems = allItemIds.map(itemId => ({
              task_id: newTask.id,
              item_id: itemId,
            }));

            const { error: taskItemsError } = await (supabase
              .from('task_items') as any)
              .insert(taskItems);

            if (taskItemsError) throw taskItemsError;

            // Update inventory status to pending
            await updateInventoryStatus(allItemIds, formData.task_type, 'pending');
          }

          toast({
            title: 'Task Created',
            description: 'Your task is now in the queue.',
          });
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving task:', error);
      toast({
        variant: 'destructive',
        title: 'Could not save task',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription>
            {task
              ? 'Update task details'
              : isFromInventory
              ? `Create a task for ${selectedItemIds.length} selected item(s)`
              : 'Create a new task'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Task Type */}
            <div className="space-y-2">
              <Label>Task Type *</Label>
              {showNewTaskType ? (
                <div className="flex gap-2">
                  <Input
                    value={newTaskTypeName}
                    onChange={(e) => setNewTaskTypeName(e.target.value)}
                    placeholder="New task type name"
                  />
                  <Button onClick={handleCreateTaskType} size="sm">
                    <MaterialIcon name="add" size="sm" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowNewTaskType(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select value={formData.task_type} onValueChange={handleTaskTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map(type => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">
                      <span className="flex items-center gap-2">
                        <MaterialIcon name="add" size="sm" />
                        Add New Type
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Account - shown when creating from tasks menu (optional) */}
            {!isFromInventory && (
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={formData.account_id}
                  onValueChange={handleAccountChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No account</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Item Search and Selection - shown when account is selected */}
            {!isFromInventory && formData.account_id !== 'none' && (
              <div className="space-y-3">
                <Label>Select Items</Label>
                <div className="relative">
                  <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by item code, description, vendor, sidemark..."
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {loadingItems ? (
                  <div className="flex items-center justify-center py-4">
                    <MaterialIcon name="progress_activity" size="md" className="animate-spin text-muted-foreground" />
                  </div>
                ) : filteredItems.length > 0 ? (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {filteredItems.map(item => {
                      const isSelected = selectedItems.some(i => i.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                          onClick={() => toggleItemSelection(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleItemSelection(item);
                            }
                          }}
                        >
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleItemSelection(item)}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{item.item_code}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[item.description, item.vendor, item.sidemark]
                                .filter(Boolean)
                                .join(' • ')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : accountItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No items found for this account
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No items match your search
                  </p>
                )}
              </div>
            )}

            {/* Selected Items Display */}
            {selectedItems.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Items ({selectedItems.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedItems.map(item => (
                    <Badge key={item.id} variant="secondary" className="flex items-center gap-1">
                      {item.item_code}
                      {!isFromInventory && (
                        <button onClick={() => removeItem(item.id)}>
                          <MaterialIcon name="close" className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description"
                rows={3}
              />
            </div>

            {/* Custom Charges - only show when editing existing task */}
            {task && (
              <TaskCustomChargesSection
                charges={charges}
                templates={templates}
                onAddCharge={addCharge}
                onUpdateCharge={updateCharge}
                onDeleteCharge={deleteCharge}
                totalCharges={totalCharges}
                disabled={chargesLoading}
              />
            )}

            {/* Bill To */}
            <div className="space-y-2">
              <Label>Bill To</Label>
              <Select
                value={formData.bill_to}
                onValueChange={(value: 'account' | 'customer' | 'no_charge') => 
                  setFormData(prev => ({ ...prev, bill_to: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="customer">Customer (Different Billing)</SelectItem>
                  <SelectItem value="no_charge">No Charge</SelectItem>
                </SelectContent>
              </Select>
              {formData.bill_to === 'no_charge' && (
                <p className="text-xs text-muted-foreground">
                  Selecting "No Charge" will void all charges for this task.
                </p>
              )}
            </div>

            {/* Customer Billing Info - only show when bill_to is customer */}
            {formData.bill_to === 'customer' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bill_to_customer_name">Customer Name</Label>
                  <Input
                    id="bill_to_customer_name"
                    value={formData.bill_to_customer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, bill_to_customer_name: e.target.value }))}
                    placeholder="Customer name for billing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bill_to_customer_email">Customer Email</Label>
                  <Input
                    id="bill_to_customer_email"
                    type="email"
                    value={formData.bill_to_customer_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, bill_to_customer_email: e.target.value }))}
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Priority */}
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => {
                    // When urgent is selected, auto-set due date to today
                    if (value === 'urgent') {
                      setFormData(prev => ({ 
                        ...prev, 
                        priority: value,
                        due_date: new Date()
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, priority: value }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formData.due_date && 'text-muted-foreground'
                      )}
                    >
                      <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                      {formData.due_date ? format(formData.due_date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date || undefined}
                      onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Assign To */}
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select
                  value={formData.assigned_to}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Warehouse - Auto-derived from items, shown as read-only when items selected */}
              {selectedItems.length > 0 && formData.warehouse_id !== 'none' && (
                <div className="space-y-2">
                  <Label>Warehouse</Label>
                  <div className="text-sm text-muted-foreground px-3 py-2 bg-muted rounded-md">
                    {warehouses.find(wh => wh.id === formData.warehouse_id)?.name || 'Auto-assigned from items'}
                  </div>
                </div>
              )}
            </div>

            {/* Account - only show when creating from inventory (auto-populated) */}
            {isFromInventory && (
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={formData.account_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, account_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !formData.task_type}
          >
            {loading ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              task ? 'Update Task' : 'Create Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Validation Error Dialog */}
      <AlertDialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MaterialIcon name="warning" size="md" className="text-destructive" />
              Cannot Create Task
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
    </Dialog>
  );
}
