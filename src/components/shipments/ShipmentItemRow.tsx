/**
 * ShipmentItemRow Component
 * Inline editable row for shipment items with expandable details
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { ItemTypeCombobox } from '@/components/items/ItemTypeCombobox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronRight, Loader2, Save, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemType {
  id: string;
  name: string;
}

interface ShipmentItem {
  id: string;
  item_id: string | null;
  expected_description: string | null;
  expected_vendor: string | null;
  expected_sidemark: string | null;
  expected_item_type_id: string | null;
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
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  
  // Edit state
  const [editDescription, setEditDescription] = useState(item.expected_description || '');
  const [editVendor, setEditVendor] = useState(item.expected_vendor || '');
  const [editSidemark, setEditSidemark] = useState(item.expected_sidemark || '');
  const [editItemTypeId, setEditItemTypeId] = useState(item.expected_item_type_id || '');
  const [editQuantity, setEditQuantity] = useState(item.expected_quantity?.toString() || '1');
  
  // Field suggestions
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: addDescSuggestion } = useFieldSuggestions('description');

  // Fetch item types
  useEffect(() => {
    const fetchItemTypes = async () => {
      if (!profile?.tenant_id) return;
      const { data } = await supabase
        .from('item_types')
        .select('id, name')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('name');
      setItemTypes(data || []);
    };
    fetchItemTypes();
  }, [profile?.tenant_id]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) return;
    setIsEditing(true);
    setEditDescription(item.expected_description || '');
    setEditVendor(item.expected_vendor || '');
    setEditSidemark(item.expected_sidemark || '');
    setEditItemTypeId(item.expected_item_type_id || '');
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
          expected_item_type_id: editItemTypeId || null,
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
  }, [item.id, editDescription, editVendor, editSidemark, editItemTypeId, editQuantity, onUpdate, addVendorSuggestion, addDescSuggestion, toast]);

  const handleRowClick = useCallback(() => {
    if (item.item_id && !isEditing) {
      navigate(`/inventory/${item.item_id}`);
    }
  }, [item.item_id, isEditing, navigate]);

  const canEdit = isInbound && !isCompleted;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <TableRow 
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          isEditing && "bg-muted/30"
        )}
      >
        {/* Select checkbox */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          {item.item_id && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(!!checked)}
              aria-label={`Select ${item.item?.item_code || 'item'}`}
            />
          )}
        </TableCell>

        {/* Expand toggle */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>

        {/* Item Code */}
        <TableCell 
          className="font-medium"
          onClick={handleRowClick}
        >
          {item.item?.item_code || '-'}
        </TableCell>

        {/* Description */}
        <TableCell onClick={isEditing ? (e) => e.stopPropagation() : handleRowClick}>
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

        {/* Vendor */}
        <TableCell onClick={isEditing ? (e) => e.stopPropagation() : handleRowClick}>
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

        {/* Expected Qty */}
        <TableCell className="text-right" onClick={isEditing ? (e) => e.stopPropagation() : undefined}>
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
        <TableCell className="text-right">
          {item.actual_quantity || '-'}
        </TableCell>

        {/* Status */}
        <TableCell>
          <Badge variant="outline">{item.status}</Badge>
        </TableCell>

        {/* Actions */}
        <TableCell onClick={(e) => e.stopPropagation()}>
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
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStartEdit}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/20 hover:bg-muted/30">
          <TableCell colSpan={9} className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
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
                <span className="text-xs text-muted-foreground">Item Type</span>
                {isEditing ? (
                  <div className="mt-1">
                    <ItemTypeCombobox
                      itemTypes={itemTypes}
                      value={editItemTypeId}
                      onChange={setEditItemTypeId}
                    />
                  </div>
                ) : (
                  <p className="font-medium">{item.expected_item_type_id ? 'Set' : '-'}</p>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Shipment Item ID</span>
                <p className="font-mono text-xs">{item.id}</p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}
