import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { queueClaimFiledAlert, queueClaimStatusChangedAlert, queueClaimApprovedAlert, queueClaimDeniedAlert } from '@/lib/alertQueue';
import type { Database, Json } from '@/integrations/supabase/types';

type ClaimRow = Database['public']['Tables']['claims']['Row'];
type ClaimInsert = Database['public']['Tables']['claims']['Insert'];
type ClaimUpdate = Database['public']['Tables']['claims']['Update'];

export type ClaimType = 'shipping_damage' | 'manufacture_defect' | 'handling_damage' | 'property_damage' | 'lost_item';
export type ClaimStatus = 'initiated' | 'under_review' | 'pending_approval' | 'pending_acceptance' | 'accepted' | 'declined' | 'denied' | 'approved' | 'credited' | 'paid' | 'closed';
export type CoverageType = 'standard' | 'full_replacement_deductible' | 'full_replacement_no_deductible' | 'pending' | null;
export type PayoutMethod = 'credit' | 'check' | 'repair_vendor_pay';

// Claim item for multi-item claims
export interface ClaimItem {
  id: string;
  tenant_id: string;
  claim_id: string;
  item_id: string | null;
  non_inventory_ref: string | null;
  coverage_type: CoverageType;
  declared_value: number | null;
  weight_lbs: number | null;
  coverage_rate: number | null;
  requested_amount: number | null;
  calculated_amount: number | null;
  approved_amount: number | null;
  deductible_applied: number | null;
  repairable: boolean | null;
  repair_quote_id: string | null;
  repair_cost: number | null;
  use_repair_cost: boolean;
  determination_notes: string | null;
  determined_by: string | null;
  determined_at: string | null;
  payout_method: PayoutMethod | null;
  payout_processed: boolean;
  payout_processed_at: string | null;
  item_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  item?: {
    id: string;
    item_code: string;
    description: string | null;
    primary_photo_url: string | null;
  } | null;
}

export interface ClaimItemInput {
  item_id?: string;
  non_inventory_ref?: string;
  requested_amount?: number;
  item_notes?: string;
}

export interface Claim extends ClaimRow {
  account?: { id: string; account_name: string; contact_email?: string } | null;
  sidemark?: { id: string; sidemark_name: string } | null;
  item?: { id: string; item_code: string; description: string | null } | null;
  shipment?: { id: string; shipment_number: string } | null;
  filed_by_user?: { id: string; first_name: string | null; last_name: string | null } | null;
  assigned_to_user?: { id: string; first_name: string | null; last_name: string | null } | null;
  // Multi-item aggregates
  item_count?: number;
  claim_items?: ClaimItem[];
  // Acceptance workflow fields (from extended claims table)
  acceptance_token?: string;
  acceptance_token_expires_at?: string | null;
  sent_for_acceptance_at?: string | null;
  sent_for_acceptance_by?: string | null;
  payout_method?: 'credit' | 'check' | 'ach' | null;
  settlement_accepted_at?: string | null;
  settlement_declined_at?: string | null;
  decline_reason?: string | null;
  counter_offer_amount?: number | null;
  counter_offer_notes?: string | null;
}

export interface ClaimAttachment {
  id: string;
  tenant_id: string;
  claim_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  is_public: boolean;
  created_at: string;
}

export interface ClaimAudit {
  id: string;
  tenant_id: string;
  claim_id: string;
  actor_id: string | null;
  action: string;
  details: Json | null;
  created_at: string;
}

