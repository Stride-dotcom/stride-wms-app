import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  useQuotes,
  useQuoteClasses,
  useQuoteServices,
  useQuoteServiceRates,
  useEditLock,
} from '@/hooks/useQuotes';
import { useAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/hooks/use-toast';
import {
  QuoteFormData,
  QuoteWithDetails,
  DiscountType,
  QUOTE_STATUS_CONFIG,
  isQuoteEditable,
} from '@/lib/quotes/types';
import { calculateQuote, formatCurrency, computeStorageDays } from '@/lib/quotes/calculator';
import { downloadQuotePdf, exportQuoteToExcel, transformQuoteToPdfData } from '@/lib/quotes/export';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export default function QuoteBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  // Data hooks
  const { fetchQuoteDetails, createQuote, updateQuote, sendQuote } = useQuotes();
  const { classes, loading: classesLoading } = useQuoteClasses();
  const { services, servicesByCategory, loading: servicesLoading } = useQuoteServices();
  const { rates, loading: ratesLoading } = useQuoteServiceRates();
  const { accounts } = useAccounts();

  // Edit lock
  const { lock, lockedByOther, acquireLock, releaseLock } = useEditLock('quote', isNew ? null : id);

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<QuoteWithDetails | null>(null);
  const [formData, setFormData] = useState<QuoteFormData>({
    account_id: '',
    currency: 'USD',
    tax_enabled: false,
    tax_rate_percent: null,
    storage_months_input: null,
    storage_days_input: null,
    rates_locked: false,
    expiration_date: null,
    quote_discount_type: null,
    quote_discount_value: null,
    notes: null,
    internal_notes: null,
    class_lines: [],
    selected_services: [],
    rate_overrides: [],
  });

  // UI state
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendName, setSendName] = useState('');
  const [sending, setSending] = useState(false);

  // Load existing quote
  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      fetchQuoteDetails(id).then((data) => {
        if (data) {
          setQuote(data);
          setFormData({
            account_id: data.account_id,
            currency: data.currency,
            tax_enabled: data.tax_enabled,
            tax_rate_percent: data.tax_rate_percent,
            storage_months_input: data.storage_months_input,
            storage_days_input: data.storage_days_input,
            rates_locked: data.rates_locked,
            expiration_date: data.expiration_date,
            quote_discount_type: data.quote_discount_type,
            quote_discount_value: data.quote_discount_value,
            notes: data.notes,
            internal_notes: data.internal_notes,
            class_lines: data.class_lines.map((line) => ({
              class_id: line.class_id,
              qty: line.qty,
              line_discount_type: line.line_discount_type,
              line_discount_value: line.line_discount_value,
            })),
            selected_services: data.selected_services.map((ss) => ({
              service_id: ss.service_id,
              is_selected: ss.is_selected,
              hours_input: ss.hours_input,
            })),
            rate_overrides: data.rate_overrides.map((override) => ({
              service_id: override.service_id,
              class_id: override.class_id,
              override_rate_amount: override.override_rate_amount,
              reason: override.reason,
            })),
          });
          // Acquire lock for editing
          if (isQuoteEditable(data.status)) {
            acquireLock();
          }
        }
        setLoading(false);
      });
    }
  }, [id, isNew, fetchQuoteDetails, acquireLock]);

  // Initialize class lines when classes load
  useEffect(() => {
    if (classes.length > 0 && formData.class_lines.length === 0) {
      setFormData((prev) => ({
        ...prev,
        class_lines: classes.map((cls) => ({
          class_id: cls.id,
          qty: 0,
          line_discount_type: null,
          line_discount_value: null,
        })),
      }));
    }
  }, [classes, formData.class_lines.length]);

  // Calculate totals
  const calculation = useMemo(() => {
    if (classes.length === 0 || services.length === 0) return null;

    return calculateQuote({
      classes,
      services,
      rates,
      classLines: formData.class_lines,
      selectedServices: formData.selected_services,
      rateOverrides: formData.rate_overrides,
      storageDaysInput: formData.storage_days_input,
      storageMonthsInput: formData.storage_months_input,
      quoteDiscountType: formData.quote_discount_type,
      quoteDiscountValue: formData.quote_discount_value,
      taxEnabled: formData.tax_enabled,
      taxRatePercent: formData.tax_rate_percent,
    });
  }, [classes, services, rates, formData]);

  // Update class line quantity
  const updateClassQty = useCallback((classId: string, qty: number) => {
    setFormData((prev) => ({
      ...prev,
      class_lines: prev.class_lines.map((line) =>
        line.class_id === classId ? { ...line, qty: Math.max(0, qty) } : line
      ),
    }));
  }, []);

  // Toggle service selection
  const toggleService = useCallback((serviceId: string) => {
    setFormData((prev) => {
      const existing = prev.selected_services.find((ss) => ss.service_id === serviceId);
      if (existing) {
        return {
          ...prev,
          selected_services: prev.selected_services.map((ss) =>
            ss.service_id === serviceId ? { ...ss, is_selected: !ss.is_selected } : ss
          ),
        };
      } else {
        return {
          ...prev,
          selected_services: [
            ...prev.selected_services,
            { service_id: serviceId, is_selected: true, hours_input: null },
          ],
        };
      }
    });
  }, []);

  // Update service hours
  const updateServiceHours = useCallback((serviceId: string, hours: number | null) => {
    setFormData((prev) => ({
      ...prev,
      selected_services: prev.selected_services.map((ss) =>
        ss.service_id === serviceId ? { ...ss, hours_input: hours } : ss
      ),
    }));
  }, []);

  // Save quote
  const handleSave = async () => {
    if (!formData.account_id) {
      toast({
        title: 'Account required',
        description: 'Please select an account for this quote.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const newQuote = await createQuote(formData);
        if (newQuote) {
          navigate(`/quotes/${newQuote.id}`, { replace: true });
        }
      } else if (id) {
        await updateQuote(id, formData);
      }
    } finally {
      setSaving(false);
    }
  };

  // Apply quote discount
  const applyDiscount = () => {
    const value = parseFloat(discountValue);
    if (!isNaN(value)) {
      setFormData((prev) => ({
        ...prev,
        quote_discount_type: discountType,
        quote_discount_value: value,
      }));
    }
    setShowDiscountDialog(false);
  };

  // Export to PDF
  const handleExportPdf = () => {
    if (!quote) return;

    const pdfData = transformQuoteToPdfData({
      ...quote,
      quote_class_lines: quote.class_lines.map((line) => ({
        ...line,
        id: line.class_id,
        quote_id: quote.id,
        class_id: line.class_id,
        quantity: line.qty,
        rate_amount: 0,
        line_total: 0,
        created_at: quote.created_at,
        quote_class: classes.find((c) => c.id === line.class_id),
      })),
      quote_selected_services: quote.selected_services
        .filter((ss) => ss.is_selected)
        .map((ss) => {
          const service = services.find((s) => s.id === ss.service_id);
          const serviceTotal = calculation?.service_totals.find((st) => st.service_id === ss.service_id);
          return {
            id: ss.service_id,
            quote_id: quote.id,
            service_id: ss.service_id,
            is_selected: ss.is_selected,
            hours_input: ss.hours_input,
            computed_billable_qty: serviceTotal?.billable_qty || 1,
            applied_rate_amount: serviceTotal?.rate || 0,
            line_total: serviceTotal?.total || 0,
            created_at: quote.created_at,
            updated_at: quote.updated_at,
            quote_service: service,
          };
        }) as any,
    });

    downloadQuotePdf(pdfData);
    toast({
      title: 'PDF Downloaded',
      description: `Quote ${quote.quote_number} has been downloaded as PDF.`,
    });
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!quote) return;

    const pdfData = transformQuoteToPdfData({
      ...quote,
      quote_class_lines: quote.class_lines.map((line) => ({
        ...line,
        id: line.class_id,
        quote_id: quote.id,
        class_id: line.class_id,
        quantity: line.qty,
        rate_amount: 0,
        line_total: 0,
        created_at: quote.created_at,
        quote_class: classes.find((c) => c.id === line.class_id),
      })),
      quote_selected_services: quote.selected_services
        .filter((ss) => ss.is_selected)
        .map((ss) => {
          const service = services.find((s) => s.id === ss.service_id);
          const serviceTotal = calculation?.service_totals.find((st) => st.service_id === ss.service_id);
          return {
            id: ss.service_id,
            quote_id: quote.id,
            service_id: ss.service_id,
            is_selected: ss.is_selected,
            hours_input: ss.hours_input,
            computed_billable_qty: serviceTotal?.billable_qty || 1,
            applied_rate_amount: serviceTotal?.rate || 0,
            line_total: serviceTotal?.total || 0,
            created_at: quote.created_at,
            updated_at: quote.updated_at,
            quote_service: service,
          };
        }) as any,
    });

    exportQuoteToExcel(pdfData);
    toast({
      title: 'Excel Downloaded',
      description: `Quote ${quote.quote_number} has been downloaded as Excel.`,
    });
  };

  // Send quote via email
  const handleSend = async () => {
    if (!quote || !id || !sendEmail.trim()) return;

    setSending(true);
    try {
      const success = await sendQuote(id, sendEmail.trim(), sendName.trim() || undefined);
      if (success) {
        setShowSendDialog(false);
        setSendEmail('');
        setSendName('');
        // Refresh quote to get updated status
        const updatedQuote = await fetchQuoteDetails(id);
        if (updatedQuote) {
          setQuote(updatedQuote);
        }
      }
    } finally {
      setSending(false);
    }
  };

  // Initialize send dialog with account's billing email
  const openSendDialog = () => {
    if (quote?.account) {
      setSendEmail(quote.account.billing_email || '');
      setSendName('');
    }
    setShowSendDialog(true);
  };

  // Check if editable
  const canEdit = isNew || (quote && isQuoteEditable(quote.status) && !lockedByOther);

  // Loading state
  if (loading || classesLoading || servicesLoading || ratesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <MaterialIcon name="arrow_back" size="md" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew ? 'New Quote' : quote?.quote_number || 'Quote'}
              </h1>
              {quote && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={QUOTE_STATUS_CONFIG[quote.status].variant as any}>
                    {QUOTE_STATUS_CONFIG[quote.status].label}
                  </Badge>
                  {lockedByOther && lock && (
                    <Badge variant="outline" className="text-amber-600">
                      <MaterialIcon name="lock" size="sm" className="mr-1" />
                      Locked by {lock.locked_by_name}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isNew && quote && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <MaterialIcon name="download" size="sm" className="mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPdf}>
                    <MaterialIcon name="description" size="sm" className="mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <MaterialIcon name="table_chart" size="sm" className="mr-2" />
                    Download Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!isNew && quote && quote.status === 'draft' && (
              <Button variant="outline" onClick={openSendDialog}>
                <MaterialIcon name="send" size="sm" className="mr-2" />
                Send Quote
              </Button>
            )}
            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                ) : (
                  <MaterialIcon name="save" size="sm" className="mr-2" />
                )}
                {isNew ? 'Create Quote' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quote Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="business" size="md" />
                  Quote Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account">Account *</Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(v) => setFormData((p) => ({ ...p, account_id: v }))}
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_code} - {account.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration">Expiration Date</Label>
                    <div className="flex items-center gap-2">
                      <MaterialIcon name="calendar_today" size="sm" className="text-muted-foreground shrink-0" />
                      <Input
                        id="expiration"
                        type="date"
                        value={formData.expiration_date || ''}
                        onChange={(e) => setFormData((p) => ({ ...p, expiration_date: e.target.value || null }))}
                        disabled={!canEdit}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="rates-locked"
                      checked={formData.rates_locked}
                      onCheckedChange={(v) => setFormData((p) => ({ ...p, rates_locked: v }))}
                      disabled={!canEdit}
                    />
                    <Label htmlFor="rates-locked" className="flex items-center gap-1">
                      {formData.rates_locked ? <MaterialIcon name="lock" size="sm" /> : <MaterialIcon name="lock_open" size="sm" />}
                      Lock Rates
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Class Quantities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="inventory_2" size="md" />
                  Item Quantities by Class
                </CardTitle>
                <CardDescription>
                  Enter the quantity of items for each size class
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {classes.map((cls) => {
                    const line = formData.class_lines.find((l) => l.class_id === cls.id);
                    const qtyValue = line?.qty;
                    return (
                      <div key={cls.id} className="space-y-1">
                        <Label className="text-xs">{cls.name}</Label>
                        <Input
                          type="number"
                          min="0"
                          value={qtyValue && qtyValue > 0 ? qtyValue : ''}
                          onChange={(e) => updateClassQty(cls.id, parseInt(e.target.value) || 0)}
                          disabled={!canEdit}
                          className="text-center"
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Storage Duration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="schedule" size="md" />
                  Storage Duration
                </CardTitle>
                <CardDescription>
                  Enter storage duration in days and/or months (1 month = 30 days)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Days</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.storage_days_input || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          storage_days_input: e.target.value ? parseInt(e.target.value) : null,
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Months</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.storage_months_input || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          storage_months_input: e.target.value ? parseInt(e.target.value) : null,
                        }))
                      }
                      disabled={!canEdit}
                      placeholder="0"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total: {computeStorageDays(formData.storage_months_input, formData.storage_days_input)} days
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="calculate" size="md" />
                  Services
                </CardTitle>
                <CardDescription>Select the services to include in this quote</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="space-y-2">
                  {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                    <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <span className="font-medium">{category}</span>
                        <Badge variant="secondary" className="ml-2">
                          {categoryServices.filter((s) =>
                            formData.selected_services.some((ss) => ss.service_id === s.id && ss.is_selected)
                          ).length} selected
                        </Badge>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4 space-y-2">
                        {categoryServices.map((service) => {
                          const selected = formData.selected_services.find(
                            (ss) => ss.service_id === service.id
                          );
                          const isSelected = selected?.is_selected ?? false;

                          return (
                            <div
                              key={service.id}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                isSelected ? 'border-primary bg-primary/5' : 'border-border'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleService(service.id)}
                                  disabled={!canEdit}
                                />
                                <div>
                                  <div className="font-medium">{service.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {service.trigger_label} • {service.billing_unit.replace('_', ' ')}
                                  </div>
                                </div>
                              </div>
                              {service.billing_unit === 'per_hour' && isSelected && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Hours:</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={selected?.hours_input || ''}
                                    onChange={(e) =>
                                      updateServiceHours(
                                        service.id,
                                        e.target.value ? parseFloat(e.target.value) : null
                                      )
                                    }
                                    disabled={!canEdit}
                                    className="w-20"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer Notes (visible on quote)</Label>
                  <Textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value || null }))}
                    disabled={!canEdit}
                    placeholder="Notes to display on the quote..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Internal Notes (not visible to customer)</Label>
                  <Textarea
                    value={formData.internal_notes || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, internal_notes: e.target.value || null }))}
                    disabled={!canEdit}
                    placeholder="Internal notes..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Panel */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="attach_money" size="md" />
                  Quote Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {calculation ? (
                  <>
                    {/* Service totals */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Services</div>
                      {calculation.service_totals.map((st) => (
                        <div key={st.service_id} className="flex justify-between text-sm">
                          <span className="truncate pr-2">{st.service_name}</span>
                          <span className="font-mono">{formatCurrency(st.total)}</span>
                        </div>
                      ))}
                      {calculation.service_totals.length === 0 && (
                        <div className="text-sm text-muted-foreground">No services selected</div>
                      )}
                    </div>

                    <Separator />

                    {/* Subtotal */}
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {formatCurrency(calculation.subtotal_before_discounts)}
                      </span>
                    </div>

                    {/* Discount */}
                    {formData.quote_discount_value && formData.quote_discount_value > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>
                          Discount ({formData.quote_discount_type === 'percent'
                            ? `${formData.quote_discount_value}%`
                            : formatCurrency(formData.quote_discount_value)}
                          )
                        </span>
                        <span>-{formatCurrency(calculation.quote_discount_amount)}</span>
                      </div>
                    )}

                    {/* After discount */}
                    {calculation.quote_discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span>After Discount</span>
                        <span className="font-semibold">
                          {formatCurrency(calculation.subtotal_after_discounts)}
                        </span>
                      </div>
                    )}

                    {/* Tax */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="tax-enabled"
                          checked={formData.tax_enabled}
                          onCheckedChange={(v) => setFormData((p) => ({ ...p, tax_enabled: v }))}
                          disabled={!canEdit}
                        />
                        <Label htmlFor="tax-enabled" className="text-sm">Tax</Label>
                        {formData.tax_enabled && (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={formData.tax_rate_percent || ''}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                tax_rate_percent: e.target.value ? parseFloat(e.target.value) : null,
                              }))
                            }
                            disabled={!canEdit}
                            className="w-20 h-8"
                            placeholder="%"
                          />
                        )}
                      </div>
                      {formData.tax_enabled && (
                        <span>{formatCurrency(calculation.tax_amount)}</span>
                      )}
                    </div>

                    <Separator />

                    {/* Grand Total */}
                    <div className="flex justify-between text-lg font-bold">
                      <span>Grand Total</span>
                      <span>{formatCurrency(calculation.grand_total)}</span>
                    </div>

                    {/* Storage days info */}
                    {calculation.storage_days > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        Storage: {calculation.storage_days} days
                      </div>
                    )}

                    {/* Actions */}
                    {canEdit && (
                      <div className="space-y-2 pt-4">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setShowDiscountDialog(true)}
                        >
                          <MaterialIcon name="percent" size="sm" className="mr-2" />
                          Add Discount
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MaterialIcon name="calculate" size="xl" className="mx-auto mb-2 opacity-50" />
                    <p>Configure your quote to see the summary</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rate disclaimer */}
            {!formData.rates_locked && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-4">
                  <div className="flex gap-2 text-amber-800 text-sm">
                    <MaterialIcon name="error" size="sm" className="flex-shrink-0 mt-0.5" />
                    <p>
                      Rates are not locked. Prices shown are valid as of today and are subject to
                      change prior to acceptance.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Discount Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Quote Discount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={discountType} onValueChange={(v: DiscountType) => setDiscountType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                min="0"
                step={discountType === 'percent' ? '1' : '0.01'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? '10' : '50.00'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountDialog(false)}>
              Cancel
            </Button>
            <Button onClick={applyDiscount}>Apply Discount</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Quote Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Send this quote to the customer. They will receive an email with a link to view and accept or decline the quote.
            </p>
            <div className="space-y-2">
              <Label htmlFor="send-email">Recipient Email *</Label>
              <Input
                id="send-email"
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-name">Recipient Name</Label>
              <Input
                id="send-name"
                value={sendName}
                onChange={(e) => setSendName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={!sendEmail.trim() || sending}>
              {sending ? (
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
              ) : (
                <MaterialIcon name="send" size="sm" className="mr-2" />
              )}
              Send Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
