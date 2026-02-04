import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useFieldSuggestions } from "@/hooks/useFieldSuggestions";
import { useAccountSidemarks } from "@/hooks/useAccountSidemarks";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SearchableSelect, SelectOption } from "@/components/ui/searchable-select";
import { ExpectedItemCard, ExpectedItemData, ExpectedItemErrors } from "@/components/shipments/ExpectedItemCard";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { MaterialIcon } from '@/components/ui/MaterialIcon';

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

interface ClassOption {
  id: string;
  code: string;
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
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<FormErrors>({});

  // Shipment fields
  const [accountId, setAccountId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [sidemark, setSidemark] = useState<string>("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch account sidemarks for autocomplete suggestions
  const { sidemarks: accountSidemarks, addSidemark: addAccountSidemark } = useAccountSidemarks(accountId || undefined);

  // Expected items
  const [expectedItems, setExpectedItems] = useState<ExpectedItemData[]>([
    { id: crypto.randomUUID(), description: "", vendor: "", quantity: 1 },
  ]);

  // Field suggestions hooks
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: recordVendor } = useFieldSuggestions("vendor");
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: recordDescription } = useFieldSuggestions("description");

  // Convert to string arrays for the card
  const vendorValues = useMemo(() => vendorSuggestions.map((s) => s.value), [vendorSuggestions]);
  const descriptionSuggestionOptions = useMemo(
    () => descriptionSuggestions.map((s) => ({ value: s.value, label: s.value })),
    [descriptionSuggestions]
  );

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

  // Sidemark autocomplete suggestions from account_sidemarks
  const sidemarkSuggestions = useMemo(
    () => accountSidemarks.map((s) => ({ value: s.sidemark, label: s.sidemark })),
    [accountSidemarks],
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

        // Fetch classes for item size selection
        const classesRes = await (supabase.from("classes") as any)
          .select("id, code, name")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

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

        setAccounts(accountsRes.data || []);
        setWarehouses(warehousesRes.data || []);
        setClasses(classesRes.data || []);

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
      { id: crypto.randomUUID(), description: "", vendor: "", quantity: 1 },
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

  const duplicateItem = (itemToDuplicate: ExpectedItemData) => {
    const newItem: ExpectedItemData = {
      id: crypto.randomUUID(),
      description: itemToDuplicate.description,
      vendor: itemToDuplicate.vendor,
      quantity: itemToDuplicate.quantity,
    };
    // Insert the duplicate right after the original item
    const index = expectedItems.findIndex((item) => item.id === itemToDuplicate.id);
    const newItems = [...expectedItems];
    newItems.splice(index + 1, 0, newItem);
    setExpectedItems(newItems);
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
      if (!item.classId) {
        errs.classCode = "Class is required";
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
      // Refresh session to prevent stale JWT / RLS failures
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "Please refresh the page and try again.",
        });
        setSaving(false);
        return;
      }

      // If sidemark text was entered, ensure it exists in account_sidemarks
      if (sidemark.trim() && accountId) {
        await addAccountSidemark(sidemark.trim());
      }

      // Create shipment
      const shipmentPayload = {
        tenant_id: profile.tenant_id,
        account_id: accountId,
        warehouse_id: warehouseId,
        sidemark: sidemark.trim() || null,
        shipment_type: isReturn ? "return" : "inbound",
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

      // Create actual items with status 'pending_receipt' and link to shipment_items
      // This allows billing calculations to work before receiving
      const validItems = expectedItems.filter((item) => item.description.trim());

      for (const expectedItem of validItems) {
        // Create actual item record with pending_receipt status
        // The item_code will be auto-generated by the database trigger
        const itemPayload = {
          tenant_id: profile.tenant_id,
          account_id: accountId,
          warehouse_id: warehouseId,
          description: expectedItem.description.trim(),
          vendor: expectedItem.vendor || null,
          quantity: expectedItem.quantity,
          class_id: expectedItem.classId || null,
          sidemark: sidemark.trim() || null,
          receiving_shipment_id: shipment.id,
          status: "pending_receipt",
        };

        const { data: newItem, error: itemError } = await (supabase.from("items") as any)
          .insert(itemPayload)
          .select("id")
          .single();

        if (itemError) {
          console.error("[ShipmentCreate] Item creation failed:", itemError);
          throw itemError;
        }

        // Create shipment_item linking to the new item
        const shipmentItemPayload = {
          shipment_id: shipment.id,
          item_id: newItem.id,
          expected_description: expectedItem.description.trim(),
          expected_quantity: expectedItem.quantity,
          expected_vendor: expectedItem.vendor || null,
          expected_class_id: expectedItem.classId || null,
          expected_sidemark: null,
          status: "pending",
        };

        const { error: shipmentItemError } = await (supabase.from("shipment_items") as any)
          .insert(shipmentItemPayload);

        if (shipmentItemError) {
          console.error("[ShipmentCreate] Shipment item creation failed:", shipmentItemError);
          throw shipmentItemError;
        }
      }

      // Record field suggestions for future use
      expectedItems.forEach((item) => {
        if (item.vendor) recordVendor(item.vendor);
        if (item.description) recordDescription(item.description);
      });

      toast({ title: "Success", description: "Shipment created successfully" });
      navigate(`/shipments/${shipment.id}`);
    } catch (err: any) {
      console.error("[ShipmentCreate] submit error:", err);
      const isRlsError =
        err?.message?.includes("row-level security") ||
        err?.code === "42501";
      toast({
        variant: "destructive",
        title: isRlsError ? "Permission Error" : "Error",
        description: isRlsError
          ? "Session may have expired. Please refresh and try again."
          : err.message || "Failed to create shipment",
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
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
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
            <MaterialIcon name="arrow_back" size="md" />
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
                    setSidemark(""); // Reset sidemark when account changes
                    if (errors.account) setErrors({ ...errors, account: undefined });
                  }}
                  placeholder="Select account..."
                  searchPlaceholder="Search accounts..."
                  emptyText="No accounts found"
                  recentKey="shipment-accounts"
                  error={errors.account}
                />
              </div>

              {/* Sidemark (text autocomplete, filtered by account) */}
              {accountId && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sidemark / Project</label>
                  <AutocompleteInput
                    value={sidemark}
                    onChange={setSidemark}
                    suggestions={sidemarkSuggestions}
                    placeholder="e.g., Living Room Set"
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
            <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[140px]">
              {saving ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MaterialIcon name="save" size="sm" className="mr-2" />
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
