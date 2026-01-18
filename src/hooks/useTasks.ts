import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Task {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  assigned_department: string | null;
  warehouse_id: string | null;
  account_id: string | null;
  related_item_id: string | null;
  parent_task_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  billing_status: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  assigned_user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  account?: {
    id: string;
    account_name: string;
  };
  subtasks?: Subtask[];
  task_items?: TaskItem[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

export interface TaskItem {
  id: string;
  task_id: string;
  item_id: string;
  quantity: number | null;
  item?: {
    id: string;
    item_code: string;
    description: string | null;
  };
}

export interface TaskType {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  color: string;
  icon: string;
  sort_order: number;
}

export interface DueDateRule {
  id: string;
  tenant_id: string;
  account_id: string | null;
  task_type: string;
  days_from_creation: number;
  is_active: boolean;
}

export function useTasks(filters?: {
  status?: string;
  taskType?: string;
  warehouseId?: string;
  assignedTo?: string;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  // Memoize filter values to prevent unnecessary refetches
  const filterStatus = filters?.status;
  const filterTaskType = filters?.taskType;
  const filterWarehouseId = filters?.warehouseId;
  const filterAssignedTo = filters?.assignedTo;

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (!profile?.tenant_id) return;

    try {
      // Only show full loading on initial load, use refetching for subsequent
      if (showLoading && tasks.length === 0) {
        setLoading(true);
      } else {
        setIsRefetching(true);
      }

      let query = (supabase
        .from('tasks') as any)
        .select(`
          *,
          assigned_user:users!tasks_assigned_to_fkey(id, first_name, last_name),
          warehouse:warehouses(id, name),
          account:accounts(id, account_name)
        `)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      if (filterTaskType && filterTaskType !== 'all') {
        query = query.eq('task_type', filterTaskType);
      }
      if (filterWarehouseId && filterWarehouseId !== 'all') {
        query = query.eq('warehouse_id', filterWarehouseId);
      }
      if (filterAssignedTo && filterAssignedTo !== 'all') {
        query = query.eq('assigned_to', filterAssignedTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load tasks',
      });
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [profile?.tenant_id, filterStatus, filterTaskType, filterWarehouseId, filterAssignedTo, toast, tasks.length]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (taskData: Partial<Task>, itemIds?: string[]) => {
    if (!profile?.tenant_id) return null;

    try {
      const { data: task, error } = await (supabase
        .from('tasks') as any)
        .insert({
          ...taskData,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add task items if provided
      if (itemIds && itemIds.length > 0 && task) {
        const taskItems = itemIds.map(itemId => ({
          task_id: task.id,
          item_id: itemId,
        }));

        await (supabase.from('task_items') as any).insert(taskItems);
      }

      toast({
        title: 'Task Created',
        description: `Task "${taskData.title}" has been created.`,
      });

      fetchTasks();
      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create task',
      });
      return null;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await (supabase
        .from('tasks') as any)
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task Updated',
        description: 'Task has been updated.',
      });

      fetchTasks();
      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update task',
      });
      return false;
    }
  };

  const completeTask = async (taskId: string) => {
    if (!profile?.id) return false;

    try {
      const { error } = await (supabase
        .from('tasks') as any)
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: profile.id,
          billing_status: 'pending',
          billing_charge_date: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task Completed',
        description: 'Task has been marked as completed.',
      });

      fetchTasks();
      return true;
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to complete task',
      });
      return false;
    }
  };

  const claimTask = async (taskId: string) => {
    if (!profile?.id) return false;

    try {
      const { error } = await (supabase
        .from('tasks') as any)
        .update({
          assigned_to: profile.id,
          status: 'in_progress',
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task Claimed',
        description: 'You have been assigned to this task.',
      });

      fetchTasks();
      return true;
    } catch (error) {
      console.error('Error claiming task:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to claim task',
      });
      return false;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await (supabase
        .from('tasks') as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task Deleted',
        description: 'Task has been deleted.',
      });

      fetchTasks();
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete task',
      });
      return false;
    }
  };

  return {
    tasks,
    loading,
    isRefetching,
    refetch: () => fetchTasks(false),
    createTask,
    updateTask,
    completeTask,
    claimTask,
    deleteTask,
  };
}

