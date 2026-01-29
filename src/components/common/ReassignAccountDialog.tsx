import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Account {
  id: string;
  account_code: string;
  account_name: string;
}

interface ReassignAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'item' | 'shipment' | 'items';
  entityIds: string[];
  currentAccountId?: string | null;
  currentAccountName?: string | null;
  onSuccess: () => void;
}

export function ReassignAccountDialog({
  open,
  onOpenChange,
  entityType,
  entityIds,
  currentAccountId,
  currentAccountName,
  onSuccess,
}: ReassignAccountDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAccounts();
      setSelectedAccountId('');
    }
  }, [open]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, account_code, account_name')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('account_name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedAccountId) {
      toast.error('Please select an account');
      return;
    }

    setSubmitting(true);
    try {
      const selectedAccount = accounts.find(a => a.id === selectedAccountId);

      if (entityType === 'shipment') {
        // Update shipment account
        const { error } = await supabase
          .from('shipments')
          .update({ account_id: selectedAccountId })
          .in('id', entityIds);

        if (error) throw error;
        toast.success(`Shipment reassigned to ${selectedAccount?.account_name}`);
      } else {
        // Update items account (single or bulk)
        const { error } = await supabase
          .from('items')
          .update({ account_id: selectedAccountId })
          .in('id', entityIds);

        if (error) throw error;

        const itemCount = entityIds.length;
        toast.success(
          itemCount === 1
            ? `Item reassigned to ${selectedAccount?.account_name}`
            : `${itemCount} items reassigned to ${selectedAccount?.account_name}`
        );
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error reassigning:', error);
      toast.error('Failed to reassign. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const entityLabel = entityType === 'shipment'
    ? 'shipment'
    : entityIds.length === 1
      ? 'item'
      : `${entityIds.length} items`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon name="swap_horiz" size="md" />
            Reassign Account
          </DialogTitle>
          <DialogDescription>
            Move this {entityLabel} to a different account.
            {currentAccountName && (
              <span className="block mt-1">
                Currently assigned to: <strong>{currentAccountName}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>New Account</Label>
            {loading ? (
              <div className="flex items-center justify-center h-10">
                <MaterialIcon name="progress_activity" size="sm" className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(a => a.id !== currentAccountId)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <span className="font-medium">{account.account_code}</span>
                        <span className="text-muted-foreground ml-2">- {account.account_name}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={!selectedAccountId || submitting}>
            {submitting ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                Reassigning...
              </>
            ) : (
              <>
                <MaterialIcon name="swap_horiz" size="sm" className="mr-2" />
                Reassign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
