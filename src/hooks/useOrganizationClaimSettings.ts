import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface OrganizationClaimSettings {
  id: string;
  tenant_id: string;
  approval_threshold_amount: number;
  approval_required_above_threshold: boolean;
  default_payout_method: 'credit' | 'check' | 'ach';
  settlement_terms_template: string | null;
  acceptance_token_expiry_days: number;
  auto_create_repair_task: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationClaimSettingsUpdate {
  approval_threshold_amount?: number;
  approval_required_above_threshold?: boolean;
  default_payout_method?: 'credit' | 'check' | 'ach';
  settlement_terms_template?: string | null;
  acceptance_token_expiry_days?: number;
  auto_create_repair_task?: boolean;
}

const DEFAULT_SETTINGS: Omit<OrganizationClaimSettings, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
  approval_threshold_amount: 1000,
  approval_required_above_threshold: true,
  default_payout_method: 'credit',
  settlement_terms_template: null,
  acceptance_token_expiry_days: 30,
  auto_create_repair_task: true,
};

const DEFAULT_TERMS_TEMPLATE = `By accepting this settlement, you acknowledge and agree that:

1. The payment represents the complete and final settlement of this claim.
2. You release the warehouse, its employees, agents, and affiliates from any and all claims, demands, damages, actions, or causes of action arising from or related to the items and/or property described in this claim.
3. The warehouse shall have no further liability, obligation, or responsibility regarding the items or property covered by this claim.
4. You waive any right to pursue additional compensation or make future claims related to the items, property, or incidents described herein.
5. You confirm that you have read and understand these terms, and are accepting this settlement voluntarily.`;

export function useOrganizationClaimSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<OrganizationClaimSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organization_claim_settings')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as OrganizationClaimSettings);
      } else {
        // Create default settings if none exist
        const { data: newSettings, error: insertError } = await supabase
          .from('organization_claim_settings')
          .insert({
            tenant_id: profile.tenant_id,
            ...DEFAULT_SETTINGS,
            settlement_terms_template: DEFAULT_TERMS_TEMPLATE,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings as OrganizationClaimSettings);
      }
    } catch (error) {
      console.error('Error fetching claim settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load claim settings',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: OrganizationClaimSettingsUpdate): Promise<boolean> => {
    if (!profile?.tenant_id || !settings) return false;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('organization_claim_settings')
        .update(updates)
        .eq('tenant_id', profile.tenant_id)
        .select()
        .single();

      if (error) throw error;

      setSettings(data as OrganizationClaimSettings);
      toast({
        title: 'Settings Saved',
        description: 'Claim settings have been updated.',
      });
      return true;
    } catch (error) {
      console.error('Error updating claim settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save claim settings',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Helper to get settings with defaults
  const getSettings = (): OrganizationClaimSettings => {
    if (settings) return settings;
    return {
      id: '',
      tenant_id: profile?.tenant_id || '',
      ...DEFAULT_SETTINGS,
      settlement_terms_template: DEFAULT_TERMS_TEMPLATE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  return {
    settings: getSettings(),
    loading,
    saving,
    updateSettings,
    refetch: fetchSettings,
  };
}
