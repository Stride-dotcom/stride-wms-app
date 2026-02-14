import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ShipmentExceptionCode =
  | 'PIECES_MISMATCH'
  | 'VENDOR_MISMATCH'
  | 'DESCRIPTION_MISMATCH'
  | 'SIDEMARK_MISMATCH'
  | 'SHIPPER_MISMATCH'
  | 'TRACKING_MISMATCH'
  | 'REFERENCE_MISMATCH'
  | 'DAMAGE'
  | 'WET'
  | 'OPEN'
  | 'MISSING_DOCS'
  | 'REFUSED'
  | 'CRUSHED_TORN_CARTONS'
  | 'OTHER';

export const SHIPMENT_EXCEPTION_CODE_META: Record<
  ShipmentExceptionCode,
  { label: string; icon: string; requiresNote?: boolean }
> = {
  PIECES_MISMATCH: { label: 'Item Count Mismatch', icon: 'tag' },
  VENDOR_MISMATCH: { label: 'Vendor Mismatch', icon: 'storefront' },
  DESCRIPTION_MISMATCH: { label: 'Description Mismatch', icon: 'description' },
  SIDEMARK_MISMATCH: { label: 'Side Mark Mismatch', icon: 'sell' },
  SHIPPER_MISMATCH: { label: 'Shipper Mismatch', icon: 'local_shipping' },
  TRACKING_MISMATCH: { label: 'Tracking Mismatch', icon: 'qr_code' },
  REFERENCE_MISMATCH: { label: 'Reference Mismatch', icon: 'fingerprint' },
  DAMAGE: { label: 'Damage', icon: 'broken_image' },
  WET: { label: 'Wet', icon: 'water_drop' },
  OPEN: { label: 'Open', icon: 'package_2' },
  MISSING_DOCS: { label: 'Missing Docs', icon: 'description' },
  REFUSED: { label: 'Refused', icon: 'block', requiresNote: true },
  CRUSHED_TORN_CARTONS: { label: 'Crushed/Torn Cartons', icon: 'inventory_2' },
  OTHER: { label: 'Other', icon: 'more_horiz', requiresNote: true },
};

export interface ShipmentExceptionRow {
  id: string;
  tenant_id: string;
  shipment_id: string;
  code: ShipmentExceptionCode;
  note: string | null;
  status: 'open' | 'resolved';
  resolution_note: string | null;
  created_at: string;
  created_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  updated_at: string;
}

interface UseShipmentExceptionsReturn {
  exceptions: ShipmentExceptionRow[];
  openExceptions: ShipmentExceptionRow[];
  openCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  upsertOpenException: (code: ShipmentExceptionCode, note?: string | null) => Promise<ShipmentExceptionRow | null>;
  removeOpenException: (code: ShipmentExceptionCode) => Promise<boolean>;
  resolveException: (id: string, resolutionNote: string) => Promise<boolean>;
  reopenException: (id: string) => Promise<boolean>;
}

export function useShipmentExceptions(shipmentId: string | undefined): UseShipmentExceptionsReturn {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [exceptions, setExceptions] = useState<ShipmentExceptionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!shipmentId || !profile?.tenant_id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('shipment_exceptions')
        .select('*')
        .eq('shipment_id', shipmentId)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExceptions((data || []) as ShipmentExceptionRow[]);
    } catch (err) {
      console.error('[useShipmentExceptions] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, profile?.tenant_id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const upsertOpenException = useCallback(async (
    code: ShipmentExceptionCode,
    note?: string | null
  ): Promise<ShipmentExceptionRow | null> => {
    if (!shipmentId || !profile?.tenant_id || !profile?.id) return null;

    try {
      const normalizedNote = note?.trim() || null;
      const existingOpen = exceptions.find((e) => e.code === code && e.status === 'open');

      if (existingOpen) {
        const { data, error } = await (supabase as any)
          .from('shipment_exceptions')
          .update({
            note: normalizedNote,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOpen.id)
          .select('*')
          .single();

        if (error) throw error;
        setExceptions((prev) => prev.map((e) => (e.id === existingOpen.id ? (data as ShipmentExceptionRow) : e)));
        return data as ShipmentExceptionRow;
      }

      const { data, error } = await (supabase as any)
        .from('shipment_exceptions')
        .insert({
          tenant_id: profile.tenant_id,
          shipment_id: shipmentId,
          code,
          note: normalizedNote,
          status: 'open',
          created_by: profile.id,
        })
        .select('*')
        .single();

      if (error) throw error;
      setExceptions((prev) => [data as ShipmentExceptionRow, ...prev]);
      return data as ShipmentExceptionRow;
    } catch (err: any) {
      console.error('[useShipmentExceptions] upsert error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to save exception',
      });
      return null;
    }
  }, [shipmentId, profile?.tenant_id, profile?.id, exceptions, toast]);

  const removeOpenException = useCallback(async (code: ShipmentExceptionCode): Promise<boolean> => {
    if (!shipmentId || !profile?.tenant_id) return false;
    try {
      const { error } = await (supabase as any)
        .from('shipment_exceptions')
        .delete()
        .eq('shipment_id', shipmentId)
        .eq('tenant_id', profile.tenant_id)
        .eq('code', code)
        .eq('status', 'open');

      if (error) throw error;
      setExceptions((prev) => prev.filter((e) => !(e.code === code && e.status === 'open')));
      return true;
    } catch (err: any) {
      console.error('[useShipmentExceptions] remove error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to remove exception',
      });
      return false;
    }
  }, [shipmentId, profile?.tenant_id, toast]);

  const resolveException = useCallback(async (id: string, resolutionNote: string): Promise<boolean> => {
    if (!profile?.id) return false;
    try {
      const { data, error } = await (supabase as any)
        .from('shipment_exceptions')
        .update({
          status: 'resolved',
          resolution_note: resolutionNote.trim(),
          resolved_at: new Date().toISOString(),
          resolved_by: profile.id,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      setExceptions((prev) => prev.map((e) => (e.id === id ? (data as ShipmentExceptionRow) : e)));
      return true;
    } catch (err: any) {
      console.error('[useShipmentExceptions] resolve error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to resolve exception',
      });
      return false;
    }
  }, [profile?.id, toast]);

  const reopenException = useCallback(async (id: string): Promise<boolean> => {
    if (!profile?.id) return false;
    try {
      const { data, error } = await (supabase as any)
        .from('shipment_exceptions')
        .update({
          status: 'open',
          resolution_note: null,
          resolved_at: null,
          resolved_by: null,
          reopened_at: new Date().toISOString(),
          reopened_by: profile.id,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      setExceptions((prev) => prev.map((e) => (e.id === id ? (data as ShipmentExceptionRow) : e)));
      return true;
    } catch (err: any) {
      console.error('[useShipmentExceptions] reopen error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to reopen exception',
      });
      return false;
    }
  }, [profile?.id, toast]);

  const openExceptions = useMemo(
    () => exceptions.filter((e) => e.status === 'open'),
    [exceptions]
  );

  return {
    exceptions,
    openExceptions,
    openCount: openExceptions.length,
    loading,
    refetch,
    upsertOpenException,
    removeOpenException,
    resolveException,
    reopenException,
  };
}
