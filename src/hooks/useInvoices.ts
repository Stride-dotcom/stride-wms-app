import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export type InvoiceType = "weekly_services" | "monthly_storage" | "closeout" | "manual";
export type InvoiceStatus = "draft" | "sent" | "void";

// Use 'any' for DB row types since schema varies
export interface Invoice {
  id: string;
  tenant_id: string;
  account_id: string;
  invoice_number: string;
  invoice_type?: string;
  period_start?: string;
  period_end?: string;
  status: string;
  subtotal?: number;
  tax_total?: number;
  total?: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  sent_at?: string | null;
  [key: string]: unknown;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  billing_event_id?: string | null;
  item_id?: string | null;
  description?: string | null;
  quantity: number;
  unit_rate: number;
  total_amount?: number;
  [key: string]: unknown;
}

export interface CreateInvoiceArgs {
  accountId: string;
  sidemark?: string | null;
  invoiceType: InvoiceType;
  periodStart: string;
  periodEnd: string;
  includeUnbilledBeforePeriod?: boolean;
}

export function useInvoices() {
  const { toast } = useToast();
  const { profile } = useAuth();

  const createInvoiceDraft = useCallback(async (args: CreateInvoiceArgs): Promise<Invoice | null> => {
    try {
      if (!profile?.tenant_id) {
        throw new Error("No tenant context");
      }

      // 1) get invoice number from RPC
      const { data: invNum, error: invNumErr } = await supabase.rpc("next_invoice_number");
      if (invNumErr) throw invNumErr;
      const invoice_number = invNum as string;

      // 2) fetch unbilled billing_events for account in period (and optionally earlier)
      let query = supabase
        .from("billing_events")
        .select("*")
        .eq("account_id", args.accountId)
        .eq("status", "unbilled");

      // Optional sidemark filter
      if (args.sidemark) {
        query = query.eq("sidemark_id", args.sidemark);
      }

      if (args.includeUnbilledBeforePeriod) {
        // Include all unbilled charges up to period end
        query = query.lte("occurred_at", `${args.periodEnd}T23:59:59.999Z`);
      } else {
        // Only charges within period
        query = query
          .gte("occurred_at", `${args.periodStart}T00:00:00.000Z`)
          .lte("occurred_at", `${args.periodEnd}T23:59:59.999Z`);
      }

      const { data: events, error: eventsErr } = await query;
      if (eventsErr) throw eventsErr;

      if (!events || events.length === 0) {
        toast({ title: "No unbilled charges", description: "There are no unbilled charges for the selected period." });
        return null;
      }

      const subtotal = events.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);

      // 3) create invoice draft (note: invoice_type not in schema, use notes for metadata)
      const { data: invoice, error: invErr } = await (supabase
        .from("invoices") as any)
        .insert({
          tenant_id: profile.tenant_id,
          account_id: args.accountId,
          sidemark_id: args.sidemark || null,
          invoice_number,
          period_start: args.periodStart,
          period_end: args.periodEnd,
          status: "draft",
          subtotal,
          tax_amount: 0,
          total_amount: subtotal,
          created_by: profile.id,
          notes: `Type: ${args.invoiceType}`,
        })
        .select("*")
        .single();

      if (invErr) throw invErr;

      // 4) create invoice lines from events
      const lines = events.map((e) => ({
        tenant_id: profile.tenant_id,
        invoice_id: invoice.id,
        billing_event_id: e.id,
        item_id: e.item_id || null,
        description: e.description || e.charge_type || e.event_type,
        quantity: e.quantity ?? 1,
        unit_rate: e.unit_rate ?? e.total_amount ?? 0,
        total_amount: e.total_amount ?? 0,
      }));

      const { error: linesErr } = await supabase.from("invoice_lines").insert(lines);
      if (linesErr) throw linesErr;

      // 5) mark billing_events invoiced
      const { error: updErr } = await supabase
        .from("billing_events")
        .update({ status: "invoiced", invoice_id: invoice.id, invoiced_at: new Date().toISOString() })
        .in("id", events.map((e) => e.id));

      if (updErr) throw updErr;

      toast({ title: "Invoice draft created", description: `${invoice_number} created with ${lines.length} line(s).` });
      return invoice as unknown as Invoice;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("createInvoiceDraft error", err);
      toast({ title: "Invoice creation failed", description: message, variant: "destructive" });
      return null;
    }
  }, [profile, toast]);

  const markInvoiceSent = useCallback(async (invoiceId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoiceId);
      if (error) throw error;

      toast({ title: "Invoice marked sent", description: "Invoice status updated to Sent." });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("markInvoiceSent error", err);
      toast({ title: "Failed to mark sent", description: message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  const voidInvoice = useCallback(async (invoiceId: string): Promise<boolean> => {
    try {
      if (!profile?.tenant_id) {
        throw new Error("No tenant context");
      }

      // 1) Get invoice details
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invErr) throw invErr;

      // 2) Get all billing events linked to this invoice
      const { data: originalEvents, error: eventsErr } = await supabase
        .from("billing_events")
        .select("*")
        .eq("invoice_id", invoiceId);

      if (eventsErr) throw eventsErr;

      // 3) Void the invoice
      const { error: voidErr } = await supabase
        .from("invoices")
        .update({ status: "void" })
        .eq("id", invoiceId);

      if (voidErr) throw voidErr;

      // 4) Create reversal billing_events (negative amounts) for each original event
      // This maintains audit trail - billing_events are never deleted per Section 5
      if (originalEvents && originalEvents.length > 0) {
        const reversalEvents = originalEvents.map((event: any) => ({
          tenant_id: event.tenant_id,
          account_id: event.account_id,
          item_id: event.item_id,
          task_id: event.task_id,
          sidemark_id: event.sidemark_id,
          class_id: event.class_id,
          shipment_id: event.shipment_id,
          service_id: event.service_id,
          event_type: event.event_type,
          charge_type: event.charge_type,
          description: `REVERSAL: ${event.description || event.charge_type}`,
          quantity: -(event.quantity || 1),
          unit_rate: event.unit_rate,
          total_amount: -(event.total_amount || 0),
          status: 'void' as const,
          occurred_at: new Date().toISOString(),
          metadata: {
            reversal_of: event.id,
            voided_invoice_id: invoiceId,
            original_occurred_at: event.occurred_at,
          },
          created_by: profile.id || null,
          needs_review: false,
        }));

        const { error: reversalErr } = await supabase
          .from("billing_events")
          .insert(reversalEvents);

        if (reversalErr) throw reversalErr;

        // 5) Mark original events as void (not deleted)
        const eventIds = originalEvents.map((e: any) => e.id);
        const { error: voidEventsErr } = await supabase
          .from("billing_events")
          .update({ status: "void" })
          .in("id", eventIds);

        if (voidEventsErr) throw voidEventsErr;
      }

      toast({ title: "Invoice voided", description: "Invoice has been voided with reversal entries created." });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("voidInvoice error", err);
      toast({ title: "Failed to void invoice", description: message, variant: "destructive" });
      return false;
    }
  }, [profile, toast]);

  const fetchInvoices = useCallback(async (filters?: {
    accountId?: string;
    status?: InvoiceStatus;
    limit?: number;
  }): Promise<Invoice[]> => {
    try {
      let query = supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filters?.limit || 50);

      if (filters?.accountId) {
        query = query.eq("account_id", filters.accountId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []) as unknown as Invoice[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("fetchInvoices error", err);
      toast({ title: "Failed to load invoices", description: message, variant: "destructive" });
      return [];
    }
  }, [toast]);

  const fetchInvoiceLines = useCallback(async (invoiceId: string): Promise<InvoiceLine[]> => {
    try {
      const { data, error } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as InvoiceLine[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("fetchInvoiceLines error", err);
      toast({ title: "Failed to load invoice lines", description: message, variant: "destructive" });
      return [];
    }
  }, [toast]);

  const generateStorageForDate = useCallback(async (date: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc("generate_storage_for_date", { p_date: date });
      if (error) throw error;
      
      toast({ title: "Storage charges generated", description: `Storage charges for ${date} have been created.` });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("generateStorageForDate error", err);
      toast({ title: "Failed to generate storage charges", description: message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  const updateInvoiceNotes = useCallback(async (invoiceId: string, notes: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ notes })
        .eq("id", invoiceId);
      if (error) throw error;

      toast({ title: "Notes saved", description: "Invoice notes have been updated." });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("updateInvoiceNotes error", err);
      toast({ title: "Failed to save notes", description: message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  const markInvoicePaid = useCallback(async (
    invoiceId: string,
    paidAmount: number,
    paymentDate?: string,
    paymentMethod?: string,
    paymentReference?: string
  ): Promise<boolean> => {
    try {
      const updatePayload: Record<string, unknown> = {
        status: 'paid',
        paid_amount: paidAmount,
        paid_at: paymentDate || new Date().toISOString(),
      };

      if (paymentMethod) {
        updatePayload.payment_method = paymentMethod;
      }
      if (paymentReference) {
        updatePayload.payment_reference = paymentReference;
      }

      const { error } = await supabase
        .from("invoices")
        .update(updatePayload)
        .eq("id", invoiceId);

      if (error) throw error;

      toast({ title: "Invoice marked paid", description: `Payment of $${paidAmount.toFixed(2)} recorded.` });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("markInvoicePaid error", err);
      toast({ title: "Failed to mark paid", description: message, variant: "destructive" });
      return false;
    }
  }, [toast]);

  // Create batch invoices - one per account from a list of billing event IDs
  const createBatchInvoices = useCallback(async (
    eventIds: string[],
    periodStart: string,
    periodEnd: string
  ): Promise<{ success: number; failed: number; invoices: Invoice[] }> => {
    const result = { success: 0, failed: 0, invoices: [] as Invoice[] };

    try {
      if (!profile?.tenant_id) {
        throw new Error("No tenant context");
      }

      if (eventIds.length === 0) {
        toast({ title: "No events selected", description: "Please select billing events to invoice." });
        return result;
      }

      // Fetch all selected billing events
      const { data: events, error: eventsErr } = await supabase
        .from("billing_events")
        .select("*, accounts:account_id(account_name)")
        .in("id", eventIds)
        .eq("status", "unbilled");

      if (eventsErr) throw eventsErr;

      if (!events || events.length === 0) {
        toast({ title: "No unbilled events", description: "All selected events are already invoiced or void." });
        return result;
      }

      // Group events by account_id
      const eventsByAccount = events.reduce((acc, event) => {
        const accountId = event.account_id;
        if (!accountId) return acc;
        if (!acc[accountId]) {
          acc[accountId] = {
            accountName: (event.accounts as any)?.account_name || 'Unknown',
            events: []
          };
        }
        acc[accountId].events.push(event);
        return acc;
      }, {} as Record<string, { accountName: string; events: any[] }>);

      // Create invoice for each account
      for (const [accountId, { accountName, events: accountEvents }] of Object.entries(eventsByAccount)) {
        try {
          // Get invoice number
          const { data: invNum, error: invNumErr } = await supabase.rpc("next_invoice_number");
          if (invNumErr) throw invNumErr;
          const invoice_number = invNum as string;

          const subtotal = accountEvents.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);

          // Create invoice
          const { data: invoice, error: invErr } = await (supabase
            .from("invoices") as any)
            .insert({
              tenant_id: profile.tenant_id,
              account_id: accountId,
              invoice_number,
              period_start: periodStart,
              period_end: periodEnd,
              status: "draft",
              subtotal,
              tax_amount: 0,
              total_amount: subtotal,
              created_by: profile.id,
              notes: `Batch invoice for ${accountName}`,
            })
            .select("*")
            .single();

          if (invErr) throw invErr;

          // Create invoice lines
          const lines = accountEvents.map((e) => ({
            tenant_id: profile.tenant_id,
            invoice_id: invoice.id,
            billing_event_id: e.id,
            item_id: e.item_id || null,
            description: e.description || e.charge_type || e.event_type,
            quantity: e.quantity ?? 1,
            unit_rate: e.unit_rate ?? e.total_amount ?? 0,
            total_amount: e.total_amount ?? 0,
          }));

          const { error: linesErr } = await supabase.from("invoice_lines").insert(lines);
          if (linesErr) throw linesErr;

          // Mark billing events as invoiced
          const { error: updErr } = await supabase
            .from("billing_events")
            .update({ status: "invoiced", invoice_id: invoice.id, invoiced_at: new Date().toISOString() })
            .in("id", accountEvents.map((e) => e.id));

          if (updErr) throw updErr;

          result.invoices.push(invoice as unknown as Invoice);
          result.success++;
        } catch (err) {
          console.error(`Failed to create invoice for account ${accountId}:`, err);
          result.failed++;
        }
      }

      if (result.success > 0) {
        toast({
          title: "Batch invoices created",
          description: `Created ${result.success} invoice(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Invoice creation failed",
          description: "Could not create any invoices.",
        });
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("createBatchInvoices error", err);
      toast({ title: "Batch invoice creation failed", description: message, variant: "destructive" });
      return result;
    }
  }, [profile, toast]);

  return {
    createInvoiceDraft,
    markInvoiceSent,
    markInvoicePaid,
    voidInvoice,
    fetchInvoices,
    fetchInvoiceLines,
    generateStorageForDate,
    updateInvoiceNotes,
    createBatchInvoices,
  };
}
