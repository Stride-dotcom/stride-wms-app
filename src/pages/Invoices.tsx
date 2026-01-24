import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInvoices, Invoice, InvoiceLine, InvoiceType } from "@/hooks/useInvoices";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Plus, FileText, Send, Eye, XCircle, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmail, buildInvoiceSentEmail } from "@/lib/email";

interface Account {
  id: string;
  account_name: string;
  account_code: string;
  billing_contact_email: string | null;
}

export default function Invoices() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { createInvoiceDraft, markInvoiceSent, voidInvoice, fetchInvoices, fetchInvoiceLines, generateStorageForDate } = useInvoices();
  
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("weekly_services");
  const [includeEarlier, setIncludeEarlier] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Lines dialog
  const [linesDialogOpen, setLinesDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  // Storage generation
  const [storageDate, setStorageDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [generatingStorage, setGeneratingStorage] = useState(false);

  // Load accounts
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

  const load = async () => {
    setLoading(true);
    const data = await fetchInvoices({ limit: 100 });
    setInvoices(data);
    setLoading(false);
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      load();
    }
  }, [profile?.tenant_id]);

  const createDraft = async () => {
    if (!accountId) {
      toast({ title: "Account required", description: "Please select an account.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const inv = await createInvoiceDraft({
      accountId,
      invoiceType,
      periodStart,
      periodEnd,
      includeUnbilledBeforePeriod: includeEarlier,
    });
    if (inv) await load();
    setCreating(false);
  };

  const openLines = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setLinesDialogOpen(true);
    setLoadingLines(true);
    const data = await fetchInvoiceLines(invoice.id);
    setLines(data);
    setLoadingLines(false);
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    const ok = await markInvoiceSent(invoice.id);
    if (ok) {
      // Find account email
      const account = accounts.find(a => a.id === invoice.account_id);
      if (account?.billing_contact_email) {
        const emailData = buildInvoiceSentEmail({
          invoiceNumber: invoice.invoice_number,
          accountName: account.account_name,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
          total: invoice.total,
          lineCount: lines.length || 0,
        });
        
        const result = await sendEmail(account.billing_contact_email, emailData.subject, emailData.html);
        if (result.ok) {
          toast({ title: "Email sent", description: `Invoice email sent to ${account.billing_contact_email}` });
        } else {
          toast({ title: "Email failed", description: result.error || "Could not send email", variant: "destructive" });
        }
      }
      await load();
    }
  };

  const handleVoidInvoice = async (invoiceId: string) => {
    const ok = await voidInvoice(invoiceId);
    if (ok) await load();
  };

  const handleGenerateStorage = async () => {
    setGeneratingStorage(true);
    await generateStorageForDate(storageDate);
    setGeneratingStorage(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Draft</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Sent</Badge>;
      case "void":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Void</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "weekly_services":
        return <Badge variant="secondary">Weekly Services</Badge>;
      case "monthly_storage":
        return <Badge variant="secondary">Monthly Storage</Badge>;
      case "closeout":
        return <Badge variant="secondary">Closeout</Badge>;
      case "manual":
        return <Badge variant="secondary">Manual</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Invoices</h1>
            <p className="text-muted-foreground">Create and manage invoice drafts</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        {/* Storage Generation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Generate Storage Charges
            </CardTitle>
            <CardDescription>
              Generate daily storage charges for all active items on a specific date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Date</label>
                <Input 
                  type="date" 
                  value={storageDate} 
                  onChange={(e) => setStorageDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <Button onClick={handleGenerateStorage} disabled={generatingStorage}>
                {generatingStorage ? "Generating..." : "Generate Storage"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Create Invoice Draft */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Invoice Draft
            </CardTitle>
            <CardDescription>
              Create a new invoice from unbilled charges for an account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-sm font-medium">Account</label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
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
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as InvoiceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly_services">Weekly Services</SelectItem>
                    <SelectItem value="monthly_storage">Monthly Storage</SelectItem>
                    <SelectItem value="closeout">Closeout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Period Start</label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Period End</label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="includeEarlier" 
                checked={includeEarlier} 
                onCheckedChange={(checked) => setIncludeEarlier(checked === true)} 
              />
              <label htmlFor="includeEarlier" className="text-sm text-muted-foreground">
                Include unbilled charges earlier than period (catch-up for suspense/unclaimed items)
              </label>
            </div>

            <Button onClick={createDraft} disabled={creating || !accountId}>
              <Plus className="h-4 w-4 mr-2" />
              {creating ? "Creating..." : "Create Draft"}
            </Button>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Invoices ({invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const account = accounts.find(a => a.id === inv.account_id);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-semibold">{inv.invoice_number}</TableCell>
                        <TableCell>{account?.account_name || inv.account_id.slice(0, 8)}</TableCell>
                        <TableCell>{getTypeBadge(inv.invoice_type)}</TableCell>
                        <TableCell>{inv.period_start} to {inv.period_end}</TableCell>
                        <TableCell>{getStatusBadge(inv.status)}</TableCell>
                        <TableCell className="text-right">${Number(inv.subtotal || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">${Number(inv.total || 0).toFixed(2)}</TableCell>
                        <TableCell>{inv.created_at?.slice(0, 10)}</TableCell>
                        <TableCell>{inv.sent_at?.slice(0, 10) || "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openLines(inv)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleSendInvoice(inv)} 
                              disabled={inv.status !== "draft"}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleVoidInvoice(inv.id)} 
                              disabled={inv.status === "void"}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!invoices.length && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No invoices yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Lines Dialog */}
        <Dialog open={linesDialogOpen} onOpenChange={setLinesDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Invoice Lines - {selectedInvoice?.invoice_number}</DialogTitle>
              <DialogDescription>
                {selectedInvoice?.period_start} to {selectedInvoice?.period_end}
              </DialogDescription>
            </DialogHeader>
            {loadingLines ? (
              <div className="p-8 text-center text-muted-foreground">Loading lines...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.service_code}</TableCell>
                      <TableCell>{line.description || "-"}</TableCell>
                      <TableCell className="text-right">{line.quantity}</TableCell>
                      <TableCell className="text-right">${Number(line.unit_rate || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">${Number(line.line_total || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {!lines.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No lines found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-lg font-semibold">
                Total: ${Number(selectedInvoice?.total || 0).toFixed(2)}
              </div>
              <Button variant="outline" onClick={() => setLinesDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
