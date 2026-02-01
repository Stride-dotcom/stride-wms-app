/**
 * ServiceCategoriesSettingsTab - Manage service categories for organizing the Price List
 * Categories are UI/reporting metadata only - they do NOT affect billing logic
 */

import { useState } from 'react';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { useServiceCategories, ServiceCategory } from '@/hooks/useServiceCategories';
import { cn } from '@/lib/utils';

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

  // Reset form when dialog opens
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
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Receiving"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first
              </p>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
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
            {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
            {category ? 'Save Changes' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ServiceCategoriesSettingsTab() {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Service Categories</h2>
          <p className="text-muted-foreground">
            Organize your price list services into categories
          </p>
        </div>
        <Button onClick={handleCreate}>
          <MaterialIcon name="add" size="sm" className="mr-2" />
          Add Category
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <MaterialIcon name="info" size="md" className="text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Categories are for organization only</p>
              <p>
                Categories help organize and filter your price list. They do not affect billing
                calculations, invoice generation, or any automated billing workflows.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="category" size="md" />
            Categories
          </CardTitle>
          <CardDescription>
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="py-12 text-center">
              <MaterialIcon name="category" size="lg" className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No categories yet</h3>
              <p className="text-muted-foreground mb-4">
                Create categories to organize your price list services
              </p>
              <Button onClick={handleCreate}>
                <MaterialIcon name="add" size="sm" className="mr-2" />
                Add First Category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Description</TableHead>
                  <TableHead className="text-center w-20">Order</TableHead>
                  <TableHead className="text-center w-24">Status</TableHead>
                  <TableHead className="text-center w-20">Type</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow
                    key={category.id}
                    className={cn(!category.is_active && 'opacity-50')}
                  >
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {category.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">{category.sort_order}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {category.is_system ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline">System</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              System categories are created by default and cannot be deleted
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
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
                                onClick={() => handleEdit(category)}
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
                                onClick={() => toggleActive(category.id)}
                                disabled={saving}
                              >
                                <MaterialIcon
                                  name={category.is_active ? 'visibility_off' : 'visibility'}
                                  size="sm"
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {category.is_active ? 'Disable' : 'Enable'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {!category.is_system && (
                          <TooltipProvider>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
              Are you sure you want to delete the category "{deleteConfirm?.name}"?
              <br /><br />
              <strong>Note:</strong> If any services are using this category, deletion will fail.
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
