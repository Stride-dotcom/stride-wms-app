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
  FormDescription,
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';

const accountSchema = z.object({
  // Basic
  account_code: z.string().min(1, 'Account code is required').max(50),
  account_name: z.string().min(1, 'Account name is required').max(200),
  account_type: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
  is_master_account: z.boolean().optional(),
  notes: z.string().optional(),
  // Contacts - Primary
  primary_contact_name: z.string().optional(),
  primary_contact_email: z.string().email().optional().or(z.literal('')),
  primary_contact_phone: z.string().optional(),
  // Contacts - Billing
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
  billing_type: z.string().optional(),
  billing_frequency: z.string().optional(),
  billing_schedule: z.string().optional(),
  payment_terms: z.string().optional(),
  currency: z.string().optional(),
  billing_net_terms: z.coerce.number().optional(),
  credit_limit: z.coerce.number().optional(),
  prepay_required: z.boolean().optional(),
  credit_hold: z.boolean().optional(),
  // Automations
  auto_inspection_on_receiving: z.boolean().optional(),
  auto_assembly_on_receiving: z.boolean().optional(),
  auto_repair_on_damage: z.boolean().optional(),
  auto_quarantine_damaged_items: z.boolean().optional(),
  // Inventory
  require_sidemark: z.boolean().optional(),
  require_inspection_photos: z.boolean().optional(),
  hide_internal_fields_from_clients: z.boolean().optional(),
  default_receiving_status: z.string().optional(),
  // Communications
  use_tenant_email_defaults: z.boolean().optional(),
  disable_email_communications: z.boolean().optional(),
  copy_from_account_id: z.string().optional(),
  // Permissions
  access_level: z.string().optional(),
  can_modify_pricing: z.boolean().optional(),
  can_delete_accounts: z.boolean().optional(),
  read_only_access: z.boolean().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  onSuccess: () => void;
}

interface Account {
  id: string;
  account_name: string;
}

const ACCOUNT_TYPES = [
  'Retail',
  'Retail w/NO Warehousing',
  'Wholesale',
  'Designer',
  'Manufacturer',
  'Other',
];

const BILLING_TYPES = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
];

const BILLING_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const BILLING_SCHEDULES = [
  { value: 'not_set', label: 'Not set' },
  { value: 'first_of_month', label: '1st of Month' },
  { value: 'fifteenth_of_month', label: '15th of Month' },
  { value: 'last_of_month', label: 'Last Day of Month' },
];

const PAYMENT_TERMS = [
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'due_on_receipt', label: 'Due on Receipt' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CAD', label: 'CAD' },
];

const RECEIVING_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'pending_inspection', label: 'Pending Inspection' },
  { value: 'quarantine', label: 'Quarantine' },
];

const ACCESS_LEVELS = [
  { value: 'client_read_only', label: 'Client - Read-Only Access' },
  { value: 'client_full', label: 'Client - Full Access' },
  { value: 'partner', label: 'Partner' },
  { value: 'internal', label: 'Internal' },
];

const getDefaultValues = (): AccountFormData => ({
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
  billing_type: 'automatic',
  billing_frequency: 'monthly',
  billing_schedule: 'not_set',
  payment_terms: 'net_30',
  currency: 'USD',
  billing_net_terms: 30,
  credit_limit: undefined,
  prepay_required: false,
  credit_hold: false,
  auto_inspection_on_receiving: false,
  auto_assembly_on_receiving: false,
  auto_repair_on_damage: false,
  auto_quarantine_damaged_items: false,
  require_sidemark: false,
  require_inspection_photos: false,
  hide_internal_fields_from_clients: false,
  default_receiving_status: 'available',
  use_tenant_email_defaults: true,
  disable_email_communications: false,
  copy_from_account_id: '',
  access_level: 'client_read_only',
  can_modify_pricing: false,
  can_delete_accounts: false,
  read_only_access: false,
});

