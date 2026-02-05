import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { LabelWithTooltip } from '@/components/ui/label-with-tooltip';
import { fieldDescriptions } from '@/lib/pricing/fieldDescriptions';
import { useServiceCategories, type ServiceCategory } from '@/hooks/useServiceCategories';
import { cn } from '@/lib/utils';

export function CategoriesTab() {
  const {
    categories,
    loading,
    saving,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleActive,
  } = useServiceCategories();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ServiceCategory | null>(null);

  const handleCreate = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleEdit = (category: ServiceCategory) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleSave = async (data: { name: string; description: string; sort_order: number; is_active: boolean }) => {
    if (editingCategory) {
      return updateCategory({
        id: editingCategory.id,
        name: data.name,
        description: data.description || null,
        sort_order: data.sort_order,
        is_active: data.is_active,
      });
    } else {
      return createCategory({
        name: data.name,
        description: data.description,
        sort_order: data.sort_order,
        is_active: data.is_active,
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteCategory(deleteConfirm.id);
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
            Organize your services into categories for menus, filters, and reports. Categories do not affect billing.
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <MaterialIcon name="add" size="sm" className="mr-1.5" />
          Add Category
        </Button>
      </div>

      {/* Empty state */}
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MaterialIcon name="folder" size="xl" className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create categories to organize your price list services.
          </p>
          <Button onClick={handleCreate}>
            <MaterialIcon name="add" size="sm" className="mr-1.5" />
            Add First Category
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => (
            <Card key={category.id} className={cn(!category.is_active && 'opacity-60')}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <Badge variant="outline" className="text-xs shrink-0">{category.sort_order}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{category.name}</span>
                    {category.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                    {!category.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  {category.description && (
                    <p className="text-xs text-muted-foreground truncate">{category.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category)}>
                          <MaterialIcon name="edit" size="sm" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(category.id)} disabled={saving}>
                          <MaterialIcon name={category.is_active ? 'visibility_off' : 'visibility'} size="sm" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{category.is_active ? 'Disable' : 'Enable'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {!category.is_system && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(category)}
                          >
                            <MaterialIcon name="delete" size="sm" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"?
              If any services are using this category, deletion will fail.
              You may want to disable the category instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
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
// CATEGORY DIALOG
// =============================================================================

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: ServiceCategory | null;
  onSave: (data: { name: string; description: string; sort_order: number; is_active: boolean }) => Promise<boolean>;
  saving: boolean;
}

function CategoryDialog({ open, onOpenChange, category, onSave, saving }: CategoryDialogProps) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(category?.is_active ?? true);

  // Sync form state when the dialog opens or the category prop changes
  useEffect(() => {
    if (open && category) {
      setName(category.name);
      setDescription(category.description || '');
      setSortOrder(category.sort_order);
      setIsActive(category.is_active);
    } else if (open && !category) {
      setName('');
      setDescription('');
      setSortOrder(0);
      setIsActive(true);
    }
  }, [open, category]);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && category) {
      setName(category.name);
      setDescription(category.description || '');
      setSortOrder(category.sort_order);
      setIsActive(category.is_active);
    } else if (isOpen && !category) {
      setName('');
      setDescription('');
      setSortOrder(0);
      setIsActive(true);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const success = await onSave({
      name: name.trim(),
      description: description.trim(),
      sort_order: sortOrder,
      is_active: isActive,
    });
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            {category
              ? 'Update the category details below.'
              : 'Create a new service category for organizing your price list.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <LabelWithTooltip htmlFor="catName" tooltip={fieldDescriptions.categoryName} required>
              Name
            </LabelWithTooltip>
            <Input
              id="catName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Receiving"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <LabelWithTooltip htmlFor="catDesc" tooltip={fieldDescriptions.categoryDescription}>
              Description
            </LabelWithTooltip>
            <Textarea
              id="catDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="catSort" tooltip={fieldDescriptions.categorySortOrder}>
                Sort Order
              </LabelWithTooltip>
              <Input
                id="catSort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch id="catActive" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="catActive" className="cursor-pointer text-sm">
                  {isActive ? 'Active' : 'Inactive'}
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-1 animate-spin" />}
            {category ? 'Save Changes' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
