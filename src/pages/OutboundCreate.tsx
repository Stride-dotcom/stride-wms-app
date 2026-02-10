import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useOutboundTypes, useOutboundShipments, useAccountItems } from '@/hooks/useOutbound';
import { useSidemarks } from '@/hooks/useSidemarks';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect, SelectOption } from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpButton } from '@/components/prompts';

// ============================================
// TYPES
// ============================================

interface Account {
  id: string;
  account_name: string;
  account_code: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface FormErrors {
  account?: string;
  warehouse?: string;
  outbound_type?: string;
  items?: string;
}

// ============================================
// COMPONENT
// ============================================

export default function OutboundCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Get pre-selected items from navigation state (from Inventory or Item Details)
  const preSelectedItemIds = (location.state as any)?.itemIds || [];
  const preSelectedAccountId = (location.state as any)?.accountId || '';

  // Hooks
  const { outboundTypes, loading: typesLoading } = useOutboundTypes();
  const { createOutbound } = useOutboundShipments();

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  // Shipment fields
  const [accountId, setAccountId] = useState<string>(preSelectedAccountId);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [outboundTypeId, setOutboundTypeId] = useState<string>('');
  const [sidemarkId, setSidemarkId] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Item selection
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set(preSelectedItemIds));
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch account items
  const { items: accountItems, loading: itemsLoading } = useAccountItems(accountId || undefined);

  // Fetch sidemarks filtered by account
  const { sidemarks, loading: sidemarksLoading } = useSidemarks(accountId || undefined);

  // ------------------------------------------
  // Fetch reference data
  // ------------------------------------------
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch accounts
        const accountsRes = await (supabase.from('accounts') as any)
          .select('id, account_name, account_code')
          .eq('tenant_id', profile.tenant_id)
          .is('deleted_at', null)
          .order('account_name');

        // Fetch warehouses
        const warehousesRes = await (supabase.from('warehouses') as any)
          .select('id, name')
          .eq('tenant_id', profile.tenant_id)
          .is('deleted_at', null)
          .order('name');

        if (accountsRes.error) {
          console.error('[OutboundCreate] accounts fetch:', accountsRes.error);
        }
        if (warehousesRes.error) {
          console.error('[OutboundCreate] warehouses fetch:', warehousesRes.error);
        }

        setAccounts(accountsRes.data || []);
        setWarehouses(warehousesRes.data || []);

        // Set default warehouse if only one exists
        if (warehousesRes.data?.length === 1) {
          setWarehouseId(warehousesRes.data[0].id);
        }

        // Set default outbound type (Will Call)
        // This will be set after outbound types load
      } catch (err) {
        console.error('[OutboundCreate] fetchData exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.tenant_id]);

  // Set default outbound type when types load
  useEffect(() => {
    if (outboundTypes.length > 0 && !outboundTypeId) {
      const willCall = outboundTypes.find(t => t.name === 'Will Call');
      setOutboundTypeId(willCall?.id || outboundTypes[0].id);
    }
  }, [outboundTypes, outboundTypeId]);

  // Convert to SelectOption arrays
  const accountOptions: SelectOption[] = useMemo(
    () => accounts.map(a => ({
      value: a.id,
      label: a.account_name,
      subtitle: a.account_code || undefined,
    })),
    [accounts]
  );

  const warehouseOptions: SelectOption[] = useMemo(
    () => warehouses.map(w => ({ value: w.id, label: w.name })),
    [warehouses]
  );

  const outboundTypeOptions: SelectOption[] = useMemo(
    () => outboundTypes.map(t => ({ value: t.id, label: t.name })),
    [outboundTypes]
  );

  const sidemarkOptions: SelectOption[] = useMemo(
    () => sidemarks.map(s => ({
      value: s.id,
      label: s.sidemark_name,
      subtitle: s.sidemark_code || undefined,
    })),
    [sidemarks]
  );

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return accountItems;
    const query = searchQuery.toLowerCase();
    return accountItems.filter(item =>
      item.item_code?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [accountItems, searchQuery]);

  // ------------------------------------------
  // Item selection handlers
  // ------------------------------------------
  const toggleItemSelection = (itemId: string) => {
    const newSet = new Set(selectedItemIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItemIds(newSet);
    if (errors.items) {
      setErrors({ ...errors, items: undefined });
    }
  };

  const selectAllItems = () => {
    const allIds = new Set(filteredItems.map(item => item.id));
    setSelectedItemIds(allIds);
    if (errors.items) {
      setErrors({ ...errors, items: undefined });
    }
  };

  const deselectAllItems = () => {
    setSelectedItemIds(new Set());
  };

  // ------------------------------------------
  // Validation
  // ------------------------------------------
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!accountId) {
      newErrors.account = 'Please select an account';
    }
    if (!warehouseId) {
      newErrors.warehouse = 'Please select a warehouse';
    }
    if (!outboundTypeId) {
      newErrors.outbound_type = 'Please select an outbound type';
    }
    if (selectedItemIds.size === 0) {
      newErrors.items = 'Please select at least one item';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ------------------------------------------
  // Submit handler
  // ------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.tenant_id || !profile?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Not authenticated' });
      return;
    }

    if (!validate()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fix the errors below' });
      return;
    }

    setSaving(true);

    try {
      const shipment = await createOutbound({
        account_id: accountId,
        warehouse_id: warehouseId,
        outbound_type_id: outboundTypeId,
        sidemark_id: sidemarkId || undefined,
        notes: notes || undefined,
        expected_date: expectedDate || undefined,
        item_ids: Array.from(selectedItemIds),
      });

      if (shipment) {
        navigate(`/shipments/${shipment.id}`);
      }
    } catch (err: any) {
      console.error('[OutboundCreate] submit error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to create outbound shipment',
      });
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------
  // Loading state
  // ------------------------------------------
  if (loading || typesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto max-w-4xl px-4 pb-safe">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pt-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <MaterialIcon name="arrow_back" size="md" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Create Outbound Shipment</h1>
            <p className="text-sm text-muted-foreground">Select items to ship out</p>
          </div>
          <HelpButton workflow="outbound" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shipment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Account */}
              <div className="space-y-1.5">
                <Label>
                  Account <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  options={accountOptions}
                  value={accountId}
                  onChange={(v) => {
                    setAccountId(v);
                    setSidemarkId('');
                    setSelectedItemIds(new Set()); // Clear selection when account changes
                    if (errors.account) setErrors({ ...errors, account: undefined });
                  }}
                  placeholder="Select account..."
                  searchPlaceholder="Search accounts..."
                  emptyText="No accounts found"
                  recentKey="outbound-accounts"
                  error={errors.account}
                />
              </div>

              {/* Outbound Type & Warehouse - side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    Outbound Type <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    options={outboundTypeOptions}
                    value={outboundTypeId}
                    onChange={(v) => {
                      setOutboundTypeId(v);
                      if (errors.outbound_type) setErrors({ ...errors, outbound_type: undefined });
                    }}
                    placeholder="Select type..."
                    searchPlaceholder="Search types..."
                    emptyText="No types found"
                    error={errors.outbound_type}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Warehouse <span className="text-destructive">*</span>
                  </Label>
                  <SearchableSelect
                    options={warehouseOptions}
                    value={warehouseId}
                    onChange={(v) => {
                      setWarehouseId(v);
                      if (errors.warehouse) setErrors({ ...errors, warehouse: undefined });
                    }}
                    placeholder="Select warehouse..."
                    searchPlaceholder="Search warehouses..."
                    emptyText="No warehouses found"
                    error={errors.warehouse}
                  />
                </div>
              </div>

              {/* Sidemark (filtered by account) */}
              {accountId && (
                <div className="space-y-1.5">
                  <Label>Sidemark / Project</Label>
                  <SearchableSelect
                    options={sidemarkOptions}
                    value={sidemarkId}
                    onChange={setSidemarkId}
                    placeholder={sidemarksLoading ? 'Loading...' : 'Select sidemark (optional)...'}
                    searchPlaceholder="Search sidemarks..."
                    emptyText="No sidemarks for this account"
                    disabled={sidemarksLoading}
                    clearable
                  />
                </div>
              )}

              {/* Expected Date */}
              <div className="space-y-1.5">
                <Label>Expected Pickup/Ship Date</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this shipment..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items Selection */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Select Items</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} selected
                </p>
              </div>
              {accountId && accountItems.length > 0 && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllItems}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={deselectAllItems}>
                    Clear
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!accountId ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MaterialIcon name="inventory_2" size="xl" className="text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Select an account to view available items</p>
                </div>
              ) : itemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
                </div>
              ) : accountItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MaterialIcon name="error" size="xl" className="text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No available items for this account</p>
                  <p className="text-sm text-muted-foreground">Items must be in storage to be shipped</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Error message */}
                  {errors.items && (
                    <p className="text-sm text-destructive">{errors.items}</p>
                  )}

                  {/* Items table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead className="hidden sm:table-cell">Description</TableHead>
                          <TableHead className="hidden md:table-cell">Type</TableHead>
                          <TableHead className="hidden md:table-cell">Sidemark</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No items match your search
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredItems.map((item) => (
                            <TableRow
                              key={item.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleItemSelection(item.id)}
                            >
                              <TableCell className="pointer-events-none">
                                <Checkbox
                                  checked={selectedItemIds.has(item.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{item.item_code}</TableCell>
                              <TableCell className="hidden sm:table-cell max-w-[200px] truncate">
                                {item.description || '-'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {item.item_type?.name ? (
                                  <Badge variant="outline">{item.item_type.name}</Badge>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {item.sidemark?.sidemark_name || '-'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3 pb-6">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || selectedItemIds.size === 0} className="min-w-[160px]">
              {saving ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MaterialIcon name="save" size="sm" className="mr-2" />
                  Create Outbound
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
