import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface SizeCategory {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  min_cubic_feet: number | null;
  max_cubic_feet: number | null;
  storage_rate_per_day: number;
  inspection_fee_per_item: number;
  default_inspection_minutes: number;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
}

export interface GlobalServiceRate {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  charge_unit: string;
  base_rate: number | null;
  pricing_mode: 'flat' | 'per_size' | 'assembly_tier' | 'manual';
  is_taxable: boolean;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
}

export interface AssemblyTier {
  id: string;
  tenant_id: string;
  tier_number: number;
  display_name: string;
  billing_mode: 'flat_per_item' | 'per_minute' | 'manual_quote';
  rate: number | null;
  default_minutes: number | null;
  requires_special_installer: boolean;
  requires_manual_quote: boolean;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
}

export interface PricingFlag {
  id: string;
  tenant_id: string;
  flag_key: string;
  display_name: string;
  description: string | null;
  flag_type: 'boolean' | 'enum' | 'number';
  is_active: boolean;
  visible_to_client: boolean;
  client_can_set: boolean;
  adds_percent: number;
  adds_minutes: number;
  flat_fee: number;
  applies_to_services: string;
  triggers_task_type: string | null;
  triggers_alert: boolean;
  creates_billing_event: boolean;
  billing_charge_type: string | null;
  is_billable: boolean;
  icon: string;
  color: string;
  sort_order: number;
  notes: string | null;
}

export interface ItemFlag {
  id: string;
  tenant_id: string;
  item_id: string;
  flag_id: string;
  value: string;
  set_by: string | null;
  set_at: string;
  flag?: PricingFlag;
}

export interface AccountPricingOverride {
  id: string;
  tenant_id: string;
  account_id: string;
  percent_adjust: number;
  created_at: string;
  created_by: string | null;
}

export interface FlagServiceRule {
  id: string;
  tenant_id: string;
  flag_id: string;
  service_code: string;
  adds_percent: number;
  adds_flat_fee: number;
  adds_minutes: number;
  multiplier: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountServiceSetting {
  id: string;
  tenant_id: string;
  account_id: string;
  service_code: string;
  is_enabled: boolean;
  custom_rate: number | null;
  custom_percent_adjust: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingCalculationBreakdown {
  service_code: string;
  calculated_at: string;
  base_rate_source: string;
  base_rate: number;
  size_category?: string;
  assembly_tier?: number;
  flags_applied?: Array<{
    flag: string;
    source: string;
    adds_percent: number;
    adds_flat: number;
    adds_minutes: number;
  }>;
  rate_after_flags?: number;
  account_adjustment_percent?: number;
  rate_after_account_adj?: number;
  final_rate: number;
  final_minutes: number;
}

export interface PricingExportData {
  size_categories: SizeCategory[];
  assembly_tiers: AssemblyTier[];
  services: GlobalServiceRate[];
  flags: PricingFlag[];
  flag_service_rules: Array<{
    flag_key: string;
    service_code: string;
    adds_percent: number;
    adds_flat_fee: number;
    adds_minutes: number;
    multiplier: number;
  }>;
  export_timestamp: string;
  tenant_id: string;
}

// ============================================================================
// Size Categories (Classes) Hooks
// ============================================================================

export function useSizeCategories() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['size-categories', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await (supabase as any)
        .from('classes')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as SizeCategory[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useUpdateSizeCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: Partial<SizeCategory> & { id: string }) => {
      const { id, ...updateData } = category;
      const { data, error } = await supabase
        .from('classes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['size-categories'] });
      toast.success('Size category updated');
    },
    onError: (error) => {
      console.error('Error updating size category:', error);
      toast.error('Failed to update size category');
    },
  });
}

// ============================================================================
// Global Service Rates Hooks
// ============================================================================

export function useGlobalServiceRates() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['global-service-rates', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await (supabase as any)
        .from('billable_services')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as GlobalServiceRate[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useUpdateGlobalServiceRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (service: Partial<GlobalServiceRate> & { id: string }) => {
      const { id, ...updateData } = service;
      const { data, error } = await supabase
        .from('billable_services')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-service-rates'] });
      toast.success('Service rate updated');
    },
    onError: (error) => {
      console.error('Error updating service rate:', error);
      toast.error('Failed to update service rate');
    },
  });
}

// ============================================================================
// Assembly Tiers Hooks
// ============================================================================

export function useAssemblyTiers() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['assembly-tiers', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await (supabase as any)
        .from('assembly_tiers')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as AssemblyTier[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useUpdateAssemblyTier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tier: Partial<AssemblyTier> & { id: string }) => {
      const { id, ...updateData } = tier;
      const { data, error } = await (supabase as any)
        .from('assembly_tiers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assembly-tiers'] });
      toast.success('Assembly tier updated');
    },
    onError: (error) => {
      console.error('Error updating assembly tier:', error);
      toast.error('Failed to update assembly tier');
    },
  });
}

