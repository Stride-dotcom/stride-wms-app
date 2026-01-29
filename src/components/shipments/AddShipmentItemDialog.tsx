/**
 * AddShipmentItemDialog Component
 * Dialog for adding new items to a shipment
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { ItemTypeCombobox } from '@/components/items/ItemTypeCombobox';
import { supabase } from '@/integrations/supabase/client';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface ItemType {
  id: string;
  name: string;
}

interface AddShipmentItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  accountId?: string;
  onSuccess: () => void;
}

export function AddShipmentItemDialog({
  open,
  onOpenChange,
  shipmentId,
  accountId,
  onSuccess,
}: AddShipmentItemDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  
  // Form state
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [sidemark, setSidemark] = useState('');
  const [itemTypeId, setItemTypeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  
  // Field suggestions - async search with previously used values
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: addDescSuggestion } = useFieldSuggestions('description');
  const { suggestions: sidemarkSuggestions, addOrUpdateSuggestion: addSidemarkSuggestion } = useFieldSuggestions('sidemark');

  // Fetch item types - both global and tenant-specific (no restrictive filter)
  useEffect(() => {
    const fetchItemTypes = async () => {
      const { data, error } = await supabase
        .from('item_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching item types:', error);
      }
      setItemTypes(data || []);
    };
    if (open) {
      fetchItemTypes();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      toast({ title: 'Description required', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await (supabase.from('shipment_items') as any).insert({
        shipment_id: shipmentId,
        expected_description: description.trim(),
        expected_vendor: vendor.trim() || null,
        expected_sidemark: sidemark.trim() || null,
        expected_item_type_id: itemTypeId || null,
        expected_quantity: parseInt(quantity) || 1,
        status: 'pending',
      });

      if (error) throw error;

      // Record field usage for future suggestions
      if (vendor) addVendorSuggestion(vendor);
      if (description) addDescSuggestion(description);
      if (sidemark) addSidemarkSuggestion(sidemark);

      toast({ title: 'Item added to shipment' });
      
      // Reset form
      setDescription('');
      setVendor('');
      setSidemark('');
      setItemTypeId('');
      setQuantity('1');
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error adding item:', error);
      toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expected Item</DialogTitle>
          <DialogDescription>
            Add an item that is expected to arrive in this shipment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <AutocompleteInput
              value={description}
              onChange={setDescription}
              suggestions={descriptionSuggestions}
              placeholder="e.g., Leather Sofa, 3-Seater"
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <AutocompleteInput
                value={vendor}
                onChange={setVendor}
                suggestions={vendorSuggestions}
                placeholder="Vendor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Expected Qty</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sidemark">Sidemark</Label>
            <AutocompleteInput
              value={sidemark}
              onChange={setSidemark}
              suggestions={sidemarkSuggestions}
              placeholder="Customer reference or sidemark"
            />
          </div>

          <div className="space-y-2">
            <Label>Class</Label>
            <ItemTypeCombobox
              itemTypes={itemTypes}
              value={itemTypeId}
              onChange={setItemTypeId}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <MaterialIcon name="add" size="sm" className="mr-2" />
                  Add Item
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
