import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { PushToQuickBooksButton } from "@/components/billing/PushToQuickBooksButton";
import { BillingEventForSync } from "@/hooks/useQuickBooks";
import { useAuth } from "@/contexts/AuthContext";
import { MultiSelect } from "@/components/ui/multi-select";
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface BillingEventRow {
  id: string;
  occurred_at: string;
  account_id: string;
  item_id: string | null;
  sidemark_id: string | null;
  event_type: string;
  charge_type: string;
  description: string | null;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  status: string;
  invoice_id: string | null;
  account_name?: string;
  item_code?: string;
  sidemark_name?: string;
}

interface Account {
  id: string;
  account_name: string;
  account_code: string;
  billing_contact_email?: string | null;
}

interface Sidemark {
  id: string;
  sidemark_name: string;
  account_id: string;
}

interface ServiceEvent {
  id: string;
  service_code: string;
  service_name: string;
}

// Track edits per row
interface RowEdit {
  description: string;
  quantity: string;
  unit_rate: string;
  sidemark_id: string;
}

type SortField = 'occurred_at' | 'account_name' | 'sidemark_name' | 'item_code' | 'event_type' | 'charge_type' | 'description' | 'quantity' | 'unit_rate' | 'total_amount' | 'status';
type SortDirection = 'asc' | 'desc';

function formatDateMMDDYY(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function toCSV(rows: BillingEventRow[]) {
  if (!rows.length) return "";
  const headers = ["occurred_at", "account_name", "item_code", "event_type", "charge_type", "description", "quantity", "unit_rate", "total_amount", "status", "invoice_id"];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => {
      if (h === 'occurred_at') {
        return escape(formatDateMMDDYY(r.occurred_at));
      }
      return escape(r[h as keyof BillingEventRow]);
    }).join(","));
  }
  return lines.join("\n");
}

