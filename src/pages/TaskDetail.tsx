import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { TaggablePhotoGrid, TaggablePhoto, getPhotoUrls } from '@/components/common/TaggablePhotoGrid';
import { AddAddonDialog } from '@/components/billing/AddAddonDialog';
import { AddCreditDialog } from '@/components/billing/AddCreditDialog';
import { BillingCalculator } from '@/components/billing/BillingCalculator';
import { useTechnicians } from '@/hooks/useTechnicians';
import { useRepairQuoteWorkflow } from '@/hooks/useRepairQuotes';
import { usePermissions } from '@/hooks/usePermissions';
import { useTasks } from '@/hooks/useTasks';
import { format } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ScanDocumentButton } from '@/components/scanner/ScanDocumentButton';
import { DocumentUploadButton } from '@/components/scanner/DocumentUploadButton';
import { DocumentList } from '@/components/scanner/DocumentList';
import { TaskHistoryTab } from '@/components/tasks/TaskHistoryTab';
import { EntityActivityFeed } from '@/components/activity/EntityActivityFeed';
import { TaskCompletionBlockedDialog } from '@/components/tasks/TaskCompletionBlockedDialog';
import { HelpButton } from '@/components/prompts';
import { PromptWorkflow } from '@/types/guidedPrompts';
import { validateTaskCompletion, TaskCompletionValidationResult } from '@/lib/billing/taskCompletionValidation';
import { logItemActivity } from '@/lib/activity/logItemActivity';
import { queueRepairUnableToCompleteAlert } from '@/lib/alertQueue';
import { resolveRepairTaskTypeId, fetchRepairTaskTypeDetails } from '@/lib/tasks/resolveRepairTaskType';

interface TaskDetail {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  task_type: string;
  task_type_id: string;
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
  metadata: {
    photos?: (string | TaggablePhoto)[];
    billing_quantity?: number;
  } | null;
  created_at: string;
  updated_at: string;
  // Billing rate fields
  billing_rate: number | null;
  billing_rate_locked: boolean | null;
  billing_rate_set_by: string | null;
  billing_rate_set_at: string | null;
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

const taskStatusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  unable_to_complete: 'Unable to Complete',
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
  const [addCreditDialogOpen, setAddCreditDialogOpen] = useState(false);
  const [taskNotes, setTaskNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [photos, setPhotos] = useState<(string | TaggablePhoto)[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);
  const [docRefetchKey, setDocRefetchKey] = useState(0);
  const [completionBlockedOpen, setCompletionBlockedOpen] = useState(false);
  const [completionValidationResult, setCompletionValidationResult] = useState<TaskCompletionValidationResult | null>(null);

  // SOP validation gate state
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationBlockers, setValidationBlockers] = useState<{ code: string; message: string; severity: string }[]>([]);

  // Set Task Rate modal state (Safety Billing)
  const [setRateDialogOpen, setSetRateDialogOpen] = useState(false);
  const [pendingRateBillingEvents, setPendingRateBillingEvents] = useState<Array<{
    id: string;
    charge_type: string;
    quantity: number | null;
    description: string | null;
    item_id: string | null;
    metadata: { task_item_codes?: string[] } | null;
  }>>([]);
  const [rateAmount, setRateAmount] = useState<string>('');
  const [rateNotes, setRateNotes] = useState<string>('');
  const [savingRate, setSavingRate] = useState(false);


  const { activeTechnicians } = useTechnicians();
  const { createWorkflowQuote, sendToTechnician } = useRepairQuoteWorkflow();
  const { hasRole } = usePermissions();
  const { completeTask, completeTaskWithServices, startTask: startTaskHook } = useTasks();

  // Only managers and admins can see billing
  const canSeeBilling = hasRole('admin') || hasRole('tenant_admin') || hasRole('manager');
  // Only admins can add credits
  const canAddCredit = hasRole('admin') || hasRole('tenant_admin');

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
      setPhotos(data.metadata?.photos || []);
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

      // Deduplicate task_items by item_id (keep the first occurrence)
      const seenItemIds = new Set<string>();
      const uniqueTaskItems = taskItemsData.filter((ti: any) => {
        if (!ti.item_id || seenItemIds.has(ti.item_id)) {
          return false;
        }
        seenItemIds.add(ti.item_id);
        return true;
      });

      // Get the item IDs
      const itemIds = uniqueTaskItems.map((ti: any) => ti.item_id).filter(Boolean);

