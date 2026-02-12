import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type DiscrepancyType =
  | 'PIECES_MISMATCH'
  | 'DAMAGE'
  | 'WET'
  | 'OPEN'
  | 'MISSING_DOCS'
  | 'REFUSED'
  | 'OTHER';

export type DiscrepancyStatus = 'open' | 'resolved';

export interface ReceivingDiscrepancy {
  id: string;
  tenant_id: string;
  shipment_id: string;
  type: DiscrepancyType;
  details: Record<string, unknown>;
  status: DiscrepancyStatus;
  resolution_notes: string | null;
  created_at: string;
  created_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface CreateDiscrepancyParams {
  shipmentId: string;
  type: DiscrepancyType;
  details?: Record<string, unknown>;
}

interface UseReceivingDiscrepanciesReturn {
  discrepancies: ReceivingDiscrepancy[];
  loading: boolean;
  openCount: number;
  createDiscrepancy: (params: CreateDiscrepancyParams) => Promise<ReceivingDiscrepancy | null>;
  resolveDiscrepancy: (id: string, notes: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useReceivingDiscrepancies(shipmentId: string | undefined): UseReceivingDiscrepanciesReturn {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [discrepancies, setDiscrepancies] = useState<ReceivingDiscrepancy[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDiscrepancies = useCallback(async () => {
    if (!shipmentId || !profile?.tenant_id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('receiving_discrepancies')
        .select('*')
        .eq('shipment_id', shipmentId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDiscrepancies(data || []);
    } catch (err) {
      console.error('[useReceivingDiscrepancies] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, profile?.tenant_id]);

  useEffect(() => {
    fetchDiscrepancies();
  }, [fetchDiscrepancies]);

  const createDiscrepancy = useCallback(async (
    params: CreateDiscrepancyParams
  ): Promise<ReceivingDiscrepancy | null> => {
    if (!profile?.tenant_id || !profile?.id) return null;

    try {
      const { data, error } = await (supabase as any)
        .from('receiving_discrepancies')
        .insert({
          tenant_id: profile.tenant_id,
          shipment_id: params.shipmentId,
          type: params.type,
          details: params.details || {},
          status: 'open',
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      setDiscrepancies(prev => [data, ...prev]);
      return data;
    } catch (err: any) {
      console.error('[useReceivingDiscrepancies] create error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to create discrepancy',
      });
      return null;
    }
  }, [profile?.tenant_id, profile?.id, toast]);

  const resolveDiscrepancy = useCallback(async (
    id: string,
    notes: string
  ): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { error } = await (supabase as any)
        .from('receiving_discrepancies')
        .update({
          status: 'resolved',
          resolution_notes: notes,
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id,
        })
        .eq('id', id);

      if (error) throw error;

      setDiscrepancies(prev =>
        prev.map(d =>
          d.id === id
            ? {
                ...d,
                status: 'resolved' as const,
                resolution_notes: notes,
                resolved_at: new Date().toISOString(),
                resolved_by: profile.id,
              }
            : d
        )
      );
      toast({ title: 'Resolved', description: 'Discrepancy has been resolved.' });
      return true;
    } catch (err: any) {
      console.error('[useReceivingDiscrepancies] resolve error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to resolve discrepancy',
      });
      return false;
    }
  }, [profile?.id, toast]);

  const openCount = discrepancies.filter(d => d.status === 'open').length;

  return {
    discrepancies,
    loading,
    openCount,
    createDiscrepancy,
    resolveDiscrepancy,
    refetch: fetchDiscrepancies,
  };
}
