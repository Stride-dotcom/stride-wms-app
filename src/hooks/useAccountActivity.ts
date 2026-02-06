/**
 * useAccountActivity - Reads account_activity rows for a given account.
 * Provides filter support and newest-first ordering.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AccountActivity {
  id: string;
  tenant_id: string;
  account_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  event_type: string;
  event_label: string;
  details: Record<string, unknown>;
  created_at: string;
}

export type AccountActivityFilter = 'all' | 'billing' | 'invoicing' | 'settings';

const FILTER_PREFIX_MAP: Record<Exclude<AccountActivityFilter, 'all'>, string[]> = {
  billing: [
    'billing_event_updated',
    'billing_event_voided',
    'billing_charge_added',
  ],
  invoicing: [
    'billing_event_invoiced',
    'billing_event_uninvoiced',
    'invoice_created',
    'invoice_voided',
  ],
  settings: [
    'account_updated',
    'account_status_changed',
    'account_setting_changed',
  ],
};

export function useAccountActivity(accountId: string | undefined) {
  const [activities, setActivities] = useState<AccountActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AccountActivityFilter>('all');

  const fetchActivities = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    try {
      let query = (supabase.from('account_activity') as any)
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter !== 'all') {
        const prefixes = FILTER_PREFIX_MAP[filter];
        if (prefixes && prefixes.length > 0) {
          query = query.in('event_type', prefixes);
        }
      }

      const { data, error } = await query;

      if (error) {
        if (error.code !== '42P01') {
          console.error('[useAccountActivity] Error:', error);
        }
        setActivities([]);
        return;
      }

      setActivities(data || []);
    } catch (err) {
      console.error('[useAccountActivity] Unexpected error:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, filter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    filter,
    setFilter,
    refetch: fetchActivities,
  };
}
