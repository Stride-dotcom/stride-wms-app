import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays } from 'date-fns';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { PushToQuickBooksButton } from '@/components/billing/PushToQuickBooksButton';
import { BillingEventForSync } from '@/hooks/useQuickBooks';

interface BillingEvent {
  id: string;
  tenant_id: string;
  account_id: string | null;
  sidemark_id: string | null;
  class_id: string | null;
  service_id: string | null;
  item_id: string | null;
  task_id: string | null;
  shipment_id: string | null;
  event_type: string;
  charge_type: string;
  description: string | null;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  status: string;
  occurred_at: string;
  created_at: string;
  metadata: Record<string, any>;
  // Rate error tracking
  has_rate_error: boolean;
  rate_error_message: string | null;
  // Joined fields
  account_name?: string;
  sidemark_name?: string;
  class_name?: string;
  service_name?: string;
  item_code?: string;
}

interface Account {
  id: string;
  account_name: string;
  account_code: string;
}

interface Sidemark {
  id: string;
  sidemark_name: string;
}

interface Service {
  id: string;
  code: string;
  name: string;
}

interface ItemClass {
  id: string;
  name: string;
}

interface StoragePreviewItem {
  item_id: string;
  item_code: string;
  description: string;
  account_id: string;
  account_name: string;
  sidemark_id: string | null;
  sidemark_name: string | null;
  class_id: string | null;
  class_name: string | null;
  received_at: string;
  released_at: string | null;
  cubic_feet: number;
  free_days: number;
  billable_days: number;
  daily_rate: number;
  total_amount: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unbilled', label: 'Unbilled' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'void', label: 'Void' },
];

