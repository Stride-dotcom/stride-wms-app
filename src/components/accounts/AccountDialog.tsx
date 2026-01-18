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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

const accountSchema = z.object({
  account_code: z.string().min(1, 'Account code is required').max(50),
  account_name: z.string().min(1, 'Account name is required').max(200),
  account_type: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
  is_master_account: z.boolean().optional(),
  notes: z.string().optional(),
  // Primary Contact
  primary_contact_name: z.string().optional(),
  primary_contact_email: z.string().email().optional().or(z.literal('')),
  primary_contact_phone: z.string().optional(),
  // Billing Contact
  billing_contact_name: z.string().optional(),
  billing_contact_email: z.string().email().optional().or(z.literal('')),
  billing_contact_phone: z.string().optional(),
  // Billing Address
  billing_address: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_postal_code: z.string().optional(),
  billing_country: z.string().optional(),
  // Billing Settings
  billing_frequency: z.string().optional(),
  payment_terms: z.string().optional(),
  credit_limit: z.coerce.number().optional(),
  credit_hold: z.boolean().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  onSuccess: () => void;
}

const ACCOUNT_TYPES = [
  'Retail',
  'Retail w/NO Warehousing',
  'Wholesale',
  'Designer',
  'Manufacturer',
  'Other',
];

const BILLING_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const PAYMENT_TERMS = [
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'due_on_receipt', label: 'Due on Receipt' },
];

