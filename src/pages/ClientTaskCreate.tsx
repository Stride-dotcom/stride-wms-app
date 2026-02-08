import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';
import { useClientPortalContext, useClientItems } from '@/hooks/useClientPortal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';

const TASK_TYPES = [
  'Delivery',
  'Pick Up',
  'Will Call',
  'Inspection',
  'Repair',
  'Assembly',
  'Disposal',
  'Custom',
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const;

interface LocationState {
  itemIds?: string[];
  accountId?: string;
}

export default function ClientTaskCreate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { portalUser, account, tenant, isLoading: contextLoading } = useClientPortalContext();
  const { data: allItems = [] } = useClientItems();

  const state = (location.state as LocationState) || {};
  const itemIds = state.itemIds || [];
  const accountId = state.accountId || portalUser?.account_id || '';

  const [taskType, setTaskType] = useState<string>('');
  const [priority, setPriority] = useState<string>('medium');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Resolve item codes for the selected items
  const selectedItems = allItems.filter((item: any) => itemIds.includes(item.id));

  const userName = portalUser?.first_name
    ? `${portalUser.first_name} ${portalUser.last_name || ''}`.trim()
    : portalUser?.email || 'User';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskType) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a task type.',
      });
      return;
    }

    if (!portalUser?.tenant_id || !accountId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Missing account or tenant information.',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Build a descriptive title
      const itemCount = itemIds.length;
      const title = itemCount > 0
        ? `${taskType} - ${itemCount} item${itemCount !== 1 ? 's' : ''} (Client Request)`
        : `${taskType} (Client Request)`;

      // Insert the task
      const { data: task, error: taskError } = await (supabase
        .from('tasks') as any)
        .insert({
          tenant_id: portalUser.tenant_id,
          account_id: accountId,
          task_type: taskType,
          title,
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
          status: 'pending',
          metadata: {
            client_portal_request: true,
            requested_by_email: portalUser.email,
            requested_by_name: userName,
          },
        })
        .select()
        .single();

      if (taskError) {
        throw taskError;
      }

      // Link items to the task via task_items junction table
      if (itemIds.length > 0 && task) {
        const taskItems = itemIds.map((itemId: string) => ({
          task_id: task.id,
          item_id: itemId,
        }));

        const { error: itemsError } = await (supabase
          .from('task_items') as any)
          .insert(taskItems);

        if (itemsError) {
          console.error('Failed to link items to task:', itemsError);
          // Non-blocking: task was created successfully, just items failed to link
        }
      }

      toast({
        title: 'Task Submitted',
        description: 'Your task request has been submitted to the warehouse team.',
      });

      navigate('/client/items');
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Submit Task',
        description: error?.message || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (contextLoading) {
    return (
      <ClientPortalLayout>
        <div className="flex items-center justify-center h-64">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout
      accountName={account?.name}
      warehouseName={tenant?.name}
      userName={userName}
    >
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Link to="/client/items">
            <Button variant="ghost" size="icon">
              <MaterialIcon name="arrow_back" size="sm" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create Task Request</h1>
            <p className="text-muted-foreground">
              Submit a task for the warehouse team to complete
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task Type */}
              <div className="space-y-2">
                <Label htmlFor="taskType">Task Type <span className="text-destructive">*</span></Label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger id="taskType">
                    <SelectValue placeholder="Select a task type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description / Notes</Label>
                <Textarea
                  id="description"
                  placeholder="Provide any additional details or instructions for the warehouse team..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="dueDate">Requested Due Date (optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Selected Items Summary */}
              {itemIds.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Items ({itemIds.length})</Label>
                  <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                    {selectedItems.length > 0 ? (
                      selectedItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="px-3 py-2 text-sm flex items-center gap-2"
                        >
                          <MaterialIcon name="inventory_2" size="sm" className="text-muted-foreground" />
                          <span className="font-medium">{item.item_code}</span>
                          {item.description && (
                            <span className="text-muted-foreground truncate">
                              - {item.description}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {itemIds.length} item{itemIds.length !== 1 ? 's' : ''} selected
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Link to="/client/items">
                  <Button type="button" variant="outline" disabled={submitting}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={submitting || !taskType}>
                  {submitting ? (
                    <>
                      <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="send" size="sm" className="mr-2" />
                      Submit Task
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </ClientPortalLayout>
  );
}
