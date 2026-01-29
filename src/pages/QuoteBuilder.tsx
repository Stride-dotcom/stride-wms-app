import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  ClassServiceSelection,
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

// Service codes for main row columns
const MAIN_ROW_SERVICES = ['RCVG', 'INSP', '15MA']; // Receiving, Inspection, Assembly 1hr
const MAIN_ROW_SERVICE_LABELS: Record<string, string> = {
  'RCVG': 'Receiving',
  'INSP': 'Inspection',
  '15MA': 'Assembly 1hr',
};

// Service codes for expanded section
const EXPANDED_SERVICES = [
  'Minor_Touch_Up',
  'Disposal',
  'Pull_Prep',
  'STRG_ST',
  'STRG',
  'Will_Call',
  'Sit_Test',
  'Returns',
];
const EXPANDED_SERVICE_LABELS: Record<string, string> = {
  'Minor_Touch_Up': 'Minor Touch Up',
  'Disposal': 'Disposal',
  'Pull_Prep': 'Pull Prep',
  'STRG_ST': 'Short Term Storage',
  'STRG': 'Day Storage',
  'Will_Call': 'Will Call',
  'Sit_Test': 'Sit Test',
  'Returns': 'Returns Processing',
};

export default function QuoteBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  // Data hooks
  const { fetchQuoteDetails, createQuote, updateQuote, sendQuote } = useQuotes();
  const { classes, loading: classesLoading } = useQuoteClasses();
  const { services, classBasedServices, nonClassBasedServices, loading: servicesLoading } = useQuoteServices();
  const { rates, loading: ratesLoading } = useQuoteServiceRates();
  const { accounts } = useAccounts();

  // Edit lock
  const { lock, lockedByOther, acquireLock } = useEditLock('quote', isNew ? null : id);

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
    class_service_selections: [],
    selected_services: [],
    rate_overrides: [],
  });

  // UI state
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendName, setSendName] = useState('');
  const [sending, setSending] = useState(false);

  // Find services by code
  const getServiceByCode = useCallback((code: string) => {
    return services.find(s => s.service_code?.toLowerCase() === code.toLowerCase());
  }, [services]);

  // Get services for main row and expanded section
  const mainRowServiceList = useMemo(() => {
    return MAIN_ROW_SERVICES.map(code => ({
      code,
      label: MAIN_ROW_SERVICE_LABELS[code] || code,
      service: getServiceByCode(code),
    })).filter(item => item.service);
  }, [getServiceByCode]);

  const expandedServiceList = useMemo(() => {
    return EXPANDED_SERVICES.map(code => ({
      code,
      label: EXPANDED_SERVICE_LABELS[code] || code,
      service: getServiceByCode(code),
    })).filter(item => item.service);
  }, [getServiceByCode]);

  // Get remaining services (not in main row or expanded)
  const remainingServices = useMemo(() => {
    const usedCodes = new Set([...MAIN_ROW_SERVICES, ...EXPANDED_SERVICES].map(c => c.toLowerCase()));
    return nonClassBasedServices.filter(s => !usedCodes.has(s.service_code?.toLowerCase() || ''));
  }, [nonClassBasedServices]);

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
            class_service_selections: [],
            selected_services: data.selected_services.map((ss) => ({
              service_id: ss.service_id,
              is_selected: ss.is_selected,
              hours_input: ss.hours_input,
              qty_input: null,
            })),
            rate_overrides: data.rate_overrides.map((override) => ({
              service_id: override.service_id,
              class_id: override.class_id,
              override_rate_amount: override.override_rate_amount,
              reason: override.reason,
            })),
          });
          if (isQuoteEditable(data.status)) {
            acquireLock();
          }
        }
        setLoading(false);
      });
    }
  }, [id, isNew, fetchQuoteDetails, acquireLock]);

  // Sync class lines with available classes from price list
  // This ensures new classes added to the price list automatically appear in quotes
  useEffect(() => {
    if (classes.length === 0) return;

    setFormData((prev) => {
      const existingClassIds = new Set(prev.class_lines.map(l => l.class_id));
      const availableClassIds = new Set(classes.map(c => c.id));

      // Check if we need to add new classes or remove old ones
      const needsNewClasses = classes.some(cls => !existingClassIds.has(cls.id));
      const hasRemovedClasses = prev.class_lines.some(l => !availableClassIds.has(l.class_id));

      if (!needsNewClasses && !hasRemovedClasses && prev.class_lines.length > 0) {
        return prev; // No changes needed
      }

      // Build new class_lines array, preserving existing values
      const newClassLines = classes.map((cls) => {
        const existing = prev.class_lines.find(l => l.class_id === cls.id);
        if (existing) {
          return existing; // Preserve existing values
        }
        // New class - create with default values
        return {
          class_id: cls.id,
          qty: 0,
          line_discount_type: null,
          line_discount_value: null,
        };
      });

      return {
        ...prev,
        class_lines: newClassLines,
      };
    });
  }, [classes]);

  // Calculate totals
  const calculation = useMemo(() => {
    if (classes.length === 0 || services.length === 0) return null;

    return calculateQuote({
      classes,
      services,
      rates,
      classLines: formData.class_lines,
      selectedServices: formData.selected_services,
      classServiceSelections: formData.class_service_selections,
      rateOverrides: formData.rate_overrides,
      storageDaysInput: formData.storage_days_input,
      storageMonthsInput: formData.storage_months_input,
      quoteDiscountType: formData.quote_discount_type,
      quoteDiscountValue: formData.quote_discount_value,
      taxEnabled: formData.tax_enabled,
      taxRatePercent: formData.tax_rate_percent,
    });
  }, [classes, services, rates, formData]);

  // Toggle class row expansion
  const toggleClassExpanded = useCallback((classId: string) => {
    setExpandedClasses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(classId)) {
        newSet.delete(classId);
      } else {
        newSet.add(classId);
      }
      return newSet;
    });
  }, []);

  // Update class line quantity
  const updateClassQty = useCallback((classId: string, qty: number) => {
    setFormData((prev) => ({
      ...prev,
      class_lines: prev.class_lines.map((line) =>
        line.class_id === classId ? { ...line, qty: Math.max(0, qty) } : line
      ),
    }));
  }, []);

  // Get class service selection
  const getClassServiceSelection = useCallback((classId: string, serviceId: string): ClassServiceSelection | undefined => {
    return formData.class_service_selections.find(
      (css) => css.class_id === classId && css.service_id === serviceId
    );
  }, [formData.class_service_selections]);

  // Get or create class service qty (returns current qty or null if not set)
  const getClassServiceQty = useCallback((classId: string, serviceId: string): number | null => {
    const selection = getClassServiceSelection(classId, serviceId);
    return selection?.qty_override ?? null;
  }, [getClassServiceSelection]);

  // Update class service qty (creates selection if needed)
  const updateClassServiceQty = useCallback((classId: string, serviceId: string, qty: number | null) => {
    setFormData((prev) => {
      const existing = prev.class_service_selections.find(
        (css) => css.class_id === classId && css.service_id === serviceId
      );
      if (existing) {
        return {
          ...prev,
          class_service_selections: prev.class_service_selections.map((css) =>
            css.class_id === classId && css.service_id === serviceId
              ? { ...css, qty_override: qty, is_selected: qty !== null && qty > 0 }
              : css
          ),
        };
      } else if (qty !== null && qty > 0) {
        return {
          ...prev,
          class_service_selections: [
            ...prev.class_service_selections,
            { class_id: classId, service_id: serviceId, is_selected: true, qty_override: qty },
          ],
        };
      }
      return prev;
    });
  }, []);

  // Toggle checkbox and set qty to class qty or 0
  const toggleClassServiceCheckbox = useCallback((classId: string, serviceId: string, classQty: number) => {
    setFormData((prev) => {
      const existing = prev.class_service_selections.find(
        (css) => css.class_id === classId && css.service_id === serviceId
      );
      if (existing) {
        const newSelected = !existing.is_selected;
        return {
          ...prev,
          class_service_selections: prev.class_service_selections.map((css) =>
            css.class_id === classId && css.service_id === serviceId
              ? { ...css, is_selected: newSelected, qty_override: newSelected ? classQty : null }
              : css
          ),
        };
      } else {
        return {
          ...prev,
          class_service_selections: [
            ...prev.class_service_selections,
            { class_id: classId, service_id: serviceId, is_selected: true, qty_override: classQty },
          ],
        };
      }
    });
  }, []);

  // Toggle non-class based service selection
  const toggleNonClassService = useCallback((serviceId: string) => {
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
            { service_id: serviceId, is_selected: true, hours_input: null, qty_input: 1 },
          ],
        };
      }
    });
  }, []);

  // Update non-class service hours/qty
  const updateNonClassServiceInput = useCallback((serviceId: string, field: 'hours_input' | 'qty_input', value: number | null) => {
    setFormData((prev) => ({
      ...prev,
      selected_services: prev.selected_services.map((ss) =>
        ss.service_id === serviceId ? { ...ss, [field]: value } : ss
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
        const updatedQuote = await fetchQuoteDetails(id);
        if (updatedQuote) {
          setQuote(updatedQuote);
        }
      }
    } finally {
      setSending(false);
    }
  };

  // Initialize send dialog
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

  // Render service input cell (checkbox + qty input)
  const renderServiceCell = (classId: string, serviceId: string | undefined, classQty: number) => {
    if (!serviceId) return <td className="px-2 py-2 text-center text-muted-foreground">-</td>;

    const selection = getClassServiceSelection(classId, serviceId);
    const isSelected = selection?.is_selected || false;
    const qty = selection?.qty_override;

    return (
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleClassServiceCheckbox(classId, serviceId, classQty)}
            disabled={!canEdit}
            className="mr-1"
          />
          <Input
            type="number"
            min="0"
            step="0.1"
            value={qty ?? ''}
            onChange={(e) => updateClassServiceQty(classId, serviceId, e.target.value ? parseFloat(e.target.value) : null)}
            disabled={!canEdit}
            className="w-14 h-7 text-center text-sm"
            placeholder="0"
          />
        </div>
      </td>
    );
  };

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

            {/* Class-Based Services Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="inventory_2" size="md" />
                  Items & Services by Class
                </CardTitle>
                <CardDescription>
                  Enter quantities per class. Check services and adjust quantities as needed. Expand rows for additional services.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-8 px-2 py-2"></th>
                      <th className="px-2 py-2 text-left font-medium">Class</th>
                      <th className="px-2 py-2 text-center font-medium w-20">Qty</th>
                      {mainRowServiceList.map(({ code, label }) => (
                        <th key={code} className="px-2 py-2 text-center font-medium min-w-[100px]">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((cls) => {
                      const line = formData.class_lines.find((l) => l.class_id === cls.id);
                      const classQty = line?.qty || 0;
                      const isExpanded = expandedClasses.has(cls.id);

                      return (
                        <Collapsible key={cls.id} open={isExpanded} onOpenChange={() => toggleClassExpanded(cls.id)} asChild>
                          <>
                            <tr className={`border-b ${classQty > 0 ? 'bg-primary/5' : ''}`}>
                              <td className="px-2 py-2">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MaterialIcon
                                      name={isExpanded ? 'expand_less' : 'expand_more'}
                                      size="sm"
                                    />
                                  </Button>
                                </CollapsibleTrigger>
                              </td>
                              <td className="px-2 py-2 font-medium">{cls.name}</td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  value={classQty > 0 ? classQty : ''}
                                  onChange={(e) => updateClassQty(cls.id, parseInt(e.target.value) || 0)}
                                  disabled={!canEdit}
                                  className="w-16 h-7 text-center text-sm"
                                  placeholder="0"
                                />
                              </td>
                              {mainRowServiceList.map(({ service }) =>
                                renderServiceCell(cls.id, service?.id, classQty)
                              )}
                            </tr>
                            <CollapsibleContent asChild>
                              <tr>
                                <td colSpan={3 + mainRowServiceList.length} className="bg-muted/30 p-0">
                                  <div className="p-3">
                                    <div className="text-xs font-medium text-muted-foreground mb-2">
                                      Additional Services for {cls.name}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {expandedServiceList.map(({ code, label, service }) => {
                                        if (!service) return null;
                                        const selection = getClassServiceSelection(cls.id, service.id);
                                        const isSelected = selection?.is_selected || false;
                                        const qty = selection?.qty_override;

                                        return (
                                          <div
                                            key={code}
                                            className={`flex items-center gap-2 p-2 rounded border ${
                                              isSelected ? 'border-primary bg-primary/5' : 'border-border'
                                            }`}
                                          >
                                            <Checkbox
                                              checked={isSelected}
                                              onCheckedChange={() => toggleClassServiceCheckbox(cls.id, service.id, classQty)}
                                              disabled={!canEdit}
                                            />
                                            <span className="text-xs flex-1 truncate">{label}</span>
                                            <Input
                                              type="number"
                                              min="0"
                                              step="0.1"
                                              value={qty ?? ''}
                                              onChange={(e) => updateClassServiceQty(cls.id, service.id, e.target.value ? parseFloat(e.target.value) : null)}
                                              disabled={!canEdit}
                                              className="w-12 h-6 text-center text-xs"
                                              placeholder="0"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Additional/Remaining Services */}
            {remainingServices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MaterialIcon name="handyman" size="md" />
                    Other Services
                  </CardTitle>
                  <CardDescription>
                    Additional flat-rate services
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {remainingServices.map((service) => {
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
                              onCheckedChange={() => toggleNonClassService(service.id)}
                              disabled={!canEdit}
                            />
                            <div>
                              <div className="font-medium">{service.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {service.category} - {service.billing_unit.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-4">
                              {service.billing_unit === 'per_hour' && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Hours:</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={selected?.hours_input || ''}
                                    onChange={(e) =>
                                      updateNonClassServiceInput(
                                        service.id,
                                        'hours_input',
                                        e.target.value ? parseFloat(e.target.value) : null
                                      )
                                    }
                                    disabled={!canEdit}
                                    className="w-20 h-8"
                                  />
                                </div>
                              )}
                              {service.billing_unit === 'per_piece' && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Qty:</Label>
                                  <Input
                                    type="number"
                                    min="0.1"
                                    step="0.1"
                                    value={selected?.qty_input || 1}
                                    onChange={(e) =>
                                      updateNonClassServiceInput(
                                        service.id,
                                        'qty_input',
                                        e.target.value ? parseFloat(e.target.value) : 1
                                      )
                                    }
                                    disabled={!canEdit}
                                    className="w-20 h-8"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Storage Duration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="schedule" size="md" />
                  Storage Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
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
                  <div className="flex-1 space-y-2">
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
                  <div className="flex-1 pt-6">
                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded text-center">
                      Total: <span className="font-semibold">{computeStorageDays(formData.storage_months_input, formData.storage_days_input)}</span> days
                    </div>
                  </div>
                </div>
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

                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold">
                        {formatCurrency(calculation.subtotal_before_discounts)}
                      </span>
                    </div>

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

                    {calculation.quote_discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span>After Discount</span>
                        <span className="font-semibold">
                          {formatCurrency(calculation.subtotal_after_discounts)}
                        </span>
                      </div>
                    )}

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

                    <div className="flex justify-between text-lg font-bold">
                      <span>Grand Total</span>
                      <span>{formatCurrency(calculation.grand_total)}</span>
                    </div>

                    {calculation.storage_days > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        Storage: {calculation.storage_days} days
                      </div>
                    )}

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

            {!formData.rates_locked && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="pt-4">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-200 text-sm">
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
