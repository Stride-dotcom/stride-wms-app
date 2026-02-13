import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MatchTier = 'tier_1' | 'tier_2' | 'tier_3' | 'unknown_account' | 'no_match';

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
  /** Structured tier classification from RPC */
  match_tier: MatchTier;
  /** Number of shipment_items matching the item-level search (0 if no item search) */
  item_match_count: number;
}

export interface CandidateParams {
  accountId?: string | null;
  vendorName?: string | null;
  refValue?: string | null;
  pieces?: number | null;
  /** Item-level description search — refines candidates in Stage 2 */
  itemDescription?: string | null;
  /** Item-level vendor search — refines candidates in Stage 2 */
  itemVendor?: string | null;
}

/** Locked debounce delay for candidate search — do not change without Phase review */
const CANDIDATE_DEBOUNCE_MS = 300;

export function useInboundCandidates(params: CandidateParams) {
  const [candidates, setCandidates] = useState<InboundCandidate[]>([]);
  const [loading, setLoading] = useState(false);
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

      let results = ((data as unknown as InboundCandidate[]) || []).map((c) => ({
        ...c,
        match_tier: c.match_tier || ('no_match' as MatchTier),
        item_match_count: 0,
      }));

      // Item-level refinement: boost candidates that have matching shipment_items
      const hasItemSearch =
        (params.itemDescription && params.itemDescription.trim().length >= 2) ||
        (params.itemVendor && params.itemVendor.trim().length >= 2);

      if (hasItemSearch && results.length > 0) {
        const candidateIds = results.map((c) => c.shipment_id);

        // Build filter conditions for shipment_items
        let query = (supabase as any)
          .from('shipment_items')
          .select('shipment_id')
          .in('shipment_id', candidateIds);

        // Build OR filter for description + vendor
        const orFilters: string[] = [];
        if (params.itemDescription && params.itemDescription.trim().length >= 2) {
          orFilters.push(`expected_description.ilike.%${params.itemDescription.trim()}%`);
        }
        if (params.itemVendor && params.itemVendor.trim().length >= 2) {
          orFilters.push(`expected_vendor.ilike.%${params.itemVendor.trim()}%`);
        }
        if (orFilters.length > 0) {
          query = query.or(orFilters.join(','));
        }

        const { data: itemMatches } = await query;

        if (itemMatches && itemMatches.length > 0) {
          // Count matches per shipment
          const matchCounts = new Map<string, number>();
          for (const row of itemMatches as { shipment_id: string }[]) {
            matchCounts.set(row.shipment_id, (matchCounts.get(row.shipment_id) || 0) + 1);
          }

          // Boost confidence for candidates with item matches
          results = results.map((c) => {
            const count = matchCounts.get(c.shipment_id) || 0;
            if (count > 0) {
              const boost = Math.min(count * 5, 15); // 5 per match, max +15
              return {
                ...c,
                confidence_score: Math.min(c.confidence_score + boost, 100),
                confidence_label:
                  c.confidence_label === 'Possible Match' && boost >= 10
                    ? 'Item Match'
                    : c.confidence_label,
                item_match_count: count,
              };
            }
            return c;
          });

          // Re-sort by confidence descending
          results.sort((a, b) => b.confidence_score - a.confidence_score);
        }
      }

      setCandidates(results);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  }, [
    params.accountId,
    params.vendorName,
    params.refValue,
    params.pieces,
    params.itemDescription,
    params.itemVendor,
  ]);

  // Debounced search — cancelable on parameter change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchCandidates();
    }, CANDIDATE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchCandidates]);

  return { candidates, loading, refetch: fetchCandidates };
}