// ============================================================================
// Pricing Flags Hooks
// ============================================================================

export function usePricingFlags() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['pricing-flags', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await (supabase as any)
        .from('pricing_flags')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as PricingFlag[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useUpdatePricingFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flag: Partial<PricingFlag> & { id: string }) => {
      const { id, ...updateData } = flag;
      const { data, error } = await (supabase as any)
        .from('pricing_flags')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-flags'] });
      toast.success('Flag updated');
    },
    onError: (error) => {
      console.error('Error updating flag:', error);
      toast.error('Failed to update flag');
    },
  });
}

export function useCreatePricingFlag() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (flag: Partial<PricingFlag> & { flag_key: string; display_name: string }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('pricing_flags')
        .insert({
          ...flag,
          tenant_id: profile.tenant_id,
          flag_type: flag.flag_type || 'boolean',
          is_active: flag.is_active ?? true,
          visible_to_client: flag.visible_to_client ?? true,
          client_can_set: flag.client_can_set ?? false,
          adds_percent: flag.adds_percent ?? 0,
          adds_minutes: flag.adds_minutes ?? 0,
          flat_fee: flag.flat_fee ?? 0,
          applies_to_services: flag.applies_to_services || 'ALL',
          triggers_alert: flag.triggers_alert ?? false,
          creates_billing_event: flag.creates_billing_event ?? false,
          is_billable: flag.is_billable ?? false,
          icon: flag.icon || 'flag',
          color: flag.color || 'default',
          sort_order: flag.sort_order ?? 99,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-flags'] });
      toast.success('Flag created');
    },
    onError: (error) => {
      console.error('Error creating flag:', error);
      toast.error('Failed to create flag');
    },
  });
}

export function useDeletePricingFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await (supabase
        .from('pricing_flags') as any)
        .delete()
        .eq('id', flagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-flags'] });
      toast.success('Flag deleted');
    },
    onError: (error) => {
      console.error('Error deleting flag:', error);
      toast.error('Failed to delete flag');
    },
  });
}

// ============================================================================
// Item Flags Hooks
// ============================================================================

export function useItemFlags(itemId: string | undefined) {
  return useQuery({
    queryKey: ['item-flags', itemId],
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error } = await (supabase
        .from('item_flags') as any)
        .select(`
          *,
          flag:pricing_flags(*)
        `)
        .eq('item_id', itemId);

      if (error) throw error;
      return data as ItemFlag[];
    },
    enabled: !!itemId,
  });
}

export function useSetItemFlag() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ itemId, flagKey, notes }: { itemId: string; flagKey: string; notes?: string }) => {
      // Use the RPC function for automatic billing/task creation
      const { data, error } = await supabase.rpc('set_item_flag', {
        p_item_id: itemId,
        p_flag_key: flagKey,
        p_user_id: user?.id || null,
        p_notes: notes || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; item_flag_id?: string; billing_event_id?: string; task_id?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to set flag');
      }

      return result;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item-flags', variables.itemId] });
      queryClient.invalidateQueries({ queryKey: ['items', variables.itemId] });
      if (result.billing_event_id) {
        queryClient.invalidateQueries({ queryKey: ['billing-events'] });
      }
      if (result.task_id) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    },
    onError: (error) => {
      console.error('Error setting item flag:', error);
      toast.error('Failed to set flag');
    },
  });
}

export function useUnsetItemFlag() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ itemId, flagKey }: { itemId: string; flagKey: string }) => {
      // Use the RPC function
      const { data, error } = await supabase.rpc('unset_item_flag', {
        p_item_id: itemId,
        p_flag_key: flagKey,
        p_user_id: user?.id || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to unset flag');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item-flags', variables.itemId] });
      queryClient.invalidateQueries({ queryKey: ['items', variables.itemId] });
      queryClient.invalidateQueries({ queryKey: ['billing-events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Error unsetting item flag:', error);
      toast.error('Failed to remove flag');
    },
  });
}

export function useRemoveItemFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, flagId }: { itemId: string; flagId: string }) => {
      const { error } = await (supabase
        .from('item_flags') as any)
        .delete()
        .eq('item_id', itemId)
        .eq('flag_id', flagId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item-flags', variables.itemId] });
    },
    onError: (error) => {
      console.error('Error removing item flag:', error);
      toast.error('Failed to remove flag');
    },
  });
}

// ============================================================================
// Account Pricing Overrides Hooks
// ============================================================================

