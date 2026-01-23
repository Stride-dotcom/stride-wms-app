import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useFieldSuggestions } from "@/hooks/useFieldSuggestions";
import { useSidemarks } from "@/hooks/useSidemarks";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect, SelectOption } from "@/components/ui/searchable-select";
import { ExpectedItemCard, ExpectedItemData, ExpectedItemErrors } from "@/components/shipments/ExpectedItemCard";
import { Plus, Loader2, Save, ArrowLeft } from "lucide-react";

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

interface ItemType {
  id: string;
  name: string;
}

interface FormErrors {
  account?: string;
  warehouse?: string;
  items?: Record<string, ExpectedItemErrors>;
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
  const isReturn = location.pathname.includes("/return/");

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<FormErrors>({});

  // Shipment fields
  const [accountId, setAccountId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [sidemarkId, setSidemarkId] = useState<string>("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch sidemarks filtered by selected account
  const { sidemarks, loading: sidemarksLoading } = useSidemarks(accountId || undefined);

  // Expected items
  const [expectedItems, setExpectedItems] = useState<ExpectedItemData[]>([
    { id: crypto.randomUUID(), description: "", vendor: "", sidemark: "", quantity: 1, item_type_id: "" },
  ]);

  // Field suggestions hooks
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: recordVendor } = useFieldSuggestions("vendor");
  const { suggestions: sidemarkSuggestions, addOrUpdateSuggestion: recordSidemark } = useFieldSuggestions("sidemark");

  // Convert to string arrays for the card
  const vendorValues = useMemo(() => vendorSuggestions.map((s) => s.value), [vendorSuggestions]);
  const sidemarkValues = useMemo(() => sidemarkSuggestions.map((s) => s.value), [sidemarkSuggestions]);

  // Convert to SelectOption arrays
  const accountOptions: SelectOption[] = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: a.account_name,
        subtitle: a.account_code || undefined,
      })),
    [accounts],
  );

  const warehouseOptions: SelectOption[] = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses],
  );

  const itemTypeOptions: SelectOption[] = useMemo(
    () => itemTypes.map((t) => ({ value: t.id, label: t.name })),
    [itemTypes],
  );

  const sidemarkOptions: SelectOption[] = useMemo(
    () => sidemarks.map((s) => ({ 
      value: s.id, 
      label: s.sidemark_name,
      subtitle: s.sidemark_code || undefined,
    })),
    [sidemarks],
  );

  // ------------------------------------------
  // Fetch reference data
  // ------------------------------------------
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch accounts (no is_active column - use deleted_at only)
        const accountsRes = await (supabase.from("accounts") as any)
          .select("id, account_name, account_code")
          .eq("tenant_id", profile.tenant_id)
          .is("deleted_at", null)
          .order("account_name", { ascending: true });

        // Fetch warehouses
        const warehousesRes = await (supabase.from("warehouses") as any)
          .select("id, name")
          .eq("tenant_id", profile.tenant_id)
          .is("deleted_at", null)
          .order("name");

        // Fetch item types (no deleted_at - use is_active only)
        const itemTypesRes = await (supabase.from("item_types") as any)
          .select("id, name, is_active, sort_order")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: true })
          .order("name", { ascending: true });

        if (accountsRes.error) {
          console.error("[ShipmentCreate] accounts fetch:", accountsRes.error);
          toast({
            variant: "destructive",
            title: "Failed to load accounts",
            description: accountsRes.error.message,
          });
        }
        if (warehousesRes.error) {
          console.error("[ShipmentCreate] warehouses fetch:", warehousesRes.error);
          toast({
            variant: "destructive",
            title: "Failed to load warehouses",
            description: warehousesRes.error.message,
          });
        }
        if (itemTypesRes.error) {
          console.error("[ShipmentCreate] itemTypes fetch:", itemTypesRes.error);
          toast({
            variant: "destructive",
            title: "Failed to load item types",
            description: itemTypesRes.error.message,
          });
        }

        setAccounts(accountsRes.data || []);
        setWarehouses(warehousesRes.data || []);
        setItemTypes(itemTypesRes.data || []);

        // Set default warehouse if only one exists
        if (warehousesRes.data?.length === 1) {
          setWarehouseId(warehousesRes.data[0].id);
        }
      } catch (err) {
        console.error("[ShipmentCreate] fetchData exception:", err);
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
      { id: crypto.randomUUID(), description: "", vendor: "", sidemark: "", quantity: 1, item_type_id: "" },
    ]);
  };

  const removeItem = (id: string) => {
    if (expectedItems.length === 1) return;
    setExpectedItems(expectedItems.filter((item) => item.id !== id));
    // Clear item errors
    if (errors.items?.[id]) {
      const newItemErrors = { ...errors.items };
      delete newItemErrors[id];
      setErrors({ ...errors, items: newItemErrors });
    }
  };

  const updateItem = (id: string, field: keyof ExpectedItemData, value: string | number) => {
    setExpectedItems(expectedItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    // Clear field error on change
    if (errors.items?.[id]?.[field as keyof ExpectedItemErrors]) {
      const newItemErrors = { ...errors.items };
      if (newItemErrors[id]) {
        delete newItemErrors[id][field as keyof ExpectedItemErrors];
      }
      setErrors({ ...errors, items: newItemErrors });
    }
  };

  // ------------------------------------------
  // Validation
  // ------------------------------------------
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!accountId) {
      newErrors.account = "Please select an account";
    }

    if (!warehouseId) {
      newErrors.warehouse = "Please select a warehouse";
    }

    // Validate items
    const itemErrors: Record<string, ExpectedItemErrors> = {};
    let hasItemErrors = false;

    expectedItems.forEach((item) => {
      const errs: ExpectedItemErrors = {};
      if (!item.description.trim()) {
        errs.description = "Description is required";
        hasItemErrors = true;
      }
      if (item.quantity < 1) {
        errs.quantity = "Quantity must be at least 1";
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

  // ------------------------------------------
  // Submit handler
  // ------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.tenant_id || !profile?.id) {
      toast({ variant: "destructive", title: "Error", description: "Not authenticated" });
      return;
    }

    if (!validate()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please fix the errors below" });
      return;
    }

    setSaving(true);

    try {
      // Create shipment
      const shipmentPayload = {
        tenant_id: profile.tenant_id,
        account_id: accountId,
        warehouse_id: warehouseId,
        sidemark_id: sidemarkId || null,
        shipment_type: "inbound" as const,
        status: "expected" as const,
        carrier: carrier || null,
        tracking_number: trackingNumber || null,
        po_number: poNumber || null,
        expected_arrival_date: expectedArrivalDate || null,
        notes: notes || null,
        created_by: profile.id,
      };

      const { data: shipment, error: shipmentError } = await (supabase.from("shipments") as any)
        .insert(shipmentPayload)
        .select("id")
        .single();

      if (shipmentError) throw shipmentError;

      // Create shipment items
      const itemsToInsert = expectedItems
        .filter((item) => item.description.trim())
        .map((item) => ({
          tenant_id: profile.tenant_id,
          shipment_id: shipment.id,
          expected_description: item.description.trim(),
          expected_quantity: item.quantity,
          vendor: item.vendor || null,
          sidemark: item.sidemark || null,
          item_type_id: item.item_type_id || null,
          status: "pending",
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await (supabase.from("shipment_items") as any).insert(itemsToInsert);

        if (itemsError) {
          console.error("[ShipmentItemsCreate] Insert failed:", itemsError);
          toast({
            variant: "destructive",
            title: "Failed to create shipment items",
            description: itemsError.message || "Unknown error",
          });
          throw itemsError;
        }
      }

      // Record field suggestions for future use
      expectedItems.forEach((item) => {
        if (item.vendor) recordVendor(item.vendor);
        if (item.sidemark) recordSidemark(item.sidemark);
      });

      toast({ title: "Success", description: "Shipment created successfully" });
      navigate(`/shipments/${shipment.id}`);
    } catch (err: any) {
      console.error("[ShipmentCreate] submit error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to create shipment",
      });
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------
  // Loading state
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
      <div className="container mx-auto max-w-2xl px-4 pb-safe">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pt-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {isReturn ? "Create Return Shipment" : "Create Inbound Shipment"}
            </h1>
            <p className="text-sm text-muted-foreground">Enter shipment details and expected items</p>
          </div>
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
                <label className="text-sm font-medium">
                  Account <span className="text-destructive">*</span>
                </label>
                <SearchableSelect
                  options={accountOptions}
                  value={accountId}
                  onChange={(v) => {
                    setAccountId(v);
                    setSidemarkId(""); // Reset sidemark when account changes
                    if (errors.account) setErrors({ ...errors, account: undefined });
                  }}
                  placeholder="Select account..."
                  searchPlaceholder="Search accounts..."
                  emptyText="No accounts found"
                  recentKey="shipment-accounts"
                  error={errors.account}
                />
              </div>

              {/* Sidemark (filtered by account) */}
              {accountId && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sidemark / Project</label>
                  <SearchableSelect
                    options={sidemarkOptions}
                    value={sidemarkId}
                    onChange={setSidemarkId}
                    placeholder={sidemarksLoading ? "Loading..." : "Select sidemark (optional)..."}
                    searchPlaceholder="Search sidemarks..."
                    emptyText="No sidemarks for this account"
                    disabled={sidemarksLoading}
                    clearable
                  />
                </div>
              )}

              {/* Warehouse */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Warehouse <span className="text-destructive">*</span>
                </label>
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

              {/* Carrier & Tracking - side by side on larger screens */}
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

              {/* PO & Date - side by side on larger screens */}
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
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {expectedItems.map((item, index) => (
                <ExpectedItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  itemTypeOptions={itemTypeOptions}
                  vendorSuggestions={vendorValues}
                  sidemarkSuggestions={sidemarkValues}
                  errors={errors.items?.[item.id]}
                  canDelete={expectedItems.length > 1}
                  onUpdate={updateItem}
                  onDelete={removeItem}
                  onVendorUsed={recordVendor}
                  onSidemarkUsed={recordSidemark}
                />
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3 pb-6">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[140px]">
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
      </div>
    </DashboardLayout>
  );
}
