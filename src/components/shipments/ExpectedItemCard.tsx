import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { SearchableSelect, SelectOption } from "@/components/ui/searchable-select";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Mobile-first expected item card for shipment creation
 * - Stacked layout on mobile
 * - Uses FormField for all inputs
 * - Uses AutocompleteInput for vendor (free typing + suggestions)
 * - Uses SearchableSelect for item type (select only)
 * - Supports field suggestions for vendor/sidemark
 */

export interface ExpectedItemData {
  id: string;
  description: string;
  vendor: string;
  quantity: number;
  item_type_id: string;
}

export interface ExpectedItemErrors {
  description?: string;
  quantity?: string;
}

export interface ExpectedItemCardProps {
  item: ExpectedItemData;
  index: number;
  itemTypeOptions: SelectOption[];
  vendorSuggestions: string[];
  errors?: ExpectedItemErrors;
  canDelete: boolean;
  onUpdate: (id: string, field: keyof ExpectedItemData, value: string | number) => void;
  onDelete: (id: string) => void;
  onVendorUsed?: (value: string) => void;
}

export function ExpectedItemCard({
  item,
  index,
  itemTypeOptions,
  vendorSuggestions,
  errors,
  canDelete,
  onUpdate,
  onDelete,
  onVendorUsed,
}: ExpectedItemCardProps) {
  // Convert suggestions to format for AutocompleteInput
  const vendorSuggestionOptions = React.useMemo(
    () => vendorSuggestions.map((v) => ({ value: v, label: v })),
    [vendorSuggestions]
  );

  // NOTE: We intentionally do NOT collect per-item sidemark during shipment
  // creation. Shipment-level sidemark/project will be applied during receiving.

  return (
    <Card className="relative">
      <CardContent className="pt-4 pb-4 space-y-4">
        {/* Item header with number and delete */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Item {index + 1}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDelete(item.id)}
            disabled={!canDelete}
            className="h-8 w-8"
          >
            <Trash2 className={cn(
              "h-4 w-4",
              canDelete ? "text-destructive" : "text-muted-foreground"
            )} />
          </Button>
        </div>

        {/* Field order: Qty, Vendor, Description, Item Type, Sidemark */}
        
        {/* Row 1: Quantity and Vendor side by side */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Qty"
            name={`item-${item.id}-quantity`}
            type="number"
            value={item.quantity}
            onChange={(v) => onUpdate(item.id, "quantity", parseInt(v) || 1)}
            min={1}
            max={9999}
            required
            error={errors?.quantity}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Vendor</label>
            <AutocompleteInput
              suggestions={vendorSuggestionOptions}
              value={item.vendor}
              onChange={(v) => {
                onUpdate(item.id, "vendor", v);
                if (v && onVendorUsed) onVendorUsed(v);
              }}
              placeholder="Type vendor name..."
              className="min-h-[44px] text-base"
            />
          </div>
        </div>

        {/* Description - textarea with auto-grow */}
        <FormField
          label="Description"
          name={`item-${item.id}-description`}
          type="textarea"
          value={item.description}
          onChange={(v) => onUpdate(item.id, "description", v)}
          placeholder="Enter item description..."
          required
          error={errors?.description}
          minRows={2}
          maxRows={4}
        />

        {/* Row 2: Class */}
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Class</label>
            <SearchableSelect
              options={itemTypeOptions}
              value={item.item_type_id}
              onChange={(v) => onUpdate(item.id, "item_type_id", v)}
              placeholder="Select class..."
              searchPlaceholder="Search classes..."
              emptyText="No classes found"
              recentKey="shipment-item-types"
              clearable
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExpectedItemCard;