export function AccountDialog({
  open,
  onOpenChange,
  accountId,
  onSuccess,
}: AccountDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      account_code: '',
      account_name: '',
      account_type: '',
      status: 'active',
      is_master_account: false,
      notes: '',
      primary_contact_name: '',
      primary_contact_email: '',
      primary_contact_phone: '',
      billing_contact_name: '',
      billing_contact_email: '',
      billing_contact_phone: '',
      billing_address: '',
      billing_city: '',
      billing_state: '',
      billing_postal_code: '',
      billing_country: 'USA',
      billing_frequency: 'monthly',
      payment_terms: 'net_30',
      credit_limit: undefined,
      credit_hold: false,
    },
  });

  useEffect(() => {
    if (open && accountId) {
      fetchAccount(accountId);
    } else if (open && !accountId) {
      form.reset({
        account_code: '',
        account_name: '',
        account_type: '',
        status: 'active',
        is_master_account: false,
        notes: '',
        primary_contact_name: '',
        primary_contact_email: '',
        primary_contact_phone: '',
        billing_contact_name: '',
        billing_contact_email: '',
        billing_contact_phone: '',
        billing_address: '',
        billing_city: '',
        billing_state: '',
        billing_postal_code: '',
        billing_country: 'USA',
        billing_frequency: 'monthly',
        payment_terms: 'net_30',
        credit_limit: undefined,
        credit_hold: false,
      });
    }
  }, [open, accountId]);

  const fetchAccount = async (id: string) => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      form.reset({
        account_code: data.account_code,
        account_name: data.account_name,
        account_type: data.account_type || '',
        status: data.status as 'active' | 'inactive' | 'suspended',
        is_master_account: data.is_master_account || false,
        notes: data.notes || '',
        primary_contact_name: data.primary_contact_name || '',
        primary_contact_email: data.primary_contact_email || '',
        primary_contact_phone: data.primary_contact_phone || '',
        billing_contact_name: data.billing_contact_name || '',
        billing_contact_email: data.billing_contact_email || '',
        billing_contact_phone: data.billing_contact_phone || '',
        billing_address: data.billing_address || '',
        billing_city: data.billing_city || '',
        billing_state: data.billing_state || '',
        billing_postal_code: data.billing_postal_code || '',
        billing_country: data.billing_country || 'USA',
        billing_frequency: data.billing_frequency || 'monthly',
        payment_terms: data.payment_terms || 'net_30',
        credit_limit: data.credit_limit || undefined,
        credit_hold: data.credit_hold || false,
      });
    } catch (error) {
      console.error('Error fetching account:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load account details',
      });
      onOpenChange(false);
    } finally {
      setFetching(false);
    }
  };

  const onSubmit = async (data: AccountFormData) => {
    if (!profile?.tenant_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No tenant found. Please log in again.',
      });
      return;
    }

    try {
      setLoading(true);

      const accountData = {
        account_code: data.account_code,
        account_name: data.account_name,
        account_type: data.account_type || null,
        status: data.status,
        is_master_account: data.is_master_account || false,
        notes: data.notes || null,
        primary_contact_name: data.primary_contact_name || null,
        primary_contact_email: data.primary_contact_email || null,
        primary_contact_phone: data.primary_contact_phone || null,
        billing_contact_name: data.billing_contact_name || null,
        billing_contact_email: data.billing_contact_email || null,
        billing_contact_phone: data.billing_contact_phone || null,
        billing_address: data.billing_address || null,
        billing_city: data.billing_city || null,
        billing_state: data.billing_state || null,
        billing_postal_code: data.billing_postal_code || null,
        billing_country: data.billing_country || null,
        billing_frequency: data.billing_frequency || null,
        payment_terms: data.payment_terms || null,
        credit_limit: data.credit_limit || null,
        credit_hold: data.credit_hold || false,
      };

      if (accountId) {
        const { error } = await supabase
          .from('accounts')
          .update(accountData)
          .eq('id', accountId);

        if (error) throw error;

        toast({
          title: 'Account updated',
          description: `${data.account_name} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase.from('accounts').insert([
          {
            ...accountData,
            tenant_id: profile.tenant_id,
          },
        ]);

        if (error) throw error;

        toast({
          title: 'Account created',
          description: `${data.account_name} has been created successfully.`,
        });
      }

      onSuccess();
    } catch (error: unknown) {
      console.error('Error saving account:', error);
      const errorMessage =
        error instanceof Error && 'code' in error && (error as { code: string }).code === '23505'
          ? 'An account with this code already exists'
          : 'Failed to save account';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!accountId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Account' : 'New Account'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the account details below.'
              : 'Enter the details for your new account.'}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <ScrollArea className="h-[60vh] pr-4">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="contacts">Contacts</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="account_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Alchemy Collections" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="account_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Code *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="ACME-001"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="account_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ACCOUNT_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="is_master_account"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Is a Master Account?
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description / Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes about this account..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Primary Contact</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="primary_contact_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Doe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="primary_contact_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="john@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="primary_contact_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="(555) 123-4567" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-3">Billing Contact</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="billing_contact_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Jane Doe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="billing_contact_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="billing@example.com"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="billing_contact_phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="(555) 987-6543" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="billing" className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Billing Address</h4>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="billing_address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Street Address</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="123 Main Street"
                                  className="resize-none"
                                  rows={2}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-4 gap-4">
                          <FormField
                            control={form.control}
                            name="billing_city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input placeholder="Seattle" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="billing_state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State</FormLabel>
                                <FormControl>
                                  <Input placeholder="WA" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="billing_postal_code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Postal Code</FormLabel>
                                <FormControl>
                                  <Input placeholder="98121" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="billing_country"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Country</FormLabel>
                                <FormControl>
                                  <Input placeholder="USA" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-3">Billing Settings</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="billing_frequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Billing Frequency</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select frequency" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {BILLING_FREQUENCIES.map((freq) => (
                                    <SelectItem key={freq.value} value={freq.value}>
                                      {freq.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="payment_terms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Payment Terms</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select terms" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {PAYMENT_TERMS.map((term) => (
                                    <SelectItem key={term.value} value={term.value}>
                                      {term.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={form.control}
                          name="credit_limit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Credit Limit ($)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="10000"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="credit_hold"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-6">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="font-normal text-destructive">
                                Credit Hold
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </ScrollArea>

              <DialogFooter className="pt-4 border-t mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Update Account' : 'Create Account'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
