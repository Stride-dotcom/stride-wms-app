import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type UnitRow = Database['public']['Tables']['inventory_units']['Row'];
type UnitUpdate = Database['public']['Tables']['inventory_units']['Update'];

export interface UnitSearchParams {
  search?: string;
  status?: string;
  accountId?: string;
  locationId?: string;
  containerId?: string;
  limit?: number;
}

/**
 * Dedicated CRUD hook for inventory_units.
 * Relies on RLS + authenticated session for tenant isolation.
 */
export function useInventoryUnits() {
  const { toast } = useToast();

  const getUnitById = useCallback(async (unitId: string): Promise<UnitRow | null> => {
    try {
      const { data, error } = await supabase
        .from('inventory_units')
        .select('*')
        .eq('id', unitId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[useInventoryUnits] getUnitById error:', error);
      return null;
    }
  }, []);

  const searchUnits = useCallback(async (params: UnitSearchParams): Promise<UnitRow[]> => {
    try {
      let query = supabase
        .from('inventory_units')
        .select('*')
        .order('ic_code');

      if (params.status) {
        query = query.eq('status', params.status);
      }
      if (params.accountId) {
        query = query.eq('account_id', params.accountId);
      }
      if (params.locationId) {
        query = query.eq('location_id', params.locationId);
      }
      if (params.containerId) {
        query = query.eq('container_id', params.containerId);
      }
      if (params.search) {
        query = query.ilike('ic_code', `%${params.search}%`);
      }
      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[useInventoryUnits] searchUnits error:', error);
      toast({
        variant: 'destructive',
        title: 'Search Failed',
        description: 'Failed to search inventory units.',
      });
      return [];
    }
  }, [toast]);

  const updateUnit = useCallback(async (
    unitId: string,
    patch: Omit<UnitUpdate, 'id' | 'tenant_id'>
  ): Promise<UnitRow | null> => {
    try {
      const { data, error } = await supabase
        .from('inventory_units')
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq('id', unitId)
        .select()
        .maybeSingle();

      if (error) throw error;

      toast({
        title: 'Unit Updated',
        description: 'Inventory unit has been updated.',
      });
      return data;
    } catch (error) {
      console.error('[useInventoryUnits] updateUnit error:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update inventory unit.',
      });
      return null;
    }
  }, [toast]);

  return {
    getUnitById,
    searchUnits,
    updateUnit,
  };
}
