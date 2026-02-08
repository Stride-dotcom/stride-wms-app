import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useClientPortalContext, useClientItems } from '@/hooks/useClientPortal';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface Warehouse {
  id: string;
  name: string;
}

interface OutboundType {
  id: string;
  name: string;
}

interface LocationState {
  itemIds?: string[];
  accountId?: string;
}

export default function ClientOutboundCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { portalUser, account, tenant, isLoading: contextLoading } = useClientPortalContext();
  const { data: allItems = [], isLoading: itemsLoading } = useClientItems();

  const state = (location.state as LocationState) || {};
  const preSelectedItemIds = state.itemIds || [];

  const userName = portalUser?.first_name
    ? `${portalUser.first_name} ${portalUser.last_name || ''}`.trim()
    : portalUser?.email || 'User';

  // Reference data
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [outboundTypes, setOutboundTypes] = useState<OutboundType[]>([]);

  // Form fields
  const [warehouseId, setWarehouseId] = useState('');
  const [outboundTypeId, setOutboundTypeId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Item selection
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set(preSelectedItemIds));
  const [searchQuery, setSearchQuery] = useState('');

  // Only show items that are in storage / available
  const availableItems = useMemo(() => {
    return allItems.filter((item: any) => {
      const status = item.status?.toLowerCase();
      return status === 'available' || status === 'in_storage' || status === 'active';
    });
  }, [allItems]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return availableItems;
    const query = searchQuery.toLowerCase();
    return availableItems.filter((item: any) =>
      item.item_code?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  }, [availableItems, searchQuery]);

  // Fetch reference data
  useEffect(() => {
    if (!portalUser?.tenant_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [warehousesRes, typesRes] = await Promise.all([
          (supabase.from('warehouses') as any)
            .select('id, name')
            .eq('tenant_id', portalUser.tenant_id)
            .is('deleted_at', null)
            .order('name'),
          (supabase.from('outbound_types') as any)
            .select('id, name')
            .eq('tenant_id', portalUser.tenant_id)
            .eq('is_active', true)
            .order('sort_order'),
        ]);

        setWarehouses(warehousesRes.data || []);
        setOutboundTypes(typesRes.data || []);

        // Auto-select warehouse if only one
        if (warehousesRes.data?.length === 1) {
          setWarehouseId(warehousesRes.data[0].id);
        }

        // Default to Will Call type
        const willCall = (typesRes.data || []).find((t: OutboundType) => t.name === 'Will Call');
        setOutboundTypeId(willCall?.id || typesRes.data?.[0]?.id || '');
      } catch (err) {
        console.error('[ClientOutboundCreate] fetchData error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portalUser?.tenant_id]);

  // Item selection handlers
  const toggleItemSelection = (itemId: string) => {
    const newSet = new Set(selectedItemIds);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItemIds(newSet);
  };

  const selectAllItems = () => {
    setSelectedItemIds(new Set(filteredItems.map((item: any) => item.id)));
  };

  const deselectAllItems = () => {
    setSelectedItemIds(new Set());
  };

  // Validation
  const validate = (): boolean => {
    if (!warehouseId) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a warehouse' });
      return false;
    }
    if (!outboundTypeId) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select an outbound type' });
      return false;
    }
    if (selectedItemIds.size === 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select at least one item' });
      return false;
    }
    return true;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!portalUser?.tenant_id || !portalUser?.account_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing account information' });
      return;
    }

    if (!validate()) return;

    setSaving(true);

    try {
      // Create outbound shipment
      const { data: shipment, error: shipmentError } = await (supabase.from('shipments') as any)
        .insert({
          tenant_id: portalUser.tenant_id,
          shipment_type: 'outbound',
          status: 'pending',
          account_id: portalUser.account_id,
          warehouse_id: warehouseId,
          outbound_type_id: outboundTypeId,
          notes: notes || null,
          expected_arrival_date: expectedDate || null,
          customer_authorized: true,
          customer_authorized_at: new Date().toISOString(),
          metadata: {
            client_portal_request: true,
            requested_by_email: portalUser.email,
            requested_by_name: userName,
          },
        })
        .select('id, shipment_number')
        .single();

      if (shipmentError) throw shipmentError;

      // Create shipment items
      const itemIds = Array.from(selectedItemIds);
      if (itemIds.length > 0) {
        const shipmentItems = itemIds.map(item_id => ({
          shipment_id: shipment.id,
          item_id,
          expected_quantity: 1,
          status: 'pending',
        }));

        const { error: itemsError } = await (supabase.from('shipment_items') as any)
          .insert(shipmentItems);

        if (itemsError) {
          console.error('[ClientOutboundCreate] shipment items error:', itemsError);
        }

        // Mark items as allocated
        await (supabase.from('items') as any)
          .update({ status: 'allocated' })
          .in('id', itemIds);
      }

      toast({
        title: 'Outbound Shipment Created',
        description: `Shipment ${shipment.shipment_number || ''} has been submitted to the warehouse.`,
      });

      navigate('/client/shipments');
    } catch (err: any) {
      console.error('[ClientOutboundCreate] submit error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to create outbound shipment',
      });
    } finally {
      setSaving(false);
    }
  };

  if (contextLoading || loading) {
    return (
      <ClientPortalLayout>
        <div className="flex items-center justify-center h-64">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </ClientPortalLayout>
    );
  }

  return (
    <ClientPortalLayout
      accountName={account?.name}
      warehouseName={tenant?.name}
      userName={userName}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/client/items">
            <Button variant="ghost" size="icon">
              <MaterialIcon name="arrow_back" size="sm" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create Outbound Shipment</h1>
            <p className="text-muted-foreground">Select items to ship out from your inventory</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shipment Details */}
          <Card>
            <CardHeader>
              <CardTitle>Shipment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Account (read-only) */}
              <div className="space-y-1.5">
                <Label>Account</Label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  {account?.name || 'Your Account'}
                </div>
              </div>

              {/* Outbound Type & Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    Outbound Type <span className="text-destructive">*</span>
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={outboundTypeId}
                    onChange={e => setOutboundTypeId(e.target.value)}
                  >
                    <option value="">Select type...</option>
                    {outboundTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {warehouses.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>
                      Warehouse <span className="text-destructive">*</span>
                    </Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={warehouseId}
                      onChange={e => setWarehouseId(e.target.value)}
                    >
                      <option value="">Select warehouse...</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Expected Date */}
              <div className="space-y-1.5">
                <Label>Expected Pickup/Ship Date</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={e => setExpectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional notes or pickup instructions..."
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
                  {availableItems.length > 0 && ` of ${availableItems.length} available`}
                </p>
              </div>
              {availableItems.length > 0 && (
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
              {itemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
                </div>
              ) : availableItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MaterialIcon name="inventory_2" size="xl" className="text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No available items in your account</p>
                  <p className="text-sm text-muted-foreground">Items must be in storage to be shipped out</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Items table */}
                  <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Item Code</TableHead>
                          <TableHead className="hidden sm:table-cell">Description</TableHead>
                          <TableHead className="hidden md:table-cell">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              No items match your search
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredItems.map((item: any) => (
                            <TableRow
                              key={item.id}
                              className={`cursor-pointer hover:bg-muted/50 ${selectedItemIds.has(item.id) ? 'bg-muted/30' : ''}`}
                              onClick={() => toggleItemSelection(item.id)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedItemIds.has(item.id)}
                                  onCheckedChange={() => toggleItemSelection(item.id)}
                                  onClick={e => e.stopPropagation()}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{item.item_code}</TableCell>
                              <TableCell className="hidden sm:table-cell max-w-[200px] truncate">
                                {item.description || '-'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <Badge variant="outline">{item.status?.replace(/_/g, ' ')}</Badge>
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
            <Link to="/client/items">
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={saving || selectedItemIds.size === 0} className="min-w-[160px]">
              {saving ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MaterialIcon name="send" size="sm" className="mr-2" />
                  Submit Outbound
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ClientPortalLayout>
  );
}
