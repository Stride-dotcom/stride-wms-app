/**
 * useAccounts - Hook for account management
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface Account {
  id: string;
  tenant_id: string;
  account_code: string;
  account_name: string;
  account_type: string | null;
  status: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  billing_city: string | null;
  billing_state: string | null;
  credit_hold: boolean | null;
  parent_account_id: string | null;
  is_master_account: boolean | null;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchAccounts = useCallback(async () => {
    if (!profile?.tenant_id) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('accounts')
        .select(`
          id,
          tenant_id,
          account_code,
          account_name,
          account_type,
          status,
          primary_contact_name,
          primary_contact_email,
          billing_city,
          billing_state,
          credit_hold,
          parent_account_id,
          is_master_account
        `)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('account_name');

      if (error) {
        console.error('[useAccounts] Fetch failed:', error);
        toast({
          variant: 'destructive',
          title: 'Error loading accounts',
          description: error.message,
        });
        return;
      }

      setAccounts((data || []) as Account[]);
    } catch (error: any) {
      console.error('[useAccounts] Unexpected error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load accounts',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const getAccountById = useCallback((accountId: string): Account | undefined => {
    return accounts.find(a => a.id === accountId);
  }, [accounts]);

  const getActiveAccounts = useCallback(() => {
    return accounts.filter(a => a.status === 'active');
  }, [accounts]);

  return {
    accounts,
    loading,
    refetch: fetchAccounts,
    getAccountById,
    getActiveAccounts,
  };
}
