import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Search, FileText, Plus, Pencil, Check, X, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MultiSelect } from "@/components/ui/multi-select";
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

interface BillableService {
  id: string;
  code: string;
  name: string;
  category: string;
}

interface EditingRow {
  id: string;
  unit_rate: string;
  description: string;
  quantity: string;
}

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
  const [services, setServices] = useState<BillableService[]>([]);
  const [sidemarks, setSidemarks] = useState<Sidemark[]>([]);
  const [loading, setLoading] = useState(false);

  // Editing state
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Selection state for bulk actions
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

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
        .from("billable_services")
        .select("id, code, name, category")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");
      setServices((data as BillableService[]) || []);
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

  const fetchRows = async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    setSelectedRows(new Set());
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
  };

  // Start editing a row
  const startEditing = (row: BillingEventRow) => {
    if (row.status !== 'unbilled') {
      toast({ title: "Cannot edit", description: "Only unbilled charges can be edited.", variant: "destructive" });
      return;
    }
    setEditingRow({
      id: row.id,
      unit_rate: row.unit_rate.toString(),
      description: row.description || '',
      quantity: row.quantity.toString(),
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingRow(null);
  };

  // Save edited row
  const saveEditedRow = async () => {
    if (!editingRow) return;

    const unitRate = parseFloat(editingRow.unit_rate);
    const quantity = parseFloat(editingRow.quantity);

    if (isNaN(unitRate) || unitRate < 0) {
      toast({ title: "Invalid rate", description: "Please enter a valid rate.", variant: "destructive" });
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: "Invalid quantity", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }

    setSavingEdit(true);
    try {
      const totalAmount = unitRate * quantity;
      const { error } = await supabase
        .from("billing_events")
        .update({
          unit_rate: unitRate,
          quantity: quantity,
          total_amount: totalAmount,
          description: editingRow.description || null,
        })
        .eq("id", editingRow.id);

      if (error) throw error;

      // Update local state
      setRows(prev => prev.map(r =>
        r.id === editingRow.id
          ? { ...r, unit_rate: unitRate, quantity: quantity, total_amount: totalAmount, description: editingRow.description || null }
          : r
      ));

      toast({ title: "Saved", description: "Billing charge updated successfully." });
      setEditingRow(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
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

  // Select all unbilled rows
  const selectAllUnbilled = () => {
    const unbilledIds = rows.filter(r => r.status === 'unbilled').map(r => r.id);
    setSelectedRows(new Set(unbilledIds));
  };

  // Get unique charge types for service filter
  const uniqueChargeTypes = useMemo(() => {
    const types = new Set<string>();
    rows.forEach(r => {
      if (r.charge_type) types.add(r.charge_type);
    });
    // Also add from services
    services.forEach(s => types.add(s.code));
    return Array.from(types).sort();
  }, [rows, services]);

  const exportCSV = () => {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing_report_${start}_to_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Billing Report</h2>
          <p className="text-muted-foreground text-sm">View, edit, and manage billing events</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddChargeOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Charge
          </Button>
          <Button onClick={fetchRows} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
                  value: s.code,
                  label: s.name || s.code,
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            <div className="text-sm text-muted-foreground">
              {selectedRows.size > 0 && (
                <span>{selectedRows.size} row(s) selected</span>
              )}
            </div>
            <div className="flex gap-2">
              {rows.some(r => r.status === 'unbilled') && (
                <Button variant="outline" size="sm" onClick={selectAllUnbilled}>
                  Select All Unbilled
                </Button>
              )}
              <Button onClick={fetchRows} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
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
            <FileText className="h-5 w-5" />
            Billing Events ({rows.length})
          </CardTitle>
          <CardDescription>
            Click the edit icon on unbilled charges to modify rates, quantities, or descriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="w-10 p-3 border-b"></th>
                  <th className="text-left p-3 border-b font-medium">Date</th>
                  <th className="text-left p-3 border-b font-medium">Account</th>
                  <th className="text-left p-3 border-b font-medium">Sidemark</th>
                  <th className="text-left p-3 border-b font-medium">Item</th>
                  <th className="text-left p-3 border-b font-medium">Type</th>
                  <th className="text-left p-3 border-b font-medium">Charge</th>
                  <th className="text-left p-3 border-b font-medium min-w-[150px]">Description</th>
                  <th className="text-right p-3 border-b font-medium w-20">Qty</th>
                  <th className="text-right p-3 border-b font-medium w-24">Rate</th>
                  <th className="text-right p-3 border-b font-medium">Total</th>
                  <th className="text-center p-3 border-b font-medium">Status</th>
                  <th className="w-20 p-3 border-b font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isEditing = editingRow?.id === r.id;
                  const canEdit = r.status === 'unbilled';

                  return (
                    <tr key={r.id} className={`border-b hover:bg-muted/50 ${isEditing ? 'bg-blue-50' : ''}`}>
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
                      <td className="p-3 text-xs">{r.sidemark_name}</td>
                      <td className="p-3 font-mono text-xs">{r.item_code}</td>
                      <td className="p-3">{r.event_type}</td>
                      <td className="p-3">{r.charge_type}</td>
                      <td className="p-3 max-w-[200px]">
                        {isEditing ? (
                          <Input
                            value={editingRow.description}
                            onChange={(e) => setEditingRow({ ...editingRow, description: e.target.value })}
                            className="h-8 text-sm"
                            placeholder="Description"
                          />
                        ) : (
                          <span className="truncate block">{r.description || "-"}</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editingRow.quantity}
                            onChange={(e) => setEditingRow({ ...editingRow, quantity: e.target.value })}
                            className="h-8 text-sm w-20 text-right"
                            step="1"
                            min="1"
                          />
                        ) : (
                          r.quantity
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editingRow.unit_rate}
                            onChange={(e) => setEditingRow({ ...editingRow, unit_rate: e.target.value })}
                            className="h-8 text-sm w-24 text-right"
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          `$${Number(r.unit_rate || 0).toFixed(2)}`
                        )}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {isEditing ? (
                          <span className="text-blue-600">
                            ${(parseFloat(editingRow.unit_rate || '0') * parseFloat(editingRow.quantity || '0')).toFixed(2)}
                          </span>
                        ) : (
                          `$${Number(r.total_amount || 0).toFixed(2)}`
                        )}
                      </td>
                      <td className="p-3 text-center">{getStatusBadge(r.status)}</td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={saveEditedRow}
                                disabled={savingEdit}
                              >
                                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={cancelEditing}
                                disabled={savingEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : canEdit ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEditing(r)}
                              title="Edit charge"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td className="p-8 text-center text-muted-foreground" colSpan={13}>
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
              {addChargeLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Charge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
