/**
 * ShipmentItemRow Component
 * Inline editable row for shipment items with expandable details
 * - Tap row to expand and edit
 * - Flags section for received items
 * - Duplicate item functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Skeleton } from '@/components/ui/skeleton';

import { supabase } from '@/integrations/supabase/client';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { useServiceEvents, ServiceEvent } from '@/hooks/useServiceEvents';
import { useAuth } from '@/contexts/AuthContext';
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
  onDuplicate?: (item: ShipmentItem) => void;
  isInbound: boolean;
  isCompleted: boolean;
}

export function ShipmentItemRow({
  item,
  isSelected,
  onSelect,
  onUpdate,
  onDuplicate,
  isInbound,
  isCompleted,
}: ShipmentItemRowProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editDescription, setEditDescription] = useState(item.expected_description || '');
  const [editVendor, setEditVendor] = useState(item.expected_vendor || '');
  const [editSidemark, setEditSidemark] = useState(item.expected_sidemark || '');
  const [editQuantity, setEditQuantity] = useState(item.expected_quantity?.toString() || '1');

  // Flags state (only for received items)
  const [enabledFlags, setEnabledFlags] = useState<Set<string>>(new Set());
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null);

  // Field suggestions
  const { suggestions: vendorSuggestions, addOrUpdateSuggestion: addVendorSuggestion } = useFieldSuggestions('vendor');
  const { suggestions: descriptionSuggestions, addOrUpdateSuggestion: addDescSuggestion } = useFieldSuggestions('description');

  // Get flag services from price list
  const { flagServiceEvents, getServiceRate, loading: serviceEventsLoading } = useServiceEvents();

  // Fetch enabled flags when expanded and item has been received
  useEffect(() => {
    if (isExpanded && item.item_id && profile?.tenant_id) {
      fetchEnabledFlags();
    }
  }, [isExpanded, item.item_id, profile?.tenant_id]);

  const fetchEnabledFlags = async () => {
    if (!item.item_id || !profile?.tenant_id) return;
    setLoadingFlags(true);
    try {
      const { data, error } = await (supabase
        .from('billing_events') as any)
        .select('charge_type')
        .eq('item_id', item.item_id)
        .eq('event_type', 'flag')
        .in('status', ['flagged', 'unbilled']);

      if (!error && data) {
        setEnabledFlags(new Set(data.map((d: any) => d.charge_type)));
      }
    } catch (error) {
      console.error('Error fetching flags:', error);
    } finally {
      setLoadingFlags(false);
    }
  };

  const handleFlagToggle = async (service: ServiceEvent, currentlyEnabled: boolean) => {
    if (!item.item_id || !profile?.tenant_id) return;
    setUpdatingFlag(service.service_code);

    try {
      if (currentlyEnabled) {
        // Remove the flag billing event
        await (supabase.from('billing_events') as any)
          .delete()
          .eq('item_id', item.item_id)
          .eq('charge_type', service.service_code)
          .eq('event_type', 'flag')
          .in('status', ['flagged', 'unbilled']);

        setEnabledFlags(prev => {
          const next = new Set(prev);
          next.delete(service.service_code);
          return next;
        });
        toast({ title: `${service.service_name} removed` });
      } else {
        // Get item details for billing event
        const { data: itemData } = await (supabase.from('items') as any)
          .select('account_id, sidemark_id, class:classes(code)')
          .eq('id', item.item_id)
          .single();

        const classCode = itemData?.class?.code || null;
        const rateInfo = getServiceRate(service.service_code, classCode);

        // Create billing event for the flag
        await (supabase.from('billing_events') as any)
          .insert({
            tenant_id: profile.tenant_id,
            account_id: itemData?.account_id,
            item_id: item.item_id,
            sidemark_id: itemData?.sidemark_id || null,
            event_type: 'flag',
            charge_type: service.service_code,
            description: service.service_name,
            quantity: 1,
            unit_rate: rateInfo.rate,
            status: 'unbilled',
            created_by: profile.id,
            has_rate_error: rateInfo.hasError,
            rate_error_message: rateInfo.errorMessage,
          });

        setEnabledFlags(prev => new Set([...prev, service.service_code]));
        toast({ title: `${service.service_name} added` });
      }
    } catch (error) {
      console.error('Error toggling flag:', error);
      toast({ title: 'Error', description: 'Failed to update flag', variant: 'destructive' });
    } finally {
      setUpdatingFlag(null);
    }
  };

  // Handle row tap to expand
  const handleRowTap = useCallback((e: React.MouseEvent) => {
    // Don't expand if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[role="checkbox"]')) {
      return;
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

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

  const handleItemCodeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.item_id) {
      navigate(`/inventory/${item.item_id}`);
    }
  }, [item.item_id, navigate]);

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDuplicate) {
      onDuplicate(item);
    }
  }, [onDuplicate, item]);

  const canEdit = isInbound && !isCompleted;

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50 transition-colors",
          isEditing && "bg-muted/30",
          isExpanded && "bg-muted/20"
        )}
        onClick={handleRowTap}
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
                onClick={handleItemCodeClick}
              >
                {item.item?.item_code || '-'}
              </span>
            </ItemPreviewCard>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>

        {/* Vendor */}
        <TableCell className="w-32" onClick={isEditing ? (e) => e.stopPropagation() : undefined}>
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
        <TableCell className="min-w-[180px]" onClick={isEditing ? (e) => e.stopPropagation() : undefined}>
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
          <div className="flex items-center gap-1">
            {/* Show flags indicator if item has flags */}
            {item.item_id && enabledFlags.size > 0 && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 text-[10px] px-1">
                <MaterialIcon name="flag" size="xs" />
                {enabledFlags.size}
              </Badge>
            )}
            {/* Expand indicator */}
            <MaterialIcon
              name={isExpanded ? "expand_less" : "expand_more"}
              size="sm"
              className="text-muted-foreground"
            />
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      {isExpanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={9} className="p-4">
            <div className="space-y-4">
              {/* Edit Section */}
              {canEdit && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Edit Item</span>
                    {!isEditing ? (
                      <Button variant="outline" size="sm" onClick={handleStartEdit}>
                        <MaterialIcon name="edit" size="sm" className="mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? (
                            <MaterialIcon name="progress_activity" size="sm" className="mr-1 animate-spin" />
                          ) : (
                            <MaterialIcon name="save" size="sm" className="mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Description</label>
                        <AutocompleteInput
                          value={editDescription}
                          onChange={setEditDescription}
                          suggestions={descriptionSuggestions}
                          placeholder="Description"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Vendor</label>
                        <AutocompleteInput
                          value={editVendor}
                          onChange={setEditVendor}
                          suggestions={vendorSuggestions}
                          placeholder="Vendor"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Sidemark</label>
                        <Input
                          value={editSidemark}
                          onChange={(e) => setEditSidemark(e.target.value)}
                          placeholder="Sidemark"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Quantity</label>
                        <Input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          min="1"
                          className="h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info Section (when not editing) */}
              {!isEditing && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Sidemark</span>
                    <p className="font-medium text-sm">{item.expected_sidemark || '-'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Expected Qty</span>
                    <p className="font-medium text-sm">{item.expected_quantity || 1}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p className="font-medium text-sm">{item.status}</p>
                  </div>
                </div>
              )}

              {/* Flags Section (only for received items) */}
              {item.item_id && flagServiceEvents.length > 0 && (
                <div className="border-t pt-4">
                  <span className="text-sm font-medium">Flags</span>
                  <p className="text-xs text-muted-foreground mb-2">Add flags to this item for billing</p>
                  {loadingFlags || serviceEventsLoading ? (
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {flagServiceEvents.map((service) => {
                        const isEnabled = enabledFlags.has(service.service_code);
                        const isUpdating = updatingFlag === service.service_code;
                        return (
                          <Button
                            key={service.id}
                            variant={isEnabled ? "default" : "outline"}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFlagToggle(service, isEnabled);
                            }}
                            disabled={isUpdating}
                            className={cn(
                              "text-xs",
                              isEnabled && "bg-amber-500 hover:bg-amber-600 text-white"
                            )}
                          >
                            {isUpdating ? (
                              <MaterialIcon name="progress_activity" size="sm" className="mr-1 animate-spin" />
                            ) : isEnabled ? (
                              <MaterialIcon name="flag" size="sm" className="mr-1" />
                            ) : (
                              <MaterialIcon name="outlined_flag" size="sm" className="mr-1" />
                            )}
                            {service.service_name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-4 flex flex-wrap gap-2">
                {item.item_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleItemCodeClick}
                  >
                    <MaterialIcon name="visibility" size="sm" className="mr-1" />
                    View Item
                  </Button>
                )}
                {canEdit && onDuplicate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDuplicate}
                  >
                    <MaterialIcon name="content_copy" size="sm" className="mr-1" />
                    Duplicate
                  </Button>
                )}
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground self-center">
                  ID: {item.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
