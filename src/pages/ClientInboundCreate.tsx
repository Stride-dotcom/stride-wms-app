import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useAccountSidemarks } from '@/hooks/useAccountSidemarks';
import { useClientPortalContext } from '@/hooks/useClientPortal';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { ExpectedItemCard, ExpectedItemData, ExpectedItemErrors } from '@/components/shipments/ExpectedItemCard';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface Warehouse {
  id: string;
  name: string;
}

interface ClassOption {
  id: string;
  code: string;
  name: string;
}

interface FormErrors {
  warehouse?: string;
  items?: Record<string, ExpectedItemErrors>;
}

export default function ClientInboundCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { portalUser, account, tenant, isLoading: contextLoading } = useClientPortalContext();

  const userName = portalUser?.first_name
    ? `${portalUser.first_name} ${portalUser.last_name || ''}`.trim()
    : portalUser?.email || 'User';

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  // Shipment fields
  const [warehouseId, setWarehouseId] = useState('');
  const [sidemark, setSidemark] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState('');
  const [notes, setNotes] = useState('');

  // Account sidemarks for autocomplete
  const { sidemarks: accountSidemarks, addSidemark: addAccountSidemark } = useAccountSidemarks(portalUser?.account_id || undefined);

  // Expected items
  const [expectedItems, setExpectedItems] = useState<ExpectedItemData[]>([
    { id: crypto.randomUUID(), description: '', vendor: '', quantity: 1 },
  ]);

  // Field suggestions
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: recordVendor } = useFieldSuggestions('vendor');
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: recordDescription } = useFieldSuggestions('description');

  const vendorValues = useMemo(() => vendorSuggestions.map(s => s.value), [vendorSuggestions]);
  const descriptionSuggestionOptions = useMemo(
    () => descriptionSuggestions.map(s => ({ value: s.value, label: s.value })),
    [descriptionSuggestions]
  );

  const sidemarkSuggestions = useMemo(
    () => accountSidemarks.map(s => ({ value: s.sidemark, label: s.sidemark })),
    [accountSidemarks]
  );

  // Fetch reference data
  useEffect(() => {
    if (!portalUser?.tenant_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [warehousesRes, classesRes] = await Promise.all([
          (supabase.from('warehouses') as any)
            .select('id, name')
            .eq('tenant_id', portalUser.tenant_id)
            .is('deleted_at', null)
            .order('name'),
          (supabase.from('classes') as any)
            .select('id, code, name')
            .eq('tenant_id', portalUser.tenant_id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
        ]);

        setWarehouses(warehousesRes.data || []);
        setClasses(classesRes.data || []);

        // Auto-select warehouse if only one
        if (warehousesRes.data?.length === 1) {
          setWarehouseId(warehousesRes.data[0].id);
        }
      } catch (err) {
        console.error('[ClientInboundCreate] fetchData error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [portalUser?.tenant_id]);

  // Item management
  const addItem = () => {
    setExpectedItems([
      ...expectedItems,
      { id: crypto.randomUUID(), description: '', vendor: '', quantity: 1 },
    ]);
  };

  const removeItem = (id: string) => {
    if (expectedItems.length === 1) return;
    setExpectedItems(expectedItems.filter(item => item.id !== id));
    if (errors.items?.[id]) {
      const newItemErrors = { ...errors.items };
      delete newItemErrors[id];
      setErrors({ ...errors, items: newItemErrors });
    }
  };

  const duplicateItem = (itemToDuplicate: ExpectedItemData) => {
    const newItem: ExpectedItemData = {
      id: crypto.randomUUID(),
      description: itemToDuplicate.description,
      vendor: itemToDuplicate.vendor,
      quantity: itemToDuplicate.quantity,
      classId: itemToDuplicate.classId,
      classCode: itemToDuplicate.classCode,
    };
    const index = expectedItems.findIndex(item => item.id === itemToDuplicate.id);
    const newItems = [...expectedItems];
    newItems.splice(index + 1, 0, newItem);
    setExpectedItems(newItems);
  };

  const updateItem = (id: string, field: keyof ExpectedItemData, value: string | number) => {
    setExpectedItems(expectedItems.map(item => (item.id === id ? { ...item, [field]: value } : item)));
    if (errors.items?.[id]?.[field as keyof ExpectedItemErrors]) {
      const newItemErrors = { ...errors.items };
      if (newItemErrors[id]) {
        delete newItemErrors[id][field as keyof ExpectedItemErrors];
      }
      setErrors({ ...errors, items: newItemErrors });
    }
  };

  // Validation — class is NOT required for client inbound
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!warehouseId) {
      newErrors.warehouse = 'Please select a warehouse';
    }

    const itemErrors: Record<string, ExpectedItemErrors> = {};
    let hasItemErrors = false;

    expectedItems.forEach(item => {
      const errs: ExpectedItemErrors = {};
      if (!item.description.trim()) {
        errs.description = 'Description is required';
        hasItemErrors = true;
      }
      if (item.quantity < 1) {
        errs.quantity = 'Quantity must be at least 1';
        hasItemErrors = true;
      }
      if (Object.keys(errs).length > 0) {
        itemErrors[item.id] = errs;
      }
    });

    if (hasItemErrors) {
      newErrors.items = itemErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!portalUser?.tenant_id || !portalUser?.account_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Missing account information' });
      return;
    }

    if (!validate()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fix the errors below' });
      return;
    }

    setSaving(true);

    try {
      // Ensure sidemark exists in account_sidemarks
      if (sidemark.trim() && portalUser.account_id) {
        await addAccountSidemark(sidemark.trim());
      }

      // Create shipment
      const { data: shipment, error: shipmentError } = await (supabase.from('shipments') as any)
        .insert({
          tenant_id: portalUser.tenant_id,
          account_id: portalUser.account_id,
          warehouse_id: warehouseId,
          sidemark: sidemark.trim() || null,
          shipment_type: 'inbound',
          status: 'expected',
          carrier: carrier || null,
          tracking_number: trackingNumber || null,
          po_number: poNumber || null,
          expected_arrival_date: expectedArrivalDate || null,
          notes: notes || null,
          metadata: {
            client_portal_request: true,
            requested_by_email: portalUser.email,
            requested_by_name: userName,
          },
        })
        .select('id')
        .single();

      if (shipmentError) throw shipmentError;

      // Create items and shipment_items
      const validItems = expectedItems.filter(item => item.description.trim());

      for (const expectedItem of validItems) {
        const itemPayload = {
          tenant_id: portalUser.tenant_id,
          account_id: portalUser.account_id,
          warehouse_id: warehouseId,
          description: expectedItem.description.trim(),
          vendor: expectedItem.vendor || null,
          quantity: expectedItem.quantity,
          class_id: expectedItem.classId || null,
          sidemark: sidemark.trim() || null,
          receiving_shipment_id: shipment.id,
          status: 'pending_receipt',
        };

        const { data: newItem, error: itemError } = await (supabase.from('items') as any)
          .insert(itemPayload)
          .select('id')
          .single();

        if (itemError) throw itemError;

        const { error: shipmentItemError } = await (supabase.from('shipment_items') as any)
          .insert({
            shipment_id: shipment.id,
            item_id: newItem.id,
            expected_description: expectedItem.description.trim(),
            expected_quantity: expectedItem.quantity,
            expected_vendor: expectedItem.vendor || null,
            expected_class_id: expectedItem.classId || null,
            status: 'pending',
          });

        if (shipmentItemError) throw shipmentItemError;
      }

      // Record field suggestions
      expectedItems.forEach(item => {
        if (item.vendor) recordVendor(item.vendor);
        if (item.description) recordDescription(item.description);
      });

      toast({ title: 'Shipment Created', description: 'Your inbound shipment has been submitted to the warehouse.' });
      navigate('/client/shipments');
    } catch (err: any) {
      console.error('[ClientInboundCreate] submit error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to create shipment',
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
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/client/shipments">
            <Button variant="ghost" size="icon">
              <MaterialIcon name="arrow_back" size="sm" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create Inbound Shipment</h1>
            <p className="text-muted-foreground">
              Notify the warehouse about an incoming shipment
            </p>
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
                <label className="text-sm font-medium">Account</label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm">
                  {account?.name || 'Your Account'}
                </div>
              </div>

              {/* Warehouse */}
              {warehouses.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Warehouse <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={warehouseId}
                    onChange={e => {
                      setWarehouseId(e.target.value);
                      if (errors.warehouse) setErrors({ ...errors, warehouse: undefined });
                    }}
                  >
                    <option value="">Select warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  {errors.warehouse && <p className="text-sm text-destructive">{errors.warehouse}</p>}
                </div>
              )}

              {/* Sidemark */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Sidemark / Project</label>
                <AutocompleteInput
                  value={sidemark}
                  onChange={setSidemark}
                  suggestions={sidemarkSuggestions}
                  placeholder="e.g., Living Room Set"
                />
              </div>

              {/* Carrier & Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Carrier"
                  name="carrier"
                  value={carrier}
                  onChange={setCarrier}
                  placeholder="e.g., FedEx, UPS"
                />
                <FormField
                  label="Tracking Number"
                  name="tracking"
                  value={trackingNumber}
                  onChange={setTrackingNumber}
                  placeholder="Tracking number"
                />
              </div>

              {/* PO & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="PO Number"
                  name="po"
                  value={poNumber}
                  onChange={setPoNumber}
                  placeholder="Purchase order number"
                />
                <FormField
                  label="Expected Arrival"
                  name="arrival"
                  type="date"
                  value={expectedArrivalDate}
                  onChange={setExpectedArrivalDate}
                />
              </div>

              {/* Notes */}
              <FormField
                label="Notes"
                name="notes"
                type="textarea"
                value={notes}
                onChange={setNotes}
                placeholder="Additional notes about this shipment..."
                minRows={2}
                maxRows={4}
              />
            </CardContent>
          </Card>

          {/* Expected Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-lg">Expected Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <MaterialIcon name="add" size="sm" className="mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {expectedItems.map((item, index) => (
                <ExpectedItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  vendorSuggestions={vendorValues}
                  descriptionSuggestions={descriptionSuggestionOptions}
                  classes={classes}
                  classOptional
                  errors={errors.items?.[item.id]}
                  canDelete={expectedItems.length > 1}
                  onUpdate={updateItem}
                  onDelete={removeItem}
                  onDuplicate={duplicateItem}
                  onVendorUsed={recordVendor}
                />
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3 pb-6">
            <Link to="/client/shipments">
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={saving} className="min-w-[140px]">
              {saving ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MaterialIcon name="send" size="sm" className="mr-2" />
                  Submit Shipment
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ClientPortalLayout>
  );
}
