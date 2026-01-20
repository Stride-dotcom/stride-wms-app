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
  status: z.enum(['active', 'on_hold', 'archived', 'credit_hold']),
  is_master_account: z.boolean().optional(),
  parent_account_id: z.string().optional(),
  notes: z.string().optional(),
  // Contacts - Primary
  primary_contact_name: z.string().optional(),
  primary_contact_email: z.string().email().optional().or(z.literal('')),
  primary_contact_phone: z.string().optional(),
  // Contacts - Billing
  billing_contact_name: z.string().optional(),
  billing_contact_email: z.string().email().optional().or(z.literal('')),
  billing_contact_phone: z.string().optional(),
  // Contacts - Alerts
  alerts_contact_name: z.string().optional(),
  alerts_contact_email: z.string().email().optional().or(z.literal('')),
  account_alert_recipients: z.string().optional(),
  // Billing Address
  billing_address: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_postal_code: z.string().optional(),
  billing_country: z.string().optional(),
  // Billing Settings
  billing_type: z.string().optional(),
  billing_method: z.string().optional(),
  billing_frequency: z.string().optional(),
  billing_schedule: z.string().optional(),
  payment_terms: z.string().optional(),
  currency: z.string().optional(),
  billing_net_terms: z.coerce.number().optional(),
  net_terms: z.coerce.number().optional(),
  credit_limit: z.coerce.number().optional(),
  credit_limit_amount: z.coerce.number().optional(),
  prepay_required: z.boolean().optional(),
  credit_hold: z.boolean().optional(),
  // Pricing
  pricing_level: z.string().optional(),
  rate_card_id: z.string().optional(),
  pricing_percentage: z.coerce.number().optional(),
  pricing_apply_to: z.string().optional(),
  pricing_selected_services: z.array(z.string()).optional(),
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
  default_receiving_location_id: z.string().optional(),
  // Communications
  use_tenant_email_defaults: z.boolean().optional(),
  use_tenant_communication_defaults: z.boolean().optional(),
  disable_email_communications: z.boolean().optional(),
  copy_from_account_id: z.string().optional(),
  email_subject_override: z.string().optional(),
  email_html_body_override: z.string().optional(),
  email_recipients_override: z.string().optional(),
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

interface RateCard {
  id: string;
  rate_card_code: string;
  rate_card_name: string;
  is_active: boolean;
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
  { value: 'mixed', label: 'Mixed' },
];

const BILLING_METHODS = [
  { value: 'per_shipment', label: 'Per Shipment' },
  { value: 'consolidated', label: 'Consolidated' },
  { value: 'monthly', label: 'Monthly' },
];

const ACCOUNT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'archived', label: 'Archived' },
  { value: 'credit_hold', label: 'Credit Hold' },
];

const PRICING_LEVELS = [
  { value: 'default', label: 'Use Default Price List' },
  { value: 'rate_card', label: 'Assign Rate Card' },
  { value: 'percentage', label: 'Apply Percentage Change' },
];

const PRICING_APPLY_TO = [
  { value: 'all', label: 'All Services' },
  { value: 'selected', label: 'Select Services' },
];