export function BillingReportTab() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [start, setStart] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [rows, setRows] = useState<BillingEventRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [services, setServices] = useState<ServiceEvent[]>([]);
  const [sidemarks, setSidemarks] = useState<Sidemark[]>([]);
  const [loading, setLoading] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('occurred_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Inline editing state - track edits per row
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({});
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: 'description' | 'quantity' | 'unit_rate' | 'sidemark_id' } | null>(null);
  const [savingRows, setSavingRows] = useState(false);

  // Selection state for bulk actions
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Add custom charge dialog
  const [addChargeOpen, setAddChargeOpen] = useState(false);
  const [addChargeLoading, setAddChargeLoading] = useState(false);
  const [newCharge, setNewCharge] = useState({
    account_id: '',
    sidemark_id: '',
    charge_type: '',
    description: '',
    quantity: '1',
    unit_rate: '',
    occurred_at: new Date().toISOString().slice(0, 10),
  });

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return Object.keys(rowEdits).length > 0;
  }, [rowEdits]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    async function loadAccounts() {
      if (!profile?.tenant_id) return;
      const { data } = await supabase
        .from("accounts")
        .select("id, account_name, account_code, billing_contact_email")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("account_name");
      setAccounts(data || []);
    }
    loadAccounts();
  }, [profile?.tenant_id]);

  useEffect(() => {
    async function loadServices() {
      if (!profile?.tenant_id) return;
      const { data } = await supabase
        .from("service_events")
        .select("id, service_code, service_name")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .is("class_code", null)
        .order("service_name");
      setServices((data as ServiceEvent[]) || []);
    }
    loadServices();
  }, [profile?.tenant_id]);

  useEffect(() => {
    async function loadSidemarks() {
      if (!profile?.tenant_id) return;
      const { data } = await supabase
        .from("sidemarks")
        .select("id, sidemark_name, account_id")
        .is("deleted_at", null)
        .order("sidemark_name");
      setSidemarks((data as Sidemark[]) || []);
    }
    loadSidemarks();
  }, [profile?.tenant_id]);

  // Get sidemarks for selected account
  const accountSidemarks = useMemo(() => {
    if (!newCharge.account_id) return [];
    return sidemarks.filter(s => s.account_id === newCharge.account_id);
  }, [sidemarks, newCharge.account_id]);

  // Get sidemarks for a specific row's account
  const getSidemarksForRow = useCallback((accountId: string) => {
    return sidemarks.filter(s => s.account_id === accountId);
  }, [sidemarks]);

  const fetchRows = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    setSelectedRows(new Set());
    setRowEdits({}); // Clear any pending edits
    setEditingCell(null);
    try {
      let query = (supabase
        .from("billing_events") as any)
        .select(`
          id, occurred_at, account_id, item_id, sidemark_id, event_type, charge_type,
          description, quantity, unit_rate, total_amount, status, invoice_id
        `)
        .eq("tenant_id", profile.tenant_id)
        .gte("occurred_at", `${start}T00:00:00.000Z`)
        .lte("occurred_at", `${end}T23:59:59.999Z`)
        .order("occurred_at", { ascending: false })
        .limit(1000);

      if (selectedAccounts.length > 0) {
        query = query.in("account_id", selectedAccounts);
      }
      if (selectedStatuses.length > 0) {
        query = query.in("status", selectedStatuses);
      }
      if (selectedServices.length > 0) {
        query = query.in("charge_type", selectedServices);
      }
      if (serviceFilter.trim()) {
        query = query.ilike("charge_type", `%${serviceFilter.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch account names and sidemark names separately
      const accountIds = [...new Set((data || []).map((r: any) => r.account_id).filter(Boolean))] as string[];
      const sidemarkIds = [...new Set((data || []).map((r: any) => r.sidemark_id).filter(Boolean))] as string[];
      const itemIds = [...new Set((data || []).map((r: any) => r.item_id).filter(Boolean))] as string[];

      let accountMap: Record<string, string> = {};
      let sidemarkMap: Record<string, string> = {};
      let itemMap: Record<string, string> = {};

      if (accountIds.length > 0) {
        const { data: accts } = await supabase
          .from("accounts")
          .select("id, account_name")
          .in("id", accountIds);
        if (accts) {
          accountMap = Object.fromEntries(accts.map((a: any) => [a.id, a.account_name]));
        }
      }

      if (sidemarkIds.length > 0) {
        const { data: sms } = await supabase
          .from("sidemarks")
          .select("id, sidemark_name")
          .in("id", sidemarkIds);
        if (sms) {
          sidemarkMap = Object.fromEntries(sms.map((s: any) => [s.id, s.sidemark_name]));
        }
      }

      if (itemIds.length > 0) {
        const { data: items } = await supabase
          .from("items")
          .select("id, item_code")
          .in("id", itemIds);
        if (items) {
          itemMap = Object.fromEntries(items.map((i: any) => [i.id, i.item_code]));
        }
      }

      const transformed = (data || []).map((row: any) => ({
        ...row,
        account_name: row.account_id ? (accountMap[row.account_id] || "-") : "-",
        item_code: row.item_id ? (itemMap[row.item_id] || "-") : "-",
        sidemark_name: row.sidemark_id ? (sidemarkMap[row.sidemark_id] || "-") : "-",
      }));

      setRows(transformed);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(e);
      toast({ title: "Failed to load report", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, start, end, selectedAccounts, selectedStatuses, selectedServices, serviceFilter, toast]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle null/undefined
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Handle numeric fields
      if (sortField === 'quantity' || sortField === 'unit_rate' || sortField === 'total_amount') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }

      // Handle dates
      if (sortField === 'occurred_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // Compare
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, sortField, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <MaterialIcon name="unfold_more" size="sm" className="ml-1 opacity-30" />;
    }
    return sortDirection === 'asc'
      ? <MaterialIcon name="arrow_upward" size="sm" className="ml-1" />
      : <MaterialIcon name="arrow_downward" size="sm" className="ml-1" />;
  };

  // Handle inline edit - start editing a cell
  const startCellEdit = (row: BillingEventRow, field: 'description' | 'quantity' | 'unit_rate' | 'sidemark_id') => {
    if (row.status !== 'unbilled') return;

    // Initialize edit state for this row if not exists
    if (!rowEdits[row.id]) {
      setRowEdits(prev => ({
        ...prev,
        [row.id]: {
          description: row.description || '',
          quantity: row.quantity.toString(),
          unit_rate: row.unit_rate.toString(),
          sidemark_id: row.sidemark_id || '',
        }
      }));
    }
    setEditingCell({ rowId: row.id, field });
  };

  // Handle inline edit value change
  const handleEditChange = (rowId: string, field: keyof RowEdit, value: string) => {
    setRowEdits(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value
      }
    }));
  };

  // Handle blur - finish editing cell
  const handleCellBlur = () => {
    setEditingCell(null);
  };

  // Handle key press in edit field
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditingCell(null);
    } else if (e.key === 'Escape') {
      // Revert changes for this row
      if (editingCell) {
        const row = rows.find(r => r.id === editingCell.rowId);
        if (row) {
          setRowEdits(prev => {
            const { [editingCell.rowId]: _, ...rest } = prev;
            return rest;
          });
        }
      }
      setEditingCell(null);
    }
  };

  // Get display value for a row (edited or original)
  const getRowValue = (row: BillingEventRow, field: 'description' | 'quantity' | 'unit_rate' | 'sidemark_id') => {
    if (rowEdits[row.id]) {
      return rowEdits[row.id][field];
    }
    if (field === 'description') return row.description || '';
    if (field === 'quantity') return row.quantity.toString();
    if (field === 'unit_rate') return row.unit_rate.toString();
    if (field === 'sidemark_id') return row.sidemark_id || '';
    return '';
  };

  // Calculate total for a row (uses edited values if available)
  const getRowTotal = (row: BillingEventRow) => {
    if (rowEdits[row.id]) {
      const qty = parseFloat(rowEdits[row.id].quantity) || 0;
      const rate = parseFloat(rowEdits[row.id].unit_rate) || 0;
      return qty * rate;
    }
    return row.total_amount;
  };

  // Get sidemark name for display
  const getSidemarkName = (row: BillingEventRow) => {
    if (rowEdits[row.id] && rowEdits[row.id].sidemark_id) {
      const sidemark = sidemarks.find(s => s.id === rowEdits[row.id].sidemark_id);
      return sidemark?.sidemark_name || '-';
    }
    return row.sidemark_name || '-';
  };

  // Save all edited rows
  const saveAllEdits = async () => {
    const editedRowIds = Object.keys(rowEdits);
    if (editedRowIds.length === 0) return;

    setSavingRows(true);
    try {
      for (const rowId of editedRowIds) {
        const edit = rowEdits[rowId];
        const unitRate = parseFloat(edit.unit_rate);
        const quantity = parseFloat(edit.quantity);

        if (isNaN(unitRate) || unitRate < 0) {
          toast({ title: "Invalid rate", description: `Please enter a valid rate for row.`, variant: "destructive" });
          continue;
        }
        if (isNaN(quantity) || quantity <= 0) {
          toast({ title: "Invalid quantity", description: `Please enter a valid quantity for row.`, variant: "destructive" });
          continue;
        }

        const totalAmount = unitRate * quantity;
        const { error } = await supabase
          .from("billing_events")
          .update({
            unit_rate: unitRate,
            quantity: quantity,
            total_amount: totalAmount,
            description: edit.description || null,
            sidemark_id: edit.sidemark_id || null,
          })
          .eq("id", rowId);

        if (error) throw error;

        // Update local state
        setRows(prev => prev.map(r =>
          r.id === rowId
            ? {
                ...r,
                unit_rate: unitRate,
                quantity: quantity,
                total_amount: totalAmount,
                description: edit.description || null,
                sidemark_id: edit.sidemark_id || null,
                sidemark_name: edit.sidemark_id ? (sidemarks.find(s => s.id === edit.sidemark_id)?.sidemark_name || '-') : '-',
              }
            : r
        ));
      }

      // Clear all edits
      setRowEdits({});
      toast({ title: "Saved", description: `${editedRowIds.length} row(s) updated successfully.` });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    } finally {
      setSavingRows(false);
    }
  };

  // Discard all changes
  const discardChanges = () => {
    setRowEdits({});
    setEditingCell(null);
    toast({ title: "Changes discarded" });
  };

  // Add custom charge
  const handleAddCharge = async () => {
    if (!profile?.tenant_id || !profile?.id) return;

    if (!newCharge.account_id) {
      toast({ title: "Account required", description: "Please select an account.", variant: "destructive" });
      return;
    }
    if (!newCharge.charge_type.trim()) {
      toast({ title: "Charge type required", description: "Please enter a charge type.", variant: "destructive" });
      return;
    }

    const unitRate = parseFloat(newCharge.unit_rate);
    const quantity = parseFloat(newCharge.quantity);

    if (isNaN(unitRate) || unitRate <= 0) {
      toast({ title: "Invalid rate", description: "Please enter a valid positive rate.", variant: "destructive" });
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: "Invalid quantity", description: "Please enter a valid positive quantity.", variant: "destructive" });
      return;
    }

    setAddChargeLoading(true);
    try {
      const { error } = await supabase
        .from("billing_events")
        .insert({
          tenant_id: profile.tenant_id,
          account_id: newCharge.account_id,
          sidemark_id: newCharge.sidemark_id || null,
          event_type: 'addon',
          charge_type: newCharge.charge_type.trim(),
          description: newCharge.description.trim() || null,
          quantity: quantity,
          unit_rate: unitRate,
          total_amount: unitRate * quantity,
          status: 'unbilled',
          occurred_at: `${newCharge.occurred_at}T12:00:00.000Z`,
          created_by: profile.id,
          metadata: { source: 'billing_report_addon' },
        });

      if (error) throw error;

      toast({ title: "Charge added", description: `Custom charge of $${(unitRate * quantity).toFixed(2)} added successfully.` });
      setAddChargeOpen(false);
      setNewCharge({
        account_id: '',
        sidemark_id: '',
        charge_type: '',
        description: '',
        quantity: '1',
        unit_rate: '',
        occurred_at: new Date().toISOString().slice(0, 10),
      });
      fetchRows();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to add charge", description: message, variant: "destructive" });
    } finally {
      setAddChargeLoading(false);
    }
  };

  // Toggle row selection
  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select/deselect all unbilled rows
  const toggleSelectAll = () => {
    const unbilledRows = rows.filter(r => r.status === 'unbilled');
    if (selectedRows.size === unbilledRows.length && unbilledRows.length > 0) {
      // Deselect all
      setSelectedRows(new Set());
    } else {
      // Select all unbilled
      setSelectedRows(new Set(unbilledRows.map(r => r.id)));
    }
  };

  // Check if all unbilled are selected
  const allUnbilledSelected = useMemo(() => {
    const unbilledRows = rows.filter(r => r.status === 'unbilled');
    return unbilledRows.length > 0 && unbilledRows.every(r => selectedRows.has(r.id));
  }, [rows, selectedRows]);

  // Check if some unbilled are selected
  const someUnbilledSelected = useMemo(() => {
    const unbilledRows = rows.filter(r => r.status === 'unbilled');
    return unbilledRows.some(r => selectedRows.has(r.id)) && !allUnbilledSelected;
  }, [rows, selectedRows, allUnbilledSelected]);


  // Handle navigation after unsaved changes dialog
  const handleProceedWithNavigation = () => {
    setShowUnsavedDialog(false);
    if (pendingNavigation === 'create-invoice') {
      const selectedBillingEventIds = Array.from(selectedRows);
      sessionStorage.setItem('invoiceSelectedBillingEvents', JSON.stringify(selectedBillingEventIds));
      navigate('/invoices?tab=create&source=billing-report');
    }
    setPendingNavigation(null);
  };

  const handleSaveAndProceed = async () => {
    await saveAllEdits();
    setShowUnsavedDialog(false);
    if (pendingNavigation === 'create-invoice') {
      const selectedBillingEventIds = Array.from(selectedRows);
      sessionStorage.setItem('invoiceSelectedBillingEvents', JSON.stringify(selectedBillingEventIds));
      navigate('/invoices?tab=create&source=billing-report');
    }
    setPendingNavigation(null);
  };

  // Navigate to Invoice Builder with selected unbilled events
  const handleCreateInvoice = () => {
    const unbilledEventIds = Array.from(selectedRows).filter(id => {
      const row = rows.find(r => r.id === id);
      return row?.status === 'unbilled';
    });

    if (unbilledEventIds.length === 0) {
      toast({
        title: 'No unbilled charges selected',
        description: 'Please select unbilled charges to create an invoice.',
        variant: 'destructive',
      });
      return;
    }

    const eventParams = unbilledEventIds.join(',');
    navigate(`/reports?tab=revenue-ledger&subtab=builder&events=${eventParams}`);
  };

  // Get unique charge types for service filter
  const uniqueChargeTypes = useMemo(() => {
    const types = new Set<string>();
    rows.forEach(r => {
      if (r.charge_type) types.add(r.charge_type);
    });
    // Also add from services
    services.forEach(s => types.add(s.service_code));
    return Array.from(types).sort();
  }, [rows, services]);

  const exportExcel = () => {
    // Prepare data for Excel export
    const excelData = rows.map(r => ({
      'Date': formatDateMMDDYY(r.occurred_at),
      'Account': r.account_name || '-',
      'Sidemark': r.sidemark_name || '-',
      'Item': r.item_code || '-',
      'Event Type': r.event_type,
      'Charge Type': r.charge_type,
      'Description': r.description || '',
      'Quantity': r.quantity,
      'Unit Rate': r.unit_rate,
      'Total': r.total_amount,
      'Status': r.status,
      'Invoice ID': r.invoice_id || '',
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 25 }, // Account
      { wch: 20 }, // Sidemark
      { wch: 15 }, // Item
      { wch: 15 }, // Event Type
      { wch: 20 }, // Charge Type
      { wch: 30 }, // Description
      { wch: 10 }, // Quantity
      { wch: 12 }, // Unit Rate
      { wch: 12 }, // Total
      { wch: 12 }, // Status
      { wch: 15 }, // Invoice ID
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Billing Report');

    // Generate Excel file and download
    XLSX.writeFile(wb, `billing_report_${start}_to_${end}.xlsx`);
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchRows();
    }
  }, [profile?.tenant_id]);

  const stats = useMemo(() => {
    const unbilled = rows.filter(r => r.status === "unbilled").reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const invoiced = rows.filter(r => r.status === "invoiced").reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const voided = rows.filter(r => r.status === "void").reduce((s, r) => s + Number(r.total_amount || 0), 0);
    return { unbilled, invoiced, voided, total: unbilled + invoiced };
  }, [rows]);

  // Transform unbilled events for QuickBooks sync
  const unbilledEventsForSync: BillingEventForSync[] = useMemo(() => {
    return rows
      .filter(r => r.status === "unbilled" && r.account_id)
      .map(r => ({
        id: r.id,
        account_id: r.account_id,
        event_type: r.event_type,
        charge_type: r.charge_type,
        description: r.description || `${r.charge_type} charge`,
        quantity: r.quantity,
        unit_rate: r.unit_rate,
        total_amount: r.total_amount,
        occurred_at: r.occurred_at,
        item_id: r.item_id || undefined,
        item_code: r.item_code || undefined,
      }));
  }, [rows]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "unbilled":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Unbilled</Badge>;
      case "invoiced":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Invoiced</Badge>;
      case "void":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Void</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Sortable column header component
  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`p-3 border-b font-medium cursor-pointer hover:bg-muted/80 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        {getSortIcon(field)}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Billing Report</h2>
          <p className="text-muted-foreground text-sm">View, edit, and manage billing events</p>
        </div>
        <div className="flex gap-2">
          {selectedRows.size > 0 && (
            <Button onClick={handleCreateInvoice} size="sm" variant="default">
              <MaterialIcon name="receipt" size="sm" className="mr-2" />
              Create Invoice ({selectedRows.size})
            </Button>
          )}
          <Button onClick={() => setAddChargeOpen(true)} size="sm" variant="outline">
            <MaterialIcon name="add" size="sm" className="mr-2" />
            Add Charge
          </Button>
          <Button onClick={fetchRows} disabled={loading} variant="outline" size="sm">
            <MaterialIcon name="refresh" size="sm" className={`mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!rows.length}>
            <MaterialIcon name="download" size="sm" className="mr-2" />
            Export Excel
          </Button>
          <PushToQuickBooksButton
            billingEvents={unbilledEventsForSync}
            periodStart={start}
            periodEnd={end}
            disabled={unbilledEventsForSync.length === 0}
            onSyncComplete={() => fetchRows()}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unbilled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">${stats.unbilled.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${stats.invoiced.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Voided</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${stats.voided.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.total.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Account</label>
              <MultiSelect
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.account_code} - ${a.account_name}`,
                }))}
                selected={selectedAccounts}
                onChange={setSelectedAccounts}
                placeholder="All accounts"
                emptyMessage="No accounts found"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <MultiSelect
                options={[
                  { value: 'unbilled', label: 'Unbilled' },
                  { value: 'invoiced', label: 'Invoiced' },
                  { value: 'void', label: 'Void' },
                ]}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="All statuses"
                emptyMessage="No statuses found"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Service Type</label>
              <MultiSelect
                options={services.map((s) => ({
                  value: s.service_code,
                  label: s.service_name || s.service_code,
                }))}
                selected={selectedServices}
                onChange={setSelectedServices}
                placeholder="All services"
                emptyMessage="No services found"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Service (search)</label>
              <div className="relative">
                <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  placeholder="e.g. INSPECTION"
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-muted-foreground flex items-center gap-4">
              {selectedRows.size > 0 && (
                <span>{selectedRows.size} row(s) selected</span>
              )}
              {hasUnsavedChanges && (
                <span className="text-amber-600 flex items-center gap-1">
                  <MaterialIcon name="edit" size="sm" />
                  {Object.keys(rowEdits).length} unsaved change(s)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {/* Save/Discard buttons when there are unsaved changes */}
              {hasUnsavedChanges && (
                <>
                  <Button variant="outline" size="sm" onClick={discardChanges}>
                    Discard Changes
                  </Button>
                  <Button size="sm" onClick={saveAllEdits} disabled={savingRows}>
                    {savingRows && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              )}
              {/* Create Invoice button */}
              {selectedRows.size > 0 && (
                <Button onClick={handleCreateInvoice} size="sm" variant="default">
                  <MaterialIcon name="receipt" size="sm" className="mr-2" />
                  Create Invoice ({selectedRows.size})
                </Button>
              )}
              <Button onClick={fetchRows} disabled={loading}>
                <MaterialIcon name="search" size="sm" className="mr-2" />
                Run Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="description" size="md" />
            Billing Events ({rows.length})
          </CardTitle>
          <CardDescription>
            Click on Description, Qty, Sidemark, or Rate fields to edit unbilled charges. Click column headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 p-3 border-b">
                    <Checkbox
                      checked={allUnbilledSelected}
                      onCheckedChange={toggleSelectAll}
                      className={someUnbilledSelected ? "data-[state=checked]:bg-primary/50" : ""}
                    />
                  </th>
                  <SortableHeader field="occurred_at" className="text-left">Date</SortableHeader>
                  <SortableHeader field="account_name" className="text-left">Account</SortableHeader>
                  <SortableHeader field="sidemark_name" className="text-left">Sidemark</SortableHeader>
                  <SortableHeader field="item_code" className="text-left">Item</SortableHeader>
                  <SortableHeader field="event_type" className="text-left">Type</SortableHeader>
                  <SortableHeader field="charge_type" className="text-left">Charge</SortableHeader>
                  <SortableHeader field="description" className="text-left min-w-[150px]">Description</SortableHeader>
                  <SortableHeader field="quantity" className="text-right w-20">Qty</SortableHeader>
                  <SortableHeader field="unit_rate" className="text-right w-24">Rate</SortableHeader>
                  <SortableHeader field="total_amount" className="text-right">Total</SortableHeader>
                  <SortableHeader field="status" className="text-center">Status</SortableHeader>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const canEdit = r.status === 'unbilled';
                  const hasEdits = !!rowEdits[r.id];
                  const rowSidemarks = getSidemarksForRow(r.account_id);

                  return (
                    <tr key={r.id} className={`border-b hover:bg-muted/50 ${hasEdits ? 'bg-amber-50' : ''}`}>
                      <td className="p-3">
                        {canEdit && (
                          <Checkbox
                            checked={selectedRows.has(r.id)}
                            onCheckedChange={() => toggleRowSelection(r.id)}
                          />
                        )}
                      </td>
                      <td className="p-3">{r.occurred_at?.slice(0, 10)}</td>
                      <td className="p-3">{r.account_name}</td>
                      {/* Sidemark - Editable */}
                      <td className="p-3 text-xs">
                        {canEdit && editingCell?.rowId === r.id && editingCell?.field === 'sidemark_id' ? (
                          <Select
                            value={getRowValue(r, 'sidemark_id') || '__none__'}
                            onValueChange={(v) => handleEditChange(r.id, 'sidemark_id', v === '__none__' ? '' : v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-32" onBlur={handleCellBlur}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {rowSidemarks.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.sidemark_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={canEdit ? 'cursor-text hover:bg-muted p-1 rounded' : ''}
                            onClick={() => canEdit && startCellEdit(r, 'sidemark_id')}
                          >
                            {getSidemarkName(r)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">{r.item_code}</td>
                      <td className="p-3">{r.event_type}</td>
                      <td className="p-3">{r.charge_type}</td>
                      {/* Description - Editable */}
                      <td className="p-3 max-w-[200px]">
                        {canEdit && editingCell?.rowId === r.id && editingCell?.field === 'description' ? (
                          <Input
                            autoFocus
                            value={getRowValue(r, 'description')}
                            onChange={(e) => handleEditChange(r.id, 'description', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleEditKeyDown}
                            className="h-8 text-sm"
                            placeholder="Description"
                          />
                        ) : (
                          <span
                            className={`truncate block ${canEdit ? 'cursor-text hover:bg-muted p-1 rounded' : ''}`}
                            onClick={() => canEdit && startCellEdit(r, 'description')}
                          >
                            {getRowValue(r, 'description') || "-"}
                          </span>
                        )}
                      </td>
                      {/* Quantity - Editable */}
                      <td className="p-3 text-right">
                        {canEdit && editingCell?.rowId === r.id && editingCell?.field === 'quantity' ? (
                          <Input
                            autoFocus
                            type="number"
                            value={getRowValue(r, 'quantity')}
                            onChange={(e) => handleEditChange(r.id, 'quantity', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleEditKeyDown}
                            className="h-8 text-sm w-20 text-right"
                            step="1"
                            min="1"
                          />
                        ) : (
                          <span
                            className={canEdit ? 'cursor-text hover:bg-muted p-1 rounded' : ''}
                            onClick={() => canEdit && startCellEdit(r, 'quantity')}
                          >
                            {getRowValue(r, 'quantity')}
                          </span>
                        )}
                      </td>
                      {/* Rate - Editable */}
                      <td className="p-3 text-right">
                        {canEdit && editingCell?.rowId === r.id && editingCell?.field === 'unit_rate' ? (
                          <Input
                            autoFocus
                            type="number"
                            value={getRowValue(r, 'unit_rate')}
                            onChange={(e) => handleEditChange(r.id, 'unit_rate', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleEditKeyDown}
                            className="h-8 text-sm w-24 text-right"
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          <span
                            className={canEdit ? 'cursor-text hover:bg-muted p-1 rounded' : ''}
                            onClick={() => canEdit && startCellEdit(r, 'unit_rate')}
                          >
                            ${Number(getRowValue(r, 'unit_rate') || 0).toFixed(2)}
                          </span>
                        )}
                      </td>
                      {/* Total - Auto-calculated */}
                      <td className="p-3 text-right font-semibold">
                        <span className={hasEdits ? 'text-amber-600' : ''}>
                          ${getRowTotal(r).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 text-center">{getStatusBadge(r.status)}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td className="p-8 text-center text-muted-foreground" colSpan={12}>
                      No billing events found for the selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Custom Charge Dialog */}
      <Dialog open={addChargeOpen} onOpenChange={setAddChargeOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add Custom Charge</DialogTitle>
            <DialogDescription>
              Create a new billing charge that will be added to the unbilled charges
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="charge_account">Account *</Label>
                <Select
                  value={newCharge.account_id}
                  onValueChange={(v) => setNewCharge({ ...newCharge, account_id: v, sidemark_id: '' })}
                >
                  <SelectTrigger id="charge_account">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="charge_sidemark">Sidemark (optional)</Label>
                <Select
                  value={newCharge.sidemark_id || '__none__'}
                  onValueChange={(v) => setNewCharge({ ...newCharge, sidemark_id: v === '__none__' ? '' : v })}
                  disabled={!newCharge.account_id}
                >
                  <SelectTrigger id="charge_sidemark">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {accountSidemarks.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.sidemark_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="charge_type">Charge Type *</Label>
                <Input
                  id="charge_type"
                  value={newCharge.charge_type}
                  onChange={(e) => setNewCharge({ ...newCharge, charge_type: e.target.value })}
                  placeholder="e.g., ADDITIONAL_SERVICE"
                  list="charge-types"
                />
                <datalist id="charge-types">
                  {uniqueChargeTypes.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="charge_date">Charge Date</Label>
                <Input
                  id="charge_date"
                  type="date"
                  value={newCharge.occurred_at}
                  onChange={(e) => setNewCharge({ ...newCharge, occurred_at: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="charge_qty">Quantity *</Label>
                <Input
                  id="charge_qty"
                  type="number"
                  value={newCharge.quantity}
                  onChange={(e) => setNewCharge({ ...newCharge, quantity: e.target.value })}
                  min="1"
                  step="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="charge_rate">Unit Rate *</Label>
                <Input
                  id="charge_rate"
                  type="number"
                  value={newCharge.unit_rate}
                  onChange={(e) => setNewCharge({ ...newCharge, unit_rate: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            {newCharge.unit_rate && newCharge.quantity && (
              <div className="text-right text-lg font-semibold text-blue-600">
                Total: ${(parseFloat(newCharge.unit_rate || '0') * parseFloat(newCharge.quantity || '0')).toFixed(2)}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="charge_desc">Description</Label>
              <Textarea
                id="charge_desc"
                value={newCharge.description}
                onChange={(e) => setNewCharge({ ...newCharge, description: e.target.value })}
                placeholder="Optional description for this charge..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddChargeOpen(false)} disabled={addChargeLoading}>
              Cancel
            </Button>
            <Button onClick={handleAddCharge} disabled={addChargeLoading}>
              {addChargeLoading && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Add Charge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have {Object.keys(rowEdits).length} unsaved change(s). Would you like to save them before proceeding?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNavigation(null)}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={handleProceedWithNavigation}>
              Discard & Continue
            </Button>
            <AlertDialogAction onClick={handleSaveAndProceed}>
              Save & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
