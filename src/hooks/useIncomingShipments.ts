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
  exception_count?: number;
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

  const includesSearchTerm = (value: string | null | undefined, term: string): boolean => {
    if (!value) return false;
    return value.toLowerCase().includes(term);
  };

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

      const mappedShipments: IncomingShipment[] = (data || []).map((row) => {
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

      let filtered = mappedShipments;
      const searchTerm = filters.search?.trim().toLowerCase() || '';

      // Full-field search contract for inbound lists:
      // shipment-level fields + line-level fields + external refs.
      if (searchTerm && mappedShipments.length > 0) {
        const matchedShipmentIds = new Set<string>();
        const shipmentIds = mappedShipments.map((shipment) => shipment.id);

        // Shipment-level matches
        for (const shipment of mappedShipments) {
          if (
            includesSearchTerm(shipment.shipment_number, searchTerm) ||
            includesSearchTerm(shipment.vendor_name, searchTerm) ||
            includesSearchTerm(shipment.tracking_number, searchTerm) ||
            includesSearchTerm(shipment.notes, searchTerm) ||
            includesSearchTerm(shipment.account_name || null, searchTerm) ||
            includesSearchTerm(shipment.status, searchTerm) ||
            includesSearchTerm(shipment.inbound_status, searchTerm)
          ) {
            matchedShipmentIds.add(shipment.id);
          }
        }

        const [shipmentItemsRes, externalRefsRes] = await Promise.all([
          (supabase.from('shipment_items') as any)
            .select('shipment_id, expected_vendor, expected_description, expected_sidemark, room, notes')
            .in('shipment_id', shipmentIds),
          (supabase.from('shipment_external_refs') as any)
            .select('shipment_id, value')
            .in('shipment_id', shipmentIds),
        ]);

        if (!shipmentItemsRes.error && Array.isArray(shipmentItemsRes.data)) {
          for (const row of shipmentItemsRes.data as Array<Record<string, string | null>>) {
            const shipmentId = row.shipment_id as string | null;
            if (!shipmentId) continue;

            if (
              includesSearchTerm(row.expected_vendor, searchTerm) ||
              includesSearchTerm(row.expected_description, searchTerm) ||
              includesSearchTerm(row.expected_sidemark, searchTerm) ||
              includesSearchTerm(row.room, searchTerm) ||
              includesSearchTerm(row.notes, searchTerm)
            ) {
              matchedShipmentIds.add(shipmentId);
            }
          }
        }

        if (!externalRefsRes.error && Array.isArray(externalRefsRes.data)) {
          for (const row of externalRefsRes.data as Array<Record<string, string | null>>) {
            const shipmentId = row.shipment_id as string | null;
            if (!shipmentId) continue;

            if (includesSearchTerm(row.value, searchTerm)) {
              matchedShipmentIds.add(shipmentId);
            }
          }
        }

        filtered = mappedShipments.filter((shipment) => matchedShipmentIds.has(shipment.id));
      }

      if (filtered.length === 0) {
        setShipments([]);
        return;
      }

      // Badge formula: shipment-level open exceptions + item-level flag instances.
      const filteredIds = filtered.map((shipment) => shipment.id);
      const [openExceptionsRes, itemFlagsRes] = await Promise.all([
        (supabase as any).from('shipment_exceptions')
          .select('shipment_id')
          .in('shipment_id', filteredIds)
          .eq('status', 'open'),
        (supabase.from('shipment_items') as any)
          .select('shipment_id, flags')
          .in('shipment_id', filteredIds),
      ]);

      const openExceptionsByShipment: Record<string, number> = {};
      if (!openExceptionsRes.error && Array.isArray(openExceptionsRes.data)) {
        for (const row of openExceptionsRes.data as Array<{ shipment_id: string }>) {
          openExceptionsByShipment[row.shipment_id] = (openExceptionsByShipment[row.shipment_id] || 0) + 1;
        }
      }

      const itemFlagsByShipment: Record<string, number> = {};
      if (!itemFlagsRes.error && Array.isArray(itemFlagsRes.data)) {
        for (const row of itemFlagsRes.data as Array<{ shipment_id: string; flags: string[] | null }>) {
          const flagCount = Array.isArray(row.flags)
            ? row.flags.filter((flag) => typeof flag === 'string').length
            : 0;
          if (flagCount > 0) {
            itemFlagsByShipment[row.shipment_id] = (itemFlagsByShipment[row.shipment_id] || 0) + flagCount;
          }
        }
      }

      const withCounts = filtered.map((shipment) => ({
        ...shipment,
        exception_count:
          (openExceptionsByShipment[shipment.id] || 0) +
          (itemFlagsByShipment[shipment.id] || 0),
      }));

      setShipments(withCounts);
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
