import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { LabelWithTooltip } from '@/components/ui/label-with-tooltip';
import { fieldDescriptions } from '@/lib/pricing/fieldDescriptions';
import { useClasses, type ItemClass } from '@/hooks/useClasses';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function ClassesTab() {
  const { classes, loading, createClass, updateClass, deleteClass } = useClasses();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ItemClass | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ItemClass | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(true);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteClass(deleteConfirm.id);
      toast({ title: 'Class deactivated' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
    setDeleteConfirm(null);
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
            Define item groups for class-based pricing. Items are automatically classified when dimensions are entered.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
          <MaterialIcon name="add" size="sm" className="mr-1.5" />
          Add Class
        </Button>
      </div>

      {/* How Classes Work explainer */}
      <Collapsible open={explainerOpen} onOpenChange={setExplainerOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MaterialIcon name="help_outline" size="sm" className="text-muted-foreground" />
                  How Classes Work
                </CardTitle>
                <MaterialIcon
                  name={explainerOpen ? 'expand_less' : 'expand_more'}
                  size="sm"
                  className="text-muted-foreground"
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                {fieldDescriptions.classExplanation}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon name="straighten" size="sm" className="text-muted-foreground" />
                      <span className="font-medium text-sm">By Size</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Small, Medium, Large, Oversized — based on cubic feet
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon name="diamond" size="sm" className="text-muted-foreground" />
                      <span className="font-medium text-sm">By Value</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bronze, Silver, Gold, Platinum — based on item value
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MaterialIcon name="inventory_2" size="sm" className="text-muted-foreground" />
                      <span className="font-medium text-sm">By Type</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Standard, Fragile, High-Value, Hazmat — based on handling
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Classes list */}
      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MaterialIcon name="label" size="xl" className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No classes defined</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Add classes to enable class-based pricing tiers.
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <MaterialIcon name="add" size="sm" className="mr-1.5" />
            Add First Class
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <Badge variant="outline" className="text-xs shrink-0">{cls.sort_order || '-'}</Badge>
                <Badge variant="outline" className="font-mono text-xs shrink-0">{cls.code}</Badge>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{cls.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {cls.min_cubic_feet !== null || cls.max_cubic_feet !== null
                      ? `${cls.min_cubic_feet ?? 0} – ${cls.max_cubic_feet ?? '∞'} cu ft`
                      : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingClass(cls)}>
                          <MaterialIcon name="edit" size="sm" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(cls)}
                        >
                          <MaterialIcon name="delete" size="sm" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Deactivate</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <ClassDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSave={async (data) => {
          try {
            await createClass(data);
            setShowCreateDialog(false);
            toast({ title: 'Class created' });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'An error occurred';
            toast({ variant: 'destructive', title: 'Error', description: message });
          }
        }}
      />

      {/* Edit Dialog */}
      <ClassDialog
        open={!!editingClass}
        onOpenChange={(open) => !open && setEditingClass(null)}
        itemClass={editingClass}
        onSave={async (data) => {
          if (editingClass) {
            try {
              await updateClass(editingClass.id, data);
              setEditingClass(null);
              toast({ title: 'Class updated' });
            } catch (error: unknown) {
              const message = error instanceof Error ? error.message : 'An error occurred';
              toast({ variant: 'destructive', title: 'Error', description: message });
            }
          }
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the class "{deleteConfirm?.name}". Historical data will be preserved.
              Items currently assigned to this class will keep their assignment, but new items won't be classified into it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// CLASS DIALOG
// =============================================================================

interface ClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemClass?: ItemClass | null;
  onSave: (data: {
    code: string;
    name: string;
    min_cubic_feet: number | null;
    max_cubic_feet: number | null;
    sort_order: number | null;
    notes?: string | null;
  }) => Promise<void>;
}

function ClassDialog({ open, onOpenChange, itemClass, onSave }: ClassDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: itemClass?.code || '',
    name: itemClass?.name || '',
    min_cubic_feet: itemClass?.min_cubic_feet ?? '',
    max_cubic_feet: itemClass?.max_cubic_feet ?? '',
    sort_order: itemClass?.sort_order ?? '',
    notes: itemClass?.notes ?? '',
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && itemClass) {
      setFormData({
        code: itemClass.code,
        name: itemClass.name,
        min_cubic_feet: itemClass.min_cubic_feet ?? '',
        max_cubic_feet: itemClass.max_cubic_feet ?? '',
        sort_order: itemClass.sort_order ?? '',
        notes: itemClass.notes ?? '',
      });
    } else if (isOpen) {
      setFormData({
        code: '',
        name: '',
        min_cubic_feet: '',
        max_cubic_feet: '',
        sort_order: '',
        notes: '',
      });
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        code: formData.code.toUpperCase(),
        name: formData.name,
        min_cubic_feet: formData.min_cubic_feet !== '' ? Number(formData.min_cubic_feet) : null,
        max_cubic_feet: formData.max_cubic_feet !== '' ? Number(formData.max_cubic_feet) : null,
        sort_order: formData.sort_order !== '' ? Number(formData.sort_order) : null,
        notes: formData.notes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{itemClass ? 'Edit Class' : 'Create Class'}</DialogTitle>
          <DialogDescription>
            {itemClass
              ? 'Update the class configuration.'
              : 'Create a new pricing class for items.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="clsCode" tooltip={fieldDescriptions.classCode} required>
                Code
              </LabelWithTooltip>
              <Input
                id="clsCode"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SM, LG"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="clsName" tooltip={fieldDescriptions.className} required>
                Name
              </LabelWithTooltip>
              <Input
                id="clsName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Small"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="clsMin" tooltip={fieldDescriptions.classMinCubicFeet}>
                Min Cubic Feet
              </LabelWithTooltip>
              <Input
                id="clsMin"
                type="number"
                step="0.01"
                min="0"
                value={formData.min_cubic_feet}
                onChange={(e) => setFormData({ ...formData, min_cubic_feet: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="clsMax" tooltip={fieldDescriptions.classMaxCubicFeet}>
                Max Cubic Feet
              </LabelWithTooltip>
              <Input
                id="clsMax"
                type="number"
                step="0.01"
                min="0"
                value={formData.max_cubic_feet}
                onChange={(e) => setFormData({ ...formData, max_cubic_feet: e.target.value })}
                placeholder="No limit"
              />
            </div>
          </div>

          <div className="space-y-2">
            <LabelWithTooltip htmlFor="clsSort" tooltip={fieldDescriptions.classSortOrder}>
              Sort Order
            </LabelWithTooltip>
            <Input
              id="clsSort"
              type="number"
              min="0"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
              placeholder="Display order (lower = first)"
              className="max-w-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clsNotes" className="text-sm font-medium">Notes</Label>
            <Textarea
              id="clsNotes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !formData.code || !formData.name}
          >
            {saving ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="animate-spin mr-1" />
                Saving...
              </>
            ) : (
              itemClass ? 'Update' : 'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
