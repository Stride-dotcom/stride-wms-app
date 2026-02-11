import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type UnitRow = Database['public']['Tables']['inventory_units']['Row'];

export function useContainerUnits(containerId?: string) {
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUnits = useCallback(async () => {
    if (!containerId) {
      setUnits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_units')
        .select('*')
        .eq('container_id', containerId)
        .order('ic_code');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching container units:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load container contents.',
      });
    } finally {
      setLoading(false);
    }
  }, [containerId, toast]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  return {
    units,
    loading,
    refetch: fetchUnits,
  };
}
