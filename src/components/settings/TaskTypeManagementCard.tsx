/**
 * TaskTypeManagementCard - Manage task types with category-first service mapping
 *
 * Features:
 * - List all task types with category, service, requires_items, active
 * - Create new task types
 * - Edit existing task types
 * - Category-first service selection (service dropdown filtered by category)
 * - Activate/deactivate task types
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface TaskType {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  billing_service_code: string | null;
  category_id: string | null;
  default_service_code: string | null;
  requires_items: boolean;
  allow_rate_override: boolean;
}

interface ServiceCode {
  service_code: string;
  service_name: string;
  category_id: string | null;
}

interface TaskTypeFormData {
  name: string;
  description: string;
  category_id: string | null;
  default_service_code: string | null;
  requires_items: boolean;
  allow_rate_override: boolean;
  is_active: boolean;
}

// ============================================================================
// Edit/Create Dialog Component
// ============================================================================

interface TaskTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType: TaskType | null;
  categories: Array<{ id: string; name: string }>;
  allServices: ServiceCode[];
  onSave: (data: TaskTypeFormData) => Promise<boolean>;
  saving: boolean;
}

function TaskTypeDialog({
  open,
  onOpenChange,
  taskType,
  categories,
  allServices,
  onSave,
  saving,
}: TaskTypeDialogProps) {
  const [formData, setFormData] = useState<TaskTypeFormData>({
    name: '',
    description: '',
    category_id: null,
    default_service_code: null,
    requires_items: true,
    allow_rate_override: true,
    is_active: true,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (taskType) {
        setFormData({
          name: taskType.name,
          description: taskType.description || '',
          category_id: taskType.category_id,
          default_service_code: taskType.default_service_code || taskType.billing_service_code,
          requires_items: taskType.requires_items ?? true,
          allow_rate_override: taskType.allow_rate_override ?? true,
          is_active: taskType.is_active,
        });
      } else {
        setFormData({
          name: '',
          description: '',
          category_id: null,
          default_service_code: null,
          requires_items: true,
          allow_rate_override: true,
          is_active: true,
        });
      }
    }
  }, [open, taskType]);

  // Filter services by selected category - DISTINCT service_codes only
  const filteredServices = useMemo(() => {
    if (!formData.category_id) {
      // If no category selected, show all unique services
      const unique = new Map<string, ServiceCode>();
      allServices.forEach(s => {
        if (!unique.has(s.service_code)) {
          unique.set(s.service_code, s);
        }
      });
      return Array.from(unique.values());
    }

    // Filter by category and dedupe
    const unique = new Map<string, ServiceCode>();
    allServices
      .filter(s => s.category_id === formData.category_id)
      .forEach(s => {
        if (!unique.has(s.service_code)) {
          unique.set(s.service_code, s);
        }
      });
    return Array.from(unique.values());
  }, [allServices, formData.category_id]);

  // When category changes, check if current service is still valid
  useEffect(() => {
    if (formData.category_id && formData.default_service_code) {
      const isValidService = filteredServices.some(
        s => s.service_code === formData.default_service_code
      );
      if (!isValidService) {
        setFormData(prev => ({ ...prev, default_service_code: null }));
      }
    }
  }, [formData.category_id, formData.default_service_code, filteredServices]);

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    const success = await onSave(formData);
    if (success) {
      onOpenChange(false);
    }
  };

  const isEditing = !!taskType;
  const isSystemTask = taskType?.is_system ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Task Type' : 'Add Task Type'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the task type configuration.'
              : 'Create a new task type with category and service mapping.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Task Type Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Assembly, Inspection"
              disabled={isSystemTask}
            />
            {isSystemTask && (
              <p className="text-xs text-muted-foreground">
                System task types cannot be renamed
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          {/* Category Selection (First) */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category_id || 'none'}
              onValueChange={(value) => setFormData({
                ...formData,
                category_id: value === 'none' ? null : value,
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No category</span>
                </SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select a category to filter available services
            </p>
          </div>

          {/* Service Selection (Second - filtered by category) */}
          <div className="space-y-2">
            <Label>Service Code</Label>
            <Select
              value={formData.default_service_code || 'none'}
              onValueChange={(value) => setFormData({
                ...formData,
                default_service_code: value === 'none' ? null : value,
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No billing (informational only)</span>
                </SelectItem>
                {filteredServices.map(service => (
                  <SelectItem key={service.service_code} value={service.service_code}>
                    <span className="font-mono text-xs mr-2">{service.service_code}</span>
                    <span className="text-muted-foreground">- {service.service_name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.category_id
                ? `Showing services in selected category (${filteredServices.length} available)`
                : 'Select a category first to filter services, or choose from all'}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-4 pt-2 border-t">
            <Label className="text-sm font-medium">Options</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_items"
                checked={formData.requires_items}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  requires_items: !!checked,
                })}
              />
              <div>
                <Label htmlFor="requires_items" className="cursor-pointer">
                  Requires Items
                </Label>
                <p className="text-xs text-muted-foreground">
                  Task must have items attached before billing
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow_rate_override"
                checked={formData.allow_rate_override}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  allow_rate_override: !!checked,
                })}
              />
              <div>
                <Label htmlFor="allow_rate_override" className="cursor-pointer">
                  Allow Rate Override
                </Label>
                <p className="text-xs text-muted-foreground">
                  Admins can override the rate for this task type
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  is_active: checked,
                })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
            {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Task Type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskTypeManagementCard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { activeCategories, getCategoryName } = useServiceCategories();

  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [serviceCodes, setServiceCodes] = useState<ServiceCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaskType, setEditingTaskType] = useState<TaskType | null>(null);

  // Filter state
  const [showInactive, setShowInactive] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      // Fetch task types
      const { data: taskTypesData, error: taskTypesError } = await (supabase
        .from('task_types') as any)
        .select('id, tenant_id, name, description, is_system, is_active, sort_order, billing_service_code, category_id, default_service_code, requires_items, allow_rate_override')
        .eq('tenant_id', profile.tenant_id)
        .order('sort_order')
        .order('name');

      if (taskTypesError) throw taskTypesError;

      // Fetch all active service codes (with category_id for filtering)
      const { data: serviceCodesData, error: serviceCodesError } = await supabase
        .from('service_events')
        .select('service_code, service_name, category_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('service_code');

      if (serviceCodesError) throw serviceCodesError;

      // Deduplicate service codes (ignore class_code rows)
      const uniqueServices = new Map<string, ServiceCode>();
      (serviceCodesData || []).forEach(s => {
        if (!uniqueServices.has(s.service_code)) {
          uniqueServices.set(s.service_code, {
            service_code: s.service_code,
            service_name: s.service_name,
            category_id: s.category_id,
          });
        }
      });

      setTaskTypes(taskTypesData || []);
      setServiceCodes(Array.from(uniqueServices.values()));
    } catch (error) {
      console.error('Error fetching task types:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load task types',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter task types
  const filteredTaskTypes = useMemo(() => {
    if (showInactive) {
      return taskTypes;
    }
    return taskTypes.filter(t => t.is_active);
  }, [taskTypes, showInactive]);

  // Handle create new
  const handleCreate = () => {
    setEditingTaskType(null);
    setDialogOpen(true);
  };

  // Handle edit
  const handleEdit = (taskType: TaskType) => {
    setEditingTaskType(taskType);
    setDialogOpen(true);
  };

  // Handle save
  const handleSave = async (data: TaskTypeFormData): Promise<boolean> => {
    if (!profile?.tenant_id) return false;

    setSaving(true);
    try {
      if (editingTaskType) {
        // Update existing
        const updateData: any = {
          description: data.description || null,
          category_id: data.category_id,
          default_service_code: data.default_service_code,
          billing_service_code: data.default_service_code, // Keep in sync for backward compat
          requires_items: data.requires_items,
          allow_rate_override: data.allow_rate_override,
          is_active: data.is_active,
        };

        // Only update name if not system task
        if (!editingTaskType.is_system) {
          updateData.name = data.name.trim();
        }

        const { error } = await (supabase
          .from('task_types') as any)
          .update(updateData)
          .eq('id', editingTaskType.id);

        if (error) throw error;

        toast({
          title: 'Task Type Updated',
          description: `"${data.name}" has been updated.`,
        });
      } else {
        // Create new
        const { error } = await (supabase
          .from('task_types') as any)
          .insert({
            tenant_id: profile.tenant_id,
            name: data.name.trim(),
            description: data.description || null,
            category_id: data.category_id,
            default_service_code: data.default_service_code,
            billing_service_code: data.default_service_code,
            requires_items: data.requires_items,
            allow_rate_override: data.allow_rate_override,
            is_active: data.is_active,
            is_system: false,
            sort_order: taskTypes.length + 1,
          });

        if (error) throw error;

        toast({
          title: 'Task Type Created',
          description: `"${data.name}" has been created.`,
        });
      }

      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error saving task type:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save task type',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (taskType: TaskType) => {
    try {
      const { error } = await (supabase
        .from('task_types') as any)
        .update({ is_active: !taskType.is_active })
        .eq('id', taskType.id);

      if (error) throw error;

      setTaskTypes(prev =>
        prev.map(t => t.id === taskType.id ? { ...t, is_active: !t.is_active } : t)
      );

      toast({
        title: taskType.is_active ? 'Task Type Deactivated' : 'Task Type Activated',
        description: `"${taskType.name}" has been ${taskType.is_active ? 'deactivated' : 'activated'}.`,
      });
    } catch (error) {
      console.error('Error toggling task type:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update task type',
      });
    }
  };

  // Get service name by code
  const getServiceName = (code: string | null): string => {
    if (!code) return '';
    const service = serviceCodes.find(s => s.service_code === code);
    return service?.service_name || code;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MaterialIcon name="assignment" size="md" className="text-primary" />
            <div>
              <CardTitle className="text-lg">Task Type Management</CardTitle>
              <CardDescription>
                Configure task types with category and service mappings.
                The rate is looked up from the Price List based on item class.
              </CardDescription>
            </div>
          </div>
          <Button onClick={handleCreate}>
            <MaterialIcon name="add" size="sm" className="mr-2" />
            Add Task Type
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showInactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(!!checked)}
            />
            <Label htmlFor="showInactive" className="cursor-pointer text-sm">
              Show inactive
            </Label>
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredTaskTypes.length} task type{filteredTaskTypes.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-center w-28">Requires Items</TableHead>
              <TableHead className="text-center w-20">Active</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTaskTypes.map(taskType => {
              const serviceCode = taskType.default_service_code || taskType.billing_service_code;
              const categoryName = getCategoryName(taskType.category_id);

              return (
                <TableRow
                  key={taskType.id}
                  className={cn(!taskType.is_active && 'opacity-50')}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{taskType.name}</span>
                      {taskType.is_system && (
                        <Badge variant="outline" className="text-xs">System</Badge>
                      )}
                    </div>
                    {taskType.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{taskType.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {categoryName ? (
                      <Badge variant="secondary">{categoryName}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {serviceCode ? (
                      <div>
                        <Badge variant="outline" className="font-mono text-xs">
                          {serviceCode}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-2">
                          {getServiceName(serviceCode)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">No billing</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {taskType.requires_items ? (
                      <MaterialIcon name="check" size="sm" className="text-green-600" />
                    ) : (
                      <MaterialIcon name="remove" size="sm" className="text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={taskType.is_active ? 'default' : 'secondary'}>
                      {taskType.is_active ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(taskType)}
                            >
                              <MaterialIcon name="edit" size="sm" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleActive(taskType)}
                            >
                              <MaterialIcon
                                name={taskType.is_active ? 'visibility_off' : 'visibility'}
                                size="sm"
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {taskType.is_active ? 'Deactivate' : 'Activate'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredTaskTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {showInactive
                    ? 'No task types found.'
                    : 'No active task types found. Check "Show inactive" to see all.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit/Create Dialog */}
      <TaskTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        taskType={editingTaskType}
        categories={activeCategories}
        allServices={serviceCodes}
        onSave={handleSave}
        saving={saving}
      />
    </Card>
  );
}
