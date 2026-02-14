import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnidentifiedAccount() {
  const { profile } = useAuth();
  const [ensuring, setEnsuring] = useState(false);

  const ensureUnidentifiedAccount = useCallback(
    async (tenantIdOverride?: string): Promise<string | null> => {
      const tenantId = tenantIdOverride ?? profile?.tenant_id;
      if (!tenantId) return null;

      setEnsuring(true);
      try {
        const { data, error } = await (supabase as any).rpc('ensure_unidentified_account', {
          p_tenant_id: tenantId,
        });

        if (error) {
          console.warn('[useUnidentifiedAccount] ensure_unidentified_account failed:', error);
          return null;
        }

        return (data as string | null) ?? null;
      } catch (err) {
        console.warn('[useUnidentifiedAccount] ensure_unidentified_account rpc error:', err);
        return null;
      } finally {
        setEnsuring(false);
      }
    },
    [profile?.tenant_id]
  );

  return {
    ensuring,
    ensureUnidentifiedAccount,
  };
}
