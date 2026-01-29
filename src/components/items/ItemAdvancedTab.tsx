import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCustomFields, useItemCustomFieldValues, CustomField } from '@/hooks/useCustomFields';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ItemAdvancedTabProps {
  itemId: string;
}

export function ItemAdvancedTab({ itemId }: ItemAdvancedTabProps) {
  const { toast } = useToast();
  const { fields, loading: fieldsLoading, createField, deleteField, refetch: refetchFields } = useCustomFields();
  const { values, loading: valuesLoading, updateValue } = useItemCustomFieldValues(itemId);
  
  const [addFieldDialogOpen, setAddFieldDialogOpen] = useState(false);
  const [deleteFieldDialogOpen, setDeleteFieldDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomField['field_type']>('text');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCreateField = async () => {
    if (!newFieldName.trim()) {
      toast({ title: 'Error', description: 'Field name is required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    const result = await createField(newFieldName, newFieldType);
    setCreating(false);

    if (result) {
      toast({ title: 'Success', description: 'Custom field created' });
      setAddFieldDialogOpen(false);
      setNewFieldName('');
      setNewFieldType('text');
    } else {
      toast({ title: 'Error', description: 'Failed to create custom field', variant: 'destructive' });
    }
  };

  const handleDeleteField = async () => {
    if (!fieldToDelete) return;

    setDeleting(true);
    const success = await deleteField(fieldToDelete.id);
    setDeleting(false);

    if (success) {
      toast({ title: 'Success', description: 'Custom field deleted' });
      setDeleteFieldDialogOpen(false);
      setFieldToDelete(null);
    } else {
      toast({ title: 'Error', description: 'Failed to delete custom field', variant: 'destructive' });
    }
  };

  const handleValueChange = async (fieldId: string, value: string) => {
    const success = await updateValue(fieldId, value);
    if (!success) {
      toast({ title: 'Error', description: 'Failed to save value', variant: 'destructive' });
    }
  };

  const renderFieldInput = (field: CustomField) => {
    const currentValue = values[field.id] || '';

    switch (field.field_type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.id}
              checked={currentValue === 'true'}
              onCheckedChange={(checked) => handleValueChange(field.id, checked ? 'true' : 'false')}
            />
            <Label htmlFor={field.id} className="text-sm font-normal">
              {currentValue === 'true' ? 'Yes' : 'No'}
            </Label>
          </div>
        );
      case 'date':
        return (
          <Input
            type="date"
            value={currentValue}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="h-8"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="h-8"
            placeholder="Enter number..."
          />
        );
      default:
        return (
          <Input
            type="text"
            value={currentValue}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            className="h-8"
            placeholder="Enter value..."
          />
        );
    }
  };

  const loading = fieldsLoading || valuesLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="settings" size="md" />
              Custom Fields
            </CardTitle>
            <CardDescription>
              Additional fields specific to your organization
            </CardDescription>
          </div>
          <Button onClick={() => setAddFieldDialogOpen(true)} size="sm">
            <MaterialIcon name="add" size="sm" className="mr-2" />
            Add Field
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
          </div>
        ) : fields.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MaterialIcon name="settings" className="mx-auto text-[48px] mb-4 opacity-50" />
            <p>No custom fields defined yet</p>
            <p className="text-sm mt-1">Click "Add Field" to create your first custom field</p>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center gap-4 group">
                <div className="w-48 flex-shrink-0">
                  <Label className="text-sm text-muted-foreground">{field.field_name}</Label>
                  <span className="text-xs text-muted-foreground ml-2">({field.field_type})</span>
                </div>
                <div className="flex-1">
                  {renderFieldInput(field)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => {
                    setFieldToDelete(field);
                    setDeleteFieldDialogOpen(true);
                  }}
                >
                  <MaterialIcon name="delete" size="sm" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Field Dialog */}
      <Dialog open={addFieldDialogOpen} onOpenChange={setAddFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>
              Create a new custom field for all items in your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g., Purchase Order Number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fieldType">Field Type</Label>
              <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as CustomField['field_type'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Yes/No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFieldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateField} disabled={creating}>
              {creating && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Create Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Field Confirmation */}
      <AlertDialog open={deleteFieldDialogOpen} onOpenChange={setDeleteFieldDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fieldToDelete?.field_name}"? This will remove this field and its values from all items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteField}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
