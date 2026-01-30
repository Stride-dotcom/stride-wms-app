import * as React from "react";
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
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
}

export interface ExpectedItemErrors {
  description?: string;
  quantity?: string;
}

export interface ExpectedItemCardProps {
  item: ExpectedItemData;
  index: number;
  vendorSuggestions: string[];
  errors?: ExpectedItemErrors;
  canDelete: boolean;
  onUpdate: (id: string, field: keyof ExpectedItemData, value: string | number) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (item: ExpectedItemData) => void;
  onVendorUsed?: (value: string) => void;
}

export function ExpectedItemCard({
  item,
  index,
  vendorSuggestions,
  errors,
  canDelete,
  onUpdate,
  onDelete,
  onDuplicate,
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
        {/* Item header with number, duplicate, and delete */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Item {index + 1}
          </span>
          <div className="flex items-center gap-1">
            {onDuplicate && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDuplicate(item)}
                className="h-8 w-8"
                title="Duplicate item"
              >
                <MaterialIcon name="content_copy" size="sm" className="text-muted-foreground" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(item.id)}
              disabled={!canDelete}
              className="h-8 w-8"
              title="Delete item"
            >
              <MaterialIcon name="delete" size="sm" className={cn(
                canDelete ? "text-destructive" : "text-muted-foreground"
              )} />
            </Button>
          </div>
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
      </CardContent>
    </Card>
  );
}

export default ExpectedItemCard;
