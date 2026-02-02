import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queueRepairQuoteReadyAlert, queueRepairQuoteSentToClientAlert } from '@/lib/alertQueue';
import { buildRepairQuoteReadyEmail } from '@/lib/email';

// ============================================================================
// NEW WORKFLOW TYPES
// ============================================================================

// Workflow status enum matching the database
export type RepairQuoteWorkflowStatus =
  | 'draft'
  | 'awaiting_assignment'
  | 'sent_to_tech'
  | 'tech_declined'
  | 'tech_submitted'
  | 'under_review'
  | 'sent_to_client'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'closed';

export interface RepairQuoteItem {
  id: string;
  tenant_id: string;
  repair_quote_id: string;
  item_id: string;
  item_code: string | null;
  item_description: string | null;
  allocated_tech_amount: number | null;
  allocated_customer_amount: number | null;
  notes_public: string | null;
  notes_internal: string | null;
  damage_description: string | null;
  damage_photos: string[];
  created_at: string;
  updated_at: string;
  item?: {
    id: string;
    item_code: string;
    description: string | null;
    status: string | null;
  };
}

export interface AuditLogEntry {
  action: string;
  by: string | null;
  by_name: string | null;
  at: string;
  details?: Record<string, any>;
}

export interface RepairQuoteToken {
  id: string;
  tenant_id: string;
  repair_quote_id: string;
  token: string;
  token_type: 'tech_quote' | 'client_review' | 'tech_repair';
  recipient_email: string | null;
  recipient_name: string | null;
  expires_at: string;
  accessed_at: string | null;
  used_at: string | null;
  created_at: string;
}

export interface TechQuoteSubmission {
  labor_hours: number;
  labor_rate: number;
  materials_cost: number;
  notes?: string;
}

// ============================================================================
// LEGACY INTERFACE (preserved for backwards compatibility)
// ============================================================================

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
          *
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

// ============================================================================
// NEW WORKFLOW HOOKS
// ============================================================================

// Extended quote interface for new workflow
export interface RepairQuoteWorkflow {
  id: string;
  tenant_id: string;
  item_id: string;
  status: RepairQuoteWorkflowStatus;
  technician_id: string | null;
  account_id: string | null;
  sidemark_id: string | null;
  source_task_id: string | null;

  // Tech submission
  tech_labor_hours: number | null;
  tech_labor_rate: number | null;
  tech_materials_cost: number | null;
  tech_total: number | null;
  tech_notes: string | null;
  tech_submitted_at: string | null;

  // Customer pricing
  // (Office-entered pricing overrides; some older rows may have nulls)
  customer_price: number | null;
  customer_total: number | null;
  markup_applied: number | null;

  // Office-only fields
  internal_cost: number | null;
  office_notes: string | null;
  pricing_locked: boolean | null;

  // Client response
  client_response: 'accepted' | 'declined' | null;
  client_responded_at: string | null;

  // Lifecycle
  expires_at: string | null;
  last_sent_at: string | null;
  audit_log: AuditLogEntry[];

  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Legacy fields
  flat_rate: number | null;
  technician_name: string | null;
  approval_status: string | null;

  // Relations
  technician?: {
    id: string;
    name: string;
    email: string;
    markup_percent: number;
    hourly_rate: number | null;
  };
  account?: {
    id: string;
    name: string;
  };
  sidemark?: {
    id: string;
    name: string;
  };
  items?: RepairQuoteItem[];
}

