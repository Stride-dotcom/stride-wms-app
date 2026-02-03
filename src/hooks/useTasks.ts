import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queueTaskCreatedAlert, queueTaskAssignedAlert, queueTaskCompletedAlert, queueInspectionCompletedAlert, queueBillingEventAlert } from '@/lib/alertQueue';
import { createBillingEventsBatch, CreateBillingEventParams } from '@/lib/billing/createBillingEvent';
import { TASK_TYPE_TO_SERVICE_CODE, getRateFromPriceList } from '@/lib/billing/billingCalculation';
import { getTaskTypeServiceCode } from '@/lib/billing/taskServiceLookup';
import { BILLING_DISABLED_ERROR } from '@/lib/billing/chargeTypeUtils';

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
  unable_to_complete_note: string | null;
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

// Map task types to inventory status fields
const TASK_TYPE_TO_STATUS_FIELD: Record<string, string> = {
  'Assembly': 'assembly_status',
  'Inspection': 'inspection_status',
  'Repair': 'repair_status',
};

// Map task status to inventory status values
const TASK_STATUS_TO_INVENTORY_STATUS: Record<string, string> = {
  'pending': 'pending',
  'in_progress': 'in_progress',
  'completed': 'completed',
  'unable_to_complete': 'unable_to_complete',
};

