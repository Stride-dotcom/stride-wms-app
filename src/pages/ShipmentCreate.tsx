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
import {
  ExpectedItemCard,
  ExpectedItemData,
  ExpectedItemErrors,
} from "@/components/shipments/ExpectedItemCard";
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
  const [sidemarkId, setSidemarkId] = useState<string>(""); // ships on shipments.sidemark_id
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch sidemarks filtered by selected account
  const { sidemarks, loading: sidemarksLoading } = useSidemarks(accountId || undefined);

  // Expected items (UI fields). These map into shipment_items.expected_* columns on insert.
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
    () =>
      sidemarks.map((s) => ({
        value: s.id,
        label: s.sidemark_name,
        subtitle: s.sidemark_code || undefined,
      })),
    [sidemarks],
  );

  // ============================================
  // DATA LOADING
  // ============================================

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: accountsData, error: accountsError }, { data: warehousesData, error: warehousesError }, { data: itemTypesData, error: itemTypesError }] =
          await Promise.all([
            (supabase.from("accounts") as any)
              .select("id, account_name, account_code")
              .eq("tenant_id", profile.tenant_id)
              .is("deleted_at", null)
              .order("account_name", { ascending: true }),
            (supabase.from("warehouses") as any)
              .select("id, name")
              .eq("tenant_id", profile.tenant_id)
              .is("deleted_at", null)
              .order("name", { ascending: true }),
            (supabase.from("item_types") as any)
              .select("id, name")
              .eq("tenant_id", profile.tenant_id)
              .is("deleted_at", null)
              .order("name", { ascending: true }),
          ]);

        if (accountsError) throw accountsError;
        if (warehousesError) throw warehousesError;
        if (itemTypesError) throw itemTypesError;

        setAccounts(accountsData || []);
        setWarehouses(warehousesData || []);
        setItemTypes(itemTypesData || []);
      } catch (e: any) {
        console.error("[ShipmentCreate] load error:", e);
        toast({ variant: "destructive", title: "Failed to load data", description: e?.message || "Unknown error" });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.tenant_id, toast]);

  // ============================================
  // ITEM HANDLERS
  // ============================================

  const addItem = () => {
    setExpectedItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", vendor: "", sidemark: "", quantity: 1, item_type_id: "" },
    ]);
  };

  const removeItem = (id: string) => {
    setExpectedItems((prev) => prev.filter((i) => i.id !== id));
    setErrors((prev) => {
      if (!prev.items) return prev;
      const next = { ...prev.items };
      delete next[id];
      return { ...prev, items: next };
    });
  };

  const updateItem = (id: string, patch: Partial<ExpectedItemData>) => {
    setExpectedItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  // ============================================
  // VALIDATION
  // ============================================

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!accountId) nextErrors.account = "Account is required";
    if (!warehouseId) nextErrors.warehouse = "Warehouse is required";

    const itemErrors: Record<string, ExpectedItemErrors> = {};
    expectedItems.forEach((item) => {
      const e: ExpectedItemErrors = {};
      if (!item.description?.trim()) e.description = "Description is required";
      if (!item.quantity || item.quantity < 1) e.quantity = "Qty must be at least 1";
      // vendor/sidemark/item_type optional
      if (Object.keys(e).length > 0) itemErrors[item.id] = e;
    });

    if (Object.keys(itemErrors).length > 0) nextErrors.items = itemErrors;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ============================================
  // SUBMIT
  // ============================================

  const handleSubmit = async () => {
    if (!profile?.tenant_id) {
      toast({ variant: "destructive", title: "Missing tenant", description: "Please sign in again." });
      return;
    }

    if (!validate()) {
      toast({ variant: "destructive", title: "Fix errors", description: "Please correct the highlighted fields." });
      return;
    }

    setSaving(true);
    try {
      // Create shipment
      const shipmentPayload: any = {
        tenant_id: profile.tenant_id,
        account_id: accountId,
        warehouse_id: warehouseId,
        sidemark_id: sidemarkId || null,
        shipment_type: isReturn ? "outbound" : "inbound",
        status: "expected",
        carrier: carrier || null,
        tracking_number: trackingNumber || null,
        po_number: poNumber || null,
        expected_arrival_date: expectedArrivalDate ? expectedArrivalDate : null,
        notes: notes || null,
      };

      const { data: shipment, error: shipmentError } = await (supabase.from("shipments") as any)
        .insert(shipmentPayload)
        .select("id")
        .single();

      if (shipmentError) throw shipmentError;

      // Create shipment_items
      // IMPORTANT: shipment_items does NOT have `sidemark` / `vendor` / `item_type_id` columns.
      // It has expected_* columns: expected_vendor, expected_sidemark, expected_item_type_id.
      const itemsToInsert = expectedItems
        .filter((item) => item.description.trim())
        .map((item) => ({
          tenant_id: profile.tenant_id,
          shipment_id: shipment.id,
          expected_description: item.description.trim(),
          expected_quantity: item.quantity,
          expected_vendor: item.vendor || null,
          expected_sidemark: item.sidemark || null,
          expected_item_type_id: item.item_type_id || null,
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
        title: "Error creating shipment",
        description: err?.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1 className="text-2xl font-semibold">{isReturn ? "Create Return Shipment" : "Create Shipment"}</h1>
          </div>
          <Button onClick={handleSubmit} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Shipment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-medium">Account *</div>
              <SearchableSelect
                options={accountOptions}
                value={accountId}
                onChange={(v) => {
                  setAccountId(v);
                  setSidemarkId(""); // reset when account changes
                  if (errors.account) setErrors({ ...errors, account: undefined });
                }}
                placeholder="Select account..."
                searchPlaceholder="Search accounts..."
                emptyText="No accounts found"
                recentKey="shipment-accounts"
                error={errors.account}
              />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium">Warehouse *</div>
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
                recentKey="shipment-warehouses"
                error={errors.warehouse}
              />
            </div>

            {/* Sidemark selector (shipments.sidemark_id) */}
            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium">Sidemark / Project</div>
              <SearchableSelect
                options={sidemarkOptions}
                value={sidemarkId}
                onChange={(v) => setSidemarkId(v)}
                placeholder={accountId ? "Select sidemark..." : "Select an account first"}
                searchPlaceholder="Search sidemarks..."
                emptyText={accountId ? (sidemarksLoading ? "Loading..." : "No sidemarks found") : "Select an account first"}
                recentKey="shipment-sidemarks"
                clearable
                disabled={!accountId}
              />
              <div className="mt-1 text-xs text-muted-foreground">
                This sets the default project for the shipment. Items created during receiving will inherit this sidemark.
              </div>
            </div>

            <FormField label="Carrier" value={carrier} onChange={setCarrier} placeholder="Carrier" />
            <FormField label="Tracking #" value={trackingNumber} onChange={setTrackingNumber} placeholder="Tracking #" />
            <FormField label="PO #" value={poNumber} onChange={setPoNumber} placeholder="PO #" />
            <FormField
              label="Expected Arrival"
              value={expectedArrivalDate}
              onChange={setExpectedArrivalDate}
              type="date"
            />
            <div className="md:col-span-2">
              <FormField label="Notes" value={notes} onChange={setNotes} placeholder="Notes..." textarea />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Expected Items</CardTitle>
            <Button variant="outline" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {expectedItems.map((item) => (
              <ExpectedItemCard
                key={item.id}
                item={item}
                onChange={(patch) => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
                vendorSuggestions={vendorValues}
                sidemarkSuggestions={sidemarkValues}
                itemTypeOptions={itemTypeOptions}
                errors={errors.items?.[item.id]}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
