import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ClassSelect } from '@/components/ui/class-select';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useAccountSidemarks } from '@/hooks/useAccountSidemarks';

const itemSchema = z.object({
  description: z.string().optional(),
  quantity: z.coerce.number().min(1).default(1),
  sidemark: z.string().optional(),
  sidemark_id: z.string().optional(),
  class_id: z.string().optional(),
  vendor: z.string().optional(),
  size: z.coerce.number().optional(),
  size_unit: z.string().optional(),
  room: z.string().optional(),
  link: z.string().optional().transform((val) => {
    if (!val || val.trim() === '') return '';
    // Auto-prepend https:// if no protocol is provided
    if (!/^https?:\/\//i.test(val)) {
      return `https://${val}`;
    }
    return val;
  }),
  status: z.string().optional(),
  client_account: z.string().optional(),
  account_id: z.string().optional(),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface Account {
  id: string;
  account_name: string;
  account_code: string;
}

interface ItemEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    item_code: string;
    description: string | null;
    quantity: number;
    sidemark: string | null;
    sidemark_id?: string | null;
    class_id?: string | null;
    account_id?: string | null;
    vendor: string | null;
    size: number | null;
    size_unit: string | null;
    room?: string | null;
    link?: string | null;
    status: string;
    item_type_id?: string | null;
    client_account?: string | null;
  } | null;
  onSuccess: () => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'released', label: 'Released', disabled: true },
];

const SIZE_UNITS = [
  { value: 'sq_ft', label: 'sq ft' },
  { value: 'cu_ft', label: 'cu ft' },
  { value: 'inches', label: 'inches' },
  { value: 'feet', label: 'feet' },
];

export function ItemEditDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: ItemEditDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Field suggestions for room and sidemark
  const { suggestions: roomSuggestions, addOrUpdateSuggestion: addRoomSuggestion } = useFieldSuggestions('room');

  // Fetch accounts
  useEffect(() => {
    const fetchData = async () => {
      const accountsRes = await supabase
        .from('accounts')
        .select('id, account_name, account_code')
        .is('deleted_at', null)
        .eq('status', 'active')
        .order('account_name');
      if (accountsRes.data) setAccounts(accountsRes.data);
    };
    if (open) fetchData();
  }, [open]);

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      description: '',
      quantity: 1,
      sidemark: '',
      sidemark_id: '',
      class_id: '',
      account_id: '',
      vendor: '',
      size: undefined,
      size_unit: '',
      room: '',
      link: '',
      status: 'active',
      client_account: '',
    },
  });

  // Track selected account for sidemark filtering
  const selectedAccountId = form.watch('account_id');

  // Account sidemarks for autocomplete
  const { sidemarks: accountSidemarks, addSidemark: addAccountSidemark } = useAccountSidemarks(selectedAccountId || undefined);
  const sidemarkSuggestions = accountSidemarks.map((s) => ({ value: s.sidemark, label: s.sidemark }));

  useEffect(() => {
    if (open && item) {
      form.reset({
        description: item.description || '',
        quantity: item.quantity || 1,
        sidemark: item.sidemark || '',
        sidemark_id: item.sidemark_id || '',
        class_id: item.class_id || '',
        account_id: item.account_id || '',
        vendor: item.vendor || '',
        size: item.size || undefined,
        size_unit: item.size_unit || '',
        room: item.room || '',
        link: item.link || '',
        status: item.status || 'active',
        client_account: item.client_account || '',
      });
    }
  }, [open, item]);

  const onSubmit = async (data: ItemFormData) => {
    if (!item) return;

    setLoading(true);
    try {
      // If sidemark text was entered, ensure it exists in account_sidemarks
      if (data.sidemark?.trim() && data.account_id) {
        await addAccountSidemark(data.sidemark.trim());
      }

      const updateData = {
        description: data.description || null,
        quantity: data.quantity,
        sidemark: data.sidemark || null,
        class_id: data.class_id || null,
        account_id: data.account_id || null,
        vendor: data.vendor || null,
        size: data.size || null,
        size_unit: data.size_unit || null,
        room: data.room || null,
        link: data.link || null,
        status: data.status || 'active',
        client_account: data.client_account || null,
      };

      const { error } = await (supabase.from('items') as any)
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;

      // Add room to suggestions
      if (data.room) addRoomSuggestion(data.room);

      toast({
        title: 'Item Updated',
        description: `${item.item_code} has been updated successfully.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update item',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Update details for {item?.item_code}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Class (Pricing Tier) */}
              <FormField
                control={form.control}
                name="class_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class (Pricing Tier)</FormLabel>
                    <FormControl>
                      <ClassSelect
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select class..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity & Status */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              disabled={'disabled' in opt && opt.disabled}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Vendor */}
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="Vendor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Item description..."
                        className="resize-none"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account */}
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        if (val === '_none_') {
                          field.onChange('');
                          form.setValue('client_account', '');
                          form.setValue('sidemark', ''); // Clear sidemark when account changes
                        } else {
                          field.onChange(val);
                          const account = accounts.find(a => a.id === val);
                          form.setValue('client_account', account?.account_name || '');
                          form.setValue('sidemark', ''); // Clear sidemark when account changes
                        }
                      }}
                      value={field.value || '_none_'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none_">No account</SelectItem>
                        {accounts.filter(account => account.id).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name} ({account.account_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sidemark & Room */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sidemark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sidemark (Project)</FormLabel>
                      <FormControl>
                        <AutocompleteInput
                          value={field.value || ''}
                          onChange={field.onChange}
                          suggestions={sidemarkSuggestions}
                          placeholder="e.g., Living Room Set"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="room"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Room</FormLabel>
                      <FormControl>
                        <AutocompleteInput
                          value={field.value || ''}
                          onChange={field.onChange}
                          suggestions={roomSuggestions}
                          placeholder="e.g., Living Room"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Link */}
              <FormField
                control={form.control}
                name="link"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link (URL)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Size & Size Unit */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Size" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="size_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SIZE_UNITS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button onClick={form.handleSubmit(onSubmit)} disabled={loading}>
            {loading && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
