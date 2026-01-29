/**
 * AddItemDialog Component
 * Dialog for adding new items directly to inventory
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
import { Textarea } from '@/components/ui/textarea';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { ItemTypeCombobox } from '@/components/items/ItemTypeCombobox';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SidemarkSelect } from '@/components/ui/sidemark-select';
import { supabase } from '@/integrations/supabase/client';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useClasses } from '@/hooks/useClasses';
import { useAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddItemDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddItemDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { classes } = useClasses();
  const { accounts } = useAccounts();
  const [saving, setSaving] = useState(false);

  // Form state
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [accountId, setAccountId] = useState('');
  const [sidemarkId, setSidemarkId] = useState('');
  const [itemTypeId, setItemTypeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [room, setRoom] = useState('');
  const [notes, setNotes] = useState('');

  // Field suggestions
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: roomSuggestions, addOrUpdateSuggestion: addRoomSuggestion } = useFieldSuggestions('room');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('');
      setVendor('');
      setAccountId('');
      setSidemarkId('');
      setItemTypeId('');
      setQuantity('1');
      setRoom('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setSaving(true);
    try {
      // Generate item code
      const prefix = 'INV';
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      const itemCode = `${prefix}-${timestamp}-${random}`;

      const { error } = await (supabase as any).from('items').insert({
        tenant_id: profile.tenant_id,
        item_code: itemCode,
        description: description || null,
        vendor: vendor || null,
        account_id: accountId || null,
        sidemark_id: sidemarkId || null,
        item_type_id: itemTypeId || null,
        quantity: parseInt(quantity, 10) || 1,
        room: room || null,
        notes: notes || null,
        status: 'in_storage',
      });

      if (error) throw error;

      // Add suggestions for autocomplete
      if (vendor) addVendorSuggestion(vendor);
      if (room) addRoomSuggestion(room);

      toast({
        title: 'Item Added',
        description: `Item ${itemCode} has been created.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add item',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon name="add" size="md" />
            Add New Item
          </DialogTitle>
          <DialogDescription>
            Add a new item directly to inventory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item_type">Item Type</Label>
              <ItemTypeCombobox
                itemTypes={(classes || []).map(c => ({ id: c.id, name: c.name }))}
                value={itemTypeId}
                onChange={setItemTypeId}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <AutocompleteInput
              value={vendor}
              onChange={setVendor}
              suggestions={vendorSuggestions}
              placeholder="Enter vendor name..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Item description..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">Account</Label>
            <SearchableSelect
              options={(accounts || []).map(a => ({ value: a.id, label: a.account_name }))}
              value={accountId}
              onChange={setAccountId}
              placeholder="Select account..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sidemark">Sidemark</Label>
              <SidemarkSelect
                accountId={accountId}
                value={sidemarkId}
                onChange={setSidemarkId}
                placeholder="Select sidemark..."
                allowCreate
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">Room</Label>
              <AutocompleteInput
                value={room}
                onChange={setRoom}
                suggestions={roomSuggestions}
                placeholder="e.g., Living Room"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
