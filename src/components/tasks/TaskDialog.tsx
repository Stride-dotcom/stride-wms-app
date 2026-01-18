import { useState, useEffect } from 'react';
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
import { Loader2, CalendarIcon, Plus, X } from 'lucide-react';
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

interface Item {
  id: string;
  item_code: string;
  description: string | null;
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
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [showNewTaskType, setShowNewTaskType] = useState(false);
  const [newTaskTypeName, setNewTaskTypeName] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: '',
    priority: 'medium',
    due_date: null as Date | null,
    assigned_to: '',
    assigned_department: '',
    warehouse_id: '',
    account_id: '',
  });

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
        title: task.title,
        description: task.description || '',
        task_type: task.task_type,
        priority: task.priority || 'medium',
        due_date: task.due_date ? new Date(task.due_date) : null,
        assigned_to: task.assigned_to || '',
        assigned_department: task.assigned_department || '',
        warehouse_id: task.warehouse_id || '',
        account_id: task.account_id || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        task_type: '',
        priority: 'medium',
        due_date: null,
        assigned_to: '',
        assigned_department: '',
        warehouse_id: '',
        account_id: '',
      });
      setSelectedItems([]);
    }
  }, [task, open]);

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
      .select('id, item_code, description')
      .in('id', selectedItemIds);

    setSelectedItems(data || []);
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

  const handleSubmit = async () => {
    if (!profile?.tenant_id || !formData.title || !formData.task_type) return;

    try {
      setLoading(true);

      const taskData = {
        tenant_id: profile.tenant_id,
        title: formData.title,
        description: formData.description || null,
        task_type: formData.task_type,
        priority: formData.priority,
        due_date: formData.due_date?.toISOString() || null,
        assigned_to: formData.assigned_to || null,
        assigned_department: formData.assigned_department || null,
        warehouse_id: formData.warehouse_id || null,
        account_id: formData.account_id || null,
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

        // Add task items if any
        if (selectedItemIds.length > 0 && newTask) {
          const taskItems = selectedItemIds.map(itemId => ({
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
              : selectedItemIds.length > 0
              ? `Create a task for ${selectedItemIds.length} selected item(s)`
              : 'Create a new task'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Selected Items */}
            {selectedItems.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Items</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedItems.map(item => (
                    <Badge key={item.id} variant="secondary" className="flex items-center gap-1">
                      {item.item_code}
                      <button onClick={() => removeItem(item.id)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>

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
                    <SelectItem value="">Unassigned</SelectItem>
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
                    <SelectItem value="">None</SelectItem>
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Account */}
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
                  <SelectItem value="">None</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.title || !formData.task_type}>
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