export function AccountDialog({
  open,
  onOpenChange,
  accountId,
  onSuccess,
}: AccountDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { toast } = useToast();
  const { profile } = useAuth();

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (open) {
      fetchAccounts();
      if (accountId) {
        fetchAccount(accountId);
      } else {
        form.reset(getDefaultValues());
      }
    }
  }, [open, accountId]);

  const fetchAccounts = async () => {
    try {
      const { data } = await supabase
        .from('accounts')
        .select('id, account_name')
        .is('deleted_at', null)
        .order('account_name');
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

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
        billing_type: data.billing_type || 'automatic',
        billing_frequency: data.billing_frequency || 'monthly',
        billing_schedule: data.billing_schedule || 'not_set',
        payment_terms: data.payment_terms || 'net_30',
        currency: data.currency || 'USD',
        billing_net_terms: data.billing_net_terms || 30,
        credit_limit: data.credit_limit || undefined,
        prepay_required: data.prepay_required || false,
        credit_hold: data.credit_hold || false,
        auto_inspection_on_receiving: data.auto_inspection_on_receiving || false,
        auto_assembly_on_receiving: data.auto_assembly_on_receiving || false,
        auto_repair_on_damage: data.auto_repair_on_damage || false,
        auto_quarantine_damaged_items: data.auto_quarantine_damaged_items || false,
        require_sidemark: data.require_sidemark || false,
        require_inspection_photos: data.require_inspection_photos || false,
        hide_internal_fields_from_clients: data.hide_internal_fields_from_clients || false,
        default_receiving_status: data.default_receiving_status || 'available',
        use_tenant_email_defaults: data.use_tenant_email_defaults ?? true,
        disable_email_communications: data.disable_email_communications || false,
        copy_from_account_id: data.copy_from_account_id || '',
        access_level: data.access_level || 'client_read_only',
        can_modify_pricing: data.can_modify_pricing || false,
        can_delete_accounts: data.can_delete_accounts || false,
        read_only_access: data.read_only_access || false,
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
        billing_type: data.billing_type || null,
        billing_frequency: data.billing_frequency || null,
        billing_schedule: data.billing_schedule || null,
        payment_terms: data.payment_terms || null,
        currency: data.currency || null,
        billing_net_terms: data.billing_net_terms || null,
        credit_limit: data.credit_limit || null,
        prepay_required: data.prepay_required || false,
        credit_hold: data.credit_hold || false,
        auto_inspection_on_receiving: data.auto_inspection_on_receiving || false,
        auto_assembly_on_receiving: data.auto_assembly_on_receiving || false,
        auto_repair_on_damage: data.auto_repair_on_damage || false,
        auto_quarantine_damaged_items: data.auto_quarantine_damaged_items || false,
        require_sidemark: data.require_sidemark || false,
        require_inspection_photos: data.require_inspection_photos || false,
        hide_internal_fields_from_clients: data.hide_internal_fields_from_clients || false,
        default_receiving_status: data.default_receiving_status || null,
        use_tenant_email_defaults: data.use_tenant_email_defaults ?? true,
        disable_email_communications: data.disable_email_communications || false,
        copy_from_account_id: data.copy_from_account_id || null,
        access_level: data.access_level || null,
        can_modify_pricing: data.can_modify_pricing || false,
        can_delete_accounts: data.can_delete_accounts || false,
        read_only_access: data.read_only_access || false,
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
      <DialogContent className="sm:max-w-[850px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Account' : 'Add New Account'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the account details below.'
              : 'Create a new customer account with master or sub-account configuration.'}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-7 mb-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts</TabsTrigger>
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                  <TabsTrigger value="automations">Automations</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="communications">Communications</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[50vh] pr-4">
                  {/* Basic Tab */}
                  <TabsContent value="basic" className="space-y-4 mt-0">
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

                  {/* Contacts Tab */}
                  <TabsContent value="contacts" className="space-y-6 mt-0">
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
                                <Input type="email" placeholder="john@example.com" {...field} />
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
                                <Input type="email" placeholder="billing@example.com" {...field} />
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
                  </TabsContent>

                  {/* Billing Tab */}
                  <TabsContent value="billing" className="space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="billing_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BILLING_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="billing_schedule"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Schedule</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select schedule" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BILLING_SCHEDULES.map((schedule) => (
                                  <SelectItem key={schedule.value} value={schedule.value}>
                                    {schedule.label}
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CURRENCIES.map((curr) => (
                                  <SelectItem key={curr.value} value={curr.value}>
                                    {curr.label}
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
                        name="billing_net_terms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Net Terms (Days)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="30"
                                {...field}
                                value={field.value ?? ''}
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
                        name="credit_limit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credit Limit</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="10000.00"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="pt-6">
                        <FormField
                          control={form.control}
                          name="prepay_required"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="font-normal">Prepayment Required</FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Automations Tab */}
                  <TabsContent value="automations" className="space-y-4 mt-0">
                    <p className="text-sm text-muted-foreground">
                      Configure per-account automation settings. Toggle switches to override defaults or leave unchecked to inherit from parent account or tenant settings.
                    </p>

                    <FormField
                      control={form.control}
                      name="auto_inspection_on_receiving"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Auto Inspection on Receiving</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="auto_assembly_on_receiving"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Auto Assembly on Receiving</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="auto_repair_on_damage"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Auto Repair on Damage</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="auto_quarantine_damaged_items"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Auto Quarantine Damaged Items</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  {/* Inventory Tab */}
                  <TabsContent value="inventory" className="space-y-4 mt-0">
                    <p className="text-sm text-muted-foreground">
                      Control inventory handling and visibility rules for this account.
                    </p>

                    <FormField
                      control={form.control}
                      name="require_sidemark"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Require Sidemark</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="require_inspection_photos"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Require Inspection Photos</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="hide_internal_fields_from_clients"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Hide Internal Fields from Clients</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="default_receiving_status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Receiving Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RECEIVING_STATUSES.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  {/* Communications Tab */}
                  <TabsContent value="communications" className="space-y-4 mt-0">
                    <p className="text-sm text-muted-foreground">
                      Configure email communication preferences for this account.
                    </p>

                    <FormField
                      control={form.control}
                      name="use_tenant_email_defaults"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="font-normal">Use Tenant Email Defaults</FormLabel>
                            <FormDescription>
                              Use the default email templates from tenant settings
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="disable_email_communications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="font-normal">Disable Email Communications</FormLabel>
                            <FormDescription>
                              Completely disable all automated emails for this account
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="copy_from_account_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Copy Email Settings From Account</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Don't copy from another account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Don't copy from another account</SelectItem>
                              {accounts
                                .filter((a) => a.id !== accountId)
                                .map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.account_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Copy email configuration from an existing account
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  {/* Permissions Tab */}
                  <TabsContent value="permissions" className="space-y-4 mt-0">
                    <FormField
                      control={form.control}
                      name="access_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select access level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ACCESS_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
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
                      name="can_modify_pricing"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Can Modify Pricing</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="can_delete_accounts"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Can Delete Accounts</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="read_only_access"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel className="font-normal">Read-Only Access</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </ScrollArea>
              </Tabs>

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