export function useTaskTypes() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultTypes = [
    { name: 'Inspection', is_system: true },
    { name: 'Assembly', is_system: true },
    { name: 'Repair', is_system: true },
    { name: 'Other', is_system: true },
  ];

  const fetchTaskTypes = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('task_types') as any)
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      // If no task types exist, create defaults
      if (!data || data.length === 0) {
        const defaultData = defaultTypes.map(t => ({
          ...t,
          tenant_id: profile.tenant_id,
          is_active: true,
          color: '#6366f1',
        }));

        await (supabase.from('task_types') as any).insert(defaultData);
        fetchTaskTypes();
        return;
      }

      setTaskTypes(data);
    } catch (error) {
      console.error('Error fetching task types:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchTaskTypes();
  }, [fetchTaskTypes]);

  const createTaskType = async (name: string, description?: string) => {
    if (!profile?.tenant_id) return null;

    try {
      const { data, error } = await (supabase
        .from('task_types') as any)
        .insert({
          tenant_id: profile.tenant_id,
          name,
          description,
          is_system: false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Task Type Created',
        description: `"${name}" has been added.`,
      });

      fetchTaskTypes();
      return data;
    } catch (error) {
      console.error('Error creating task type:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create task type',
      });
      return null;
    }
  };

  return {
    taskTypes,
    loading,
    refetch: fetchTaskTypes,
    createTaskType,
  };
}

export function useDueDateRules(accountId?: string) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<DueDateRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      let query = (supabase
        .from('due_date_rules') as any)
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true);

      if (accountId) {
        query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      } else {
        query = query.is('account_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching due date rules:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, accountId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const getDueDateForTaskType = (taskType: string): Date => {
    const rule = rules.find(r => r.task_type === taskType);
    const days = rule?.days_from_creation || 3; // Default 3 days
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  };

  const saveRule = async (taskType: string, days: number, forAccountId?: string) => {
    if (!profile?.tenant_id) return false;

    try {
      // Upsert rule
      const { error } = await (supabase
        .from('due_date_rules') as any)
        .upsert({
          tenant_id: profile.tenant_id,
          account_id: forAccountId || null,
          task_type: taskType,
          days_from_creation: days,
          is_active: true,
        }, {
          onConflict: 'tenant_id,account_id,task_type',
        });

      if (error) throw error;

      toast({
        title: 'Rule Saved',
        description: `Due date rule for ${taskType} has been updated.`,
      });

      fetchRules();
      return true;
    } catch (error) {
      console.error('Error saving due date rule:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save due date rule',
      });
      return false;
    }
  };

  return {
    rules,
    loading,
    refetch: fetchRules,
    getDueDateForTaskType,
    saveRule,
  };
}

export function useSubtasks(taskId: string) {
  const { toast } = useToast();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubtasks = useCallback(async () => {
    if (!taskId) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('subtasks') as any)
        .select('*')
        .eq('task_id', taskId)
        .order('sort_order');

      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const addSubtask = async (title: string, description?: string) => {
    try {
      const { error } = await (supabase
        .from('subtasks') as any)
        .insert({
          task_id: taskId,
          title,
          description,
          sort_order: subtasks.length,
        });

      if (error) throw error;

      fetchSubtasks();
      return true;
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add subtask',
      });
      return false;
    }
  };

  const toggleSubtask = async (subtaskId: string, isCompleted: boolean) => {
    try {
      const { error } = await (supabase
        .from('subtasks') as any)
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', subtaskId);

      if (error) throw error;

      fetchSubtasks();
      return true;
    } catch (error) {
      console.error('Error toggling subtask:', error);
      return false;
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await (supabase
        .from('subtasks') as any)
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;

      fetchSubtasks();
      return true;
    } catch (error) {
      console.error('Error deleting subtask:', error);
      return false;
    }
  };

  return {
    subtasks,
    loading,
    refetch: fetchSubtasks,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
  };
}
