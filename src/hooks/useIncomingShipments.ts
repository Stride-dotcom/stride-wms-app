import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type ShipmentRow = Database['public']['Tables']['shipments']['Row'];

export type InboundKind = 'manifest' | 'expected' | 'dock_intake';

export interface IncomingShipment extends ShipmentRow {
  account_name?: string | null;
  open_items_count?: number;
  received_items_sum?: number;
}

export interface IncomingFilters {
  inbound_kind: InboundKind;
  search?: string;
  status?: string;
}

export function useIncomingShipments(filters: IncomingFilters) {
  const [shipments, setShipments] = useState<IncomingShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('shipments')
        .select('*, accounts(account_name), shipment_items(id)')
        .eq('shipment_type', 'inbound')
        .eq('inbound_kind', filters.inbound_kind)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('inbound_status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: IncomingShipment[] = (data || []).map((row) => {
        const acct = (row as Record<string, unknown>).accounts as { account_name: string } | null;
        const items = (row as Record<string, unknown>).shipment_items as { id: string }[] | null;
        return {
          ...row,
          account_name: acct?.account_name || null,
          open_items_count: items?.length ?? 0,
          accounts: undefined,
          shipment_items: undefined,
        } as unknown as IncomingShipment;
      });

      // Client-side search to include account_name matching
      const filtered = filters.search
        ? mapped.filter((s) => {
            const q = filters.search!.toLowerCase();
            return (
              s.shipment_number?.toLowerCase().includes(q) ||
              s.vendor_name?.toLowerCase().includes(q) ||
              (s.notes as string | null)?.toLowerCase().includes(q) ||
              s.tracking_number?.toLowerCase().includes(q) ||
              s.account_name?.toLowerCase().includes(q)
            );
          })
        : mapped;

      setShipments(filtered);
    } catch (error) {
      console.error('Error fetching incoming shipments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load incoming shipments.',
      });
    } finally {
      setLoading(false);
    }
  }, [filters.inbound_kind, filters.search, filters.status, toast]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return { shipments, loading, refetch: fetchShipments };
}
