import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { InvoiceDetailDialog } from './InvoiceDetailDialog';
import { MarkPaidDialog } from './MarkPaidDialog';
import { downloadInvoicePdf, InvoicePdfData } from '@/lib/invoicePdf';

interface Invoice {
  id: string;
  invoice_number: string;
  account_id: string;
  invoice_date: string;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  payment_status: string | null;
  subtotal: number;
  total_amount: number;
  paid_amount: number | null;
  tax_amount: number | null;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  accounts?: {
    account_name: string;
    account_code: string;
    billing_contact_email: string | null;
  };
}

export function SavedInvoicesTab() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<{ id: string; account_name: string }[]>([]);

  // Filters
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selection
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  // Dialogs
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Bulk action states
  const [bulkDownloading, setBulkDownloading] = useState(false);

  // Load invoices
  useEffect(() => {
    loadInvoices();
    loadAccounts();
  }, [profile?.tenant_id]);

  const loadInvoices = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);

    try {
      const { data, error } = await (supabase
        .from('invoices') as any)
        .select(`
          *,
          accounts!inner(account_name, account_code, billing_contact_email)
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
      toast({ title: 'Error loading invoices', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    if (!profile?.tenant_id) return;

    const { data } = await supabase
      .from('accounts')
      .select('id, account_name')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .order('account_name');

    setAccounts(data || []);
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (accountFilter !== 'all' && inv.account_id !== accountFilter) return false;
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      return true;
    });
  }, [invoices, accountFilter, statusFilter]);

  // Summary calculations
  const summary = useMemo(() => {
    const draft = filteredInvoices.filter(i => i.status === 'draft');
    const sent = filteredInvoices.filter(i => i.status === 'sent');
    const paid = filteredInvoices.filter(i => i.status === 'paid');

    return {
      draft: { count: draft.length, total: draft.reduce((s, i) => s + Number(i.total_amount || 0), 0) },
      sent: { count: sent.length, total: sent.reduce((s, i) => s + Number(i.total_amount || 0), 0) },
      paid: { count: paid.length, total: paid.reduce((s, i) => s + Number(i.total_amount || 0), 0) },
      total: { count: filteredInvoices.length, total: filteredInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0) },
    };
  }, [filteredInvoices]);

  // Selection handlers
  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  // Action handlers
  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
  };

  const handleMarkPaid = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setMarkPaidDialogOpen(true);
  };

  const handleVoidInvoice = async (invoice: Invoice) => {
    if (!confirm(`Are you sure you want to void invoice ${invoice.invoice_number}?`)) return;

    try {
      // Void the invoice
      const { error: voidErr } = await supabase
        .from('invoices')
        .update({ status: 'void' })
        .eq('id', invoice.id);

      if (voidErr) throw voidErr;

      // Reset billing events to unbilled
      const { error: resetErr } = await supabase
        .from('billing_events')
        .update({ status: 'unbilled', invoice_id: null, invoiced_at: null })
        .eq('invoice_id', invoice.id);

      if (resetErr) throw resetErr;

      toast({ title: 'Invoice voided' });
      loadInvoices();
    } catch (err) {
      console.error('Error voiding invoice:', err);
      toast({ title: 'Error voiding invoice', variant: 'destructive' });
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: 'Invoice marked as sent',
        description: `Invoice ${invoice.invoice_number} is now marked as sent`,
      });
      loadInvoices();
    } catch (err) {
      console.error('Error sending invoice:', err);
      toast({ title: 'Error sending invoice', variant: 'destructive' });
    }
  };

  // Bulk download
  const handleBulkDownload = async () => {
    setBulkDownloading(true);

    for (const id of selectedInvoices) {
      const invoice = invoices.find(i => i.id === id);
      if (!invoice) continue;

      // Generate and download PDF
      const pdfData: InvoicePdfData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date || undefined,
        periodStart: invoice.period_start || '',
        periodEnd: invoice.period_end || '',
        invoiceType: 'manual',
        companyName: 'Stride Warehouse',
        accountName: invoice.accounts?.account_name || '',
        accountCode: invoice.accounts?.account_code || '',
        lines: [],
        subtotal: invoice.subtotal || 0,
        total: invoice.total_amount || 0,
      };

      downloadInvoicePdf(pdfData);
      await new Promise(r => setTimeout(r, 500)); // Delay between downloads
    }

    setBulkDownloading(false);
    toast({ title: `Downloaded ${selectedInvoices.size} invoices` });
  };

  const getStatusBadge = (status: string, paymentStatus: string | null) => {
    if (status === 'draft') return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Draft</Badge>;
    if (status === 'sent') {
      if (paymentStatus === 'partial') return <Badge variant="outline" className="bg-orange-100 text-orange-800">Partial</Badge>;
      return <Badge variant="outline" className="bg-green-100 text-green-800">Sent</Badge>;
    }
    if (status === 'paid') return <Badge variant="outline" className="bg-blue-100 text-blue-800">Paid</Badge>;
    if (status === 'void') return <Badge variant="outline" className="bg-gray-100 text-gray-500">Void</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Saved Invoices</h2>
          <p className="text-muted-foreground">View and manage all invoices</p>
        </div>
        <Button variant="outline" onClick={loadInvoices}>
          <MaterialIcon name="refresh" size="sm" className="mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Account:</span>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Draft</p>
            <p className="text-2xl font-bold text-yellow-600">${summary.draft.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{summary.draft.count} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Sent</p>
            <p className="text-2xl font-bold text-green-600">${summary.sent.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{summary.sent.count} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-blue-600">${summary.paid.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{summary.paid.count} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">${summary.total.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{summary.total.count} invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedInvoices.size > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">{selectedInvoices.size} selected</span>
              <Button variant="outline" size="sm" onClick={handleBulkDownload} disabled={bulkDownloading}>
                <MaterialIcon name="download" size="sm" className="mr-1" />
                {bulkDownloading ? 'Downloading...' : 'Download PDFs'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedInvoices(new Set())}>
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedInvoices.has(invoice.id)}
                      onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.accounts?.account_name || '-'}</TableCell>
                  <TableCell>{invoice.invoice_date}</TableCell>
                  <TableCell>{invoice.due_date || '-'}</TableCell>
                  <TableCell className="text-right font-medium">${Number(invoice.total_amount || 0).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status || 'draft', invoice.payment_status)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleViewInvoice(invoice)}>
                        <MaterialIcon name="visibility" size="sm" />
                      </Button>
                      {invoice.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSendInvoice(invoice)}
                        >
                          <MaterialIcon name="send" size="sm" />
                        </Button>
                      )}
                      {invoice.status === 'sent' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMarkPaid(invoice)}
                        >
                          <MaterialIcon name="payments" size="sm" />
                        </Button>
                      )}
                      {invoice.status !== 'void' && invoice.status !== 'paid' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleVoidInvoice(invoice)}
                        >
                          <MaterialIcon name="cancel" size="sm" className="text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedInvoice && (
        <>
          <InvoiceDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            invoice={selectedInvoice}
            onRefresh={loadInvoices}
          />
          <MarkPaidDialog
            open={markPaidDialogOpen}
            onOpenChange={setMarkPaidDialogOpen}
            invoice={selectedInvoice}
            onSuccess={() => {
              setMarkPaidDialogOpen(false);
              loadInvoices();
            }}
          />
        </>
      )}
    </div>
  );
}
