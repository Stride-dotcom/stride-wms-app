import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type UnitRow = Database['public']['Tables']['inventory_units']['Row'];

export interface InventoryUnitWithContainer extends UnitRow {
  container_code: string | null;
}

export interface UnitFilters {
  search?: string;
  status?: string;
  containerId?: string;
}

export function useUnitsAtLocation(locationId?: string, filters?: UnitFilters) {
  const [units, setUnits] = useState<InventoryUnitWithContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUnits = useCallback(async () => {
    if (!locationId) {
      setUnits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('inventory_units')
        .select('*, containers(container_code)')
        .eq('location_id', locationId)
        .order('ic_code');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.containerId) {
        query = query.eq('container_id', filters.containerId);
      }
      if (filters?.search) {
        query = query.ilike('ic_code', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: InventoryUnitWithContainer[] = (data || []).map((row) => {
        const containerData = row.containers as unknown as { container_code: string } | null;
        return {
          ...row,
          container_code: containerData?.container_code || null,
          containers: undefined,
        } as unknown as InventoryUnitWithContainer;
      });

      setUnits(mapped);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load inventory units.',
      });
    } finally {
      setLoading(false);
    }
  }, [locationId, filters?.search, filters?.status, filters?.containerId, toast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  return {
    units,
    loading,
    refetch: fetchUnits,
  };
}