export function useAccountPricingOverrides() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['account-pricing-overrides', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('account_rate_adjustments')
        .select(`
          *,
          account:accounts(id, account_code, account_name)
        `)
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useAccountPricingOverride(accountId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['account-pricing-override', accountId],
    queryFn: async () => {
      if (!accountId || !profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from('account_rate_adjustments')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('account_id', accountId)
        .maybeSingle();

      if (error) throw error;
      return data as AccountPricingOverride | null;
    },
    enabled: !!accountId && !!profile?.tenant_id,
  });
}

export function useUpsertAccountPricingOverride() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ accountId, percentAdjust }: { accountId: string; percentAdjust: number }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('account_rate_adjustments')
        .upsert({
          tenant_id: profile.tenant_id,
          account_id: accountId,
          percent_adjust: percentAdjust / 100, // Convert from percentage to decimal
          created_by: user?.id,
        }, {
          onConflict: 'tenant_id,account_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-pricing-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['account-pricing-override', variables.accountId] });
      toast.success('Account pricing updated');
    },
    onError: (error) => {
      console.error('Error updating account pricing:', error);
      toast.error('Failed to update account pricing');
    },
  });
}

// ============================================================================
// Seed Default Pricing
// ============================================================================

export function useSeedDefaultPricing() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { error } = await (supabase as any).rpc('seed_default_pricing', {
        p_tenant_id: profile.tenant_id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['size-categories'] });
      queryClient.invalidateQueries({ queryKey: ['assembly-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-flags'] });
      queryClient.invalidateQueries({ queryKey: ['global-service-rates'] });
      toast.success('Default pricing data loaded');
    },
    onError: (error) => {
      console.error('Error seeding pricing:', error);
      toast.error('Failed to load default pricing');
    },
  });
}

// ============================================================================
// Calculate Service Price (Client-side wrapper for the DB function)
// ============================================================================

export function useCalculateServicePrice() {
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      accountId,
      serviceCode,
      classId,
      assemblyTierId,
      itemId,
    }: {
      accountId?: string;
      serviceCode: string;
      classId?: string;
      assemblyTierId?: string;
      itemId?: string;
    }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await (supabase as any).rpc('calculate_service_price', {
        p_tenant_id: profile.tenant_id,
        p_account_id: accountId || null,
        p_service_code: serviceCode,
        p_class_id: classId || null,
        p_assembly_tier_id: assemblyTierId || null,
        p_item_id: itemId || null,
      });

      if (error) throw error;
      return data?.[0] as { rate: number; minutes: number; source: string; flags_applied: string[] } | undefined;
    },
  });
}

// ============================================================================
// Flag Service Rules Hooks (Per-Service Adjustments)
// ============================================================================

export function useFlagServiceRules(flagId: string | undefined) {
  return useQuery({
    queryKey: ['flag-service-rules', flagId],
    queryFn: async () => {
      if (!flagId) return [];

      const { data, error } = await (supabase
        .from('flag_service_rules') as any)
        .select('*')
        .eq('flag_id', flagId)
        .eq('is_active', true);

      if (error) throw error;
      return data as FlagServiceRule[];
    },
    enabled: !!flagId,
  });
}

