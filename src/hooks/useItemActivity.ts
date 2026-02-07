/**
 * useItemActivity - Reads item_activity rows for a given item.
 * Provides filter support and newest-first ordering.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ItemActivity {
  id: string;
  tenant_id: string;
  item_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  event_type: string;
  event_label: string;
  details: Record<string, unknown>;
  created_at: string;
}

export type ActivityFilterCategory =
  | 'all'
  | 'movements'
  | 'billing'
  | 'tasks'
  | 'notes_photos'
  | 'status_account_class';

const CATEGORY_PREFIX_MAP: Record<Exclude<ActivityFilterCategory, 'all'>, string[]> = {
  movements: ['item_moved', 'item_location_changed'],
  billing: [
    'item_flag_applied',
    'item_flag_removed',
    'item_scan_charge_applied',
    'billing_event_created',
    'billing_event_voided',
    'billing_event_invoiced',
    'billing_charge_added',
    'indicator_applied',
    'indicator_removed',
    'flag_alert_sent',
  ],
  tasks: ['task_assigned', 'task_completed', 'task_started', 'task_unable'],
  notes_photos: [
    'item_note_added',
    'item_note_edited',
    'item_note_deleted',
    'item_photo_added',
    'item_photo_removed',
  ],
  status_account_class: [
    'item_status_changed',
    'item_account_changed',
    'item_class_changed',
    'item_field_updated',
    'inventory_count_recorded',
  ],
};

export function useItemActivity(itemId: string | undefined) {
  const [activities, setActivities] = useState<ItemActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilterCategory>('all');

  const fetchActivities = useCallback(async () => {
    if (!itemId) return;

    setLoading(true);
    try {
      let query = (supabase.from('item_activity') as any)
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(200);

      // Apply filter if not 'all'
      if (filter !== 'all') {
        const prefixes = CATEGORY_PREFIX_MAP[filter];
        if (prefixes && prefixes.length > 0) {
          query = query.in('event_type', prefixes);
        }
      }

      const { data, error } = await query;

      if (error) {
        // Table might not exist yet
        if (error.code !== '42P01') {
          console.error('[useItemActivity] Error:', error);
        }
        setActivities([]);
        return;
      }

      setActivities(data || []);
    } catch (err) {
      console.error('[useItemActivity] Unexpected error:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [itemId, filter]);

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
