import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices, useBillableCharges, BillableCharge, Invoice } from '@/hooks/useBilling';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';

interface Account {
  id: string;
  account_name: string;
  account_code: string;
  parent_account_id: string | null;
}

const CHARGE_TYPE_OPTIONS = [
  { value: 'tasks', label: 'Task Charges (Receiving, Shipping, Assembly, etc.)' },
  { value: 'custom', label: 'Custom Billing Charges' },
];

export default function Billing() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: gate } = useSubscriptionGate();
  const { invoices, loading: invoicesLoading, createInvoice, updateInvoiceStatus, refetch: refetchInvoices } = useInvoices();
  const [startingSubscription, setStartingSubscription] = useState(false);

  // Filters and state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [includeSubAccounts, setIncludeSubAccounts] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [chargeTypes, setChargeTypes] = useState<string[]>(['tasks', 'custom']);
  const [searchQuery, setSearchQuery] = useState('');

  // Create invoice dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCharges, setSelectedCharges] = useState<Set<string>>(new Set());
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // View invoice dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceLineItems, setInvoiceLineItems] = useState<any[]>([]);

  // Billable charges
  const {
    charges,
    loading: chargesLoading,
    refetch: refetchCharges,
  } = useBillableCharges(
    selectedAccountIds,
    format(dateRange.start, 'yyyy-MM-dd'),
    format(dateRange.end, 'yyyy-MM-dd'),
    chargeTypes
  );

  useEffect(() => {
    fetchAccounts();
  }, [profile?.tenant_id]);

  const fetchAccounts = async () => {
    if (!profile?.tenant_id) return;

    const { data, error } = await supabase
      .from('accounts')
      .select('id, account_name, account_code, parent_account_id')
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('account_name');

    if (!error) {
      setAccounts(data || []);
    }
  };

  const handleAccountSelect = (accountId: string, checked: boolean) => {
    let newSelected = new Set(selectedAccountIds);

    if (checked) {
      newSelected.add(accountId);
      // Include sub-accounts if option is enabled
      if (includeSubAccounts) {
        accounts
          .filter(a => a.parent_account_id === accountId)
          .forEach(a => newSelected.add(a.id));
      }
    } else {
      newSelected.delete(accountId);
    }

    setSelectedAccountIds(Array.from(newSelected));
  };

  const handleChargeTypeToggle = (chargeType: string) => {
    setChargeTypes(prev =>
      prev.includes(chargeType)
        ? prev.filter(t => t !== chargeType)
        : [...prev, chargeType]
    );
  };

  const toggleChargeSelection = (chargeId: string) => {
    const newSelected = new Set(selectedCharges);
    if (newSelected.has(chargeId)) {
      newSelected.delete(chargeId);
    } else {
      newSelected.add(chargeId);
    }
    setSelectedCharges(newSelected);
  };

  const selectAllCharges = () => {
    if (selectedCharges.size === filteredCharges.length) {
      setSelectedCharges(new Set());
    } else {
      setSelectedCharges(new Set(filteredCharges.map(c => c.id)));
    }
  };

  const handleCreateInvoice = async () => {
    if (selectedCharges.size === 0 || selectedAccountIds.length === 0) return;

    setCreatingInvoice(true);
    try {
      // Group charges by account
      const chargesByAccount = new Map<string, BillableCharge[]>();

      for (const chargeId of selectedCharges) {
        const charge = charges.find(c => c.id === chargeId);
        if (charge) {
          const existing = chargesByAccount.get(charge.account_id) || [];
          existing.push(charge);
          chargesByAccount.set(charge.account_id, existing);
        }
      }

      // Create invoice for each account
      for (const [accountId, accountCharges] of chargesByAccount) {
        const lineItems = accountCharges.map(charge => ({
          description: charge.description,
          line_item_type: charge.charge_type,
          service_type: charge.service_type,
          service_date: charge.service_date,
          quantity: charge.quantity,
          unit_price: charge.unit_price,
          line_total: charge.total,
          item_id: charge.item_id || null,
          item_code: charge.item_code || null,
          task_id: charge.task_id || null,
          account_code: null,
        }));

        await createInvoice(
          accountId,
          format(dateRange.start, 'yyyy-MM-dd'),
          format(dateRange.end, 'yyyy-MM-dd'),
          lineItems
        );

        // Mark custom charges as invoiced
        const customChargeIds = accountCharges
          .filter(c => c.charge_type === 'custom')
          .map(c => c.id.replace('custom-', ''));

        if (customChargeIds.length > 0) {
          await supabase
            .from('custom_billing_charges')
            .update({ invoiced_at: new Date().toISOString() })
            .in('id', customChargeIds);
        }
      }

      toast({
        title: 'Invoice(s) Created',
        description: `Created ${chargesByAccount.size} invoice(s) successfully.`,
      });

      setCreateDialogOpen(false);
      setSelectedCharges(new Set());
      refetchCharges();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create invoice(s).',
      });
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);

    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order');

    setInvoiceLineItems(data || []);
    setViewDialogOpen(true);
  };

  const handleSendInvoice = async (invoiceId: string) => {
    await updateInvoiceStatus(invoiceId, 'sent');
    toast({ title: 'Invoice Sent', description: 'Invoice status updated to sent.' });
  };

  const handleMarkPaid = async (invoiceId: string) => {
    await updateInvoiceStatus(invoiceId, 'paid');
    toast({ title: 'Invoice Paid', description: 'Invoice marked as paid.' });
  };

  const filteredCharges = charges.filter(charge =>
    charge.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    charge.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    charge.item_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTotal = Array.from(selectedCharges).reduce((sum, chargeId) => {
    const charge = charges.find(c => c.id === chargeId);
    return sum + (charge?.total || 0);
  }, 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      sent: 'default',
      paid: 'outline',
      overdue: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const isNewSubscriber = gate?.status === 'none';

  const handleSubscriptionAction = async () => {
    setStartingSubscription(true);
    try {
      const functionName = isNewSubscriber
        ? 'create-stripe-checkout-session'
        : 'create-stripe-portal-session';

      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) throw new Error(error.message);

      const targetUrl = (data as { url?: string } | null)?.url;
      if (!targetUrl) {
        throw new Error('No Stripe redirect URL returned.');
      }

      window.location.assign(targetUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start Stripe flow.';
      toast({
        variant: 'destructive',
        title: 'Subscription action failed',
        description: message,
      });
    } finally {
      setStartingSubscription(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            primaryText="Revenue"
            accentText="Ledger"
            description="Create invoices from billable charges"
          />
          <Button
            onClick={() => void handleSubscriptionAction()}
            disabled={startingSubscription}
            className="gap-2"
          >
            {startingSubscription ? (
              <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
            ) : (
              <MaterialIcon name="credit_card" size="sm" />
            )}
            {isNewSubscriber ? 'Start Subscription' : 'Manage Subscription'}
          </Button>
        </div>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList>
            <TabsTrigger value="create">Create Invoice</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="filter_list" size="md" />
                  Filter Charges
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Date Range */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Period Start</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                          {format(dateRange.start, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.start}
                          onSelect={(date) =>
                            date && setDateRange(prev => ({ ...prev, start: date }))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Period End</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                          {format(dateRange.end, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.end}
                          onSelect={(date) =>
                            date && setDateRange(prev => ({ ...prev, end: date }))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Charge Types */}
                <div className="space-y-2">
                  <Label>Charge Types</Label>
                  <div className="flex flex-wrap gap-4">
                    {CHARGE_TYPE_OPTIONS.map(option => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={option.value}
                          checked={chargeTypes.includes(option.value)}
                          onCheckedChange={() => handleChargeTypeToggle(option.value)}
                        />
                        <label htmlFor={option.value} className="text-sm">
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Accounts</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-sub"
                        checked={includeSubAccounts}
                        onCheckedChange={(checked) => setIncludeSubAccounts(!!checked)}
                      />
                      <label htmlFor="include-sub" className="text-sm">
                        Include sub-accounts
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3 max-h-48 overflow-y-auto border rounded-md p-4">
                    {accounts
                      .filter(a => !a.parent_account_id)
                      .map(account => (
                        <div key={account.id} className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={account.id}
                              checked={selectedAccountIds.includes(account.id)}
                              onCheckedChange={(checked) =>
                                handleAccountSelect(account.id, !!checked)
                              }
                            />
                            <label htmlFor={account.id} className="text-sm font-medium">
                              {account.account_name}
                            </label>
                          </div>
                          {/* Sub-accounts */}
                          {accounts
                            .filter(a => a.parent_account_id === account.id)
                            .map(sub => (
                              <div
                                key={sub.id}
                                className="flex items-center space-x-2 ml-6"
                              >
                                <Checkbox
                                  id={sub.id}
                                  checked={selectedAccountIds.includes(sub.id)}
                                  onCheckedChange={(checked) =>
                                    handleAccountSelect(sub.id, !!checked)
                                  }
                                />
                                <label htmlFor={sub.id} className="text-sm text-muted-foreground">
                                  {sub.account_name}
                                </label>
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Billable Charges */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Billable Charges</CardTitle>
                    <CardDescription>
                      {filteredCharges.length} charges found
                      {selectedCharges.size > 0 && (
                        <span className="ml-2">
                          • {selectedCharges.size} selected (${selectedTotal.toFixed(2)})
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {selectedCharges.size > 0 && (
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <MaterialIcon name="add" size="sm" className="mr-2" />
                      Create Invoice(s)
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search charges..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {chargesLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
                  </div>
                ) : selectedAccountIds.length === 0 ? (
                  <div className="text-center py-12">
                    <MaterialIcon name="attach_money" className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">Select accounts</h3>
                    <p className="text-muted-foreground">
                      Choose accounts to view billable charges
                    </p>
                  </div>
                ) : filteredCharges.length === 0 ? (
                  <div className="text-center py-12">
                    <MaterialIcon name="attach_money" className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No charges found</h3>
                    <p className="text-muted-foreground">
                      No billable charges for the selected period and accounts
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedCharges.size === filteredCharges.length && filteredCharges.length > 0}
                              onCheckedChange={selectAllCharges}
                            />
                          </TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCharges.map(charge => (
                          <TableRow
                            key={charge.id}
                            className={cn(
                              'cursor-pointer hover:bg-muted/50',
                              selectedCharges.has(charge.id) && 'bg-muted/30'
                            )}
                            onClick={() => toggleChargeSelection(charge.id)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedCharges.has(charge.id)}
                                onCheckedChange={() => toggleChargeSelection(charge.id)}
                              />
                            </TableCell>
                            <TableCell>{format(new Date(charge.service_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell>{charge.account_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{charge.service_type}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {charge.description}
                            </TableCell>
                            <TableCell className="text-right">{charge.quantity}</TableCell>
                            <TableCell className="text-right font-mono">
                              ${charge.unit_price.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              ${charge.total.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="description" size="md" />
                  Invoices
                </CardTitle>
                <CardDescription>
                  {invoices.length} invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-12">
                    <MaterialIcon name="description" className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No invoices yet</h3>
                    <p className="text-muted-foreground">
                      Create invoices from the Create Invoice tab
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-32">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map(invoice => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{invoice.account_name}</TableCell>
                            <TableCell>{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              {invoice.period_start && invoice.period_end
                                ? `${format(new Date(invoice.period_start), 'MMM d')} - ${format(new Date(invoice.period_end), 'MMM d, yyyy')}`
                                : '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              ${(invoice.total_amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewInvoice(invoice)}
                                >
                                  <MaterialIcon name="visibility" size="sm" />
                                </Button>
                                {invoice.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSendInvoice(invoice.id)}
                                  >
                                    <MaterialIcon name="send" size="sm" />
                                  </Button>
                                )}
                                {invoice.status === 'sent' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMarkPaid(invoice.id)}
                                  >
                                    <MaterialIcon name="check_circle" size="sm" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Invoice Confirmation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice(s)</DialogTitle>
            <DialogDescription>
              You are about to create invoices for {selectedCharges.size} charge(s) totaling ${selectedTotal.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Invoices will be grouped by account. Each account will receive a separate invoice.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={creatingInvoice}>
              {creatingInvoice ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Invoice(s)'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invoice {selectedInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.account_name}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground">Invoice Date</Label>
                  <p>{selectedInvoice && format(new Date(selectedInvoice.invoice_date), 'PPP')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Period</Label>
                  <p>
                    {selectedInvoice?.period_start && selectedInvoice?.period_end
                      ? `${format(new Date(selectedInvoice.period_start), 'MMM d')} - ${format(new Date(selectedInvoice.period_end), 'MMM d, yyyy')}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{selectedInvoice && getStatusBadge(selectedInvoice.status)}</p>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceLineItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.service_type || item.line_item_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity || 1}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${item.unit_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          ${item.line_total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="text-right space-y-1">
                  <div className="flex justify-between gap-8">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-mono">${(selectedInvoice?.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {(selectedInvoice?.tax_amount || 0) > 0 && (
                    <div className="flex justify-between gap-8">
                      <span className="text-muted-foreground">Tax:</span>
                      <span className="font-mono">${(selectedInvoice?.tax_amount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-8 text-lg font-bold">
                    <span>Total:</span>
                    <span className="font-mono">${(selectedInvoice?.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