export function useAllFlagServiceRules() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['all-flag-service-rules', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await (supabase
        .from('flag_service_rules') as any)
        .select(`
          *,
          flag:pricing_flags(flag_key, display_name)
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true);

      if (error) throw error;
      return data as (FlagServiceRule & { flag: { flag_key: string; display_name: string } })[];
    },
    enabled: !!profile?.tenant_id,
  });
}

export function useUpsertFlagServiceRule() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (rule: Partial<FlagServiceRule> & { flag_id: string; service_code: string }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await (supabase
        .from('flag_service_rules') as any)
        .upsert({
          tenant_id: profile.tenant_id,
          flag_id: rule.flag_id,
          service_code: rule.service_code,
          adds_percent: rule.adds_percent ?? 0,
          adds_flat_fee: rule.adds_flat_fee ?? 0,
          adds_minutes: rule.adds_minutes ?? 0,
          multiplier: rule.multiplier ?? 1,
          is_active: rule.is_active ?? true,
          notes: rule.notes,
        }, {
          onConflict: 'flag_id,service_code',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['flag-service-rules', variables.flag_id] });
      queryClient.invalidateQueries({ queryKey: ['all-flag-service-rules'] });
      toast.success('Flag service rule saved');
    },
    onError: (error) => {
      console.error('Error saving flag service rule:', error);
      toast.error('Failed to save flag service rule');
    },
  });
}

export function useDeleteFlagServiceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ flagId, serviceCode }: { flagId: string; serviceCode: string }) => {
      const { error } = await (supabase
        .from('flag_service_rules') as any)
        .delete()
        .eq('flag_id', flagId)
        .eq('service_code', serviceCode);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['flag-service-rules', variables.flagId] });
      queryClient.invalidateQueries({ queryKey: ['all-flag-service-rules'] });
      toast.success('Flag service rule deleted');
    },
    onError: (error) => {
      console.error('Error deleting flag service rule:', error);
      toast.error('Failed to delete flag service rule');
    },
  });
}

// ============================================================================
// Account Service Settings Hooks (Enable/Disable Services per Account)
// ============================================================================

export function useAccountServiceSettings(accountId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['account-service-settings', accountId],
    queryFn: async () => {
      if (!accountId || !profile?.tenant_id) return [];

      const { data, error } = await (supabase
        .from('account_service_settings') as any)
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('account_id', accountId);

      if (error) throw error;
      return data as AccountServiceSetting[];
    },
    enabled: !!accountId && !!profile?.tenant_id,
  });
}

export function useUpsertAccountServiceSetting() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (setting: Partial<AccountServiceSetting> & { account_id: string; service_code: string }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await (supabase
        .from('account_service_settings') as any)
        .upsert({
          tenant_id: profile.tenant_id,
          account_id: setting.account_id,
          service_code: setting.service_code,
          is_enabled: setting.is_enabled ?? true,
          custom_rate: setting.custom_rate,
          custom_percent_adjust: setting.custom_percent_adjust,
          notes: setting.notes,
        }, {
          onConflict: 'account_id,service_code',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-service-settings', variables.account_id] });
      toast.success('Account service setting saved');
    },
    onError: (error) => {
      console.error('Error saving account service setting:', error);
      toast.error('Failed to save account service setting');
    },
  });
}

export function useDeleteAccountServiceSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, serviceCode }: { accountId: string; serviceCode: string }) => {
      const { error } = await (supabase
        .from('account_service_settings') as any)
        .delete()
        .eq('account_id', accountId)
        .eq('service_code', serviceCode);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-service-settings', variables.accountId] });
      toast.success('Account service setting deleted');
    },
    onError: (error) => {
      console.error('Error deleting account service setting:', error);
      toast.error('Failed to delete account service setting');
    },
  });
}

// ============================================================================
// Pricing Import/Export Hooks
// ============================================================================

export function useExportPricingData() {
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await supabase.rpc('get_pricing_export_data', {
        p_tenant_id: profile.tenant_id,
      });

      if (error) throw error;
      return data as PricingExportData;
    },
    onError: (error) => {
      console.error('Error exporting pricing data:', error);
      toast.error('Failed to export pricing data');
    },
  });
}

export function useImportPricingData() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ data, overwrite }: { data: Partial<PricingExportData>; overwrite: boolean }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data: result, error } = await supabase.rpc('import_pricing_data', {
        p_tenant_id: profile.tenant_id,
        p_data: data,
        p_overwrite: overwrite,
      });

      if (error) throw error;
      return result as { success: boolean; imported_counts: Record<string, number> };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['size-categories'] });
      queryClient.invalidateQueries({ queryKey: ['assembly-tiers'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-flags'] });
      queryClient.invalidateQueries({ queryKey: ['global-service-rates'] });
      queryClient.invalidateQueries({ queryKey: ['all-flag-service-rules'] });
      toast.success(`Pricing data imported successfully`);
    },
    onError: (error) => {
      console.error('Error importing pricing data:', error);
      toast.error('Failed to import pricing data');
    },
  });
}

// ============================================================================
// Enhanced Calculate Service Price V2 (with Metadata)
// ============================================================================

export function useCalculateServicePriceV2() {
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      accountId,
      serviceCode,
      classId,
      assemblyTierId,
      itemId,
    }: {
      accountId?: string;
      serviceCode: string;
      classId?: string;
      assemblyTierId?: string;
      itemId?: string;
    }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await supabase.rpc('calculate_service_price_v2', {
        p_tenant_id: profile.tenant_id,
        p_account_id: accountId || null,
        p_service_code: serviceCode,
        p_class_id: classId || null,
        p_assembly_tier_id: assemblyTierId || null,
        p_item_id: itemId || null,
      });

      if (error) throw error;
      return data?.[0] as {
        rate: number;
        minutes: number;
        source: string;
        flags_applied: string[];
        calculation_breakdown: BillingCalculationBreakdown;
      } | undefined;
    },
  });
}

// ============================================================================
// Seed Enhanced Flags (Additional Warehouse-Specific Flags)
// ============================================================================

export function useSeedEnhancedFlags() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { error } = await supabase.rpc('seed_enhanced_flags', {
        p_tenant_id: profile.tenant_id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-flags'] });
      toast.success('Enhanced flags added');
    },
    onError: (error) => {
      console.error('Error seeding enhanced flags:', error);
      toast.error('Failed to add enhanced flags');
    },
  });
}
