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
  service_code?: string;
  description?: string | null;
  quantity: number;
  unit_rate: number;
  line_total?: number;
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

      // 3) create invoice draft
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          tenant_id: profile.tenant_id,
          account_id: args.accountId,
          sidemark: args.sidemark || null,
          invoice_number,
          invoice_type: args.invoiceType,
          period_start: args.periodStart,
          period_end: args.periodEnd,
          status: "draft",
          subtotal,
          tax_total: 0,
          total: subtotal,
          created_by: profile.id,
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
        service_code: e.charge_type || e.event_type,
        description: e.description || e.charge_type || e.event_type,
        quantity: e.quantity ?? 1,
        unit_rate: e.unit_rate ?? e.total_amount ?? 0,
        line_total: e.total_amount ?? 0,
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
      // 1) Get all billing event IDs linked to this invoice
      const { data: lines, error: linesErr } = await supabase
        .from("invoice_lines")
        .select("billing_event_id")
        .eq("invoice_id", invoiceId);

      if (linesErr) throw linesErr;

      // 2) Void the invoice
      const { error: voidErr } = await supabase
        .from("invoices")
        .update({ status: "void" })
        .eq("id", invoiceId);

      if (voidErr) throw voidErr;

      // 3) Revert billing events back to unbilled
      const eventIds = (lines || []).map(l => l.billing_event_id).filter(Boolean) as string[];
      if (eventIds.length > 0) {
        const { error: revertErr } = await supabase
          .from("billing_events")
          .update({ status: "unbilled", invoice_id: null, invoiced_at: null })
          .in("id", eventIds);

        if (revertErr) throw revertErr;
      }

      toast({ title: "Invoice voided", description: "Invoice has been voided and charges are now unbilled again." });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("voidInvoice error", err);
      toast({ title: "Failed to void invoice", description: message, variant: "destructive" });
      return false;
    }
  }, [toast]);

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

  return { 
    createInvoiceDraft, 
    markInvoiceSent, 
    voidInvoice,
    fetchInvoices, 
    fetchInvoiceLines,
    generateStorageForDate,
  };
}
