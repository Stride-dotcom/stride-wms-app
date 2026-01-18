import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { format } from 'date-fns';
import { Loader2, CalendarIcon, Plus, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  selectedItemIds?: string[];
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
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  selectedItemIds = [],
  onSuccess,
}: TaskDialogProps) {
  const { profile } = useAuth();
  const { taskTypes, createTaskType } = useTaskTypes();
  const { getDueDateForTaskType } = useDueDateRules();
  const { warehouses } = useWarehouses();
  const { users } = useUsers();

  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const [showNewTaskType, setShowNewTaskType] = useState(false);
  const [newTaskTypeName, setNewTaskTypeName] = useState('');
  
  // For item search when creating from tasks menu
  const [accountItems, setAccountItems] = useState<InventoryItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    task_type: '',
    priority: 'medium',
    due_date: null as Date | null,
    assigned_to: 'unassigned',
    assigned_department: '',
    warehouse_id: 'none',
    account_id: 'none',
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

  useEffect(() => {
    if (task) {
      setFormData({
        description: task.description || '',
        task_type: task.task_type,
        priority: task.priority || 'medium',
        due_date: task.due_date ? new Date(task.due_date) : null,
        assigned_to: task.assigned_to || 'unassigned',
        assigned_department: task.assigned_department || '',
        warehouse_id: task.warehouse_id || 'none',
        account_id: task.account_id || 'none',
      });
    } else {
      setFormData({
        description: '',
        task_type: '',
        priority: 'medium',
        due_date: null,
        assigned_to: 'unassigned',
        assigned_department: '',
        warehouse_id: 'none',
        account_id: 'none',
      });
      setSelectedItems([]);
      setAccountItems([]);
      setItemSearchQuery('');
    }
  }, [task, open]);

  // Auto-populate account when items are selected from inventory
  useEffect(() => {
    if (selectedItems.length > 0 && formData.account_id === 'none') {
      // Find the account that matches the first item's client_account
      const firstItemAccount = selectedItems[0]?.client_account;
      if (firstItemAccount) {
        const matchingAccount = accounts.find(
          acc => acc.account_name === firstItemAccount
        );
        if (matchingAccount) {
          setFormData(prev => ({ ...prev, account_id: matchingAccount.id }));
        }
      }
    }
  }, [selectedItems, accounts]);

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
      .select('id, item_code, description, vendor, sidemark, client_account')
      .in('id', selectedItemIds);

    setSelectedItems(data || []);
  };

  const fetchAccountItems = async (accountId: string) => {
    setLoadingItems(true);
    try {
      // Get the account name first
      const account = accounts.find(a => a.id === accountId);
      if (!account) return;

      const { data } = await (supabase
        .from('items') as any)
        .select('id, item_code, description, vendor, sidemark, client_account')
        .eq('client_account', account.account_name)
        .eq('status', 'in_stock')
        .is('deleted_at', null)
        .order('item_code');

      setAccountItems(data || []);
    } catch (error) {
      console.error('Error fetching account items:', error);
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

  const handleSubmit = async () => {
    if (!profile?.tenant_id || !formData.task_type) return;

    try {
      setLoading(true);

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
        status: 'pending',
      };

      if (task) {
        // Update existing task
        const { error } = await (supabase
          .from('tasks') as any)
          .update(taskData)
          .eq('id', task.id);

        if (error) throw error;
      } else {
        // Create new task
        const { data: newTask, error } = await (supabase
          .from('tasks') as any)
          .insert(taskData)
          .select()
          .single();

        if (error) throw error;

        // Add task items - combine pre-selected and manually selected
        const allItemIds = isFromInventory 
          ? selectedItemIds 
          : selectedItems.map(i => i.id);

        if (allItemIds.length > 0 && newTask) {
          const taskItems = allItemIds.map(itemId => ({
            task_id: newTask.id,
            item_id: itemId,
          }));

          await (supabase.from('task_items') as any).insert(taskItems);
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving task:', error);
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
                    <Plus className="h-4 w-4" />
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
                        <Plus className="h-4 w-4" />
                        Add New Type
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Account - shown at top when creating from tasks menu */}
            {!isFromInventory && (
              <div className="space-y-2">
                <Label>Account *</Label>
                <Select
                  value={formData.account_id}
                  onValueChange={handleAccountChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account to view items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select an account</SelectItem>
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by item code, description, vendor, sidemark..."
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {loadingItems ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredItems.length > 0 ? (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {filteredItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                        onClick={() => toggleItemSelection(item)}
                      >
                        <Checkbox
                          checked={selectedItems.some(i => i.id === item.id)}
                          onCheckedChange={() => toggleItemSelection(item)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{item.item_code}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {[item.description, item.vendor, item.sidemark]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        </div>
                      </div>
                    ))}
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
                          <X className="h-3 w-3" />
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

            <div className="grid gap-4 md:grid-cols-2">
              {/* Priority */}
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
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
                      <CalendarIcon className="mr-2 h-4 w-4" />
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

              {/* Warehouse */}
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select
                  value={formData.warehouse_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, warehouse_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            disabled={loading || !formData.task_type || (!isFromInventory && formData.account_id === 'none')}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              task ? 'Update Task' : 'Create Task'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
