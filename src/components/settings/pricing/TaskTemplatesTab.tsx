import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { LabelWithTooltip } from '@/components/ui/label-with-tooltip';
import { fieldDescriptions } from '@/lib/pricing/fieldDescriptions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useChargeTypes, type ChargeType } from '@/hooks/useChargeTypes';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface TaskType {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_billable: boolean;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
}

interface TaskTypeChargeLink {
  id: string;
  task_type_id: string;
  charge_type_id: string;
  scope: string;
  auto_calculate: boolean;
  sort_order: number;
}

interface TaskTemplateWithLinks extends TaskType {
  links: (TaskTypeChargeLink & { charge_type?: ChargeType })[];
}

// =============================================================================
// HOOK — with stable dependencies to avoid infinite loops
// =============================================================================

function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplateWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const { chargeTypes } = useChargeTypes();

  // Use refs to avoid stale closures without adding to dependency arrays
  const chargeTypesRef = useRef(chargeTypes);
  chargeTypesRef.current = chargeTypes;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const fetchTemplates = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      setError(null);

      const { data: taskTypes, error: ttError } = await (supabase as any)
        .from('task_types')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name');

      if (ttError) {
        if (ttError.code === '42P01') {
          setTemplates([]);
          return;
        }
        throw ttError;
      }

      if (!taskTypes || taskTypes.length === 0) {
        setTemplates([]);
        return;
      }

      const taskTypeIds = taskTypes.map((tt: TaskType) => tt.id);
      let links: TaskTypeChargeLink[] = [];

      try {
        const { data: linksData, error: linksError } = await (supabase as any)
          .from('task_type_charge_links')
          .select('*')
          .in('task_type_id', taskTypeIds)
          .order('sort_order');

        if (linksError && linksError.code !== '42P01') {
          throw linksError;
        }
        links = (linksData || []) as TaskTypeChargeLink[];
      } catch {
        links = [];
      }

      const currentChargeTypes = chargeTypesRef.current;
      const combined: TaskTemplateWithLinks[] = (taskTypes as TaskType[]).map(tt => ({
        ...tt,
        links: links
          .filter(l => l.task_type_id === tt.id)
          .map(l => ({
            ...l,
            charge_type: currentChargeTypes.find(ct => ct.id === l.charge_type_id),
          })),
      }));

      setTemplates(combined);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      toastRef.current({ variant: 'destructive', title: 'Error loading templates', description: message });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Re-merge charge types when they load (without re-fetching from DB)
  useEffect(() => {
    if (chargeTypes.length > 0 && templates.length > 0) {
      setTemplates(prev => prev.map(tt => ({
        ...tt,
        links: tt.links.map(l => ({
          ...l,
          charge_type: chargeTypes.find(ct => ct.id === l.charge_type_id),
        })),
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeTypes.length]);

  const createTemplate = async (data: {
    name: string;
    description?: string;
    is_billable: boolean;
    is_active: boolean;
  }): Promise<TaskType | null> => {
    if (!profile?.tenant_id) return null;
    try {
      const { data: result, error } = await (supabase as any)
        .from('task_types')
        .insert({
          tenant_id: profile.tenant_id,
          name: data.name,
          description: data.description || null,
          is_billable: data.is_billable,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      toastRef.current({ title: 'Template created', description: `Created "${data.name}"` });
      await fetchTemplates();
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastRef.current({ variant: 'destructive', title: 'Error', description: message });
      return null;
    }
  };

  const updateTemplate = async (id: string, data: Partial<{
    name: string;
    description: string | null;
    is_billable: boolean;
    is_active: boolean;
  }>): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('task_types')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      toastRef.current({ title: 'Template updated' });
      await fetchTemplates();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastRef.current({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      // Delete links first
      await (supabase as any)
        .from('task_type_charge_links')
        .delete()
        .eq('task_type_id', id);

      const { error } = await (supabase as any)
        .from('task_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toastRef.current({ title: 'Template deleted' });
      await fetchTemplates();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastRef.current({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const replaceLinks = async (taskTypeId: string, chargeTypeIds: string[]): Promise<boolean> => {
    if (!profile?.tenant_id) return false;
    try {
      await (supabase as any)
        .from('task_type_charge_links')
        .delete()
        .eq('task_type_id', taskTypeId);

      if (chargeTypeIds.length > 0) {
        const inserts = chargeTypeIds.map((ctId, idx) => ({
          tenant_id: profile.tenant_id,
          task_type_id: taskTypeId,
          charge_type_id: ctId,
          scope: 'per_item',
          auto_calculate: true,
          sort_order: idx + 1,
        }));
        const { error } = await (supabase as any)
          .from('task_type_charge_links')
          .insert(inserts);
        if (error) throw error;
      }

      await fetchTemplates();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      toastRef.current({ variant: 'destructive', title: 'Error saving services', description: message });
      return false;
    }
  };

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    replaceLinks,
  };
}

// =============================================================================
// TASK TEMPLATES TAB
// =============================================================================

type FilterType = 'all' | 'billable' | 'non-billable';

export function TaskTemplatesTab() {
  const {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    replaceLinks,
  } = useTaskTemplates();
  const { chargeTypes } = useChargeTypes();

  const [filter, setFilter] = useState<FilterType>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplateWithLinks | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TaskTemplateWithLinks | null>(null);

  const filtered = templates.filter(t => {
    if (filter === 'billable') return t.is_billable;
    if (filter === 'non-billable') return !t.is_billable;
    return true;
  });

  const handleSaveTemplate = async (
    data: { name: string; description: string | null; is_billable: boolean; is_active: boolean },
    serviceIds: string[]
  ) => {
    if (editingTemplate) {
      const ok = await updateTemplate(editingTemplate.id, data);
      if (ok) {
        await replaceLinks(editingTemplate.id, serviceIds);
        setDialogOpen(false);
      }
    } else {
      const result = await createTemplate(data);
      if (result) {
        await replaceLinks(result.id, serviceIds);
        setDialogOpen(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <MaterialIcon name="error" size="xl" className="text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Failed to load templates</h3>
        <p className="text-muted-foreground mb-4 max-w-sm">{error}</p>
        <p className="text-xs text-muted-foreground mb-4">
          This may happen if the task_types table hasn't been set up yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Preconfigured service bundles for common task workflows. When a task uses a template, linked services are automatically added.
          </p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setDialogOpen(true); }} className="w-full sm:w-auto">
          <MaterialIcon name="add" size="sm" className="mr-1.5" />
          Add Template
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'billable', 'non-billable'] as FilterType[]).map((f) => (
          <button
            key={f}
            className={cn(
              'px-3 py-1 rounded-full text-sm transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'billable' ? 'Billable' : 'Non-Billable'}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MaterialIcon name="assignment" size="xl" className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No task templates</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create templates to define which services are automatically added to tasks.
          </p>
          <Button onClick={() => { setEditingTemplate(null); setDialogOpen(true); }}>
            <MaterialIcon name="add" size="sm" className="mr-1.5" />
            Add First Template
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No templates match the current filter.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((template) => (
            <AccordionItem key={template.id} value={template.id} className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3 flex-1 text-left">
                  <span className="font-medium text-sm">{template.name}</span>
                  <Badge variant={template.is_billable ? 'default' : 'secondary'} className="text-xs">
                    {template.is_billable ? 'Billable' : 'Non-Billable'}
                  </Badge>
                  {!template.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto mr-2">
                    {template.links.length > 0
                      ? `${template.links.length} service${template.links.length !== 1 ? 's' : ''}`
                      : 'No services'}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 pt-2">
                  {template.description && (
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  )}

                  {/* Linked services */}
                  {template.links.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No services linked — legacy billing on task completion</p>
                  ) : (
                    <div className="space-y-1">
                      {template.links.map((link, idx) => (
                        <div key={link.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-muted/50 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                            {link.charge_type ? (
                              <>
                                <Badge variant="outline" className="font-mono text-xs">{link.charge_type.charge_code}</Badge>
                                <span>{link.charge_type.charge_name}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground italic">Unknown service</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{link.scope}</Badge>
                            <Badge variant={link.auto_calculate ? 'default' : 'secondary'} className="text-xs">
                              {link.auto_calculate ? 'Auto' : 'Manual'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => { setEditingTemplate(template); setDialogOpen(true); }}>
                      <MaterialIcon name="edit" size="sm" className="mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(template)}>
                      <MaterialIcon name="delete" size="sm" className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Template Dialog — with integrated service assignment */}
      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        chargeTypes={chargeTypes}
        onSave={handleSaveTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This will also remove all linked services.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteConfirm) {
                  await deleteTemplate(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// TEMPLATE DIALOG — with integrated service search & assignment
// =============================================================================

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TaskTemplateWithLinks | null;
  chargeTypes: ChargeType[];
  onSave: (
    data: { name: string; description: string | null; is_billable: boolean; is_active: boolean },
    serviceIds: string[]
  ) => Promise<void>;
}

function TemplateDialog({ open, onOpenChange, template, chargeTypes, onSave }: TemplateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [assignedServiceIds, setAssignedServiceIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  // Sync form state when dialog opens
  useEffect(() => {
    if (open && template) {
      setName(template.name);
      setDescription(template.description || '');
      setIsBillable(template.is_billable);
      setIsActive(template.is_active);
      setAssignedServiceIds(template.links.map(l => l.charge_type_id));
      setSearchQuery('');
      setShowServiceDropdown(false);
    } else if (open && !template) {
      setName('');
      setDescription('');
      setIsBillable(true);
      setIsActive(true);
      setAssignedServiceIds([]);
      setSearchQuery('');
      setShowServiceDropdown(false);
    }
  }, [open, template]);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && template) {
      setName(template.name);
      setDescription(template.description || '');
      setIsBillable(template.is_billable);
      setIsActive(template.is_active);
      setAssignedServiceIds(template.links.map(l => l.charge_type_id));
    } else if (isOpen) {
      setName('');
      setDescription('');
      setIsBillable(true);
      setIsActive(true);
      setAssignedServiceIds([]);
    }
    setSearchQuery('');
    setShowServiceDropdown(false);
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          description: description.trim() || null,
          is_billable: isBillable,
          is_active: isActive,
        },
        assignedServiceIds
      );
    } finally {
      setSaving(false);
    }
  };

  const addService = (chargeTypeId: string) => {
    if (!assignedServiceIds.includes(chargeTypeId)) {
      setAssignedServiceIds(prev => [...prev, chargeTypeId]);
    }
    setSearchQuery('');
    setShowServiceDropdown(false);
  };

  const removeService = (chargeTypeId: string) => {
    setAssignedServiceIds(prev => prev.filter(id => id !== chargeTypeId));
  };

  // Filter charge types for search dropdown
  const availableServices = chargeTypes.filter(ct =>
    ct.is_active &&
    !assignedServiceIds.includes(ct.id) &&
    (searchQuery === '' ||
      ct.charge_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ct.charge_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const assignedServices = assignedServiceIds
    .map(id => chargeTypes.find(ct => ct.id === id))
    .filter((ct): ct is ChargeType => ct !== undefined);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Add Template'}</DialogTitle>
          <DialogDescription>
            {template ? 'Update the template details and assigned services.' : 'Create a new task template with linked services.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div className="space-y-2">
            <LabelWithTooltip htmlFor="tmplName" tooltip={fieldDescriptions.templateName} required>
              Template Name
            </LabelWithTooltip>
            <Input
              id="tmplName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard Inspection"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <LabelWithTooltip htmlFor="tmplDesc" tooltip={fieldDescriptions.templateDescription}>
              Description
            </LabelWithTooltip>
            <Textarea
              id="tmplDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center justify-between">
            <LabelWithTooltip tooltip={fieldDescriptions.templateBillable}>Billable</LabelWithTooltip>
            <Switch checked={isBillable} onCheckedChange={setIsBillable} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* ============================================================ */}
          {/* ASSIGNED SERVICES SECTION                                     */}
          {/* ============================================================ */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-3 block">Assigned Services</Label>

            {/* Search and add */}
            <div className="relative mb-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MaterialIcon name="search" size="sm" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowServiceDropdown(true);
                    }}
                    onFocus={() => setShowServiceDropdown(true)}
                    onBlur={() => {
                      // Delay closing to allow click on dropdown items
                      setTimeout(() => setShowServiceDropdown(false), 200);
                    }}
                    placeholder="Search and add services..."
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Dropdown results */}
              {showServiceDropdown && searchQuery.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {availableServices.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No matching services found
                    </div>
                  ) : (
                    availableServices.slice(0, 10).map(ct => (
                      <button
                        key={ct.id}
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addService(ct.id)}
                      >
                        <Badge variant="outline" className="font-mono text-xs shrink-0">{ct.charge_code}</Badge>
                        <span className="truncate">{ct.charge_name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Assigned services list */}
            {assignedServices.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">
                No services assigned. Search above to add services.
              </p>
            ) : (
              <div className="space-y-1">
                {assignedServices.map((ct) => (
                  <div key={ct.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-muted/50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">{ct.charge_code}</Badge>
                      <span className="truncate">{ct.charge_name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeService(ct.id)}
                    >
                      <MaterialIcon name="close" size="sm" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-1 animate-spin" />}
            {template ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
