import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InboundCandidate {
  shipment_id: string;
  inbound_kind: string;
  account_id: string | null;
  account_name: string | null;
  vendor_name: string | null;
  expected_pieces: number | null;
  eta_start: string | null;
  eta_end: string | null;
  created_at: string;
  shipment_number: string;
  confidence_score: number;
  confidence_label: string;
}

export interface CandidateParams {
  accountId?: string | null;
  vendorName?: string | null;
  refValue?: string | null;
  pieces?: number | null;
}

export function useInboundCandidates(params: CandidateParams) {
  const [candidates, setCandidates] = useState<InboundCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCandidates = useCallback(async () => {
    // Need at least one parameter to search
    if (!params.accountId && !params.vendorName && !params.refValue) {
      setCandidates([]);
      return;
    }

    // Cancel in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      setLoading(true);
      const rpcParams: Record<string, unknown> = {};
      if (params.accountId) rpcParams.p_account_id = params.accountId;
      if (params.vendorName) rpcParams.p_vendor_name = params.vendorName;
      if (params.refValue) rpcParams.p_ref_value = params.refValue;
      if (params.pieces) rpcParams.p_pieces = params.pieces;

      const { data, error } = await supabase.rpc(
        'rpc_find_inbound_candidates',
        rpcParams as { p_account_id?: string; p_vendor_name?: string; p_ref_value?: string; p_pieces?: number },
      );
      if (error) throw error;
      setCandidates((data as unknown as InboundCandidate[]) || []);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  }, [params.accountId, params.vendorName, params.refValue, params.pieces]);

  // Debounced search (300ms)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchCandidates();
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchCandidates]);

  return { candidates, loading };
}
