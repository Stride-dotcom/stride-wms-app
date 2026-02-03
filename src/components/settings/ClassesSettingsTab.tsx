/**
 * ClassesSettingsTab - Admin UI for managing item classes (pricing tiers)
 * 
 * Classes define size-based pricing tiers (XS, S, M, L, XL, XXL) with
 * cubic feet thresholds for automatic classification.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import { useClasses, type ItemClass } from '@/hooks/useClasses';

export function ClassesSettingsTab() {
  const { classes, loading, createClass, updateClass, deleteClass, refetch } = useClasses();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<ItemClass | null>(null);

  const handleDelete = async (cls: ItemClass) => {
    if (confirm(`Delete class "${cls.name}"? This will deactivate it, not remove historical data.`)) {
      try {
        await deleteClass(cls.id);
        toast({ title: 'Class deleted' });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <MaterialIcon name="progress_activity" className="animate-spin mr-2" />
        Loading classes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Item Classes</h3>
          <p className="text-sm text-muted-foreground">
            Define size-based pricing tiers. Items are automatically classified by cubic feet.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <MaterialIcon name="add" size="sm" className="mr-1" />
          Add Class
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Order</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Min Cu Ft</TableHead>
              <TableHead className="text-right">Max Cu Ft</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No classes defined. Add classes to enable size-based pricing.
                </TableCell>
              </TableRow>
            ) : (
              classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell>
                    <Badge variant="outline">{cls.sort_order || '-'}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">{cls.code}</TableCell>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {cls.min_cubic_feet !== null ? cls.min_cubic_feet.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {cls.max_cubic_feet !== null ? cls.max_cubic_feet.toFixed(2) : '∞'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingClass(cls)}
                      >
                        <MaterialIcon name="edit" size="sm" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cls)}
                      >
                        <MaterialIcon name="delete" size="sm" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Classes Work</CardTitle>
          <CardDescription>
            Classes automatically assign items to pricing tiers based on their dimensions.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            • <strong>Cubic Feet Calculation:</strong> Length × Width × Height ÷ 1728 (for inches)
          </p>
          <p>
            • <strong>Auto-Classification:</strong> When an item's dimensions are entered, it's automatically assigned the matching class.
          </p>
          <p>
            • <strong>Pricing Lookup:</strong> Billing uses class-specific rates from the Pricing Rules tab.
          </p>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <ClassDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSave={async (data) => {
          try {
            await createClass(data);
            setShowCreateDialog(false);
            toast({ title: 'Class created' });
          } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
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
            } catch (error: any) {
              toast({ variant: 'destructive', title: 'Error', description: error.message });
            }
          }
        }}
      />
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
  });

  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && itemClass) {
      setFormData({
        code: itemClass.code,
        name: itemClass.name,
        min_cubic_feet: itemClass.min_cubic_feet ?? '',
        max_cubic_feet: itemClass.max_cubic_feet ?? '',
        sort_order: itemClass.sort_order ?? '',
      });
    } else if (open) {
      setFormData({
        code: '',
        name: '',
        min_cubic_feet: '',
        max_cubic_feet: '',
        sort_order: '',
      });
    }
    onOpenChange(open);
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
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., XS, S, M"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Extra Small"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_cubic_feet">Min Cubic Feet</Label>
              <Input
                id="min_cubic_feet"
                type="number"
                step="0.01"
                min="0"
                value={formData.min_cubic_feet}
                onChange={(e) => setFormData({ ...formData, min_cubic_feet: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_cubic_feet">Max Cubic Feet</Label>
              <Input
                id="max_cubic_feet"
                type="number"
                step="0.01"
                min="0"
                value={formData.max_cubic_feet}
                onChange={(e) => setFormData({ ...formData, max_cubic_feet: e.target.value })}
                placeholder="Leave empty for no limit"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort_order">Sort Order</Label>
            <Input
              id="sort_order"
              type="number"
              min="0"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
              placeholder="Display order (lower = first)"
              className="max-w-[120px]"
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
