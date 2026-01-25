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
  flag_type: 'boolean' | 'enum' | 'number';
  is_active: boolean;
  visible_to_client: boolean;
  client_can_set: boolean;
  adds_percent: number;
  adds_minutes: number;
  applies_to_services: string;
  triggers_task_type: string | null;
  triggers_alert: boolean;
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
    mutationFn: async (flag: Omit<PricingFlag, 'id' | 'tenant_id'>) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await (supabase as any)
        .from('pricing_flags')
        .insert({ ...flag, tenant_id: profile.tenant_id })
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
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ itemId, flagId, value }: { itemId: string; flagId: string; value: string }) => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await (supabase
        .from('item_flags') as any)
        .upsert({
          tenant_id: profile.tenant_id,
          item_id: itemId,
          flag_id: flagId,
          value,
          set_by: user?.id,
          set_at: new Date().toISOString(),
        }, {
          onConflict: 'item_id,flag_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['item-flags', variables.itemId] });
    },
    onError: (error) => {
      console.error('Error setting item flag:', error);
      toast.error('Failed to set flag');
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