export default function BillingReports() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sidemarks, setSidemarks] = useState<Sidemark[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [classes, setClasses] = useState<ItemClass[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 1)));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedSidemarks, setSelectedSidemarks] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTimeColumns, setShowTimeColumns] = useState(false);

  // Storage calculator
  const [storageDialogOpen, setStorageDialogOpen] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storagePreview, setStoragePreview] = useState<StoragePreviewItem[]>([]);
  const [storageFrom, setStorageFrom] = useState<Date>(startOfMonth(new Date()));
  const [storageTo, setStorageTo] = useState<Date>(endOfMonth(new Date()));
  const [generatingStorage, setGeneratingStorage] = useState(false);

  // Load reference data
  useEffect(() => {
    if (profile?.tenant_id) {
      loadReferenceData();
    }
  }, [profile?.tenant_id]);

  // Load events when filters change
  useEffect(() => {
    if (profile?.tenant_id) {
      loadEvents();
    }
  }, [profile?.tenant_id, dateFrom, dateTo, statusFilter]);

  const loadReferenceData = async () => {
    if (!profile?.tenant_id) return;

    try {
      const [accountsRes, sidemarksRes, servicesRes, classesRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, account_name, account_code')
          .eq('tenant_id', profile.tenant_id)
          .is('deleted_at', null)
          .order('account_name'),
        supabase
          .from('sidemarks')
          .select('id, sidemark_name')
          .eq('tenant_id', profile.tenant_id)
          .is('deleted_at', null)
          .order('sidemark_name'),
        supabase
          .from('billable_services')
          .select('id, code, name')
          .eq('tenant_id', profile.tenant_id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('item_types')
          .select('id, name')
          .eq('tenant_id', profile.tenant_id)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (sidemarksRes.data) setSidemarks(sidemarksRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
      if (classesRes.data) setClasses(classesRes.data);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const loadEvents = async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      let query = supabase
        .from('billing_events')
        .select(`
          *,
          accounts:account_id(account_name),
          sidemarks:sidemark_id(sidemark_name),
          item_types:class_id(name),
          billable_services:service_id(name),
          items:item_id(item_code)
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('occurred_at', format(dateFrom, 'yyyy-MM-dd'))
        .lte('occurred_at', format(dateTo, 'yyyy-MM-dd') + 'T23:59:59')
        .order('occurred_at', { ascending: false })
        .limit(2000);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data with joined fields
      const transformed = (data || []).map((event: any) => ({
        ...event,
        account_name: event.accounts?.account_name || 'Unknown',
        sidemark_name: event.sidemarks?.sidemark_name || null,
        class_name: event.item_types?.name || null,
        service_name: event.billable_services?.name || event.charge_type,
        item_code: event.items?.item_code || null,
      }));

      setEvents(transformed);
    } catch (error) {
      console.error('Error loading billing events:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load billing events',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Account filter
      if (selectedAccounts.length > 0 && event.account_id && !selectedAccounts.includes(event.account_id)) {
        return false;
      }
      // Sidemark filter
      if (selectedSidemarks.length > 0 && event.sidemark_id && !selectedSidemarks.includes(event.sidemark_id)) {
        return false;
      }
      // Service filter
      if (selectedServices.length > 0 && event.service_id && !selectedServices.includes(event.service_id)) {
        return false;
      }
      // Class filter
      if (selectedClasses.length > 0 && event.class_id && !selectedClasses.includes(event.class_id)) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          event.description?.toLowerCase().includes(query) ||
          event.item_code?.toLowerCase().includes(query) ||
          event.account_name?.toLowerCase().includes(query) ||
          event.charge_type?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [events, selectedAccounts, selectedSidemarks, selectedServices, selectedClasses, searchQuery]);

  // Totals
  const totals = useMemo(() => {
    const unbilled = filteredEvents.filter((e) => e.status === 'unbilled').reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const invoiced = filteredEvents.filter((e) => e.status === 'invoiced').reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const voided = filteredEvents.filter((e) => e.status === 'void').reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const rateErrors = filteredEvents.filter((e) => e.has_rate_error).length;
    return { unbilled, invoiced, voided, total: unbilled + invoiced, rateErrors };
  }, [filteredEvents]);

  // Transform unbilled events for QuickBooks sync
  const unbilledEventsForSync: BillingEventForSync[] = useMemo(() => {
    return filteredEvents
      .filter((e) => e.status === 'unbilled' && e.account_id)
      .map((e) => ({
        id: e.id,
        account_id: e.account_id!,
        event_type: e.event_type,
        charge_type: e.charge_type,
        description: e.description || `${e.charge_type} charge`,
        quantity: e.quantity,
        unit_rate: e.unit_rate,
        total_amount: e.total_amount,
        occurred_at: e.occurred_at,
        item_id: e.item_id || undefined,
        item_code: e.item_code || undefined,
      }));
  }, [filteredEvents]);

  // Export to Excel
  const handleExport = useCallback(() => {
    if (filteredEvents.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No data',
        description: 'No events to export',
      });
      return;
    }

    if (filteredEvents.length > 10000) {
      toast({
        variant: 'destructive',
        title: 'Too many rows',
        description: 'Please narrow your filters to export fewer than 10,000 rows',
      });
      return;
    }

    const exportData = filteredEvents.map((event) => ({
      'Date': format(new Date(event.occurred_at), 'yyyy-MM-dd'),
      'Account': event.account_name || '',
      'Sidemark': event.sidemark_name || '',
      'Item Code': event.item_code || '',
      'Service': event.service_name || event.charge_type,
      'Class': event.class_name || '',
      'Description': event.description || '',
      'Qty': event.quantity || 1,
      'Unit Rate': event.unit_rate || 0,
      'Amount': event.total_amount || 0,
      'Status': event.status,
      'Event Type': event.event_type,
      'Rate Error': event.has_rate_error ? 'Yes' : '',
      'Error Message': event.rate_error_message || '',
      ...(showTimeColumns ? {
        'Time (min)': event.metadata?.time_minutes || '',
        'Pull/Prep (min)': event.metadata?.pull_prep_minutes || '',
      } : {}),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Billing Events');
    
    const fileName = `billing-events-${format(dateFrom, 'yyyyMMdd')}-${format(dateTo, 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: 'Export complete',
      description: `Exported ${filteredEvents.length} rows to ${fileName}`,
    });
  }, [filteredEvents, dateFrom, dateTo, showTimeColumns, toast]);

  // Navigate to entity
  const handleRowClick = (event: BillingEvent) => {
    if (event.task_id) {
      navigate(`/tasks?id=${event.task_id}`);
    } else if (event.shipment_id) {
      navigate(`/shipments/${event.shipment_id}`);
    } else if (event.item_id) {
      navigate(`/inventory/${event.item_id}`);
    }
  };

  // Storage calculator
  const calculateStorage = async () => {
    if (!profile?.tenant_id) return;

    setStorageLoading(true);
    try {
      // Get items that were in storage during the period
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id,
          item_code,
          description,
          account_id,
          sidemark_id,
          item_type_id,
          received_at,
          released_at,
          length,
          width,
          height,
          accounts:account_id(account_name, free_storage_days),
          sidemarks:sidemark_id(sidemark_name),
          item_types:item_type_id(name)
        `)
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .not('received_at', 'is', null)
        .or(`released_at.is.null,released_at.gte.${format(storageFrom, 'yyyy-MM-dd')}`);

      if (error) throw error;

      // Get storage daily rate from services
      const { data: storageService } = await supabase
        .from('billable_services')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('code', 'STORAGE')
        .single();

      // Get default rate (simplified - would need rate card lookup in production)
      let dailyRate = 0.05; // Default fallback

      // Calculate for each item
      const preview: StoragePreviewItem[] = (items || [])
        .filter((item: any) => {
          const receivedAt = new Date(item.received_at);
          const releasedAt = item.released_at ? new Date(item.released_at) : null;
          // Item must have been in storage during the period
          return receivedAt <= storageTo && (!releasedAt || releasedAt >= storageFrom);
        })
        .map((item: any) => {
          const receivedAt = new Date(item.received_at);
          const releasedAt = item.released_at ? new Date(item.released_at) : null;
          
          // Calculate cubic feet
          const l = item.length || 0;
          const w = item.width || 0;
          const h = item.height || 0;
          const cubicFeet = (l * w * h) / 1728; // Convert cubic inches to cubic feet

          // Get free days from account or default
          const freeDays = item.accounts?.free_storage_days || 0;
          
          // Calculate billable period
          const billStart = new Date(Math.max(storageFrom.getTime(), receivedAt.getTime()));
          const billEnd = releasedAt 
            ? new Date(Math.min(storageTo.getTime(), releasedAt.getTime()))
            : storageTo;
          
          // Subtract free days from start
          const freeEndDate = new Date(receivedAt);
          freeEndDate.setDate(freeEndDate.getDate() + freeDays);
          
          const actualBillStart = new Date(Math.max(billStart.getTime(), freeEndDate.getTime()));
          const billableDays = Math.max(0, differenceInDays(billEnd, actualBillStart) + 1);
          
          const totalAmount = billableDays * dailyRate * Math.max(1, cubicFeet);

          return {
            item_id: item.id,
            item_code: item.item_code,
            description: item.description || '',
            account_id: item.account_id,
            account_name: item.accounts?.account_name || 'Unknown',
            sidemark_id: item.sidemark_id,
            sidemark_name: item.sidemarks?.sidemark_name || null,
            class_id: item.item_type_id,
            class_name: item.item_types?.name || null,
            received_at: item.received_at,
            released_at: item.released_at,
            cubic_feet: cubicFeet,
            free_days: freeDays,
            billable_days: billableDays,
            daily_rate: dailyRate,
            total_amount: totalAmount,
          };
        })
        .filter((item: StoragePreviewItem) => item.billable_days > 0);

      setStoragePreview(preview);
    } catch (error) {
      console.error('Error calculating storage:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to calculate storage charges',
      });
    } finally {
      setStorageLoading(false);
    }
  };

  const generateStorageEvents = async () => {
    if (!profile?.tenant_id || storagePreview.length === 0) return;

    setGeneratingStorage(true);
    try {
      // Get storage service ID
      const { data: storageService } = await supabase
        .from('billable_services')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('code', 'STORAGE')
        .single();

      const eventsToInsert = storagePreview.map((item) => ({
        tenant_id: profile.tenant_id,
        account_id: item.account_id,
        sidemark_id: item.sidemark_id,
        class_id: item.class_id,
        service_id: storageService?.id || null,
        item_id: item.item_id,
        event_type: 'storage',
        charge_type: 'storage',
        description: `Storage: ${item.item_code} (${item.billable_days} days)`,
        quantity: item.billable_days,
        unit_rate: item.daily_rate * Math.max(1, item.cubic_feet),
        total_amount: item.total_amount,
        status: 'unbilled',
        occurred_at: format(storageTo, 'yyyy-MM-dd'),
        metadata: {
          date_from: format(storageFrom, 'yyyy-MM-dd'),
          date_to: format(storageTo, 'yyyy-MM-dd'),
          billable_days: item.billable_days,
          cubic_feet: item.cubic_feet,
          daily_rate: item.daily_rate,
        },
        created_by: profile.id,
      }));

      const { error } = await supabase
        .from('billing_events')
        .insert(eventsToInsert);

      if (error) throw error;

      toast({
        title: 'Storage events created',
        description: `Created ${eventsToInsert.length} storage billing events`,
      });

      setStorageDialogOpen(false);
      setStoragePreview([]);
      loadEvents();
    } catch (error) {
      console.error('Error generating storage events:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate storage events',
      });
    } finally {
      setGeneratingStorage(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unbilled':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Unbilled</Badge>;
      case 'invoiced':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Invoiced</Badge>;
      case 'void':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Void</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          primaryText="Billing"
          accentText="Reports"
          description="View and export billing events across all accounts"
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unbilled</CardDescription>
              <CardTitle className="text-2xl text-yellow-500">{formatCurrency(totals.unbilled)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Invoiced</CardDescription>
              <CardTitle className="text-2xl text-green-500">{formatCurrency(totals.invoiced)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Void</CardDescription>
              <CardTitle className="text-2xl text-red-500">{formatCurrency(totals.voided)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total (excl. void)</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(totals.total)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={totals.rateErrors > 0 ? "border-amber-500/50 bg-amber-500/5" : ""}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                {totals.rateErrors > 0 && <MaterialIcon name="warning" className="h-3 w-3 text-amber-500" />}
                Rate Errors
              </CardDescription>
              <CardTitle className={cn("text-2xl", totals.rateErrors > 0 ? "text-amber-500" : "text-muted-foreground")}>
                {totals.rateErrors}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="filter_list" size="md" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {/* Date From */}
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                      {format(dateFrom, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                      {format(dateTo, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account */}
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={selectedAccounts[0] || 'all'}
                  onValueChange={(v) => setSelectedAccounts(v === 'all' ? [] : [v])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service */}
              <div className="space-y-2">
                <Label>Service</Label>
                <Select
                  value={selectedServices[0] || 'all'}
                  onValueChange={(v) => setSelectedServices(v === 'all' ? [] : [v])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Services" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {services.map((svc) => (
                      <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" onClick={loadEvents} disabled={loading}>
                <MaterialIcon name={loading ? "progress_activity" : "refresh"} size="sm" className={cn("mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => setStorageDialogOpen(true)}>
                <MaterialIcon name="calculate" size="sm" className="mr-2" />
                Storage Calculator
              </Button>
              <Button onClick={handleExport} disabled={filteredEvents.length === 0}>
                <MaterialIcon name="download" size="sm" className="mr-2" />
                Export Excel
              </Button>
              <PushToQuickBooksButton
                billingEvents={unbilledEventsForSync}
                periodStart={format(dateFrom, 'yyyy-MM-dd')}
                periodEnd={format(dateTo, 'yyyy-MM-dd')}
                disabled={unbilledEventsForSync.length === 0}
                onSyncComplete={() => loadEvents()}
              />
              <div className="flex items-center gap-2 ml-auto">
                <Checkbox
                  id="showTime"
                  checked={showTimeColumns}
                  onCheckedChange={(checked) => setShowTimeColumns(checked === true)}
                />
                <Label htmlFor="showTime" className="text-sm">Show time columns</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MaterialIcon name="table_chart" size="md" />
              Billing Events
              <Badge variant="secondary" className="ml-2">{filteredEvents.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No billing events found for the selected filters
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Sidemark</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      {showTimeColumns && (
                        <>
                          <TableHead className="text-right">Time</TableHead>
                          <TableHead className="text-right">Prep</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(event)}
                      >
                        <TableCell>{format(new Date(event.occurred_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{event.account_name}</TableCell>
                        <TableCell className="text-muted-foreground">{event.sidemark_name || '-'}</TableCell>
                        <TableCell>
                          {event.item_code ? (
                            <span className="font-mono text-sm">{event.item_code}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{event.service_name}</TableCell>
                        <TableCell className="text-muted-foreground">{event.class_name || '-'}</TableCell>
                        <TableCell className="text-right">{event.quantity || 1}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {event.has_rate_error && (
                              <span title={event.rate_error_message || 'Rate error'}>
                                <MaterialIcon name="warning" size="sm" className="text-amber-500" />
                              </span>
                            )}
                            {formatCurrency(event.unit_rate || 0)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex items-center justify-end gap-1">
                            {event.has_rate_error && (
                              <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/10">
                                Est.
                              </Badge>
                            )}
                            {formatCurrency(event.total_amount || 0)}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(event.status)}</TableCell>
                        {showTimeColumns && (
                          <>
                            <TableCell className="text-right text-muted-foreground">
                              {event.metadata?.time_minutes || '-'}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {event.metadata?.pull_prep_minutes || '-'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Storage Calculator Dialog */}
      <Dialog open={storageDialogOpen} onOpenChange={setStorageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MaterialIcon name="calculate" size="md" />
              Storage Charge Calculator
            </DialogTitle>
            <DialogDescription>
              Calculate storage charges for items in the selected date range
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 py-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-start">
                    <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                    {format(storageFrom, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={storageFrom} onSelect={(d) => d && setStorageFrom(d)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-start">
                    <MaterialIcon name="calendar_today" size="sm" className="mr-2" />
                    {format(storageTo, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={storageTo} onSelect={(d) => d && setStorageTo(d)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-end">
              <Button onClick={calculateStorage} disabled={storageLoading}>
                {storageLoading ? <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" /> : <MaterialIcon name="calculate" size="sm" className="mr-2" />}
                Calculate
              </Button>
            </div>
          </div>

          {storagePreview.length > 0 && (
            <>
              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Cu.Ft.</TableHead>
                      <TableHead className="text-right">Free Days</TableHead>
                      <TableHead className="text-right">Bill Days</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {storagePreview.map((item) => (
                      <TableRow key={item.item_id}>
                        <TableCell className="font-mono text-sm">{item.item_code}</TableCell>
                        <TableCell>{item.account_name}</TableCell>
                        <TableCell>{item.class_name || '-'}</TableCell>
                        <TableCell className="text-right">{item.cubic_feet.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.free_days}</TableCell>
                        <TableCell className="text-right">{item.billable_days}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {storagePreview.length} items • Total: {formatCurrency(storagePreview.reduce((sum, i) => sum + i.total_amount, 0))}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setStorageDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={generateStorageEvents}
              disabled={storagePreview.length === 0 || generatingStorage}
            >
              {generatingStorage ? <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" /> : <MaterialIcon name="attach_money" size="sm" className="mr-2" />}
              Generate Storage Events
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
