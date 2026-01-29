/**
 * AddItemDialog Component
 * Dialog for adding new items directly to inventory
 */

import { useState, useEffect, useRef } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SidemarkSelect } from '@/components/ui/sidemark-select';
import { supabase } from '@/integrations/supabase/client';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
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
  const { accounts } = useAccounts();
  const [saving, setSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Form state
  const [accountId, setAccountId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [sidemarkId, setSidemarkId] = useState('');
  const [room, setRoom] = useState('');
  const [notes, setNotes] = useState('');

  // Field suggestions
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: roomSuggestions, addOrUpdateSuggestion: addRoomSuggestion } = useFieldSuggestions('room');

  // Track if form has been modified
  const hasFormData = accountId || vendor || description || sidemarkId || room || notes || quantity !== '1';

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAccountId('');
      setQuantity('1');
      setVendor('');
      setDescription('');
      setSidemarkId('');
      setRoom('');
      setNotes('');
    }
  }, [open]);

  const handleClose = (shouldClose: boolean) => {
    if (!shouldClose) return;

    // If form has data, show confirmation
    if (hasFormData) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!accountId) {
      toast({
        variant: 'destructive',
        title: 'Account Required',
        description: 'Please select an account for this item.',
      });
      return;
    }

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
        account_id: accountId,
        quantity: parseInt(quantity, 10) || 1,
        vendor: vendor || null,
        description: description || null,
        sidemark_id: sidemarkId || null,
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
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MaterialIcon name="add" size="md" />
              Add New Item
            </DialogTitle>
            <DialogDescription>
              Add a new item directly to inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-2">
            {/* Account - Required */}
            <div className="space-y-2">
              <Label htmlFor="account" className="flex items-center gap-1">
                Account <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={(accounts || []).map(a => ({ value: a.id, label: a.account_name }))}
                value={accountId}
                onChange={setAccountId}
                placeholder="Select account..."
              />
            </div>

            {/* Quantity */}
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

            {/* Vendor */}
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <AutocompleteInput
                value={vendor}
                onChange={setVendor}
                suggestions={vendorSuggestions}
                placeholder="Enter vendor name..."
              />
            </div>

            {/* Description */}
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

            {/* Sidemark */}
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

            {/* Room */}
            <div className="space-y-2">
              <Label htmlFor="room">Room</Label>
              <AutocompleteInput
                value={room}
                onChange={setRoom}
                suggestions={roomSuggestions}
                placeholder="e.g., Living Room"
              />
            </div>

            {/* Notes */}
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
          </form>

          <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => handleClose(true)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Confirmation Dialog */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close this dialog? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