// Task types that require special completion handling
const SPECIAL_TASK_TYPES = {
  WILL_CALL: 'Will Call',
  DISPOSAL: 'Disposal',
};

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

      if (error) {
        // Ignore AbortError - happens during rapid navigation
        if (error.message?.includes('AbortError') || error.message?.includes('aborted')) {
          console.debug('[useTasks] Request aborted (expected during navigation)');
          return;
        }
        throw error;
      }
      setTasks(data || []);
    } catch (error: any) {
      // Ignore AbortError - happens during rapid navigation
      if (error?.message?.includes('AbortError') || error?.message?.includes('aborted')) {
        console.debug('[useTasks] Request aborted (expected during navigation)');
        return;
      }
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

  // Helper to update inventory status for task items
  const updateInventoryStatus = async (taskId: string, taskType: string, status: string) => {
    const statusField = TASK_TYPE_TO_STATUS_FIELD[taskType];
    if (!statusField) return; // Task type doesn't map to an inventory status

    const inventoryStatus = TASK_STATUS_TO_INVENTORY_STATUS[status];
    if (!inventoryStatus) return;

    try {
      // Get task items
      const { data: taskItems } = await (supabase
        .from('task_items') as any)
        .select('item_id')
        .eq('task_id', taskId);

      if (!taskItems || taskItems.length === 0) return;

      const itemIds = taskItems.map((ti: any) => ti.item_id);

      // Update items with the new status
      const updateData: Record<string, string> = {};
      updateData[statusField] = inventoryStatus;

      await (supabase
        .from('items') as any)
        .update(updateData)
        .in('id', itemIds);
    } catch (error) {
      console.error('Error updating inventory status:', error);
    }
  };

  // Helper to create billing events for task completion
  const createTaskBillingEvents = async (
    taskId: string,
    taskType: string,
    accountId: string | null
  ) => {
    if (!profile?.tenant_id || !profile?.id) return;

    try {
      // First, fetch the task to check for billing config
      const { data: taskData } = await (supabase
        .from('tasks') as any)
        .select('billing_rate, billing_rate_locked, title, metadata')
        .eq('id', taskId)
        .single();

      // Check if task type requires manual rate entry (Safety Billing)
      // This covers Assembly/Repair by name OR any task type with requires_manual_rate=true
      const { data: taskTypeData } = await (supabase
        .from('task_types') as any)
        .select('requires_manual_rate')
        .eq('tenant_id', profile.tenant_id)
        .eq('name', taskType)
        .maybeSingle();

      const isManualRateTaskType =
        taskTypeData?.requires_manual_rate === true ||
        taskType === 'Assembly' ||
        taskType === 'Repair';

      const hasManualRate = taskData?.billing_rate_locked && taskData?.billing_rate !== null;
      const manualRate = taskData?.billing_rate;

      // For Assembly and Repair tasks, use service code and quantity from metadata
      const isAssemblyTask = taskType === 'Assembly';
      const isRepairTask = taskType === 'Repair';
      const isPerTaskBilling = isAssemblyTask || isRepairTask;

      // Get service code and quantity from metadata
      const assemblyServiceCode = taskData?.metadata?.billing_service_code || '60MA';
      const billingQuantity = taskData?.metadata?.billing_quantity || 0;

      // Get service code for this task type
      // Priority: 1) Assembly service from metadata, 2) Repair default, 3) DB lookup, 4) Hardcoded defaults
      let serviceCode: string;
      if (isAssemblyTask) {
        serviceCode = assemblyServiceCode;
      } else if (isRepairTask) {
        serviceCode = '1HRO'; // Repair uses 1 Hr Repair service
      } else {
        // Dynamic lookup from task_types table, falls back to hardcoded defaults
        serviceCode = await getTaskTypeServiceCode(profile.tenant_id, taskType);
      }

      // Check if this service uses task-level billing (e.g., Assembly, Repair)
      const serviceInfo = await getRateFromPriceList(profile.tenant_id, serviceCode, null, accountId);
      const isTaskLevelBilling = serviceInfo.billingUnit === 'Task' || isPerTaskBilling;

      // Fetch all classes to map class_id to code
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id, code')
        .eq('tenant_id', profile.tenant_id);
      const classMap = new Map((allClasses || []).map((c: any) => [c.id, c.code]));

      // Get task items with item details including class_id and account info
      const { data: taskItems } = await (supabase
        .from('task_items') as any)
        .select(`
          item_id,
          quantity,
          items:item_id(id, class_id, sidemark_id, account_id, item_code, account:accounts(account_name))
        `)
        .eq('task_id', taskId);

      if (!taskItems || taskItems.length === 0) return;

      // Build billing events
      const billingEvents: CreateBillingEventParams[] = [];
      const alertsToQueue: Array<{
        serviceName: string;
        itemCode: string;
        accountName: string;
        amount: number;
        description: string;
      }> = [];

      // For Assembly and Repair tasks, create single billing event with selected service and quantity
      if (isPerTaskBilling) {
        const firstItem = taskItems[0]?.items;
        const taskAccountId = accountId || firstItem?.account_id;

        if (taskAccountId && billingQuantity > 0) {
          const itemCodes = taskItems
            .map((ti: any) => ti.items?.item_code)
            .filter(Boolean);
          const itemCodesStr = itemCodes.join(', ');

          // SAFETY BILLING: For manual-rate task types without a rate set, use NULL
          // This creates a "pending pricing" state that blocks invoicing until rate is entered
          const needsPendingRate = isManualRateTaskType && !hasManualRate;
          const unitRate = needsPendingRate ? null : (hasManualRate ? manualRate : serviceInfo.rate);
          const totalAmount = unitRate !== null ? unitRate * billingQuantity : null;

          // Description includes RATE REQUIRED notice if pending
          const description = needsPendingRate
            ? `RATE REQUIRED – ${serviceInfo.serviceName}: ${taskData?.title || itemCodesStr}`
            : `${serviceInfo.serviceName}: ${taskData?.title || itemCodesStr}`;

          billingEvents.push({
            tenant_id: profile.tenant_id,
            account_id: taskAccountId,
            sidemark_id: firstItem?.sidemark_id || null,
            class_id: null,
            item_id: null, // Task-level, not item-specific
            task_id: taskId,
            event_type: 'task_completion',
            charge_type: serviceCode,
            description,
            quantity: billingQuantity,
            unit_rate: unitRate,
            total_amount: totalAmount,
            status: 'unbilled',
            occurred_at: new Date().toISOString(),
            metadata: {
              task_type: taskType,
              billing_unit: 'Task',
              service_code: serviceCode,
              manual_rate: hasManualRate,
              pending_rate: needsPendingRate, // Flag for UI to show rate entry
              task_item_codes: itemCodes, // Store item codes for display in reports
            },
            created_by: profile.id,
            has_rate_error: needsPendingRate ? true : (hasManualRate ? false : serviceInfo.hasError),
            rate_error_message: needsPendingRate
              ? 'Rate not set – set price before invoicing'
              : (hasManualRate ? null : serviceInfo.errorMessage),
          });
        }
      } else if (isTaskLevelBilling && hasManualRate) {
        // For other task-level billing with manual rate
        const firstItem = taskItems[0]?.items;
        const taskAccountId = accountId || firstItem?.account_id;

        if (taskAccountId) {
          const itemCodes = taskItems
            .map((ti: any) => ti.items?.item_code)
            .filter(Boolean);
          const itemCodesStr = itemCodes.join(', ');
          const description = `${taskType}: ${taskData?.title || itemCodesStr}`;

          billingEvents.push({
            tenant_id: profile.tenant_id,
            account_id: taskAccountId,
            sidemark_id: firstItem?.sidemark_id || null,
            class_id: null,
            item_id: null,
            task_id: taskId,
            event_type: 'task_completion',
            charge_type: serviceCode,
            description,
            quantity: 1,
            unit_rate: manualRate,
            total_amount: manualRate,
            status: 'unbilled',
            occurred_at: new Date().toISOString(),
            metadata: {
              task_type: taskType,
              billing_unit: 'Task',
              manual_rate: true,
              task_item_codes: itemCodes, // Store item codes for display in reports
            },
            created_by: profile.id,
            has_rate_error: false,
            rate_error_message: null,
          });
        }
      } else {
        // Item-level billing: create event per item
        for (const taskItem of taskItems) {
          const item = taskItem.items;
          if (!item) continue;

          const itemAccountId = accountId || item.account_id;
          if (!itemAccountId) continue;

          // Get the item's class code for rate lookup
          const classCode = item.class_id ? classMap.get(item.class_id) : null;

          // Use manual rate if set, otherwise lookup from Price List
          let unitRate: number;
          let rateResult: any;

          if (hasManualRate) {
            unitRate = manualRate;
            rateResult = { serviceName: serviceCode, alertRule: 'none', hasError: false };
          } else {
            rateResult = await getRateFromPriceList(
              profile.tenant_id,
              serviceCode,
              classCode,
              itemAccountId
            );
            unitRate = rateResult.rate;
          }

          const quantity = taskItem.quantity || 1;
          const totalAmount = quantity * unitRate;
          const description = `${taskType}: ${item.item_code}`;

          billingEvents.push({
            tenant_id: profile.tenant_id,
            account_id: itemAccountId,
            sidemark_id: item.sidemark_id || null,
            class_id: item.class_id || null,
            item_id: item.id,
            task_id: taskId,
            event_type: 'task_completion',
            charge_type: serviceCode,
            description,
            quantity,
            unit_rate: unitRate,
            total_amount: totalAmount,
            status: 'unbilled',
            occurred_at: new Date().toISOString(),
            metadata: {
              task_type: taskType,
              class_code: classCode,
              manual_rate: hasManualRate,
            },
            created_by: profile.id,
            has_rate_error: hasManualRate ? false : rateResult.hasError,
            rate_error_message: hasManualRate ? null : rateResult.errorMessage,
          });

          // Track alerts to queue for services with email_office alert rule
          if (rateResult.alertRule === 'email_office') {
            alertsToQueue.push({
              serviceName: rateResult.serviceName,
              itemCode: item.item_code,
              accountName: item.account?.account_name || 'Unknown Account',
              amount: totalAmount,
              description,
            });
          }
        }
      }

      if (billingEvents.length > 0) {
        const results = await createBillingEventsBatch(billingEvents);

        // Queue alerts for services with email_office alert rule
        for (let i = 0; i < alertsToQueue.length && i < results.length; i++) {
          const alertInfo = alertsToQueue[i];
          const billingEvent = results[i];
          if (billingEvent?.id) {
            await queueBillingEventAlert(
              profile.tenant_id,
              billingEvent.id,
              alertInfo.serviceName,
              alertInfo.itemCode,
              alertInfo.accountName,
              alertInfo.amount,
              alertInfo.description
            );
          }
        }
      }
    } catch (error: any) {
      if (error?.message === BILLING_DISABLED_ERROR) {
        console.warn(`[useTasks] Billing disabled for service on this account, skipping billing events`);
        toast({ variant: 'destructive', title: 'Billing Disabled', description: BILLING_DISABLED_ERROR });
      } else {
        console.error('Error creating task billing events:', error);
      }
      // Don't throw - billing event creation shouldn't block task completion
    }
  };

  // Helper to convert task custom charges to billing events on completion
  const convertTaskCustomChargesToBillingEvents = async (
    taskId: string,
    accountId: string | null
  ) => {
    if (!profile?.tenant_id || !profile?.id) return;

    try {
      // Get task custom charges
      const { data: customCharges } = await (supabase
        .from('task_custom_charges') as any)
        .select('*')
        .eq('task_id', taskId);

      if (!customCharges || customCharges.length === 0) return;

      // Get task items to link charges to items if possible
      const { data: taskItems } = await (supabase
        .from('task_items') as any)
        .select('item_id, items:item_id(sidemark_id)')
        .eq('task_id', taskId)
        .limit(1);

      const firstItem = taskItems?.[0];
      const sidemarkId = firstItem?.items?.sidemark_id || null;
      const itemId = firstItem?.item_id || null;

      // Build billing events for each custom charge
      const billingEvents: CreateBillingEventParams[] = customCharges.map((charge: any) => ({
        tenant_id: profile.tenant_id,
        account_id: accountId,
        sidemark_id: sidemarkId,
        item_id: itemId,
        task_id: taskId,
        event_type: 'addon',
        charge_type: charge.charge_type || 'addon',
        description: charge.charge_description || charge.charge_name,
        quantity: 1,
        unit_rate: charge.charge_amount,
        total_amount: charge.charge_amount,
        status: 'unbilled',
        occurred_at: new Date().toISOString(),
        metadata: {
          custom_charge_id: charge.id,
          template_id: charge.template_id,
        },
        created_by: profile.id,
      }));

      if (billingEvents.length > 0) {
        await createBillingEventsBatch(billingEvents);
      }
    } catch (error) {
      console.error('Error converting custom charges to billing events:', error);
      // Don't throw - shouldn't block task completion
    }
  };

  const createTask = async (taskData: Partial<Task>, itemIds?: string[]) => {
    if (!profile?.tenant_id) return null;

    try {
      const { data: task, error } = await (supabase
        .from('tasks') as any)
        .insert({
          ...taskData,
          tenant_id: profile.tenant_id,
          status: 'pending', // New tasks start as pending
        })
        .select()
        .single();

      if (error) {
        console.error('[createTask] Insert failed:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to create task',
          description: error.message || 'Database error while creating task',
        });
        return null;
      }

      // Add task items if provided
      if (itemIds && itemIds.length > 0 && task) {
        const taskItems = itemIds.map(itemId => ({
          task_id: task.id,
          item_id: itemId,
        }));

        const { error: itemsError } = await (supabase.from('task_items') as any).insert(taskItems);
        if (itemsError) {
          console.error('[createTask] Failed to add task items:', itemsError);
        }

        // Update inventory status to pending
        await updateInventoryStatus(task.id, taskData.task_type || '', 'pending');
      }

      toast({
        title: 'Task Created',
        description: `Task has been created and added to queue.`,
      });

      // Queue task.created alert
      if (task) {
        await queueTaskCreatedAlert(profile.tenant_id, task.id, taskData.task_type || 'General');
      }

      fetchTasks();
      return task;
    } catch (error: any) {
      console.error('[createTask] Exception:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create task',
        description: error?.message || 'An unexpected error occurred',
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

  const startTask = async (taskId: string) => {
    if (!profile?.id) return false;

    try {
      // Get task info first
      const { data: taskData } = await (supabase
        .from('tasks') as any)
        .select('task_type')
        .eq('id', taskId)
        .single();

      const { error } = await (supabase
        .from('tasks') as any)
        .update({
          status: 'in_progress',
          assigned_to: profile.id,
        })
        .eq('id', taskId);

      if (error) throw error;

      // Update inventory status
      if (taskData) {
        await updateInventoryStatus(taskId, taskData.task_type, 'in_progress');
      }

      toast({
        title: 'Task Started',
        description: 'Task is now in progress.',
      });

      // Queue task.assigned alert (task started = assigned to current user)
      if (taskData) {
        await queueTaskAssignedAlert(profile.tenant_id, taskId, taskData.task_type);
      }

      fetchTasks();
      return true;
    } catch (error) {
      console.error('Error starting task:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start task',
      });
      return false;
    }
  };

  const completeTask = async (taskId: string, pickupName?: string) => {
    if (!profile?.id) return false;

    try {
      // Get task info first
      const { data: taskData } = await (supabase
        .from('tasks') as any)
        .select('task_type')
        .eq('id', taskId)
        .single();

      if (!taskData) {
        throw new Error('Task not found');
      }

      // Handle Will Call completion - requires pickup name
      if (taskData.task_type === SPECIAL_TASK_TYPES.WILL_CALL) {
        if (!pickupName) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Pickup name is required for Will Call completion',
          });
          return false;
        }

        // Update task with pickup info
        const { error: taskError } = await (supabase
          .from('tasks') as any)
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: profile.id,
            billing_charge_date: new Date().toISOString(),
            pickup_name: pickupName,
            pickup_completed_at: new Date().toISOString(),
          })
          .eq('id', taskId);

        if (taskError) throw taskError;

        // Get task items and update them to 'released' status
        const { data: taskItems } = await (supabase
          .from('task_items') as any)
          .select('item_id')
          .eq('task_id', taskId);

        if (taskItems && taskItems.length > 0) {
          const itemIds = taskItems.map((ti: any) => ti.item_id);
          await (supabase
            .from('items') as any)
            .update({ status: 'released' })
            .in('id', itemIds);
        }

        toast({
          title: 'Will Call Completed',
          description: `Items released to ${pickupName}.`,
        });

        // Queue task.completed alert
        await queueTaskCompletedAlert(profile.tenant_id, taskId, 'Will Call');

        fetchTasks();
        return true;
      }

      // Handle Disposal completion
      if (taskData.task_type === SPECIAL_TASK_TYPES.DISPOSAL) {
        // Update task
        const { error: taskError } = await (supabase
          .from('tasks') as any)
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: profile.id,
            billing_charge_date: new Date().toISOString(),
          })
          .eq('id', taskId);

        if (taskError) throw taskError;

        // Get task items and update them to 'disposed' status with deleted_at
        const { data: taskItems } = await (supabase
          .from('task_items') as any)
          .select('item_id')
          .eq('task_id', taskId);

        if (taskItems && taskItems.length > 0) {
          const itemIds = taskItems.map((ti: any) => ti.item_id);
          await (supabase
            .from('items') as any)
            .update({ 
              status: 'disposed',
              deleted_at: new Date().toISOString(),
            })
            .in('id', itemIds);
        }

        toast({
          title: 'Disposal Completed',
          description: 'Items have been marked as disposed.',
        });

        // Queue task.completed alert
        await queueTaskCompletedAlert(profile.tenant_id, taskId, 'Disposal');

        fetchTasks();
        return true;
      }

      // Normal task completion for other task types
      const { error } = await (supabase
        .from('tasks') as any)
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: profile.id,
          billing_charge_date: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;

      // Update inventory status
      await updateInventoryStatus(taskId, taskData.task_type, 'completed');

      // Get task account_id for billing
      const { data: taskFullData } = await (supabase
        .from('tasks') as any)
        .select('account_id')
        .eq('id', taskId)
        .single();

      // Create billing events for task completion
      await createTaskBillingEvents(taskId, taskData.task_type, taskFullData?.account_id);

      // Also convert any task custom charges to billing events
      await convertTaskCustomChargesToBillingEvents(taskId, taskFullData?.account_id);

      toast({
        title: 'Task Completed',
        description: 'Task has been marked as completed.',
      });

      // Queue task.completed alert
      await queueTaskCompletedAlert(profile.tenant_id, taskId, taskData.task_type);

      // For Inspection tasks, also queue a specific inspection completed alert
      if (taskData.task_type === 'Inspection') {
        // Get first item from task for the alert
        const { data: firstTaskItem } = await (supabase
          .from('task_items') as any)
          .select(`
            item_id,
            items:item_id(item_code, has_damage, account_id, accounts!items_account_id_fkey(alerts_contact_email, primary_contact_email))
          `)
          .eq('task_id', taskId)
          .limit(1)
          .maybeSingle();
        
        if (firstTaskItem?.items) {
          const accountEmail = (firstTaskItem.items.accounts as any)?.alerts_contact_email || 
                               (firstTaskItem.items.accounts as any)?.primary_contact_email || undefined;
          await queueInspectionCompletedAlert(
            profile.tenant_id,
            taskId,
            firstTaskItem.items.item_code || 'Unknown',
            firstTaskItem.items.has_damage || false,
            accountEmail
          );
        }
      }

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

  // Get task items for a specific task (used for Will Call dialog)
  const getTaskItems = async (taskId: string) => {
    try {
      const { data: taskItems } = await (supabase
        .from('task_items') as any)
        .select(`
          item_id,
          items:item_id(id, item_code, description)
        `)
        .eq('task_id', taskId);

      if (!taskItems) return [];

      return taskItems.map((ti: any) => ({
        id: ti.items?.id || ti.item_id,
        item_code: ti.items?.item_code || 'Unknown',
        description: ti.items?.description || null,
      }));
    } catch (error) {
      console.error('Error fetching task items:', error);
      return [];
    }
  };

  const markUnableToComplete = async (taskId: string, note: string) => {
    if (!profile?.id) return false;

    try {
      // Get task info first
      const { data: taskData } = await (supabase
        .from('tasks') as any)
        .select('task_type')
        .eq('id', taskId)
        .single();

      const { error } = await (supabase
        .from('tasks') as any)
        .update({
          status: 'unable_to_complete',
          unable_to_complete_note: note,
          completed_at: new Date().toISOString(),
          completed_by: profile.id,
        })
        .eq('id', taskId);

      if (error) throw error;

      // Update inventory status
      if (taskData) {
        await updateInventoryStatus(taskId, taskData.task_type, 'unable_to_complete');
      }

      toast({
        title: 'Task Marked',
        description: 'Task has been marked as unable to complete.',
      });

      fetchTasks();
      return true;
    } catch (error) {
      console.error('Error marking task unable to complete:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update task',
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

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      // Get task info first
      const { data: taskData, error: fetchError } = await (supabase
        .from('tasks') as any)
        .select('task_type')
        .eq('id', taskId)
        .single();

      if (fetchError) {
        console.error('[updateTaskStatus] Failed to fetch task:', fetchError);
        toast({
          variant: 'destructive',
          title: 'Failed to update status',
          description: fetchError.message || 'Could not find task',
        });
        return false;
      }

      const updates: any = { status };

      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = profile?.id;
        updates.billing_charge_date = new Date().toISOString();
      }

      const { error } = await (supabase
        .from('tasks') as any)
        .update(updates)
        .eq('id', taskId);

      if (error) {
        console.error('[updateTaskStatus] Update failed:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to update status',
          description: error.message || 'Database error while updating task',
        });
        return false;
      }

      // Update inventory status
      if (taskData) {
        await updateInventoryStatus(taskId, taskData.task_type, status);
      }

      // If completing, create billing events
      if (status === 'completed' && taskData) {
        // Get task account_id for billing
        const { data: taskFullData } = await (supabase
          .from('tasks') as any)
          .select('account_id')
          .eq('id', taskId)
          .single();

        // Create billing events for task completion
        await createTaskBillingEvents(taskId, taskData.task_type, taskFullData?.account_id);

        // Also convert any task custom charges to billing events
        await convertTaskCustomChargesToBillingEvents(taskId, taskFullData?.account_id);
      }

      toast({
        title: 'Status Updated',
        description: `Task status changed to ${status.replace('_', ' ')}.`,
      });

      fetchTasks();
      return true;
    } catch (error: any) {
      console.error('[updateTaskStatus] Exception:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to update status',
        description: error?.message || 'An unexpected error occurred',
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

      if (error) {
        console.error('[deleteTask] Delete failed:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to delete task',
          description: error.message || 'Database error while deleting task',
        });
        return false;
      }

      toast({
        title: 'Task Deleted',
        description: 'Task has been deleted.',
      });

      fetchTasks();
      return true;
    } catch (error: any) {
      console.error('[deleteTask] Exception:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to delete task',
        description: error?.message || 'An unexpected error occurred',
      });
      return false;
    }
  };

  // Generate billing events for a task (can be used for already-completed tasks)
  const generateBillingEventsForTask = async (taskId: string) => {
    if (!profile?.tenant_id) return false;

    try {
      // Get task info
      const { data: taskData, error: taskError } = await (supabase
        .from('tasks') as any)
        .select('task_type, account_id')
        .eq('id', taskId)
        .single();

      if (taskError || !taskData) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to fetch task data',
        });
        return false;
      }

      // Check if billing events already exist for this task
      const { data: existingEvents } = await (supabase
        .from('billing_events') as any)
        .select('id')
        .eq('task_id', taskId)
        .eq('event_type', 'task_completion')
        .limit(1);

      if (existingEvents && existingEvents.length > 0) {
        toast({
          title: 'Already Generated',
          description: 'Billing events already exist for this task.',
        });
        return true;
      }

      // Create billing events
      await createTaskBillingEvents(taskId, taskData.task_type, taskData.account_id);

      toast({
        title: 'Billing Generated',
        description: 'Billing events have been created for this task.',
      });

      return true;
    } catch (error) {
      console.error('Error generating billing events:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate billing events',
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
    startTask,
    completeTask,
    markUnableToComplete,
    claimTask,
    updateTaskStatus,
    deleteTask,
    getTaskItems,
    generateBillingEventsForTask,
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
    { name: 'Will Call', is_system: true, completion_action: 'release' },
    { name: 'Disposal', is_system: true, completion_action: 'dispose' },
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

  const getDueDateForTaskType = useCallback((taskType: string): Date => {
    const rule = rules.find(r => r.task_type === taskType);
    const days = rule?.days_from_creation || 3; // Default 3 days
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }, [rules]);

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