export interface ClaimFilters {
  status?: ClaimStatus | ClaimStatus[];
  claimType?: ClaimType | ClaimType[];
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface CreateClaimData {
  claim_type: ClaimType;
  account_id: string;
  sidemark_id?: string | null;
  shipment_id?: string | null;
  item_id?: string | null; // Legacy single item support
  item_ids?: string[]; // Multi-item support
  non_inventory_ref?: string | null;
  incident_location?: string | null;
  incident_contact_name?: string | null;
  incident_contact_phone?: string | null;
  incident_contact_email?: string | null;
  incident_date?: string | null;
  description: string;
  public_notes?: string | null;
  internal_notes?: string | null;
  client_initiated?: boolean;
}

// Generate claim number in CLM-XXX-XXXX format
function generateClaimNumber(): string {
  const part1 = Math.floor(Math.random() * 900 + 100);
  const part2 = Math.floor(Math.random() * 9000 + 1000);
  return `CLM-${part1}-${part2}`;
}

export function useClaims(filters?: ClaimFilters) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchClaims = useCallback(async () => {
    if (!profile?.tenant_id) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('claims')
        .select(`
          *,
          account:accounts!claims_account_id_fkey(id, account_name),
          sidemark:sidemarks!claims_sidemark_id_fkey(id, sidemark_name),
          item:items!claims_item_id_fkey(id, item_code, description),
          shipment:shipments!claims_shipment_id_fkey(id, shipment_number),
          filed_by_user:users!claims_filed_by_fkey(id, first_name, last_name)
        `)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }
      if (filters?.claimType) {
        if (Array.isArray(filters.claimType)) {
          query = query.in('claim_type', filters.claimType);
        } else {
          query = query.eq('claim_type', filters.claimType);
        }
      }
      if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClaims((data || []) as unknown as Claim[]);
    } catch (error) {
      console.error('Error fetching claims:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load claims',
      });
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.claimType, filters?.accountId, filters?.dateFrom, filters?.dateTo, profile?.tenant_id, toast]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const createClaim = async (data: CreateClaimData): Promise<Claim | null> => {
    if (!profile?.tenant_id || !profile?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'No authenticated user' });
      return null;
    }

    try {
      const claimNumber = generateClaimNumber();

      // Determine which items to process
      const itemIds = data.item_ids?.length ? data.item_ids : (data.item_id ? [data.item_id] : []);

      // Get coverage snapshot if single item_id is provided (legacy support)
      let coverageSnapshot: Json | null = null;
      if (data.item_id && !data.item_ids?.length) {
        const { data: item } = await supabase
          .from('items')
          .select('coverage_type, declared_value, weight_lbs, coverage_deductible, coverage_rate')
          .eq('id', data.item_id)
          .single();
        if (item) {
          coverageSnapshot = item as Json;
        }
      }

      const insertData: ClaimInsert = {
        tenant_id: profile.tenant_id,
        claim_number: claimNumber,
        claim_type: data.claim_type,
        status: 'initiated',
        account_id: data.account_id,
        sidemark_id: data.sidemark_id || null,
        shipment_id: data.shipment_id || null,
        item_id: data.item_id || null, // Keep for legacy single-item
        non_inventory_ref: data.non_inventory_ref || null,
        incident_location: data.incident_location || null,
        incident_contact_name: data.incident_contact_name || null,
        incident_contact_phone: data.incident_contact_phone || null,
        incident_contact_email: data.incident_contact_email || null,
        filed_by: profile.id,
        description: data.description,
        coverage_snapshot: coverageSnapshot,
        requires_manager_approval: true,
      };

      const { data: result, error } = await supabase
        .from('claims')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      // Create claim_items for multi-item support
      if (itemIds.length > 0) {
        // Fetch all item details for coverage snapshots
        const { data: itemsData } = await supabase
          .from('items')
          .select('id, coverage_type, declared_value, weight_lbs, coverage_rate')
          .in('id', itemIds);

        const itemsMap = new Map(itemsData?.map(i => [i.id, i]) || []);

        const claimItemsInsert = itemIds.map(itemId => {
          const itemData = itemsMap.get(itemId);
          return {
            tenant_id: profile.tenant_id,
            claim_id: result.id,
            item_id: itemId,
            coverage_type: itemData?.coverage_type || null,
            declared_value: itemData?.declared_value || null,
            weight_lbs: itemData?.weight_lbs || null,
            coverage_rate: itemData?.coverage_rate || null,
          };
        });

        await supabase.from('claim_items').insert(claimItemsInsert);
      }

      // Create audit entry
      await supabase.from('claim_audit').insert([{
        tenant_id: profile.tenant_id,
        claim_id: result.id,
        actor_id: profile.id,
        action: 'created',
        details: {
          claim_type: data.claim_type,
          item_count: itemIds.length,
        } as Json,
      }]);

      toast({
        title: 'Claim Filed',
        description: `Claim ${result.claim_number} has been created${itemIds.length > 1 ? ` with ${itemIds.length} items` : ''}`,
      });

      // Queue claim filed alert
      await queueClaimFiledAlert(
        profile.tenant_id,
        result.id,
        result.claim_number,
        data.claim_type
      );

      await fetchClaims();
      return result as unknown as Claim;
    } catch (error) {
      console.error('Error creating claim:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create claim',
      });
      return null;
    }
  };

  const updateClaimStatus = async (
    claimId: string, 
    newStatus: ClaimStatus, 
    additionalData?: ClaimUpdate
  ): Promise<Claim | null> => {
    if (!profile?.tenant_id || !profile?.id) return null;

    try {
      const updateData: ClaimUpdate = {
        status: newStatus,
        ...additionalData,
      };

      if (newStatus === 'approved' || newStatus === 'credited' || newStatus === 'paid') {
        updateData.resolved_by = profile.id;
        updateData.resolved_at = new Date().toISOString();
      }

      const { data: result, error } = await supabase
        .from('claims')
        .update(updateData)
        .eq('id', claimId)
        .select()
        .single();

      if (error) throw error;

      // Create audit entry
      await supabase.from('claim_audit').insert([{
        tenant_id: profile.tenant_id,
        claim_id: claimId,
        actor_id: profile.id,
        action: `status_changed_to_${newStatus}`,
        details: (additionalData || null) as Json,
      }]);

      toast({
        title: 'Claim Updated',
        description: `Claim status changed to ${newStatus.replace('_', ' ')}`,
      });

      // Queue status change alert
      if (newStatus === 'approved' && additionalData?.approved_payout_amount) {
        await queueClaimApprovedAlert(
          profile.tenant_id,
          claimId,
          result.claim_number,
          additionalData.approved_payout_amount
        );
      } else if (newStatus === 'denied') {
        await queueClaimDeniedAlert(
          profile.tenant_id,
          claimId,
          result.claim_number
        );
      } else {
        await queueClaimStatusChangedAlert(
          profile.tenant_id,
          claimId,
          result.claim_number,
          newStatus
        );
      }

      await fetchClaims();
      return result as unknown as Claim;
    } catch (error) {
      console.error('Error updating claim:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update claim',
      });
      return null;
    }
  };

  const updateClaim = async (claimId: string, data: ClaimUpdate): Promise<Claim | null> => {
    if (!profile?.tenant_id || !profile?.id) return null;

    try {
      const { data: result, error } = await supabase
        .from('claims')
        .update(data)
        .eq('id', claimId)
        .select()
        .single();

      if (error) throw error;

      // Create audit entry
      await supabase.from('claim_audit').insert([{
        tenant_id: profile.tenant_id,
        claim_id: claimId,
        actor_id: profile.id,
        action: 'updated',
        details: data as unknown as Json,
      }]);

      await fetchClaims();
      return result as unknown as Claim;
    } catch (error) {
      console.error('Error updating claim:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update claim',
      });
      return null;
    }
  };

  const deleteClaim = async (claimId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('claims')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', claimId);

      if (error) throw error;
      
      toast({ title: 'Claim Deleted' });
      await fetchClaims();
      return true;
    } catch (error) {
      console.error('Error deleting claim:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete claim',
      });
      return false;
    }
  };

  // Attachments
  const fetchAttachments = async (claimId: string): Promise<ClaimAttachment[]> => {
    const { data, error } = await supabase
      .from('claim_attachments')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
    return (data || []) as ClaimAttachment[];
  };

  const uploadAttachment = async (
    claimId: string,
    file: File,
    isPublic: boolean = true
  ): Promise<ClaimAttachment | null> => {
    if (!profile?.tenant_id || !profile?.id) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${profile.tenant_id}/${claimId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('claims')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Create attachment record
      const { data, error } = await supabase
        .from('claim_attachments')
        .insert([{
          tenant_id: profile.tenant_id,
          claim_id: claimId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: profile.id,
          is_public: isPublic,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'File Uploaded' });
      return data as ClaimAttachment;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to upload file',
      });
      return null;
    }
  };

  const deleteAttachment = async (attachment: ClaimAttachment): Promise<boolean> => {
    try {
      // Delete from storage
      await supabase.storage.from('claims').remove([attachment.storage_path]);

      // Delete record
      const { error } = await supabase
        .from('claim_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      toast({ title: 'Attachment Deleted' });
      return true;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete attachment',
      });
      return false;
    }
  };

  const toggleAttachmentVisibility = async (
    attachmentId: string,
    isPublic: boolean
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('claim_attachments')
        .update({ is_public: isPublic })
        .eq('id', attachmentId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating attachment:', error);
      return false;
    }
  };

  // Audit log
  const fetchAuditLog = async (claimId: string): Promise<ClaimAudit[]> => {
    const { data, error } = await supabase
      .from('claim_audit')
      .select('*')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching audit log:', error);
      return [];
    }
    return (data || []) as ClaimAudit[];
  };

  const addAuditEntry = async (
    claimId: string,
    action: string,
    details?: Record<string, unknown>
  ): Promise<boolean> => {
    if (!profile?.tenant_id || !profile?.id) return false;

    try {
      const { error } = await supabase.from('claim_audit').insert([{
        tenant_id: profile.tenant_id,
        claim_id: claimId,
        actor_id: profile.id,
        action,
        details: (details || null) as Json,
      }]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding audit entry:', error);
      return false;
    }
  };

  // Settlement
  const sendDetermination = async (claimId: string, termsText: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { error } = await supabase
        .from('claims')
        .update({
          determination_sent_at: new Date().toISOString(),
          settlement_terms_text: termsText,
          settlement_terms_version: '1.0',
          settlement_acceptance_required: true,
        })
        .eq('id', claimId);

      if (error) throw error;

      await addAuditEntry(claimId, 'determination_sent', { terms_text: termsText });

      toast({ title: 'Determination Sent' });
      return true;
    } catch (error) {
      console.error('Error sending determination:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send determination',
      });
      return false;
    }
  };

  const acceptSettlement = async (claimId: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { error } = await supabase
        .from('claims')
        .update({
          settlement_accepted_at: new Date().toISOString(),
          settlement_accepted_by: profile.id,
        })
        .eq('id', claimId);

      if (error) throw error;

      await addAuditEntry(claimId, 'client_accepted_settlement');

      toast({ title: 'Settlement Accepted' });
      return true;
    } catch (error) {
      console.error('Error accepting settlement:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to accept settlement',
      });
      return false;
    }
  };

  const requestEscalation = async (claimId: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      await addAuditEntry(claimId, 'client_requested_escalation');
      toast({ title: 'Escalation Requested' });
      return true;
    } catch (error) {
      console.error('Error requesting escalation:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to request escalation',
      });
      return false;
    }
  };

  // Issue credit
  const issueCredit = async (
    claimId: string,
    accountId: string,
    amount: number,
    reason: string
  ): Promise<boolean> => {
    if (!profile?.tenant_id || !profile?.id) return false;

    try {
      const { error } = await supabase.from('account_credits').insert([{
        tenant_id: profile.tenant_id,
        account_id: accountId,
        claim_id: claimId,
        amount,
        reason,
        created_by: profile.id,
      }]);

      if (error) throw error;

      await updateClaimStatus(claimId, 'credited', { approved_payout_amount: amount });

      toast({ title: 'Credit Issued', description: `$${amount.toFixed(2)} credited to account` });
      return true;
    } catch (error) {
      console.error('Error issuing credit:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to issue credit',
      });
      return false;
    }
  };

  // Claim Items (multi-item support)
  const fetchClaimItems = async (claimId: string): Promise<ClaimItem[]> => {
    const { data, error } = await supabase
      .from('claim_items')
      .select(`
        *,
        item:items(id, item_code, description, primary_photo_url)
      `)
      .eq('claim_id', claimId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching claim items:', error);
      return [];
    }
    return (data || []) as unknown as ClaimItem[];
  };

  const addClaimItem = async (
    claimId: string,
    itemId: string,
    notes?: string
  ): Promise<ClaimItem | null> => {
    if (!profile?.tenant_id) return null;

    try {
      // Get item coverage data
      const { data: itemData } = await supabase
        .from('items')
        .select('coverage_type, declared_value, weight_lbs, coverage_rate')
        .eq('id', itemId)
        .single();

      const { data, error } = await supabase
        .from('claim_items')
        .insert([{
          tenant_id: profile.tenant_id,
          claim_id: claimId,
          item_id: itemId,
          coverage_type: itemData?.coverage_type || null,
          declared_value: itemData?.declared_value || null,
          weight_lbs: itemData?.weight_lbs || null,
          coverage_rate: itemData?.coverage_rate || null,
          item_notes: notes || null,
        }])
        .select(`
          *,
          item:items(id, item_code, description, primary_photo_url)
        `)
        .single();

      if (error) throw error;

      toast({ title: 'Item Added to Claim' });
      return data as unknown as ClaimItem;
    } catch (error) {
      console.error('Error adding claim item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add item to claim',
      });
      return null;
    }
  };

  const updateClaimItem = async (
    claimItemId: string,
    updates: Partial<Pick<ClaimItem, 'requested_amount' | 'approved_amount' | 'deductible_applied' | 'weight_lbs' | 'repairable' | 'repair_cost' | 'use_repair_cost' | 'determination_notes' | 'determined_by' | 'determined_at' | 'payout_method' | 'item_notes'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('claim_items')
        .update(updates)
        .eq('id', claimItemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating claim item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update claim item',
      });
      return false;
    }
  };

  const removeClaimItem = async (claimItemId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('claim_items')
        .delete()
        .eq('id', claimItemId);

      if (error) throw error;

      toast({ title: 'Item Removed from Claim' });
      return true;
    } catch (error) {
      console.error('Error removing claim item:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove item from claim',
      });
      return false;
    }
  };

  // Calculate payout based on coverage rules
  // NOTE: Deductible is $300 PER CLAIM (not per item) - apply deductible once at claim level
  // Repair vs Replace: If item is repairable and has repair_cost, use the lower of repair vs replacement
  const calculateItemPayout = (item: ClaimItem, applyDeductible: boolean = true): {
    maxPayout: number;
    deductible: number;
    useRepairCost: boolean;
    repairVsReplace?: { repairCost: number; replacementCost: number };
  } => {
    const STANDARD_RATE = 0.72; // $0.72 per lb for standard coverage
    const CLAIM_DEDUCTIBLE = 300; // $300 deductible per claim for full replacement with deductible

    // Calculate base replacement cost first
    let replacementCost = 0;
    let deductible = 0;

    switch (item.coverage_type) {
      case 'standard':
        // $0.72 per lb, no deductible
        const weight = item.weight_lbs || 0;
        const rate = item.coverage_rate || STANDARD_RATE;
        replacementCost = weight * rate;
        deductible = 0;
        break;

      case 'full_replacement_deductible':
        // Declared value minus deductible (deductible applied once per claim)
        const declaredValue = item.declared_value || 0;
        deductible = applyDeductible ? CLAIM_DEDUCTIBLE : 0;
        replacementCost = Math.max(0, declaredValue - deductible);
        break;

      case 'full_replacement_no_deductible':
        // Full declared value
        replacementCost = item.declared_value || 0;
        deductible = 0;
        break;

      default:
        // No coverage - no payout
        return {
          maxPayout: 0,
          deductible: 0,
          useRepairCost: false,
        };
    }

    // Repair vs Replace logic: If item is repairable and has repair cost, use the lower amount
    if (item.repairable && item.repair_cost != null && item.repair_cost > 0) {
      const repairCost = item.repair_cost;
      const useRepair = repairCost < replacementCost || item.use_repair_cost;

      return {
        maxPayout: useRepair ? repairCost : replacementCost,
        deductible,
        useRepairCost: useRepair,
        repairVsReplace: {
          repairCost,
          replacementCost,
        },
      };
    }

    return {
      maxPayout: replacementCost,
      deductible,
      useRepairCost: false,
    };
  };

  // Calculate total claim payout with deductible applied once per claim
  const calculateClaimPayout = (items: ClaimItem[]): {
    totalDeclaredValue: number;
    totalCalculatedPayout: number;
    deductibleApplied: number;
    netPayout: number;
    repairSavings: number;
    itemBreakdown: Array<{
      itemId: string;
      payout: number;
      coverageType: CoverageType;
      useRepairCost: boolean;
      repairVsReplace?: { repairCost: number; replacementCost: number };
    }>;
  } => {
    const CLAIM_DEDUCTIBLE = 300;

    let totalDeclaredValue = 0;
    let totalCalculatedPayout = 0;
    let repairSavings = 0;
    let hasDeductibleCoverage = false;
    const itemBreakdown: Array<{
      itemId: string;
      payout: number;
      coverageType: CoverageType;
      useRepairCost: boolean;
      repairVsReplace?: { repairCost: number; replacementCost: number };
    }> = [];

    for (const item of items) {
      // Calculate without deductible first (we apply it once at end)
      const result = calculateItemPayout(item, false);

      totalCalculatedPayout += result.maxPayout;
      totalDeclaredValue += item.declared_value || 0;

      // Track repair savings
      if (result.useRepairCost && result.repairVsReplace) {
        repairSavings += result.repairVsReplace.replacementCost - result.repairVsReplace.repairCost;
      }

      // Track if any item has deductible coverage
      if (item.coverage_type === 'full_replacement_deductible') {
        hasDeductibleCoverage = true;
      }

      itemBreakdown.push({
        itemId: item.item_id || item.non_inventory_ref || item.id,
        payout: result.maxPayout,
        coverageType: item.coverage_type,
        useRepairCost: result.useRepairCost,
        repairVsReplace: result.repairVsReplace,
      });
    }

    // Apply deductible once per claim if any item has deductible coverage
    const deductibleApplied = hasDeductibleCoverage ? CLAIM_DEDUCTIBLE : 0;
    const netPayout = Math.max(0, totalCalculatedPayout - deductibleApplied);

    return {
      totalDeclaredValue,
      totalCalculatedPayout,
      deductibleApplied,
      netPayout,
      repairSavings,
      itemBreakdown,
    };
  };

  return {
    claims,
    loading,
    refetch: fetchClaims,
    createClaim,
    updateClaim,
    updateClaimStatus,
    deleteClaim,
    // Attachments
    fetchAttachments,
    uploadAttachment,
    deleteAttachment,
    toggleAttachmentVisibility,
    // Audit
    fetchAuditLog,
    addAuditEntry,
    // Settlement
    sendDetermination,
    acceptSettlement,
    requestEscalation,
    // Credits
    issueCredit,
    // Claim Items (multi-item)
    fetchClaimItems,
    addClaimItem,
    updateClaimItem,
    removeClaimItem,
    calculateItemPayout,
    calculateClaimPayout,
  };
}

// Helper to get display labels
export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  shipping_damage: 'Shipping Damage',
  manufacture_defect: 'Manufacture Defect',
  handling_damage: 'Handling Damage',
  property_damage: 'Property Damage',
  lost_item: 'Lost Item',
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  initiated: 'Initiated',
  under_review: 'Under Review',
  pending_approval: 'Pending Approval',
  pending_acceptance: 'Pending Client Acceptance',
  accepted: 'Client Accepted',
  declined: 'Client Declined',
  denied: 'Denied',
  approved: 'Approved',
  credited: 'Credited',
  paid: 'Paid',
  closed: 'Closed',
};