// Available services for selection
const AVAILABLE_SERVICES = [
  { key: 'receiving', label: 'Receiving', description: 'Receiving and inspection of incoming items' },
  { key: 'storage', label: 'Storage', description: 'Monthly/daily warehouse storage' },
  { key: 'picking', label: 'Picking', description: 'Order picking and preparation' },
  { key: 'packing', label: 'Packing', description: 'Packaging and wrapping' },
  { key: 'shipping', label: 'Shipping', description: 'Outbound shipping and delivery' },
  { key: 'assembly', label: 'Assembly', description: 'Item assembly and setup' },
  { key: 'inspection', label: 'Inspection', description: 'Quality inspection services' },
  { key: 'repair', label: 'Repair', description: 'Repair and restoration' },
  { key: 'minor_touchup', label: 'Minor Touch-up', description: 'Minor repairs and touch-ups' },
  { key: 'custom_packaging', label: 'Custom Packaging', description: 'Custom crating and packaging' },
  { key: 'handling', label: 'Handling', description: 'Manual handling and labor' },
  { key: 'move', label: 'Move', description: 'Internal warehouse moves' },
  { key: 'delivery', label: 'Delivery', description: 'Final mile delivery' },
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
  parent_account_id: 'none',
  notes: '',
  primary_contact_name: '',
  primary_contact_email: '',
  primary_contact_phone: '',
  billing_contact_name: '',
  billing_contact_email: '',
  billing_contact_phone: '',
  alerts_contact_name: '',
  alerts_contact_email: '',
  account_alert_recipients: '',
  billing_address: '',
  billing_city: '',
  billing_state: '',
  billing_postal_code: '',
  billing_country: 'USA',
  billing_type: 'automatic',
  billing_method: 'per_shipment',
  billing_frequency: 'monthly',
  billing_schedule: 'not_set',
  payment_terms: 'net_30',
  currency: 'USD',
  billing_net_terms: 30,
  net_terms: 30,
  credit_limit: undefined,
  credit_limit_amount: undefined,
  prepay_required: false,
  credit_hold: false,
  pricing_level: 'default',
  rate_card_id: 'default',
  pricing_percentage: undefined,
  pricing_apply_to: 'all',
  pricing_selected_services: [],
  auto_inspection_on_receiving: false,
  auto_assembly_on_receiving: false,
  auto_repair_on_damage: false,
  auto_quarantine_damaged_items: false,
  require_sidemark: false,
  require_inspection_photos: false,
  hide_internal_fields_from_clients: false,
  default_receiving_status: 'available',
  default_receiving_location_id: '',
  use_tenant_email_defaults: true,
  use_tenant_communication_defaults: true,
  disable_email_communications: false,
  copy_from_account_id: 'none',
  email_subject_override: '',
  email_html_body_override: '',
  email_recipients_override: '',
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
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [serviceSelectionOpen, setServiceSelectionOpen] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (open) {
      fetchAccounts();
      fetchRateCards();
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

  const fetchRateCards = async () => {
    try {
      const { data } = await supabase
        .from('rate_cards')
        .select('id, rate_card_code, rate_card_name, is_active')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('rate_card_name');
      setRateCards(data || []);
    } catch (error) {
      console.error('Error fetching rate cards:', error);
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

      // Map legacy status values to new ones
      const mapStatus = (s: string): 'active' | 'on_hold' | 'archived' | 'credit_hold' => {
        if (s === 'inactive' || s === 'suspended') return 'on_hold';
        if (s === 'on_hold' || s === 'archived' || s === 'credit_hold') return s as 'on_hold' | 'archived' | 'credit_hold';
        return 'active';
      };

      form.reset({
        account_code: data.account_code,
        account_name: data.account_name,
        account_type: data.account_type || '',
        status: mapStatus(data.status),
        is_master_account: data.is_master_account || false,
        parent_account_id: data.parent_account_id || 'none',
        notes: data.notes || '',
        primary_contact_name: data.primary_contact_name || '',
        primary_contact_email: data.primary_contact_email || '',
        primary_contact_phone: data.primary_contact_phone || '',
        billing_contact_name: data.billing_contact_name || '',
        billing_contact_email: data.billing_contact_email || '',
        billing_contact_phone: data.billing_contact_phone || '',
        alerts_contact_name: data.alerts_contact_name || '',
        alerts_contact_email: data.alerts_contact_email || '',
        account_alert_recipients: data.account_alert_recipients || '',
        billing_address: data.billing_address || '',
        billing_city: data.billing_city || '',
        billing_state: data.billing_state || '',
        billing_postal_code: data.billing_postal_code || '',
        billing_country: data.billing_country || 'USA',
        billing_type: data.billing_type || 'automatic',
        billing_method: data.billing_method || 'per_shipment',
        billing_frequency: data.billing_frequency || 'monthly',
        billing_schedule: data.billing_schedule || 'not_set',
        payment_terms: data.payment_terms || 'net_30',
        currency: data.currency || 'USD',
        billing_net_terms: data.billing_net_terms || 30,
        net_terms: data.net_terms || 30,
        credit_limit: data.credit_limit || undefined,
        credit_limit_amount: data.credit_limit_amount || undefined,
        prepay_required: data.prepay_required || false,
        credit_hold: data.credit_hold || false,
        pricing_level: data.pricing_level || 'default',
        rate_card_id: data.rate_card_id || 'default',
        pricing_percentage: undefined,
        pricing_apply_to: 'all',
        pricing_selected_services: [],
        auto_inspection_on_receiving: data.auto_inspection_on_receiving || false,
        auto_assembly_on_receiving: data.auto_assembly_on_receiving || false,
        auto_repair_on_damage: data.auto_repair_on_damage || false,
        auto_quarantine_damaged_items: data.auto_quarantine_damaged_items || false,
        require_sidemark: data.require_sidemark || false,
        require_inspection_photos: data.require_inspection_photos || false,
        hide_internal_fields_from_clients: data.hide_internal_fields_from_clients || false,
        default_receiving_status: data.default_receiving_status || 'available',
        default_receiving_location_id: data.default_receiving_location_id || '',
        use_tenant_email_defaults: data.use_tenant_email_defaults ?? true,
        use_tenant_communication_defaults: data.use_tenant_communication_defaults ?? true,
        disable_email_communications: data.disable_email_communications || false,
        copy_from_account_id: data.copy_from_account_id || 'none',
        email_subject_override: data.email_subject_override || '',
        email_html_body_override: data.email_html_body_override || '',
        email_recipients_override: data.email_recipients_override || '',
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
        parent_account_id: data.parent_account_id === 'none' ? null : data.parent_account_id || null,
        notes: data.notes || null,
        primary_contact_name: data.primary_contact_name || null,
        primary_contact_email: data.primary_contact_email || null,
        primary_contact_phone: data.primary_contact_phone || null,
        billing_contact_name: data.billing_contact_name || null,
        billing_contact_email: data.billing_contact_email || null,
        billing_contact_phone: data.billing_contact_phone || null,
        alerts_contact_name: data.alerts_contact_name || null,
        alerts_contact_email: data.alerts_contact_email || null,
        account_alert_recipients: data.account_alert_recipients || null,
        billing_address: data.billing_address || null,
        billing_city: data.billing_city || null,
        billing_state: data.billing_state || null,
        billing_postal_code: data.billing_postal_code || null,
        billing_country: data.billing_country || null,
        billing_type: data.billing_type || null,
        billing_method: data.billing_method || null,
        billing_frequency: data.billing_frequency || null,
        billing_schedule: data.billing_schedule || null,
        payment_terms: data.payment_terms || null,
        currency: data.currency || null,
        billing_net_terms: data.billing_net_terms || null,
        net_terms: data.net_terms || null,
        credit_limit: data.credit_limit || null,
        credit_limit_amount: data.credit_limit_amount || null,
        prepay_required: data.prepay_required || false,
        credit_hold: data.credit_hold || false,
        pricing_level: data.pricing_level || null,
        rate_card_id: data.rate_card_id === 'default' ? null : data.rate_card_id || null,
        auto_inspection_on_receiving: data.auto_inspection_on_receiving || false,
        auto_assembly_on_receiving: data.auto_assembly_on_receiving || false,
        auto_repair_on_damage: data.auto_repair_on_damage || false,
        auto_quarantine_damaged_items: data.auto_quarantine_damaged_items || false,
        require_sidemark: data.require_sidemark || false,
        require_inspection_photos: data.require_inspection_photos || false,
        hide_internal_fields_from_clients: data.hide_internal_fields_from_clients || false,
        default_receiving_status: data.default_receiving_status || null,
        default_receiving_location_id: data.default_receiving_location_id || null,
        use_tenant_email_defaults: data.use_tenant_email_defaults ?? true,
        use_tenant_communication_defaults: data.use_tenant_communication_defaults ?? true,
        disable_email_communications: data.disable_email_communications || false,
        copy_from_account_id: data.copy_from_account_id === 'none' ? null : data.copy_from_account_id || null,
        email_subject_override: data.email_subject_override || null,
        email_html_body_override: data.email_html_body_override || null,
        email_recipients_override: data.email_recipients_override || null,
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
                <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 mb-4 gap-1 h-auto">
                  <TabsTrigger value="basic" className="text-xs sm:text-sm px-2 sm:px-3 truncate min-w-0">Basic</TabsTrigger>
                  <TabsTrigger value="contacts" className="text-xs sm:text-sm px-2 sm:px-3 truncate min-w-0">Contacts</TabsTrigger>
                  <TabsTrigger value="pricing" className="text-xs sm:text-sm px-2 sm:px-3 truncate min-w-0">Pricing</TabsTrigger>
                  <TabsTrigger value="billing" className="text-xs sm:text-sm px-2 sm:px-3 truncate min-w-0">Billing</TabsTrigger>
                  <TabsTrigger value="automations" className="text-xs sm:text-sm px-2 sm:px-3 truncate min-w-0">Automations</TabsTrigger>
                  <TabsTrigger value="inventory" className="text-xs sm:text-sm px-2 sm:px-3 truncate min-w-0">Inventory</TabsTrigger>
                  <TabsTrigger value="permissions" className="text-xs sm:text-sm px-2 sm:px-3 truncate min-w-0">Permissions</TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[50vh] pr-4">
                  {/* Basic Tab */}
                  <TabsContent value="basic" className="space-y-4 mt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                {ACCOUNT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="is_master_account"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (!checked) {
                                    form.setValue('parent_account_id', 'none');
                                  }
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-normal">
                                Sub Account
                              </FormLabel>
                              <FormDescription>
                                Check if this is a sub-account of another primary account
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />

                      {form.watch('is_master_account') && (
                        <FormField
                          control={form.control}
                          name="parent_account_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Account</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Search and select primary account..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">Select a primary account</SelectItem>
                                  {accounts
                                    .filter((a) => a.id !== accountId)
                                    .map((a) => (
                                      <SelectItem key={a.id} value={a.id}>
                                        {a.account_name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Primary account users automatically have access to this sub-account.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

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
                      <h4 className="text-sm font-medium mb-3">Alerts Contact</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="alerts_contact_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Operations Manager" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="alerts_contact_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="alerts@example.com" {...field} />
                              </FormControl>
                              <FormDescription>
                                Receives system alerts and notifications
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-3">Alert Recipients</h4>
                      <FormField
                        control={form.control}
                        name="account_alert_recipients"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Recipients</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="john@example.com, +1-555-123-4567, jane@example.com"
                                className="resize-none"
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Comma-separated emails and phone numbers for all account alerts. 
                              Available in templates as {'{{account_contact_email}}'}, {'{{account_contact_phone}}'}, and {'{{account_contact_recipients_raw}}'}.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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

                  {/* Pricing Tab */}
                  <TabsContent value="pricing" className="space-y-4 mt-0">
                    <FormField
                      control={form.control}
                      name="pricing_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pricing Setup Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select pricing method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PRICING_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value}>
                                  {level.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Priority: Fixed rate overrides &gt; % adjustments &gt; Base price list
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />


                    {form.watch('pricing_level') === 'rate_card' && (
                      <FormField
                        control={form.control}
                        name="rate_card_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate Card</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select rate card" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="default">Default Rate Card</SelectItem>
                                {rateCards.map((card) => (
                                  <SelectItem key={card.id} value={card.id}>
                                    {card.rate_card_name} ({card.rate_card_code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Rate cards can be managed in Settings &gt; Rate Cards
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {form.watch('pricing_level') === 'percentage' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="pricing_percentage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Percentage Adjustment (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="e.g., 10 for markup, -10 for discount"
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Positive = markup, Negative = discount
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="pricing_apply_to"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Apply To</FormLabel>
                                <Select 
                                  onValueChange={(value) => {
                                    field.onChange(value);
                                    if (value === 'selected') {
                                      setServiceSelectionOpen(true);
                                    }
                                  }} 
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select scope" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {PRICING_APPLY_TO.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Show selected services when "Select Services" is chosen */}
                        {form.watch('pricing_apply_to') === 'selected' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <FormLabel>Selected Services</FormLabel>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                onClick={() => setServiceSelectionOpen(true)}
                              >
                                Edit Selection
                              </Button>
                            </div>
                            <div className="rounded-md border p-3">
                              {(form.watch('pricing_selected_services') || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No services selected. Click "Edit Selection" to choose services.</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {(form.watch('pricing_selected_services') || []).map((serviceKey) => {
                                    const service = AVAILABLE_SERVICES.find(s => s.key === serviceKey);
                                    return service ? (
                                      <span 
                                        key={serviceKey}
                                        className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                                      >
                                        {service.label}
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Service Selection Dialog */}
                        <Dialog open={serviceSelectionOpen} onOpenChange={setServiceSelectionOpen}>
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>Select Services</DialogTitle>
                              <DialogDescription>
                                Choose which services the {form.watch('pricing_percentage') || 0}% adjustment will apply to.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto py-4">
                              {AVAILABLE_SERVICES.map((service) => {
                                const currentSelected = form.watch('pricing_selected_services') || [];
                                const isSelected = currentSelected.includes(service.key);
                                return (
                                  <div 
                                    key={service.key}
                                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                                    }`}
                                    onClick={() => {
                                      const current = form.getValues('pricing_selected_services') || [];
                                      if (current.includes(service.key)) {
                                        form.setValue('pricing_selected_services', current.filter(s => s !== service.key));
                                      } else {
                                        form.setValue('pricing_selected_services', [...current, service.key]);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isSelected} />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{service.label}</p>
                                      <p className="text-xs text-muted-foreground">{service.description}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <DialogFooter>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => form.setValue('pricing_selected_services', [])}
                              >
                                Clear All
                              </Button>
                              <Button 
                                type="button" 
                                variant="outline"
                                onClick={() => form.setValue('pricing_selected_services', AVAILABLE_SERVICES.map(s => s.key))}
                              >
                                Select All
                              </Button>
                              <Button type="button" onClick={() => setServiceSelectionOpen(false)}>
                                Done
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Pricing Priority</p>
                      <p>When calculating charges, the system applies pricing in this order:</p>
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Fixed price overrides (item or service level)</li>
                        <li>Percentage adjustments from this account</li>
                        <li>Base price from assigned rate card or default list</li>
                      </ol>
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
