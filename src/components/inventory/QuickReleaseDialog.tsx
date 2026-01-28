import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, PackageX } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface QuickReleaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItems: SelectedItem[];
  onSuccess: () => void;
}

interface SelectedItem {
  id: string;
  item_code: string;
  description: string | null;
  quantity: number;
  client_account?: string | null;
  warehouse_id?: string | null;
}

export function QuickReleaseDialog({
  open,
  onOpenChange,
  selectedItems,
  onSuccess,
}: QuickReleaseDialogProps) {
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!releaseDate) {
      toast({
        title: 'Release date required',
        description: 'Please select a release date.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select at least one item to release.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Get current user's profile - users.id IS the auth.uid() in this schema
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await (supabase
        .from('users') as any)
        .select('id, tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      // Create the outbound shipment for tracking
      const shipmentData = {
        tenant_id: profile.tenant_id,
        shipment_type: 'outbound',
        release_type: 'manual_release',
        status: 'completed',
        warehouse_id: selectedItems[0]?.warehouse_id || null,
        notes: `Manual release of ${selectedItems.length} item(s)`,
        created_by: profile.id,
        completed_at: releaseDate.toISOString(),
      };

      const { data: shipment, error: shipmentError } = await (supabase
        .from('shipments') as any)
        .insert(shipmentData)
        .select('id, shipment_number')
        .single();

      if (shipmentError) throw shipmentError;

      // Create shipment items linking to actual inventory items
      const shipmentItems = selectedItems.map(item => ({
        shipment_id: shipment.id,
        item_id: item.id,
        expected_quantity: item.quantity,
        actual_quantity: item.quantity,
        expected_description: item.description,
        status: 'completed',
      }));

      const { error: itemsError } = await (supabase
        .from('shipment_items') as any)
        .insert(shipmentItems);

      if (itemsError) throw itemsError;

      // Update each item's status to 'released' and set released_at
      const itemIds = selectedItems.map(item => item.id);
      const { error: updateError } = await (supabase
        .from('items') as any)
        .update({
          status: 'released',
          released_at: releaseDate.toISOString(),
        })
        .in('id', itemIds);

      if (updateError) throw updateError;

      toast({
        title: 'Items Released',
        description: `${selectedItems.length} item(s) released successfully. Shipment ${shipment.shipment_number} created.`,
      });

      onSuccess();
      onOpenChange(false);
      setReleaseDate(undefined);
    } catch (error: any) {
      console.error('Error releasing items:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to release items.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setReleaseDate(undefined);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5" />
            Release Items
          </DialogTitle>
          <DialogDescription>
            Release {selectedItems.length} item(s) from inventory. This will mark them as released and create a shipment record for tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Items Summary */}
          <div className="space-y-2">
            <Label>Items to Release ({selectedItems.length})</Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto bg-muted/30">
              <div className="space-y-1">
                {selectedItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.item_code}</span>
                    <span className="text-muted-foreground truncate max-w-[150px]">
                      {item.description || 'No description'}
                    </span>
                  </div>
                ))}
                {selectedItems.length > 5 && (
                  <div className="text-sm text-muted-foreground pt-1">
                    ...and {selectedItems.length - 5} more
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Release Date Picker */}
          <div className="space-y-2">
            <Label>Release Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !releaseDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {releaseDate ? format(releaseDate, 'PPP') : 'Select release date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={releaseDate}
                  onSelect={setReleaseDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !releaseDate}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Release Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
