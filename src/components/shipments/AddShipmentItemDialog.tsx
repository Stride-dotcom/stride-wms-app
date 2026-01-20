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
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';

interface ItemType {
  id: string;
  name: string;
}

interface AddShipmentItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  onSuccess: () => void;
}

export function AddShipmentItemDialog({
  open,
  onOpenChange,
  shipmentId,
  onSuccess,
}: AddShipmentItemDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  
  // Form state
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [sidemark, setSidemark] = useState('');
  const [itemTypeId, setItemTypeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  
  // Field suggestions
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: addDescSuggestion } = useFieldSuggestions('description');

  // Fetch item types
  useEffect(() => {
    const fetchItemTypes = async () => {
      if (!profile?.tenant_id) return;
      const { data } = await supabase
        .from('item_types')
        .select('id, name')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('name');
      setItemTypes(data || []);
    };
    if (open) {
      fetchItemTypes();
    }
  }, [open, profile?.tenant_id]);

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

      // Record field usage
      if (vendor) addVendorSuggestion(vendor);
      if (description) addDescSuggestion(description);

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
            <Input
              id="sidemark"
              value={sidemark}
              onChange={(e) => setSidemark(e.target.value)}
              placeholder="Customer reference"
            />
          </div>

          <div className="space-y-2">
            <Label>Item Type</Label>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
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
