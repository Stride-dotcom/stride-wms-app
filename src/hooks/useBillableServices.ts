import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type ServiceRow = Database['public']['Tables']['billable_services']['Row'];
type ServiceInsert = Database['public']['Tables']['billable_services']['Insert'];
type ServiceUpdate = Database['public']['Tables']['billable_services']['Update'];

export type BillableService = ServiceRow;
export type ServiceCategory = 'item_service' | 'accessorial' | 'storage' | 'labor' | 'addon';
export type ChargeUnit = 'per_item' | 'per_hour' | 'per_day' | 'per_cubic_foot' | 'flat' | 'per_event';

export function useBillableServices(category?: ServiceCategory) {
  const [services, setServices] = useState<BillableService[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchServices = useCallback(async () => {
    if (!profile?.tenant_id) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('billable_services')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching billable services:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load billable services',
      });
    } finally {
      setLoading(false);
    }
  }, [category, profile?.tenant_id, toast]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const createService = async (data: Omit<ServiceInsert, 'tenant_id'>) => {
    if (!profile?.tenant_id) throw new Error('No tenant');
    
    const { data: result, error } = await supabase
      .from('billable_services')
      .insert([{ ...data, tenant_id: profile.tenant_id }])
      .select()
      .single();

    if (error) throw error;
    await fetchServices();
    return result;
  };

  const updateService = async (id: string, data: ServiceUpdate) => {
    const { data: result, error } = await supabase
      .from('billable_services')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await fetchServices();
    return result;
  };

  const deleteService = async (id: string) => {
    const { error } = await supabase
      .from('billable_services')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    await fetchServices();
  };

  const getServiceByCode = useCallback((code: string): BillableService | undefined => {
    return services.find(s => s.code === code);
  }, [services]);

  return {
    services,
    loading,
    refetch: fetchServices,
    createService,
    updateService,
    deleteService,
    getServiceByCode,
  };
}