      if (itemIds.length === 0) {
        setTaskItems(uniqueTaskItems.map((ti: any) => ({ ...ti, item: null })));
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
        setTaskItems(uniqueTaskItems.map((ti: any) => ({ ...ti, item: null })));
        return;
      }

      // Map items to task_items
      const itemMap = Object.fromEntries((items || []).map((i: any) => [i.id, i]));
      setTaskItems(uniqueTaskItems.map((ti: any) => ({
        ...ti,
        item: itemMap[ti.item_id] || null,
      })));
      // Trigger billing recalculation
      setBillingRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching task items:', error);
    }
  }, [id]);

  // Fetch pending-rate billing events for this task (Safety Billing)
  const fetchPendingRateBillingEvents = useCallback(async () => {
    if (!id || !profile?.tenant_id) return;
    try {
      const { data, error } = await (supabase
        .from('billing_events') as any)
        .select('id, charge_type, quantity, description, item_id, metadata')
        .eq('tenant_id', profile.tenant_id)
        .eq('task_id', id)
        .eq('status', 'unbilled')
        .is('unit_rate', null);

      if (error) {
        console.error('Error fetching pending-rate billing events:', error);
        setPendingRateBillingEvents([]);
        return;
      }

      setPendingRateBillingEvents(data || []);
    } catch (error) {
      console.error('Error fetching pending-rate billing events:', error);
      setPendingRateBillingEvents([]);
    }
  }, [id, profile?.tenant_id]);

  // Save the rate for pending billing events
  const handleSaveRate = async () => {
    if (!rateAmount || pendingRateBillingEvents.length === 0) return;

    const rate = parseFloat(rateAmount);
    if (isNaN(rate) || rate < 0) {
      toast({ variant: 'destructive', title: 'Invalid Rate', description: 'Please enter a valid positive number' });
      return;
    }

    setSavingRate(true);
    try {
      // Update all pending-rate billing events for this task
      const eventIds = pendingRateBillingEvents.map(e => e.id);

      for (const event of pendingRateBillingEvents) {
        const quantity = event.quantity || 1;
        const totalAmount = rate * quantity;

        // Update the billing event with the new rate
        const updateData: any = {
          unit_rate: rate,
          total_amount: totalAmount,
          has_rate_error: false,
          rate_error_message: null,
        };

        // Update description to remove RATE REQUIRED prefix
        if (event.description?.startsWith('RATE REQUIRED – ')) {
          updateData.description = event.description.replace('RATE REQUIRED – ', '');
        }

        // Add notes to metadata if provided
        if (rateNotes) {
          updateData.metadata = {
            ...(event.metadata || {}),
            rate_notes: rateNotes,
            rate_set_at: new Date().toISOString(),
          };
        }

        const { error } = await (supabase
          .from('billing_events') as any)
          .update(updateData)
          .eq('id', event.id);

        if (error) throw error;
      }

      toast({
        title: 'Rate Set Successfully',
        description: `Updated ${eventIds.length} billing line${eventIds.length !== 1 ? 's' : ''} with rate $${rate.toFixed(2)}`,
      });

      // Close dialog and refresh
      setSetRateDialogOpen(false);
      setRateAmount('');
      setRateNotes('');
      setPendingRateBillingEvents([]);
      setBillingRefreshKey(prev => prev + 1);
      fetchPendingRateBillingEvents();
    } catch (error: any) {
      console.error('Error saving rate:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save rate' });
    } finally {
      setSavingRate(false);
    }
  };

  useEffect(() => {
    fetchTask();
    fetchTaskItems();
  }, [fetchTask, fetchTaskItems]);

  // Fetch pending-rate events when task loads and is completed (for Safety Billing)
  useEffect(() => {
    if (task?.status === 'completed') {
      fetchPendingRateBillingEvents();
    }
  }, [task?.status, fetchPendingRateBillingEvents]);

  const handleStartTask = async () => {
    if (!id || !profile?.id || !profile?.tenant_id) return;
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
    if (!id || !profile?.id || !task || !profile?.tenant_id) return;

    // Inspection tasks require all items to have pass/fail status
    if (task.task_type === 'Inspection' && taskItems.length > 0) {
      const uninspectedItems = taskItems.filter(
        ti => !ti.item?.inspection_status || (ti.item.inspection_status !== 'pass' && ti.item.inspection_status !== 'fail')
      );
      if (uninspectedItems.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Inspection Incomplete',
          description: `All items must be marked Pass or Fail before completing. ${uninspectedItems.length} item${uninspectedItems.length !== 1 ? 's' : ''} remaining.`,
        });
        return;
      }
    }

    setActionLoading(true);
    try {
      // Phase 5B: Validate task completion requirements (client-side)
      const phase5bValidation = await validateTaskCompletion(
        profile.tenant_id,
        id,
        task.task_type
      );

      if (!phase5bValidation.canComplete) {
        // Show blocking dialog with validation issues
        setCompletionValidationResult(phase5bValidation);
        setCompletionBlockedOpen(true);
        setActionLoading(false);
        return;
      }

      // SOP Hard Gate: Call RPC to validate task completion
      const { data: sopValidationResult, error: rpcError } = await supabase.rpc('validate_task_completion', {
        p_task_id: id,
      });

      if (rpcError) {
        console.error('SOP validation RPC error:', rpcError);
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Failed to validate task requirements. Please try again.',
        });
        setActionLoading(false);
        return;
      }

      // Cast to expected shape
      const result = sopValidationResult as { ok: boolean; blockers: { code: string; message: string; severity: string }[]; task_type: string } | null;

      // Filter blockers to only include those with severity "blocking" (or all if no severity field)
      const blockers = (result?.blockers || []).filter(
        (b) => b.severity === 'blocking' || !b.severity
      );

      if (!result?.ok && blockers.length > 0) {
        // Block completion and show modal
        setValidationBlockers(blockers);
        setValidationOpen(true);
        setActionLoading(false);
        return;
      }

      // All validations passed — complete with primary_service_code billing
      try {
        const success = await completeTaskWithServices(id, []);
        if (success) {
          fetchTask();
          fetchTaskItems();
        }
      } finally {
        setActionLoading(false);
      }
    } catch (error) {
      console.error('Error completing task:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to complete task' });
      setActionLoading(false);
    }
  };

  const handleUnableToComplete = async (note: string) => {
    if (!id || !profile?.id || !profile?.tenant_id) return false;
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

      // For Repair tasks: send unrepairable item alert (damage/quarantine remain)
      if (task?.task_type === 'Repair') {
        const itemCodes = taskItems
          .map(ti => ti.item?.item_code)
          .filter(Boolean) as string[];

        await queueRepairUnableToCompleteAlert(
          profile.tenant_id,
          id,
          itemCodes.length > 0 ? itemCodes : ['Unknown'],
          note,
          task.account?.account_name
        );
      }

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
      // Update inspection_status; if fail, also set has_damage
      const updateData: Record<string, any> = { inspection_status: result };
      if (result === 'fail') {
        updateData.has_damage = true;
      } else if (result === 'pass') {
        // Passing clears any previous damage flag set by inspection
        updateData.has_damage = false;
      }

      const { error } = await (supabase.from('items') as any)
        .update(updateData)
        .eq('id', itemId);
      if (error) throw error;

      // Update local state
      setTaskItems(prev => prev.map(ti =>
        ti.item_id === itemId
          ? { ...ti, item: ti.item ? { ...ti.item, inspection_status: result } : ti.item }
          : ti
      ));

      toast({ title: `Item ${result === 'pass' ? 'Passed' : 'Failed'}` });

      // If item failed inspection, trigger auto-repair and auto-quarantine automations
      if (result === 'fail' && task?.account_id && profile?.tenant_id) {
        triggerDamageAutomations(itemId, task.account_id);
      }

      // Refresh task items to get updated data
      fetchTaskItems();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save inspection result' });
    }
  };

  // Trigger auto-repair and auto-quarantine automations when item fails inspection
  const triggerDamageAutomations = async (itemId: string, accountId: string) => {
    if (!profile?.tenant_id || !task) return;

    try {
      // Fetch account automation settings
      const { data: account } = await (supabase
        .from('accounts') as any)
        .select('auto_repair_on_damage, auto_quarantine_damaged_items')
        .eq('id', accountId)
        .single();

      // Fetch tenant preferences for auto_repair_on_damage
      const { data: tenantPreferences } = await (supabase
        .from('tenant_preferences') as any)
        .select('auto_repair_on_damage')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();

      const shouldCreateRepair = tenantPreferences?.auto_repair_on_damage || account?.auto_repair_on_damage;
      const shouldQuarantine = account?.auto_quarantine_damaged_items;

      // Get item info for task creation
      const { data: itemData } = await (supabase
        .from('items') as any)
        .select('item_code, description')
        .eq('id', itemId)
        .single();

      // Auto Repair on Damage: create a Repair task
      if (shouldCreateRepair && itemData) {
        // Copy inspection photos and notes to the repair task
        const inspectionPhotos = photos || [];
        const inspectionNotes = taskNotes || '';

        // Resolve repair task type with precedence (account → org → fallback)
        const repairTaskTypeId = await resolveRepairTaskTypeId({
          tenantId: profile.tenant_id,
          accountId,
          purpose: 'damage',
        });

        if (!repairTaskTypeId) {
          console.warn('[triggerDamageAutomations] No repair task type available; skipping repair task creation');
          toast({
            title: 'Damage Detected',
            description: 'Could not create repair task (no repair type configured)',
          });
          return;
        }

        // Fetch the resolved task type details
        const repairType = await fetchRepairTaskTypeDetails(repairTaskTypeId);
        if (!repairType) {
          console.error(`[triggerDamageAutomations] Task type ${repairTaskTypeId} not found after resolution`);
          return;
        }

        const { data: repairTask } = await (supabase
          .from('tasks') as any)
          .insert({
            tenant_id: profile.tenant_id,
            title: `Repair: ${itemData.description || itemData.item_code}`,
            description: inspectionNotes ? `Inspection Notes:\n${inspectionNotes}` : null,
            task_type: repairType.name,
            task_type_id: repairType.id,
            status: 'pending',
            priority: 'high',
            account_id: accountId,
            warehouse_id: task.warehouse_id,
            parent_task_id: task.id,
            metadata: inspectionPhotos.length > 0 ? { photos: inspectionPhotos } : null,
          })
          .select('id')
          .single();

        if (repairTask) {
          // Link item to repair task
          await (supabase
            .from('task_items') as any)
            .insert({
              task_id: repairTask.id,
              item_id: itemId,
            });

          // Update item's repair_status
          await (supabase
            .from('items') as any)
            .update({ repair_status: 'pending' })
            .eq('id', itemId);

          toast({
            title: 'Repair Task Created',
            description: `Auto-repair task created for ${itemData.item_code}`,
          });
        }
      }

      // Auto Quarantine Damaged Items: apply quarantine indicator flag
      if (shouldQuarantine) {
        await applyQuarantineFlag(itemId, itemData?.item_code || 'Unknown');
      }
    } catch (error) {
      console.error('Error triggering damage automations:', error);
      // Don't block the inspection result - automations are best-effort
    }
  };

  // Apply quarantine indicator flag to an item
  const applyQuarantineFlag = async (itemId: string, itemCode: string) => {
    if (!profile?.tenant_id) return;

    try {
      // Look up the Quarantine flag charge type
      const { data: quarantineFlag } = await (supabase
        .from('charge_types') as any)
        .select('id, charge_code')
        .eq('tenant_id', profile.tenant_id)
        .eq('add_flag', true)
        .eq('flag_is_indicator', true)
        .ilike('charge_name', '%quarantine%')
        .maybeSingle();

      if (!quarantineFlag) {
        // No quarantine flag configured in the system - skip silently
        console.warn('No Quarantine indicator flag found in charge_types. Skipping auto-quarantine.');
        return;
      }

      // Check if already applied
      const { data: existing } = await (supabase
        .from('item_flags') as any)
        .select('id')
        .eq('item_id', itemId)
        .eq('service_code', quarantineFlag.charge_code)
        .maybeSingle();

      if (existing) return; // Already quarantined

      // Apply the flag
      await (supabase
        .from('item_flags') as any)
        .insert({
          tenant_id: profile.tenant_id,
          item_id: itemId,
          charge_type_id: quarantineFlag.id,
          service_code: quarantineFlag.charge_code,
          created_by: profile.id,
        });

      // Log activity
      logItemActivity({
        tenantId: profile.tenant_id,
        itemId,
        actorUserId: profile.id,
        eventType: 'indicator_applied',
        eventLabel: 'Quarantine applied (auto - inspection failed)',
        details: { service_code: quarantineFlag.charge_code, reason: 'inspection_failed', automated: true },
      });

      toast({
        title: 'Item Quarantined',
        description: `${itemCode} has been quarantined due to failed inspection`,
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error applying quarantine flag:', error);
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

  // Handler for TaggablePhotoGrid - saves with metadata
  const handlePhotosChange = async (newPhotos: TaggablePhoto[]) => {
    const previousPhotos = photos;
    setPhotos(newPhotos);
    if (!id || !task) return;
    try {
      // Merge with existing metadata, storing photos in metadata.photos
      const updatedMetadata = { ...(task.metadata || {}), photos: newPhotos };
      const { error } = await (supabase.from('tasks') as any)
        .update({ metadata: updatedMetadata })
        .eq('id', id);

      if (error) throw error;
      // Update local task state with new metadata
      setTask(prev => prev ? { ...prev, metadata: updatedMetadata } : prev);
    } catch (error) {
      console.error('Error saving photos:', error);
      // Revert on error
      setPhotos(previousPhotos);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save photos. Please try again.',
      });
    }
  };

  // Handler for PhotoScanner/Upload - converts URLs to TaggablePhoto format
  const handlePhotoUrlsAdded = async (urls: string[]) => {
    const newTaggablePhotos: TaggablePhoto[] = urls.map(url => ({
      url,
      isPrimary: false,
      needsAttention: false,
      isRepair: false,
    }));

    // Keep existing photos (with their tags), add new ones
    const existingUrls = getPhotoUrls(photos);
    const trulyNewPhotos = newTaggablePhotos.filter(p => !existingUrls.includes(p.url));

    if (trulyNewPhotos.length === 0) return;

    // Merge existing (normalized) with new
    const normalizedExisting: TaggablePhoto[] = photos.map(p =>
      typeof p === 'string'
        ? { url: p, isPrimary: false, needsAttention: false, isRepair: false }
        : p
    );
    const allPhotos = [...normalizedExisting, ...trulyNewPhotos];

    const previousPhotos = photos;
    setPhotos(allPhotos);

    if (!id || !task) return;
    try {
      // Merge with existing metadata, storing photos in metadata.photos
      const updatedMetadata = { ...(task.metadata || {}), photos: allPhotos };
      const { error } = await (supabase.from('tasks') as any)
        .update({ metadata: updatedMetadata })
        .eq('id', id);

      if (error) throw error;

      // Update local task state with new metadata
      setTask(prev => prev ? { ...prev, metadata: updatedMetadata } : prev);

      toast({
        title: 'Photos saved',
        description: `${trulyNewPhotos.length} photo(s) added.`,
      });
    } catch (error) {
      console.error('Error saving photos:', error);
      setPhotos(previousPhotos);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save photos. Please try again.',
      });
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <MaterialIcon name="arrow_back" size="md" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold">{task.title}</h1>
              <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">TSK-{task.id.slice(0, 8).toUpperCase()}</Badge>
                <StatusIndicator status={task.status} label={taskStatusLabels[task.status]} size="sm" />
                <StatusIndicator
                  status={task.priority === 'urgent' ? 'failed' : 'in_progress'}
                  label={task.priority === 'urgent' ? 'Urgent' : 'Normal'}
                  size="sm"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 self-start sm:self-center">
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <MaterialIcon name="edit" size="sm" className="mr-2" />
              Edit Task
            </Button>
            {/* Help button - workflow based on task type */}
            <HelpButton
              workflow={
                task.task_type === 'Inspection' ? 'inspection' :
                task.task_type === 'Assembly' ? 'assembly' :
                task.task_type === 'Repair' ? 'repair' : 'inspection'
              }
            />
          </div>
        </div>

        {/* Task Pending Banner */}
        {task.status === 'pending' && (
          <Card className="border-orange-500 dark:border-orange-400 bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 bg-orange-500 rounded-full" />
                  <span className="font-medium">Task pending</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setUnableDialogOpen(true)} disabled={actionLoading}>
                    <MaterialIcon name="cancel" size="sm" className="mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleStartTask} disabled={actionLoading}>
                    <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
                    Start {task.task_type}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task In Progress Banner - similar to Shipment receiving banner */}
        {task.status === 'in_progress' && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 bg-primary rounded-full animate-pulse" />
                  <span className="font-medium">{task.task_type} in progress</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setUnableDialogOpen(true)} disabled={actionLoading}>
                    <MaterialIcon name="cancel" size="sm" className="mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCompleteTask} disabled={actionLoading}>
                    <MaterialIcon name="check" size="sm" className="mr-2" />
                    Finish {task.task_type}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Action Buttons (when not pending or in_progress) */}
        {!['pending', 'in_progress'].includes(task.status) && (
          <div className="flex flex-wrap gap-2">
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
            {/* Add Credit Button - Admin Only */}
            {task.account_id && canAddCredit && (
              <Button
                variant="secondary"
                onClick={() => setAddCreditDialogOpen(true)}
              >
                <MaterialIcon name="money_off" size="sm" className="mr-2" />
                Add Credit
              </Button>
            )}
          </div>
        )}
        
        {/* Additional buttons for pending/in_progress tasks */}
        {['pending', 'in_progress'].includes(task.status) && (
          <div className="flex flex-wrap gap-2">
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
            {/* Add Credit Button - Admin Only */}
            {task.account_id && canAddCredit && (
              <Button
                variant="secondary"
                onClick={() => setAddCreditDialogOpen(true)}
              >
                <MaterialIcon name="money_off" size="sm" className="mr-2" />
                Add Credit
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
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
            {task.task_type === 'Inspection' && taskItems.length > 0 && (() => {
              const passedCount = taskItems.filter(ti => ti.item?.inspection_status === 'pass').length;
              const failedCount = taskItems.filter(ti => ti.item?.inspection_status === 'fail').length;
              const pendingCount = taskItems.filter(ti => !ti.item?.inspection_status).length;
              return (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">Inspection Summary:</span>
                      <div className="flex items-center gap-2">
                        {passedCount > 0 && <StatusIndicator status="pass" label={`${passedCount} Passed`} size="sm" />}
                        {failedCount > 0 && <StatusIndicator status="fail" label={`${failedCount} Failed`} size="sm" />}
                        {pendingCount > 0 && <StatusIndicator status="pending" label={`${pendingCount} Pending`} size="sm" />}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Items Table */}
            {taskItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MaterialIcon name="assignment" size="sm" />
                    Items ({taskItems.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
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
                                  <StatusIndicator status="pass" label="PASSED" size="sm" />
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/10 h-7 px-2"
                                    onClick={() => ti.item_id && handleItemInspectionResult(ti.item_id, 'pass')}
                                    disabled={task.status !== 'in_progress'}
                                  >
                                    <MaterialIcon name="check_circle" size="sm" />
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                {ti.item?.inspection_status === 'fail' ? (
                                  <StatusIndicator status="fail" label="FAILED" size="sm" />
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 h-7 px-2"
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
                    existingPhotos={getPhotoUrls(photos)}
                    maxPhotos={20}
                    onPhotosSaved={handlePhotoUrlsAdded}
                    size="sm"
                    label="Take Photos"
                    showCount={false}
                  />
                  <PhotoUploadButton
                    entityType="task"
                    entityId={task.id}
                    tenantId={task.tenant_id}
                    existingPhotos={getPhotoUrls(photos)}
                    maxPhotos={20}
                    onPhotosSaved={handlePhotoUrlsAdded}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {photos.length > 0 ? (
                  <TaggablePhotoGrid
                    photos={photos}
                    onPhotosChange={handlePhotosChange}
                    enableTagging={true}
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
                    context={{ type: 'task', taskId: task.id, title: task.title }}
                    onSuccess={() => {
                      setDocRefetchKey(prev => prev + 1);
                    }}
                    label="Scan"
                    size="sm"
                    directToCamera
                  />
                  <DocumentUploadButton
                    context={{ type: 'task', taskId: task.id, title: task.title }}
                    onSuccess={() => {
                      setDocRefetchKey(prev => prev + 1);
                    }}
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <DocumentList
                  contextType="task"
                  contextId={task.id}
                  refetchKey={docRefetchKey}
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

            {/* Task Activity */}
            <EntityActivityFeed entityType="task" entityId={task.id} title="Activity" description="Billing and operational activity for this task" />

            {/* Task History */}
            <TaskHistoryTab taskId={task.id} />
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6 min-w-0">
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

            {/* Safety Billing: Set Task Rate Card - Shows when there are pending-rate billing events */}
            {canSeeBilling && task.status === 'completed' && pendingRateBillingEvents.length > 0 && (
              <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                    <MaterialIcon name="warning" size="sm" className="text-red-600" />
                    Rate Required
                  </CardTitle>
                  <CardDescription className="text-red-700 dark:text-red-300">
                    This task has {pendingRateBillingEvents.length} billing line{pendingRateBillingEvents.length !== 1 ? 's' : ''} without a rate set.
                    Set the rate before invoicing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    onClick={() => setSetRateDialogOpen(true)}
                    className="w-full"
                    variant="destructive"
                  >
                    <MaterialIcon name="attach_money" size="sm" className="mr-2" />
                    Set Task Rate
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Billing Charges - Manager/Admin Only */}
            {canSeeBilling && task.account_id && (
              <BillingCalculator
                taskId={task.id}
                taskType={task.task_type}
                taskTypeId={task.task_type_id}
                refreshKey={billingRefreshKey}
                title="Billing Calculator"
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

      {/* Add Credit Dialog - Admin Only */}
      {task.account_id && (
        <AddCreditDialog
          open={addCreditDialogOpen}
          onOpenChange={setAddCreditDialogOpen}
          accountId={task.account_id}
          accountName={task.account?.account_name}
          taskId={task.id}
          onSuccess={() => {
            fetchTask();
            setBillingRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {/* Task Completion Blocked Dialog (Phase 5B) */}
      <TaskCompletionBlockedDialog
        open={completionBlockedOpen}
        onOpenChange={setCompletionBlockedOpen}
        validationResult={completionValidationResult}
      />

      {/* SOP Validation Blockers Modal */}
      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <MaterialIcon name="block" size="md" />
              Can't Complete Task Yet
            </DialogTitle>
            <DialogDescription>
              Fix the items below, then try again.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-2">
              {validationBlockers.map((blocker, index) => (
                <div
                  key={`${blocker.code}-${index}`}
                  className="flex items-start gap-3 p-3 border rounded-lg bg-muted/50"
                >
                  <MaterialIcon name="error" size="sm" className="text-destructive mt-0.5 shrink-0" />
                  <span className="text-sm">{blocker.message}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setValidationOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Task Rate Dialog (Safety Billing) */}
      <Dialog open={setRateDialogOpen} onOpenChange={setSetRateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MaterialIcon name="attach_money" size="md" className="text-primary" />
              Set Task Rate
            </DialogTitle>
            <DialogDescription>
              Set the billing rate for this {task?.task_type} task.
              This will update {pendingRateBillingEvents.length} pending billing line{pendingRateBillingEvents.length !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Linked Items Display */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Linked Items</Label>
              {taskItems.length > 0 ? (
                <div className="bg-muted rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                  {taskItems.map((ti) => (
                    <div key={ti.id} className="text-sm flex justify-between items-center">
                      <span className="font-mono font-medium">{ti.item?.item_code || 'Unknown'}</span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="truncate max-w-[150px]">{ti.item?.description || '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground text-center">
                  No linked items
                </div>
              )}
            </div>

            {/* Rate Input */}
            <div className="space-y-2">
              <Label htmlFor="rate_amount">Rate Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="rate_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={rateAmount}
                  onChange={(e) => setRateAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This rate will be applied to all {pendingRateBillingEvents.length} billing line{pendingRateBillingEvents.length !== 1 ? 's' : ''} for this task.
              </p>
            </div>

            {/* Billing Preview */}
            {rateAmount && parseFloat(rateAmount) > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Billing Preview</p>
                {pendingRateBillingEvents.map((event, idx) => {
                  const qty = event.quantity || 1;
                  const total = parseFloat(rateAmount) * qty;
                  return (
                    <div key={event.id} className="flex justify-between text-sm mt-1 text-blue-700 dark:text-blue-300">
                      <span>{event.charge_type} × {qty}</span>
                      <span className="font-medium">${total.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between font-medium text-blue-800 dark:text-blue-200">
                  <span>Total</span>
                  <span>
                    ${pendingRateBillingEvents.reduce((sum, e) => sum + parseFloat(rateAmount) * (e.quantity || 1), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="rate_notes">Notes (optional)</Label>
              <Textarea
                id="rate_notes"
                placeholder="Add any notes about this rate..."
                value={rateNotes}
                onChange={(e) => setRateNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/reports?tab=billing')}
              className="sm:mr-auto"
            >
              <MaterialIcon name="open_in_new" size="sm" className="mr-2" />
              View in Billing Report
            </Button>
            <Button
              variant="outline"
              onClick={() => setSetRateDialogOpen(false)}
              disabled={savingRate}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRate}
              disabled={savingRate || !rateAmount || parseFloat(rateAmount) <= 0}
            >
              {savingRate && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Save Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
