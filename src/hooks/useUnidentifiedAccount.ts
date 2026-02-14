import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Fetches (or creates) the UNIDENTIFIED SHIPMENT system account for the current tenant.
 * Calls the ensure_unidentified_account() DB function which is idempotent.
 */
export function useUnidentifiedAccount() {
  const { profile } = useAuth();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await (supabase as any).rpc('ensure_unidentified_account', {
        p_tenant_id: profile.tenant_id,
      });
      if (error) throw error;
      setAccountId(data as string);
    } catch (err) {
      console.error('[useUnidentifiedAccount] Error:', err);
      // Fallback: try to find existing
      try {
        const { data } = await supabase
          .from('accounts')
          .select('id')
          .eq('tenant_id', profile.tenant_id)
          .eq('account_name', 'UNIDENTIFIED SHIPMENT')
          .eq('is_active', true)
          .limit(1)
          .single();
        if (data) setAccountId(data.id);
      } catch {
        // no-op
      }
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { unidentifiedAccountId: accountId, loading };
}