// Hook for workflow quote management (authenticated - office staff)
export function useRepairQuoteWorkflow() {
  const [quotes, setQuotes] = useState<RepairQuoteWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchQuotes = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);

      const { data, error } = await (supabase
        .from('repair_quotes') as any)
        .select(`
          *,
          technician:technicians(id, name, email, markup_percent, hourly_rate),
          account:accounts(id, name:account_name),
          sidemark:sidemarks(id, name:sidemark_name)
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData: RepairQuoteWorkflow[] = (data || []).map((q: any) => ({
        ...q,
        status: q.status || 'draft',
        audit_log: q.audit_log || [],
      }));

      setQuotes(transformedData);
    } catch (error) {
      console.error('Error fetching repair quotes:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load repair quotes',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Create a new workflow quote
  const createWorkflowQuote = useCallback(async (data: {
    item_id: string;
    account_id: string;
    sidemark_id?: string;
    source_task_id?: string;
    technician_id?: string;
    item_ids?: string[];
  }): Promise<RepairQuoteWorkflow | null> => {
    if (!profile?.tenant_id || !profile?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in',
      });
      return null;
    }

    try {
      const initialStatus: RepairQuoteWorkflowStatus = data.technician_id
        ? 'awaiting_assignment'
        : 'draft';

      const auditEntry: AuditLogEntry = {
        action: 'created',
        by: profile.id,
        by_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        at: new Date().toISOString(),
        details: { source_task_id: data.source_task_id },
      };

      const { data: newQuote, error } = await (supabase
        .from('repair_quotes') as any)
        .insert({
          tenant_id: profile.tenant_id,
          item_id: data.item_id,
          account_id: data.account_id,
          sidemark_id: data.sidemark_id || null,
          source_task_id: data.source_task_id || null,
          technician_id: data.technician_id || null,
          status: initialStatus,
          created_by: profile.id,
          audit_log: [auditEntry],
        })
        .select()
        .single();

      if (error) throw error;

      // Create quote items
      const itemIds = [data.item_id, ...(data.item_ids || [])];

      const { data: items } = await supabase
        .from('items')
        .select('id, item_code, description')
        .in('id', itemIds);

      if (items && items.length > 0) {
        const quoteItems = items.map(item => ({
          tenant_id: profile.tenant_id,
          repair_quote_id: newQuote.id,
          item_id: item.id,
          item_code: item.item_code,
          item_description: item.description,
        }));

        await (supabase as any).from('repair_quote_items').insert(quoteItems);
      }

      toast({
        title: 'Success',
        description: 'Repair quote created',
      });

      await fetchQuotes();
      return newQuote as RepairQuoteWorkflow;
    } catch (error) {
      console.error('Error creating repair quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create repair quote',
      });
      return null;
    }
  }, [profile, toast, fetchQuotes]);

  // Assign technician
  const assignTechnician = useCallback(async (
    quoteId: string,
    technicianId: string
  ): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { data: quote } = await (supabase
        .from('repair_quotes') as any)
        .select('audit_log')
        .eq('id', quoteId)
        .single();

      const auditLog = quote?.audit_log || [];
      const auditEntry: AuditLogEntry = {
        action: 'technician_assigned',
        by: profile.id,
        by_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        at: new Date().toISOString(),
        details: { technician_id: technicianId },
      };

      const { error } = await (supabase
        .from('repair_quotes') as any)
        .update({
          technician_id: technicianId,
          status: 'awaiting_assignment',
          audit_log: [...auditLog, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Technician assigned',
      });

      await fetchQuotes();
      return true;
    } catch (error) {
      console.error('Error assigning technician:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to assign technician',
      });
      return false;
    }
  }, [profile, toast, fetchQuotes]);

  // Send to technician
  const sendToTechnician = useCallback(async (quoteId: string): Promise<string | null> => {
    if (!profile?.tenant_id || !profile?.id) return null;

    try {
      const { data: quote } = await (supabase
        .from('repair_quotes') as any)
        .select(`
          *,
          technician:technicians(id, name, email)
        `)
        .eq('id', quoteId)
        .single();

      if (!quote || !quote.technician) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Quote must have a technician assigned',
        });
        return null;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      const { data: tokenData, error: tokenError } = await (supabase as any)
        .from('repair_quote_tokens')
        .insert({
          tenant_id: profile.tenant_id,
          repair_quote_id: quoteId,
          token_type: 'tech_quote',
          recipient_email: quote.technician.email,
          recipient_name: quote.technician.name,
          expires_at: expiresAt.toISOString(),
          created_by: profile.id,
        })
        .select()
        .single();

      if (tokenError) throw tokenError;

      const auditLog = quote.audit_log || [];
      const auditEntry: AuditLogEntry = {
        action: 'sent_to_tech',
        by: profile.id,
        by_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        at: new Date().toISOString(),
        details: {
          technician_name: quote.technician.name,
          technician_email: quote.technician.email,
        },
      };

      await (supabase
        .from('repair_quotes') as any)
        .update({
          status: 'sent_to_tech',
          expires_at: expiresAt.toISOString(),
          last_sent_at: new Date().toISOString(),
          audit_log: [...auditLog, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      toast({
        title: 'Success',
        description: `Quote request sent to ${quote.technician.name}`,
      });

      await fetchQuotes();
      return tokenData.token;
    } catch (error) {
      console.error('Error sending to technician:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send quote request',
      });
      return null;
    }
  }, [profile, toast, fetchQuotes]);

  // Send to client
  const sendToClient = useCallback(async (quoteId: string, testEmail?: string): Promise<string | null> => {
    if (!profile?.tenant_id || !profile?.id) return null;

    try {
      const { data: quote } = await (supabase
        .from('repair_quotes') as any)
        .select(`
          *,
          account:accounts(id, name:account_name, primary_contact_email, alerts_contact_email)
        `)
        .eq('id', quoteId)
        .single();

      if (!quote || !quote.account) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Quote must have an account',
        });
        return null;
      }

      // Fetch quote items for the email
      const { data: quoteItems } = await (supabase as any)
        .from('repair_quote_items')
        .select(`
          *,
          item:items(item_code, description)
        `)
        .eq('repair_quote_id', quoteId);

      const itemCodes = (quoteItems || []).map((qi: any) =>
        qi.item?.item_code || qi.item_code || 'Unknown'
      );
      const firstItemCode = itemCodes[0] || 'Unknown';
      const firstItemDescription = (quoteItems?.[0]?.item?.description || quoteItems?.[0]?.item_description || 'No description');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      // Only create token if not a test email
      let tokenData: any = null;
      if (!testEmail) {
        const { data, error: tokenError } = await (supabase as any)
          .from('repair_quote_tokens')
          .insert({
            tenant_id: profile.tenant_id,
            repair_quote_id: quoteId,
            token_type: 'client_review',
            recipient_email: quote.account.alerts_contact_email || quote.account.primary_contact_email,
            recipient_name: quote.account.name,
            expires_at: expiresAt.toISOString(),
            created_by: profile.id,
          })
          .select()
          .single();

        if (tokenError) throw tokenError;
        tokenData = data;
      } else {
        // For test email, create a temporary token
        const { data, error: tokenError } = await (supabase as any)
          .from('repair_quote_tokens')
          .insert({
            tenant_id: profile.tenant_id,
            repair_quote_id: quoteId,
            token_type: 'client_review',
            recipient_email: testEmail,
            recipient_name: 'Test Recipient',
            expires_at: expiresAt.toISOString(),
            created_by: profile.id,
          })
          .select()
          .single();

        if (tokenError) throw tokenError;
        tokenData = data;
      }

      // Build the review link
      const reviewLink = `${window.location.origin}/quote/review?token=${tokenData.token}`;

      // Build email using existing template
      const emailData = buildRepairQuoteReadyEmail({
        itemCode: firstItemCode,
        itemDescription: firstItemDescription,
        accountName: quote.account.name,
        quoteAmount: quote.customer_total || quote.customer_price || 0,
        quoteNotes: quote.tech_notes || undefined,
        quoteLink: reviewLink,
      });

      // Determine recipient emails
      const recipientEmails = testEmail
        ? [testEmail]
        : [quote.account.alerts_contact_email || quote.account.primary_contact_email].filter(Boolean);

      if (recipientEmails.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No email address found for this account',
        });
        return null;
      }

      // Queue the email alert
      await queueRepairQuoteSentToClientAlert(
        profile.tenant_id,
        quoteId,
        quote.account.name,
        quote.customer_total || quote.customer_price || 0,
        itemCodes,
        emailData.html,
        recipientEmails
      );

      // Only update quote status if not a test email
      if (!testEmail) {
        const auditLog = quote.audit_log || [];
        const auditEntry: AuditLogEntry = {
          action: 'sent_to_client',
          by: profile.id,
          by_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
          at: new Date().toISOString(),
          details: {
            account_name: quote.account.name,
            contact_email: quote.account.alerts_contact_email || quote.account.primary_contact_email,
          },
        };

        await (supabase
          .from('repair_quotes') as any)
          .update({
            status: 'sent_to_client',
            expires_at: expiresAt.toISOString(),
            last_sent_at: new Date().toISOString(),
            audit_log: [...auditLog, auditEntry],
            updated_at: new Date().toISOString(),
          })
          .eq('id', quoteId);

        toast({
          title: 'Quote Sent',
          description: `Email queued to ${recipientEmails.join(', ')}`,
        });

        await fetchQuotes();
      } else {
        toast({
          title: 'Test Email Sent',
          description: `Test email queued to ${testEmail}`,
        });
      }

      return tokenData.token;
    } catch (error) {
      console.error('Error sending to client:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send quote to client',
      });
      return null;
    }
  }, [profile, toast, fetchQuotes]);

  // Review tech submission
  const reviewQuote = useCallback(async (quoteId: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { data: quote } = await (supabase
        .from('repair_quotes') as any)
        .select('audit_log')
        .eq('id', quoteId)
        .single();

      const auditLog = quote?.audit_log || [];
      const auditEntry: AuditLogEntry = {
        action: 'under_review',
        by: profile.id,
        by_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        at: new Date().toISOString(),
      };

      const { error } = await (supabase
        .from('repair_quotes') as any)
        .update({
          status: 'under_review',
          audit_log: [...auditLog, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (error) throw error;

      await fetchQuotes();
      return true;
    } catch (error) {
      console.error('Error reviewing quote:', error);
      return false;
    }
  }, [profile, fetchQuotes]);

  // Close/cancel quote
  const closeQuote = useCallback(async (quoteId: string, reason?: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      const { data: quote } = await (supabase
        .from('repair_quotes') as any)
        .select('audit_log')
        .eq('id', quoteId)
        .single();

      const auditLog = quote?.audit_log || [];
      const auditEntry: AuditLogEntry = {
        action: 'closed',
        by: profile.id,
        by_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        at: new Date().toISOString(),
        details: { reason },
      };

      const { error } = await (supabase
        .from('repair_quotes') as any)
        .update({
          status: 'closed',
          audit_log: [...auditLog, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: 'Quote Closed',
        description: 'The quote has been closed',
      });

      await fetchQuotes();
      return true;
    } catch (error) {
      console.error('Error closing quote:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to close quote',
      });
      return false;
    }
  }, [profile, toast, fetchQuotes]);

  // Get status display info
  const getStatusInfo = (status: RepairQuoteWorkflowStatus | string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
      awaiting_assignment: { label: 'Awaiting Assignment', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      sent_to_tech: { label: 'Sent to Tech', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      tech_declined: { label: 'Tech Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      tech_submitted: { label: 'Tech Submitted', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      under_review: { label: 'Under Review', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
      sent_to_client: { label: 'Sent to Client', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
      accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      declined: { label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
      closed: { label: 'Closed', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
      // Legacy statuses
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  return {
    quotes,
    loading,
    refetch: fetchQuotes,
    createWorkflowQuote,
    assignTechnician,
    sendToTechnician,
    sendToClient,
    reviewQuote,
    closeQuote,
    getStatusInfo,
  };
}

// Hook for technician quote submission (unauthenticated - magic link)
export function useTechQuoteSubmission(token: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<RepairQuoteToken | null>(null);
  const [quote, setQuote] = useState<RepairQuoteWorkflow | null>(null);
  const [quoteItems, setQuoteItems] = useState<RepairQuoteItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const validateAndLoad = useCallback(async () => {
    if (!token) {
      setError('No access token provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Validate token
      const { data: tokenRecord, error: tokenError } = await (supabase as any)
        .from('repair_quote_tokens')
        .select('*')
        .eq('token', token)
        .eq('token_type', 'tech_quote')
        .single();

      if (tokenError || !tokenRecord) {
        setError('Invalid or expired access link');
        setLoading(false);
        return;
      }

      // Check expiration
      if (new Date(tokenRecord.expires_at) < new Date()) {
        setError('This access link has expired. Please contact the warehouse for a new link.');
        setLoading(false);
        return;
      }

      setTokenData(tokenRecord as RepairQuoteToken);

      // Update accessed_at
      await (supabase as any)
        .from('repair_quote_tokens')
        .update({ accessed_at: new Date().toISOString() })
        .eq('id', tokenRecord.id);

      // Load quote with relations
      const { data: quoteData, error: quoteError } = await (supabase
        .from('repair_quotes') as any)
        .select(`
          *,
          account:accounts(id, name:account_name),
          sidemark:sidemarks(id, name:sidemark_name)
        `)
        .eq('id', tokenRecord.repair_quote_id)
        .single();

      if (quoteError) throw quoteError;

      // Check if already submitted
      if (quoteData.status === 'tech_submitted' || quoteData.status === 'tech_declined') {
        setError('You have already responded to this quote request.');
        setLoading(false);
        return;
      }

      setQuote(quoteData as RepairQuoteWorkflow);

      // Load quote items with item details
      const { data: itemsData, error: itemsError } = await (supabase as any)
        .from('repair_quote_items')
        .select(`
          *,
          item:items(id, item_code, description, status)
        `)
        .eq('repair_quote_id', tokenRecord.repair_quote_id);

      if (itemsError) throw itemsError;

      // Fetch photos for each item
      const itemsWithPhotos = await Promise.all(
        (itemsData || []).map(async (qi: any) => {
          const { data: photos } = await supabase
            .from('item_photos')
            .select('photo_url')
            .eq('item_id', qi.item_id)
            .order('created_at', { ascending: false });

          return {
            ...qi,
            damage_photos: qi.damage_photos || (photos || []).map((p: any) => p.photo_url),
          } as RepairQuoteItem;
        })
      );

      setQuoteItems(itemsWithPhotos);
      setLoading(false);
    } catch (err) {
      console.error('Error loading quote data:', err);
      setError('Failed to load quote information');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    validateAndLoad();
  }, [validateAndLoad]);

  // Submit quote
  const submitQuote = useCallback(async (submission: TechQuoteSubmission): Promise<boolean> => {
    if (!tokenData || !quote) return false;

    try {
      setSubmitting(true);

      const techTotal = (submission.labor_hours * submission.labor_rate) + submission.materials_cost;

      // Get technician markup
      const { data: techData } = await supabase
        .from('technicians')
        .select('markup_percent')
        .eq('id', quote.technician_id)
        .single();

      const markupPercent = techData?.markup_percent || 0;
      const customerTotal = techTotal * (1 + markupPercent / 100);

      const auditEntry: AuditLogEntry = {
        action: 'tech_submitted',
        by: null,
        by_name: tokenData.recipient_name,
        at: new Date().toISOString(),
        details: {
          labor_hours: submission.labor_hours,
          labor_rate: submission.labor_rate,
          materials_cost: submission.materials_cost,
          tech_total: techTotal,
        },
      };

      const { error: updateError } = await (supabase
        .from('repair_quotes') as any)
        .update({
          status: 'tech_submitted',
          tech_labor_hours: submission.labor_hours,
          tech_labor_rate: submission.labor_rate,
          tech_materials_cost: submission.materials_cost,
          tech_total: techTotal,
          tech_notes: submission.notes || null,
          tech_submitted_at: new Date().toISOString(),
          customer_total: customerTotal,
          markup_applied: markupPercent,
          audit_log: [...(quote.audit_log || []), auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      // Mark token as used
      await (supabase as any)
        .from('repair_quote_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      toast({
        title: 'Quote Submitted',
        description: 'Your quote has been submitted successfully.',
      });

      return true;
    } catch (err) {
      console.error('Error submitting quote:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit quote. Please try again.',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [tokenData, quote, toast]);

  // Decline job
  const declineJob = useCallback(async (reason?: string): Promise<boolean> => {
    if (!tokenData || !quote) return false;

    try {
      setSubmitting(true);

      const auditEntry: AuditLogEntry = {
        action: 'tech_declined',
        by: null,
        by_name: tokenData.recipient_name,
        at: new Date().toISOString(),
        details: { reason },
      };

      const { error: updateError } = await (supabase
        .from('repair_quotes') as any)
        .update({
          status: 'tech_declined',
          tech_notes: reason || null,
          audit_log: [...(quote.audit_log || []), auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      // Mark token as used
      await (supabase as any)
        .from('repair_quote_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      toast({
        title: 'Job Declined',
        description: 'You have declined this repair job.',
      });

      return true;
    } catch (err) {
      console.error('Error declining job:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to decline job. Please try again.',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [tokenData, quote, toast]);

  return {
    loading,
    error,
    tokenData,
    quote,
    quoteItems,
    submitting,
    submitQuote,
    declineJob,
    refetch: validateAndLoad,
  };
}

// Hook for client quote review (unauthenticated - magic link)
export function useClientQuoteReview(token: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<RepairQuoteToken | null>(null);
  const [quote, setQuote] = useState<RepairQuoteWorkflow | null>(null);
  const [quoteItems, setQuoteItems] = useState<RepairQuoteItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const validateAndLoad = useCallback(async () => {
    if (!token) {
      setError('No access token provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Validate token
      const { data: tokenRecord, error: tokenError } = await (supabase as any)
        .from('repair_quote_tokens')
        .select('*')
        .eq('token', token)
        .eq('token_type', 'client_review')
        .single();

      if (tokenError || !tokenRecord) {
        setError('Invalid or expired access link');
        setLoading(false);
        return;
      }

      // Check expiration
      if (new Date(tokenRecord.expires_at) < new Date()) {
        setError('This quote has expired. Please contact the warehouse for assistance.');
        setLoading(false);
        return;
      }

      setTokenData(tokenRecord as RepairQuoteToken);

      // Update accessed_at
      await (supabase as any)
        .from('repair_quote_tokens')
        .update({ accessed_at: new Date().toISOString() })
        .eq('id', tokenRecord.id);

      // Load quote with relations
      const { data: quoteData, error: quoteError } = await (supabase
        .from('repair_quotes') as any)
        .select(`
          *,
          account:accounts(id, name:account_name),
          sidemark:sidemarks(id, name:sidemark_name),
          technician:technicians(id, name)
        `)
        .eq('id', tokenRecord.repair_quote_id)
        .single();

      if (quoteError) throw quoteError;

      // Check if already responded
      if (quoteData.client_response) {
        setError(`You have already ${quoteData.client_response} this quote.`);
        setLoading(false);
        return;
      }

      setQuote(quoteData as RepairQuoteWorkflow);

      // Load quote items with item details
      const { data: itemsData, error: itemsError } = await (supabase as any)
        .from('repair_quote_items')
        .select(`
          *,
          item:items(id, item_code, description, status)
        `)
        .eq('repair_quote_id', tokenRecord.repair_quote_id);

      if (itemsError) throw itemsError;

      // Fetch photos for each item
      const itemsWithPhotos = await Promise.all(
        (itemsData || []).map(async (qi: any) => {
          const { data: photos } = await supabase
            .from('item_photos')
            .select('photo_url')
            .eq('item_id', qi.item_id)
            .order('created_at', { ascending: false })
            .limit(5);

          return {
            ...qi,
            damage_photos: qi.damage_photos?.length > 0
              ? qi.damage_photos
              : (photos || []).map((p: any) => p.photo_url),
          } as RepairQuoteItem;
        })
      );

      setQuoteItems(itemsWithPhotos);
      setLoading(false);
    } catch (err) {
      console.error('Error loading quote data:', err);
      setError('Failed to load quote information');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    validateAndLoad();
  }, [validateAndLoad]);

  // Accept quote
  const acceptQuote = useCallback(async (): Promise<boolean> => {
    if (!tokenData || !quote) return false;

    try {
      setSubmitting(true);

      const auditEntry: AuditLogEntry = {
        action: 'accepted',
        by: null,
        by_name: tokenData.recipient_name || 'Client',
        at: new Date().toISOString(),
        details: {
          customer_total: quote.customer_total,
        },
      };

      const { error: updateError } = await (supabase
        .from('repair_quotes') as any)
        .update({
          status: 'accepted',
          client_response: 'accepted',
          client_responded_at: new Date().toISOString(),
          audit_log: [...(quote.audit_log || []), auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      // Mark token as used
      await (supabase as any)
        .from('repair_quote_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      toast({
        title: 'Quote Accepted',
        description: 'Thank you! The warehouse has been notified.',
      });

      return true;
    } catch (err) {
      console.error('Error accepting quote:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to accept quote. Please try again.',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [tokenData, quote, toast]);

  // Decline quote
  const declineQuote = useCallback(async (reason?: string): Promise<boolean> => {
    if (!tokenData || !quote) return false;

    try {
      setSubmitting(true);

      const auditEntry: AuditLogEntry = {
        action: 'declined',
        by: null,
        by_name: tokenData.recipient_name || 'Client',
        at: new Date().toISOString(),
        details: { reason },
      };

      const { error: updateError } = await (supabase
        .from('repair_quotes') as any)
        .update({
          status: 'declined',
          client_response: 'declined',
          client_responded_at: new Date().toISOString(),
          tech_notes: reason ? `Client decline reason: ${reason}` : quote.tech_notes,
          audit_log: [...(quote.audit_log || []), auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      // Mark token as used
      await (supabase as any)
        .from('repair_quote_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      toast({
        title: 'Quote Declined',
        description: 'The warehouse has been notified of your decision.',
      });

      return true;
    } catch (err) {
      console.error('Error declining quote:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to decline quote. Please try again.',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [tokenData, quote, toast]);

  return {
    loading,
    error,
    tokenData,
    quote,
    quoteItems,
    submitting,
    acceptQuote,
    declineQuote,
    refetch: validateAndLoad,
  };
}
