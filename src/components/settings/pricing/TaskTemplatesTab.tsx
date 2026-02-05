import { useState, useEffect, useCallback } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { LabelWithTooltip } from '@/components/ui/label-with-tooltip';
import { fieldDescriptions } from '@/lib/pricing/fieldDescriptions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useChargeTypes, type ChargeType } from '@/hooks/useChargeTypes';
import { supabase } from '@/integrations/supabase/client';

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
// HOOK
// =============================================================================

function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplateWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const { toast } = useToast();
  const { chargeTypes } = useChargeTypes();

  const fetchTemplates = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);

      const { data: taskTypes, error: ttError } = await (supabase as any)
        .from('task_types')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('sort_order')
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
      const { data: links, error: linksError } = await (supabase as any)
        .from('task_type_charge_links')
        .select('*')
        .in('task_type_id', taskTypeIds)
        .order('sort_order');

      if (linksError && linksError.code !== '42P01') {
        throw linksError;
      }

      const combined: TaskTemplateWithLinks[] = (taskTypes as TaskType[]).map(tt => ({
        ...tt,
        links: ((links || []) as TaskTypeChargeLink[])
          .filter(l => l.task_type_id === tt.id)
          .map(l => ({
            ...l,
            charge_type: chargeTypes.find(ct => ct.id === l.charge_type_id),
          })),
      }));

      setTemplates(combined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error loading templates', description: message });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, chargeTypes, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

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
      toast({ title: 'Template created', description: `Created "${data.name}"` });
      await fetchTemplates();
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
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
      toast({ title: 'Template updated' });
      await fetchTemplates();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('task_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Template deleted' });
      await fetchTemplates();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const addLink = async (taskTypeId: string, chargeTypeId: string, scope: string = 'per_item', autoCalculate: boolean = true): Promise<boolean> => {
    if (!profile?.tenant_id) return false;
    try {
      const maxSort = templates.find(t => t.id === taskTypeId)?.links.length ?? 0;
      const { error } = await (supabase as any)
        .from('task_type_charge_links')
        .insert({
          tenant_id: profile.tenant_id,
          task_type_id: taskTypeId,
          charge_type_id: chargeTypeId,
          scope,
          auto_calculate: autoCalculate,
          sort_order: maxSort + 1,
        });
      if (error) throw error;
      await fetchTemplates();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  const removeLink = async (linkId: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('task_type_charge_links')
        .delete()
        .eq('id', linkId);
      if (error) throw error;
      await fetchTemplates();
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
      return false;
    }
  };

  return {
    templates,
    loading,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addLink,
    removeLink,
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
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addLink,
    removeLink,
  } = useTaskTemplates();
  const { chargeTypes } = useChargeTypes();

  const [filter, setFilter] = useState<FilterType>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplateWithLinks | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TaskTemplateWithLinks | null>(null);
  const [addServiceDialog, setAddServiceDialog] = useState<string | null>(null);
  const [selectedChargeTypeId, setSelectedChargeTypeId] = useState('');

  const filtered = templates.filter(t => {
    if (filter === 'billable') return t.is_billable;
    if (filter === 'non-billable') return !t.is_billable;
    return true;
  });

  const handleAddService = async () => {
    if (!addServiceDialog || !selectedChargeTypeId) return;
    await addLink(addServiceDialog, selectedChargeTypeId);
    setAddServiceDialog(null);
    setSelectedChargeTypeId('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
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
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
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
                  {template.links.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto mr-2">
                      {template.links.length} service{template.links.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 pt-2">
                  {template.description && (
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  )}

                  {/* Linked services */}
                  {template.links.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No services linked to this template</p>
                  ) : (
                    <div className="space-y-1">
                      {template.links.map((link, idx) => (
                        <div key={link.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-muted/50 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                            {link.charge_type && (
                              <>
                                <Badge variant="outline" className="font-mono text-xs">{link.charge_type.charge_code}</Badge>
                                <span>{link.charge_type.charge_name}</span>
                              </>
                            )}
                            {!link.charge_type && <span className="text-muted-foreground italic">Unknown service</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{link.scope}</Badge>
                            <Badge variant={link.auto_calculate ? 'default' : 'secondary'} className="text-xs">
                              {link.auto_calculate ? 'Auto' : 'Manual'}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLink(link.id)}>
                              <MaterialIcon name="close" size="sm" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add service button */}
                  <Button variant="outline" size="sm" onClick={() => setAddServiceDialog(template.id)}>
                    <MaterialIcon name="add" size="sm" className="mr-1" />
                    Add Service
                  </Button>

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

      {/* Template Dialog */}
      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSave={async (data) => {
          if (editingTemplate) {
            const ok = await updateTemplate(editingTemplate.id, data);
            if (ok) setDialogOpen(false);
          } else {
            const result = await createTemplate(data);
            if (result) setDialogOpen(false);
          }
        }}
      />

      {/* Add Service Dialog */}
      <Dialog open={!!addServiceDialog} onOpenChange={() => { setAddServiceDialog(null); setSelectedChargeTypeId(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service to Template</DialogTitle>
            <DialogDescription>Select a service to link to this task template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedChargeTypeId} onValueChange={setSelectedChargeTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select service..." />
              </SelectTrigger>
              <SelectContent>
                {chargeTypes.filter(ct => ct.is_active).map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.charge_code} — {ct.charge_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddServiceDialog(null); setSelectedChargeTypeId(''); }}>
              Cancel
            </Button>
            <Button onClick={handleAddService} disabled={!selectedChargeTypeId}>
              Add Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
// TEMPLATE DIALOG
// =============================================================================

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TaskTemplateWithLinks | null;
  onSave: (data: {
    name: string;
    description: string | null;
    is_billable: boolean;
    is_active: boolean;
  }) => Promise<void>;
}

function TemplateDialog({ open, onOpenChange, template, onSave }: TemplateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [isBillable, setIsBillable] = useState(template?.is_billable ?? true);
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && template) {
      setName(template.name);
      setDescription(template.description || '');
      setIsBillable(template.is_billable);
      setIsActive(template.is_active);
    } else if (isOpen) {
      setName('');
      setDescription('');
      setIsBillable(true);
      setIsActive(true);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        is_billable: isBillable,
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Add Template'}</DialogTitle>
          <DialogDescription>
            {template ? 'Update the template details.' : 'Create a new task template with linked services.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          <div className="flex items-center justify-between">
            <LabelWithTooltip tooltip={fieldDescriptions.templateBillable}>Billable</LabelWithTooltip>
            <Switch checked={isBillable} onCheckedChange={setIsBillable} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
