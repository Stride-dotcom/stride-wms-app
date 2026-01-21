import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Loader2, Save, ArrowLeft } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface Account {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface ItemType {
  id: string;
  name: string;
}

interface ExpectedItem {
  id: string;
  description: string;
  vendor: string;
  sidemark: string;
  quantity: number;
  item_type_id: string;
}

// ============================================
// COMPONENT
// ============================================

export default function ShipmentCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Determine shipment type from route
  const isReturn = location.pathname.includes('/return/');
  const shipmentType = 'inbound';

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

  // Shipment fields
  const [accountId, setAccountId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('');
  const [notes, setNotes] = useState('');

  // Expected items
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[]>([
    { id: crypto.randomUUID(), description: '', vendor: '', sidemark: '', quantity: 1, item_type_id: '' }
  ]);

  // ------------------------------------------
  // Fetch reference data
  // ------------------------------------------
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [accountsRes, warehousesRes, itemTypesRes] = await Promise.all([
          supabase
            .from('accounts')
            .select('id, name')
            .eq('tenant_id', profile.tenant_id)
            .is('deleted_at', null)
            .order('name'),
          supabase
            .from('warehouses')
            .select('id, name')
            .eq('tenant_id', profile.tenant_id)
            .is('deleted_at', null)
            .order('name'),
          supabase
            .from('item_types')
            .select('id, name')
            .eq('tenant_id', profile.tenant_id)
            .is('deleted_at', null)
            .order('name'),
        ]);

        if (accountsRes.error) {
          console.error('[ShipmentCreate] accounts fetch:', accountsRes.error);
        }
        if (warehousesRes.error) {
          console.error('[ShipmentCreate] warehouses fetch:', warehousesRes.error);
        }
        if (itemTypesRes.error) {
          console.error('[ShipmentCreate] itemTypes fetch:', itemTypesRes.error);
        }

        setAccounts(accountsRes.data || []);
        setWarehouses(warehousesRes.data || []);
        setItemTypes(itemTypesRes.data || []);

        // Set default warehouse if only one exists
        if (warehousesRes.data?.length === 1) {
          setWarehouseId(warehousesRes.data[0].id);
        }
      } catch (err) {
        console.error('[ShipmentCreate] fetchData exception:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.tenant_id]);

  // ------------------------------------------
  // Item management
  // ------------------------------------------
  const addItem = () => {
    setExpectedItems([
      ...expectedItems,
      { id: crypto.randomUUID(), description: '', vendor: '', sidemark: '', quantity: 1, item_type_id: '' }
    ]);
  };

  const removeItem = (id: string) => {
    if (expectedItems.length === 1) return;
    setExpectedItems(expectedItems.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof ExpectedItem, value: string | number) => {
    setExpectedItems(expectedItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
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

    if (!accountId) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select an account' });
      return;
    }

    if (!warehouseId) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please select a warehouse' });
      return;
    }

    // Filter out empty items
    const validItems = expectedItems.filter(item => item.description.trim() || item.quantity > 0);
    if (validItems.length === 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please add at least one expected item' });
      return;
    }

    setSaving(true);
    try {
      // Create shipment - shipment_number is auto-generated by trigger
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          tenant_id: profile.tenant_id,
          shipment_number: `SHP-${Date.now()}`, // Temporary, will be replaced by trigger
          shipment_type: shipmentType,
          status: 'expected',
          account_id: accountId,
          warehouse_id: warehouseId,
          carrier: carrier || null,
          tracking_number: trackingNumber || null,
          po_number: poNumber || null,
          expected_arrival_date: expectedArrivalDate || null,
          notes: notes || null,
          release_type: isReturn ? 'return' : null,
          created_by: profile.id,
        })
        .select('id, shipment_number')
        .single();

      if (shipmentError) {
        console.error('[ShipmentCreate] create shipment failed:', shipmentError);
        toast({ variant: 'destructive', title: 'Error', description: shipmentError.message });
        return;
      }

      // Create shipment items
      const shipmentItems = validItems.map(item => ({
        shipment_id: shipment.id,
        expected_description: item.description || null,
        expected_vendor: item.vendor || null,
        expected_sidemark: item.sidemark || null,
        expected_quantity: item.quantity,
        expected_item_type_id: item.item_type_id || null,
        status: 'pending',
      }));

      const { error: itemsError } = await supabase
        .from('shipment_items')
        .insert(shipmentItems);

      if (itemsError) {
        console.error('[ShipmentCreate] create shipment_items failed:', itemsError);
        toast({ variant: 'destructive', title: 'Warning', description: 'Shipment created but items failed to save' });
      }

      toast({ title: 'Shipment Created', description: `${shipment.shipment_number} created successfully` });
      navigate(`/shipments/${shipment.id}`);
    } catch (err) {
      console.error('[ShipmentCreate] handleSubmit exception:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create shipment' });
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------
  // Render
  // ------------------------------------------
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isReturn ? 'Create Return Shipment' : 'Create Inbound Shipment'}
          </h1>
          <p className="text-muted-foreground">Enter shipment details and expected items</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Shipment Details */}
        <Card>
          <CardHeader>
            <CardTitle>Shipment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account">Account *</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(warehouse => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier</Label>
                <Input
                  id="carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g., FedEx, UPS"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracking">Tracking Number</Label>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="po">PO Number</Label>
                <Input
                  id="po"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="Purchase order number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="arrival">Expected Arrival</Label>
                <Input
                  id="arrival"
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(e) => setExpectedArrivalDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this shipment"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Expected Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Expected Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Sidemark</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expectedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.vendor}
                        onChange={(e) => updateItem(item.id, 'vendor', e.target.value)}
                        placeholder="Vendor"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.sidemark}
                        onChange={(e) => updateItem(item.id, 'sidemark', e.target.value)}
                        placeholder="Sidemark"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={item.item_type_id} 
                        onValueChange={(v) => updateItem(item.id, 'item_type_id', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {itemTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        disabled={expectedItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Shipment
              </>
            )}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
}
