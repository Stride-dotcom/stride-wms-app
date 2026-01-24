import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queueRepairQuoteReadyAlert } from '@/lib/alertQueue';

export interface RepairQuote {
  id: string;
  item_id: string;
  tenant_id: string;
  flat_rate: number | null;
  technician_user_id: string | null;
  technician_name: string | null;
  approval_status: 'pending' | 'approved' | 'declined';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  technician?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  approver?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export function useRepairQuotes(itemId: string | undefined) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<RepairQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    if (!itemId) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('repair_quotes') as any)
        .select(`
          *,
          technician:technician_user_id(id, first_name, last_name),
          approver:approved_by(id, first_name, last_name)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error fetching repair quotes:', error);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const createQuote = async (quoteData: {
    flat_rate: number;
    technician_user_id?: string;
    technician_name?: string;
    notes?: string;
  }) => {
    if (!profile?.tenant_id || !itemId) return null;

    try {
      const { data, error } = await (supabase
        .from('repair_quotes') as any)
        .insert({
          item_id: itemId,
          tenant_id: profile.tenant_id,
          flat_rate: quoteData.flat_rate,
          technician_user_id: quoteData.technician_user_id || null,
          technician_name: quoteData.technician_name || null,
          notes: quoteData.notes || null,
          created_by: profile.id,
          approval_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Queue repair quote ready alert
      // Fetch item code and account email for the alert
      const { data: itemData } = await supabase
        .from('items')
        .select('item_code, account_id, accounts!items_account_id_fkey(alerts_contact_email, primary_contact_email)')
        .eq('id', itemId)
        .single();
      
      if (itemData && profile.tenant_id) {
        const accountEmail = (itemData.accounts as any)?.alerts_contact_email || 
                             (itemData.accounts as any)?.primary_contact_email || undefined;
        await queueRepairQuoteReadyAlert(
          profile.tenant_id,
          itemId,
          itemData.item_code || 'Unknown',
          quoteData.flat_rate,
          accountEmail
        );
      }

      toast({
        title: 'Quote Created',
        description: 'Repair quote has been created and is pending approval.',
      });

      fetchQuotes();
      return data;
    } catch (error) {
      console.error('Error creating repair quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create repair quote',
      });
      return null;
    }
  };

  const approveQuote = async (quoteId: string) => {
    if (!profile?.id) return false;

    try {
      const { error } = await (supabase
        .from('repair_quotes') as any)
        .update({
          approval_status: 'approved',
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (error) throw error;

      // Create alert for repair quote approval
      const quote = quotes.find(q => q.id === quoteId);
      if (quote) {
        await (supabase
          .from('alert_queue') as any)
          .insert({
            tenant_id: profile.tenant_id,
            alert_type: 'repair_quote_approved',
            entity_type: 'item',
            entity_id: itemId,
            subject: 'Repair Quote Approved',
            body_text: `Repair quote for $${quote.flat_rate} has been approved.`,
            status: 'pending',
          });

        // Auto-create repair task if none exists
        await createRepairTaskIfNeeded();
      }

      toast({
        title: 'Quote Approved',
        description: 'Repair quote has been approved.',
      });

      fetchQuotes();
      return true;
    } catch (error) {
      console.error('Error approving quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to approve quote',
      });
      return false;
    }
  };

  const declineQuote = async (quoteId: string) => {
    if (!profile?.id) return false;

    try {
      const { error } = await (supabase
        .from('repair_quotes') as any)
        .update({
          approval_status: 'declined',
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: 'Quote Declined',
        description: 'Repair quote has been declined.',
      });

      fetchQuotes();
      return true;
    } catch (error) {
      console.error('Error declining quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to decline quote',
      });
      return false;
    }
  };

  const createRepairTaskIfNeeded = async () => {
    if (!profile?.tenant_id || !itemId) return;

    try {
      // Check if there's already an open repair task for this item
      const { data: existingTasks } = await (supabase
        .from('task_items') as any)
        .select(`
          task_id,
          tasks:task_id(id, task_type, status)
        `)
        .eq('item_id', itemId);

      const hasOpenRepairTask = existingTasks?.some(
        (ti: any) =>
          ti.tasks?.task_type === 'Repair' &&
          !['completed', 'cancelled', 'unable_to_complete'].includes(ti.tasks?.status)
      );

      if (hasOpenRepairTask) return;

      // Create new repair task
      const { data: task } = await (supabase
        .from('tasks') as any)
        .insert({
          tenant_id: profile.tenant_id,
          title: 'Repair - 1 item',
          task_type: 'Repair',
          status: 'pending',
          priority: 'normal',
        })
        .select()
        .single();

      if (task) {
        await (supabase.from('task_items') as any).insert({
          task_id: task.id,
          item_id: itemId,
        });
      }
    } catch (error) {
      console.error('Error creating repair task:', error);
    }
  };

  return {
    quotes,
    loading,
    refetch: fetchQuotes,
    createQuote,
    approveQuote,
    declineQuote,
  };
}
