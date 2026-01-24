import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database, Json } from '@/integrations/supabase/types';

type ClaimRow = Database['public']['Tables']['claims']['Row'];
type ClaimInsert = Database['public']['Tables']['claims']['Insert'];
type ClaimUpdate = Database['public']['Tables']['claims']['Update'];

export type ClaimType = 'shipping_damage' | 'manufacture_defect' | 'handling_damage' | 'property_damage' | 'lost_item';
export type ClaimStatus = 'initiated' | 'under_review' | 'denied' | 'approved' | 'credited' | 'paid' | 'closed';

export interface Claim extends ClaimRow {
  account?: { id: string; account_name: string } | null;
  sidemark?: { id: string; sidemark_name: string } | null;
  item?: { id: string; item_code: string; description: string | null } | null;
  shipment?: { id: string; shipment_number: string } | null;
  filed_by_user?: { id: string; first_name: string | null; last_name: string | null } | null;
  assigned_to_user?: { id: string; first_name: string | null; last_name: string | null } | null;
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
  item_id?: string | null;
  non_inventory_ref?: string | null;
  incident_location?: string | null;
  incident_contact_name?: string | null;
  incident_contact_phone?: string | null;
  incident_contact_email?: string | null;
  description: string;
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
      
      // Get coverage snapshot if item_id is provided
      let coverageSnapshot: Json | null = null;
      if (data.item_id) {
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
        item_id: data.item_id || null,
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

      // Create audit entry
      await supabase.from('claim_audit').insert([{
        tenant_id: profile.tenant_id,
        claim_id: result.id,
        actor_id: profile.id,
        action: 'created',
        details: { claim_type: data.claim_type } as Json,
      }]);

      toast({
        title: 'Claim Filed',
        description: `Claim ${result.claim_number} has been created`,
      });

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
  denied: 'Denied',
  approved: 'Approved',
  credited: 'Credited',
  paid: 'Paid',
  closed: 'Closed',
};
