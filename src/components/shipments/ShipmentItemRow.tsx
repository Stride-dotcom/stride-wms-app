/**
 * ShipmentItemRow Component
 * Inline editable row for shipment items with expandable details
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';

import { supabase } from '@/integrations/supabase/client';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useToast } from '@/hooks/use-toast';
import { ItemPreviewCard } from '@/components/items/ItemPreviewCard';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { cn } from '@/lib/utils';

interface ShipmentItem {
  id: string;
  item_id: string | null;
  expected_description: string | null;
  expected_vendor: string | null;
  expected_sidemark: string | null;
  expected_quantity: number | null;
  actual_quantity: number | null;
  status: string;
  item?: {
    item_code: string;
    description: string | null;
    vendor: string | null;
  } | null;
}

interface ShipmentItemRowProps {
  item: ShipmentItem;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onUpdate: () => void;
  isInbound: boolean;
  isCompleted: boolean;
}

export function ShipmentItemRow({
  item,
  isSelected,
  onSelect,
  onUpdate,
  isInbound,
  isCompleted,
}: ShipmentItemRowProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editDescription, setEditDescription] = useState(item.expected_description || '');
  const [editVendor, setEditVendor] = useState(item.expected_vendor || '');
  const [editSidemark, setEditSidemark] = useState(item.expected_sidemark || '');
  const [editQuantity, setEditQuantity] = useState(item.expected_quantity?.toString() || '1');

  // Field suggestions
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: addDescSuggestion } = useFieldSuggestions('description');

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) return;
    setIsEditing(true);
    setEditDescription(item.expected_description || '');
    setEditVendor(item.expected_vendor || '');
    setEditSidemark(item.expected_sidemark || '');
    setEditQuantity(item.expected_quantity?.toString() || '1');
  }, [item, isCompleted]);

  const handleCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);

    try {
      const { error } = await (supabase.from('shipment_items') as any)
        .update({
          expected_description: editDescription || null,
          expected_vendor: editVendor || null,
          expected_sidemark: editSidemark || null,
          expected_quantity: parseInt(editQuantity) || 1,
        })
        .eq('id', item.id);

      if (error) throw error;

      // Record field usage for autocomplete
      if (editVendor) addVendorSuggestion(editVendor);
      if (editDescription) addDescSuggestion(editDescription);

      setIsEditing(false);
      onUpdate();
      toast({ title: 'Item updated' });
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [item.id, editDescription, editVendor, editSidemark, editQuantity, onUpdate, addVendorSuggestion, addDescSuggestion, toast]);

  const handleRowClick = useCallback(() => {
    if (item.item_id && !isEditing) {
      navigate(`/inventory/${item.item_id}`);
    }
  }, [item.item_id, isEditing, navigate]);

  const canEdit = isInbound && !isCompleted;

  return (
    <>
      <TableRow 
        className={cn(
          isEditing && "bg-muted/30",
          item.item_id && !isEditing && "cursor-pointer hover:bg-muted/50",
          !item.item_id && "cursor-default"
        )}
        onClick={!isEditing ? handleRowClick : undefined}
      >
        {/* Select checkbox */}
        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
          {item.item_id && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(!!checked)}
              aria-label={`Select ${item.item?.item_code || 'item'}`}
            />
          )}
        </TableCell>

        {/* Expand toggle */}
        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <MaterialIcon name="expand_more" size="sm" />
            ) : (
              <MaterialIcon name="chevron_right" size="sm" />
            )}
          </Button>
        </TableCell>

        {/* Item Code */}
        <TableCell className="w-28 font-medium">
          {item.item_id ? (
            <ItemPreviewCard itemId={item.item_id}>
              <span 
                className="text-primary hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowClick();
                }}
              >
                {item.item?.item_code || '-'}
              </span>
            </ItemPreviewCard>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>

        {/* Vendor */}
        <TableCell className="w-32" onClick={isEditing ? (e) => e.stopPropagation() : handleRowClick}>
          {isEditing ? (
            <AutocompleteInput
              value={editVendor}
              onChange={setEditVendor}
              suggestions={vendorSuggestions}
              placeholder="Vendor"
              className="h-8"
            />
          ) : (
            item.item?.vendor || item.expected_vendor || '-'
          )}
        </TableCell>

        {/* Description */}
        <TableCell className="min-w-[180px]" onClick={isEditing ? (e) => e.stopPropagation() : handleRowClick}>
          {isEditing ? (
            <AutocompleteInput
              value={editDescription}
              onChange={setEditDescription}
              suggestions={descriptionSuggestions}
              placeholder="Description"
              className="h-8"
            />
          ) : (
            item.item?.description || item.expected_description || '-'
          )}
        </TableCell>

        {/* Expected Qty */}
        <TableCell className="w-28 text-right" onClick={isEditing ? (e) => e.stopPropagation() : undefined}>
          {isEditing ? (
            <Input
              type="number"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              className="h-8 w-20 text-right"
              min="1"
            />
          ) : (
            item.expected_quantity || '-'
          )}
        </TableCell>

        {/* Received Qty */}
        <TableCell className="w-28 text-right">
          {item.actual_quantity || '-'}
        </TableCell>

        {/* Status */}
        <TableCell className="w-24">
          <Badge variant="outline">{item.status}</Badge>
        </TableCell>

        {/* Actions */}
        <TableCell className="w-16" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                    ) : (
                      <MaterialIcon name="save" size="sm" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <MaterialIcon name="close" size="sm" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStartEdit}
                >
                  <MaterialIcon name="edit" size="sm" />
                </Button>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/30">
          <TableCell colSpan={9} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-xs text-muted-foreground">Sidemark</span>
                {isEditing ? (
                  <Input
                    value={editSidemark}
                    onChange={(e) => setEditSidemark(e.target.value)}
                    placeholder="Sidemark"
                    className="h-8 mt-1"
                  />
                ) : (
                  <p className="font-medium">{item.expected_sidemark || '-'}</p>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Shipment Item ID</span>
                <p className="font-mono text-xs">{item.id}</p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
