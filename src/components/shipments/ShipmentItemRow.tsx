/**
 * ShipmentItemRow Component
 * Row for shipment items with:
 * - Inline editable fields for pending items (not yet received)
 * - Tap row to expand and show flags (for received items)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';

import { supabase } from '@/integrations/supabase/client';
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
  expected_class_id: string | null;
  expected_quantity: number | null;
  actual_quantity: number | null;
  status: string;
  item?: {
    item_code: string;
    description: string | null;
    vendor: string | null;
    sidemark: string | null;
    room: string | null;
    class_id: string | null;
    current_location?: {
      code: string;
    } | null;
    class?: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  expected_class?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

interface ClassOption {
  id: string;
  code: string;
  name: string;
}

interface ShipmentItemRowProps {
  item: ShipmentItem;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onUpdate: () => void;
  onDelete?: (item: ShipmentItem) => void;
  onDuplicate?: (item: ShipmentItem) => void;
  isInbound: boolean;
  isCompleted: boolean;
  classes?: ClassOption[];
  accountId?: string;
}

export function ShipmentItemRow({
  item,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  isInbound,
  isCompleted,
  classes = [],
  accountId,
}: ShipmentItemRowProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  // Inline edit state - tracks local values
  const [vendor, setVendor] = useState(item.expected_vendor || '');
  const [description, setDescription] = useState(item.expected_description || '');
  const [quantity, setQuantity] = useState(item.expected_quantity?.toString() || '1');
  const [selectedClass, setSelectedClass] = useState(
    item.expected_class?.code || item.item?.class?.code || ''
  );
  const [sidemark, setSidemark] = useState(item.item?.sidemark || item.expected_sidemark || '');

  // Refs to track latest values for blur handlers (avoids stale closure issues)
  const selectedClassRef = useRef(selectedClass);
  const sidemarkRef = useRef(sidemark);

  // Track if we're currently saving
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipNextSyncRef = useRef(false); // Track if we should skip next prop sync

  // Flags state (only for received items)
  const [enabledFlags, setEnabledFlags] = useState<Set<string>>(new Set());
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null);

  // Get flag services from price list
  const { flagServiceEvents, getServiceRate, loading: serviceEventsLoading } = useServiceEvents();

  // Sync local state when item prop changes, but NOT during a save
  useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return; // Skip this sync - we just saved and don't want to revert
    }
    setVendor(item.expected_vendor || '');
    setDescription(item.expected_description || '');
    setQuantity(item.expected_quantity?.toString() || '1');
    const classValue = item.expected_class?.code || item.item?.class?.code || '';
    const sidemarkValue = item.item?.sidemark || item.expected_sidemark || '';
    setSelectedClass(classValue);
    setSidemark(sidemarkValue);
    selectedClassRef.current = classValue;
    sidemarkRef.current = sidemarkValue;
  }, [item.expected_vendor, item.expected_description, item.expected_quantity, item.expected_class, item.item?.class, item.item?.sidemark, item.expected_sidemark]);

  // Keep refs in sync with state changes
  useEffect(() => {
    selectedClassRef.current = selectedClass;
  }, [selectedClass]);

  useEffect(() => {
    sidemarkRef.current = sidemark;
  }, [sidemark]);

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

  // Auto-save function for pending (expected) items - updates shipment_items table
  const saveField = useCallback(async (field: string, value: string) => {
    if (item.item_id) return; // For received items, use saveReceivedItemField instead

    const updateData: Record<string, any> = {};
    if (field === 'vendor') updateData.expected_vendor = value || null;
    if (field === 'description') updateData.expected_description = value || null;
    if (field === 'quantity') updateData.expected_quantity = parseInt(value) || 1;
    if (field === 'sidemark') updateData.expected_sidemark = value || null;
    if (field === 'class') {
      // Find the class ID from the code
      const matchedClass = classes.find(c => c.code === value);
      updateData.expected_class_id = matchedClass?.id || null;
    }

    setSaving(true);
    skipNextSyncRef.current = true; // Prevent useEffect from reverting value
    try {
      const { error } = await (supabase.from('shipment_items') as any)
        .update(updateData)
        .eq('id', item.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating item:', error);
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
      skipNextSyncRef.current = false; // Re-enable sync on error
    } finally {
      setSaving(false);
    }
  }, [item.id, item.item_id, classes, onUpdate, toast]);

  // Save function for received items - updates items table (for class and sidemark)
  const saveReceivedItemField = useCallback(async (field: string, value: string) => {
    if (!item.item_id) return; // Only for received items

    const updateData: Record<string, any> = {};
    if (field === 'class') {
      const matchedClass = classes.find(c => c.code === value);
      updateData.class_id = matchedClass?.id || null;
    }
    if (field === 'sidemark') {
      updateData.sidemark = value || null;
    }

    setSaving(true);
    skipNextSyncRef.current = true; // Prevent useEffect from reverting value
    try {
      const { error } = await (supabase.from('items') as any)
        .update(updateData)
        .eq('id', item.item_id);

      if (error) throw error;
      onUpdate();
      toast({ title: 'Item Updated' });
    } catch (error) {
      console.error('Error updating received item:', error);
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
      skipNextSyncRef.current = false; // Re-enable sync on error
    } finally {
      setSaving(false);
    }
  }, [item.item_id, classes, onUpdate, toast]);

  // Delete shipment item with audit logging
  const handleDelete = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setDeleting(true);
    try {
      // Log to audit before deletion
      await (supabase.from('admin_audit_log') as any).insert({
        tenant_id: profile.tenant_id,
        actor_id: profile.id,
        entity_type: 'shipment_item',
        entity_id: item.id,
        action: 'delete',
        changes: {
          deleted_item: {
            expected_description: item.expected_description,
            expected_vendor: item.expected_vendor,
            expected_quantity: item.expected_quantity,
            expected_class_id: item.expected_class_id,
            status: item.status,
          }
        }
      });

      // Delete the shipment item
      const { error } = await (supabase.from('shipment_items') as any)
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast({ title: 'Item Removed', description: 'Item has been removed from shipment' });
      onDelete?.(item);
      onUpdate();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({ title: 'Error', description: 'Failed to remove item', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }, [item, profile, onDelete, onUpdate, toast]);

  // Handle blur - save the field (routes to correct save function based on item state)
  const handleBlur = useCallback((field: string, value: string) => {
    // Clear any pending timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    // For class and sidemark, use refs to get the latest value (avoids stale closure)
    const actualValue = field === 'class' ? selectedClassRef.current :
                        field === 'sidemark' ? sidemarkRef.current : value;

    // Save after a short delay to allow for tab navigation
    saveTimeoutRef.current = setTimeout(() => {
      if (item.item_id && (field === 'class' || field === 'sidemark')) {
        // For received items, update the items table
        saveReceivedItemField(field, actualValue);
      } else {
        // For pending items, update shipment_items table
        saveField(field, actualValue);
      }
    }, 200);
  }, [item.item_id, saveField, saveReceivedItemField]);

  // Handle class change - save immediately for live pricing update
  const handleClassChange = useCallback((value: string) => {
    setSelectedClass(value);
    selectedClassRef.current = value;

    // Clear any pending blur timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save immediately when a valid class is selected (not when clearing/typing)
    const matchedClass = classes.find(c => c.code === value);
    if (matchedClass) {
      // Debounce slightly to avoid rapid saves while typing
      saveTimeoutRef.current = setTimeout(() => {
        if (item.item_id) {
          saveReceivedItemField('class', value);
        } else {
          saveField('class', value);
        }
      }, 100);
    }
  }, [classes, item.item_id, saveField, saveReceivedItemField]);

  const handleFlagToggle = async (service: ServiceEvent, currentlyEnabled: boolean) => {
    if (!item.item_id || !profile?.tenant_id) return;
    setUpdatingFlag(service.service_code);

    try {
      if (currentlyEnabled) {
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
        const { data: itemData } = await (supabase.from('items') as any)
          .select('account_id, sidemark_id, class:classes(code)')
          .eq('id', item.item_id)
          .single();

        const classCode = itemData?.class?.code || null;
        const rateInfo = getServiceRate(service.service_code, classCode);

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

  const handleRowTap = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[role="checkbox"]')) {
      return;
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleItemCodeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.item_id) {
      navigate(`/inventory/${item.item_id}`);
    }
  }, [item.item_id, navigate]);

  // Can edit pending item fields if inbound, not completed, and item not yet received
  const canEditPending = isInbound && !isCompleted && !item.item_id;
  // Can edit class/sidemark on received items if not completed
  const canEditReceived = isInbound && !isCompleted && !!item.item_id;
  // Can delete pending items (not yet received)
  const canDelete = isInbound && !isCompleted && !item.item_id;

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50 transition-colors",
          isExpanded && "bg-amber-50/30 dark:bg-amber-950/10"
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
            <MaterialIcon
              name={isExpanded ? "expand_less" : "expand_more"}
              size="sm"
            />
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
            <span className="text-muted-foreground italic text-xs">pending</span>
          )}
        </TableCell>

        {/* Qty - shows expected for pending, received for received items */}
        <TableCell className="w-20 text-right" onClick={(e) => canEditPending && e.stopPropagation()}>
          {canEditPending ? (
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={() => handleBlur('quantity', quantity)}
              min="1"
              className="h-7 w-16 text-sm text-right border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input ml-auto"
            />
          ) : (
            <span className="text-sm">
              {item.item_id ? (item.actual_quantity || '-') : (item.expected_quantity || '-')}
            </span>
          )}
        </TableCell>

        {/* Vendor - editable for pending items */}
        <TableCell className="w-32" onClick={(e) => canEditPending && e.stopPropagation()}>
          {canEditPending ? (
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              onBlur={() => handleBlur('vendor', vendor)}
              placeholder="Vendor"
              className="h-7 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
            />
          ) : (
            <span className="text-sm">{item.item?.vendor || item.expected_vendor || '-'}</span>
          )}
        </TableCell>

        {/* Description - editable for pending items */}
        <TableCell className="min-w-[140px]" onClick={(e) => canEditPending && e.stopPropagation()}>
          {canEditPending ? (
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => handleBlur('description', description)}
              placeholder="Description"
              className="h-7 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
            />
          ) : (
            <span className="text-sm">{item.item?.description || item.expected_description || '-'}</span>
          )}
        </TableCell>

        {/* Location - read-only, only for received items */}
        <TableCell className="w-24">
          <span className="text-sm">
            {item.item?.current_location?.code || '-'}
          </span>
        </TableCell>

        {/* Class - editable for pending AND received items with autocomplete */}
        <TableCell className="w-24" onClick={(e) => (canEditPending || canEditReceived) && e.stopPropagation()}>
          {(canEditPending || canEditReceived) ? (
            <AutocompleteInput
              value={selectedClass}
              onChange={handleClassChange}
              suggestions={classes.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
              placeholder="Class"
              className="h-7 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
            />
          ) : (
            <span className="text-sm">
              {item.item?.class?.code || item.expected_class?.code || '-'}
            </span>
          )}
        </TableCell>

        {/* Sidemark - editable for pending AND received items */}
        <TableCell className="w-28" onClick={(e) => (canEditPending || canEditReceived) && e.stopPropagation()}>
          {(canEditPending || canEditReceived) ? (
            <Input
              value={sidemark}
              onChange={(e) => setSidemark(e.target.value)}
              onBlur={() => handleBlur('sidemark', sidemark)}
              placeholder="Sidemark"
              className="h-7 text-sm border-transparent bg-transparent hover:bg-muted/50 focus:bg-background focus:border-input"
            />
          ) : (
            <span className="text-sm">
              {item.item?.sidemark || item.expected_sidemark || '-'}
            </span>
          )}
        </TableCell>

        {/* Room - only for received items */}
        <TableCell className="w-24">
          <span className="text-sm">
            {item.item?.room || '-'}
          </span>
        </TableCell>

        {/* Status */}
        <TableCell className="w-24">
          <Badge variant="outline" className="text-xs">{item.status}</Badge>
          {saving && (
            <MaterialIcon name="progress_activity" size="sm" className="ml-1 animate-spin inline" />
          )}
        </TableCell>

        {/* Actions */}
        <TableCell className="w-24" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {/* Duplicate button for pending items */}
            {canEditPending && onDuplicate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(item);
                }}
                title="Duplicate item"
              >
                <MaterialIcon name="content_copy" size="sm" className="text-muted-foreground" />
              </Button>
            )}
            {/* Delete button for pending items */}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={deleting}
                title="Remove item"
              >
                {deleting ? (
                  <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                ) : (
                  <MaterialIcon name="delete" size="sm" />
                )}
              </Button>
            )}
            {/* Show flags indicator if item has flags */}
            {item.item_id && enabledFlags.size > 0 && (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 text-[10px] px-1">
                <MaterialIcon name="flag" size="sm" className="text-[10px]" />
                {enabledFlags.size}
              </Badge>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Row - ONLY shows flags */}
      {isExpanded && (
        <TableRow className="bg-amber-50/50 dark:bg-amber-950/20">
          <TableCell colSpan={11} className="py-2 px-4">
            {item.item_id ? (
              // Item has been received - show flags
              loadingFlags || serviceEventsLoading ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-28" />
                </div>
              ) : flagServiceEvents.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  {flagServiceEvents.map((service) => {
                    const isEnabled = enabledFlags.has(service.service_code);
                    const isUpdating = updatingFlag === service.service_code;
                    return (
                      <label
                        key={service.id}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer select-none py-1",
                          isUpdating && "opacity-50"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={() => handleFlagToggle(service, isEnabled)}
                          disabled={isUpdating}
                          className={cn(
                            "h-5 w-5",
                            isEnabled && "bg-amber-500 border-amber-500 data-[state=checked]:bg-amber-500"
                          )}
                        />
                        <span className={cn(
                          "text-sm",
                          isEnabled ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                        )}>
                          {service.service_name}
                        </span>
                        {isUpdating && (
                          <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No flags configured in Price List</p>
              )
            ) : (
              // Item not yet received - show duplicate button
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <MaterialIcon name="schedule" size="sm" className="inline mr-1 align-text-bottom" />
                  Flags available after item is received
                </p>
                {onDuplicate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(item);
                    }}
                    className="gap-1"
                  >
                    <MaterialIcon name="content_copy" size="sm" />
                    Duplicate
                  </Button>
                )}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
