import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useUnidentifiedAccount } from '@/hooks/useUnidentifiedAccount';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activity/logActivity';
import { queueUnidentifiedIntakeCompletedAlert } from '@/lib/alertQueue';
import { AddFromManifestSelector } from './AddFromManifestSelector';
import { ShipmentExceptionBadge } from '@/components/shipments/ShipmentExceptionBadge';

interface ReceivedItem {
  id: string;
  shipment_item_id?: string;
  description: string;
  expected_quantity: number;
  received_quantity: number;
  vendor: string;
  sidemark: string;
  class_id: string | null;
  sourceType: 'manual' | 'manifest';
  sourceShipmentItemId?: string;
  allocationId?: string;
  packages: number; // 0 = no container, 1 = single, 2+ = multi-package
}

const ARRIVAL_NO_ID_FLAG = 'ARRIVAL_NO_ID';

export interface ItemMatchingParams {
  itemDescription: string | null;
  itemVendor: string | null;
}

interface Stage2DetailedReceivingProps {
  shipmentId: string;
  shipmentNumber: string;
  exceptionCount?: number;
  shipment: {
    account_id: string | null;
    warehouse_id: string | null;
    signed_pieces: number | null;
    vendor_name: string | null;
    sidemark_id: string | null;
    shipment_exception_type?: string | null;
  };
  onComplete: () => void;
  onRefresh: () => void;
  /** Called when item details change to refine matching panel candidates */
  onItemMatchingParamsChange?: (params: ItemMatchingParams) => void;
  onOpenExceptions?: () => void;
}

export function Stage2DetailedReceiving({
  shipmentId,
  shipmentNumber,
  exceptionCount,
  shipment,
  onComplete,
  onRefresh,
  onItemMatchingParamsChange,
  onOpenExceptions,
}: Stage2DetailedReceivingProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const { ensureUnidentifiedAccount } = useUnidentifiedAccount();

  // Items
  const [items, setItems] = useState<ReceivedItem[]>([]);
  const [receivedPieces, setReceivedPieces] = useState<number>(0);

  // Emit item-level matching params whenever items change
  useEffect(() => {
    if (!onItemMatchingParamsChange) return;

    // Aggregate unique descriptions and vendors from current items for matching refinement
    const descriptions = items
      .map((i) => i.description.trim())
      .filter((d) => d.length >= 2);
    const vendors = items
      .map((i) => i.vendor.trim())
      .filter((v) => v.length >= 2);

    // Use the most recently entered (last) non-empty value for each — that's what the user is actively typing
    const lastDescription = descriptions.length > 0 ? descriptions[descriptions.length - 1] : null;
    const lastVendor = vendors.length > 0 ? vendors[vendors.length - 1] : null;

    onItemMatchingParamsChange({
      itemDescription: lastDescription,
      itemVendor: lastVendor,
    });
  }, [items, onItemMatchingParamsChange]);

  // Manifest selector
  const [showManifestSelector, setShowManifestSelector] = useState(false);
  const [showMatchingPanel, setShowMatchingPanel] = useState(false);

  // Admin override
  const [showAdminOverride, setShowAdminOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Container placement prompt
  const [containerPromptItemId, setContainerPromptItemId] = useState<string | null>(null);
  const [containerPromptQty, setContainerPromptQty] = useState(0);
  const [customContainerCount, setCustomContainerCount] = useState(2);

  // Completing
  const [completing, setCompleting] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  // Load existing shipment items
  useEffect(() => {
    loadExistingItems();
  }, [shipmentId]);

  const loadExistingItems = async () => {
    if (!shipmentId) return;

    const { data, error } = await (supabase as any)
      .from('shipment_items')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Stage2] load items error:', error);
      return;
    }

    if (data && data.length > 0) {
      const mapped: ReceivedItem[] = data.map((item: any) => ({
        id: item.id,
        shipment_item_id: item.id,
        description: item.expected_description || '',
        expected_quantity: item.expected_quantity || 0,
        received_quantity: item.actual_quantity || item.expected_quantity || 0,
        vendor: item.expected_vendor || '',
        sidemark: item.expected_sidemark || '',
        class_id: item.expected_class_id || null,
        sourceType: 'manifest' as const,
        packages: 1,
      }));
      setItems(mapped);
      setReceivedPieces(mapped.reduce((sum, i) => sum + i.received_quantity, 0));
    }
  };

  // Add manual item
  const addManualItem = () => {
    const newItem: ReceivedItem = {
      id: crypto.randomUUID(),
      description: '',
      expected_quantity: 0,
      received_quantity: 1,
      vendor: shipment.vendor_name || '',
      sidemark: '',
      class_id: null,
      sourceType: 'manual',
      packages: 1,
    };
    setItems(prev => [...prev, newItem]);
  };

  // Add from manifest
  const handleAddFromManifest = (manifestItems: any[]) => {
    const newItems: ReceivedItem[] = manifestItems.map((item) => ({
      id: crypto.randomUUID(),
      shipment_item_id: undefined,
      description: item.expected_description || '',
      expected_quantity: item.expected_quantity || 0,
      received_quantity: item.expected_quantity || 0,
      vendor: item.expected_vendor || '',
      sidemark: item.expected_sidemark || '',
      class_id: item.expected_class_id || null,
      sourceType: 'manifest' as const,
      sourceShipmentItemId: item.id,
      packages: 1,
    }));
    setItems(prev => [...prev, ...newItems]);
    updateReceivedPieces([...items, ...newItems]);
  };

  // Update item field
  const updateItem = (id: string, field: keyof ReceivedItem, value: unknown) => {
    setItems(prev => {
      const updated = prev.map(i => (i.id === id ? { ...i, [field]: value } : i));
      if (field === 'received_quantity') {
        updateReceivedPieces(updated);
        // Show container placement prompt when qty > 1
        const qty = value as number;
        if (qty > 1) {
          setContainerPromptItemId(id);
          setContainerPromptQty(qty);
          setCustomContainerCount(Math.min(qty, 2));
        }
      }
      return updated;
    });
  };

  // Container placement handlers
  const applyContainerChoice = (itemId: string, packages: number) => {
    setItems(prev => prev.map(i => (i.id === itemId ? { ...i, packages } : i)));
    setContainerPromptItemId(null);
  };

  // Remove item (allocation-aware)
  const removeItem = async (item: ReceivedItem) => {
    // If sourced from allocation, reverse via deallocation RPC
    if (item.allocationId) {
      try {
        const { error } = await supabase.rpc('rpc_deallocate_manifest_item', {
          p_allocation_id: item.allocationId,
        });
        if (error) throw error;
      } catch (err: any) {
        console.error('[Stage2] deallocation error:', err);
        toast({
          variant: 'destructive',
          title: 'Deallocation Failed',
          description: err?.message || 'Failed to reverse allocation',
        });
        return;
      }
    }

    // If it's a persisted shipment_item, delete it
    if (item.shipment_item_id) {
      await (supabase as any)
        .from('shipment_items')
        .delete()
        .eq('id', item.shipment_item_id);
    }

    // Log audit
    if (profile?.tenant_id && profile?.id) {
      logActivity({
        entityType: 'shipment',
        tenantId: profile.tenant_id,
        entityId: shipmentId,
        actorUserId: profile.id,
        eventType: 'receiving_item_removed',
        eventLabel: 'Item removed during receiving',
        details: {
          description: item.description,
          quantity: item.received_quantity,
          source: item.sourceType,
          allocationReversed: !!item.allocationId,
        },
      });
    }

    setItems(prev => {
      const updated = prev.filter(i => i.id !== item.id);
      updateReceivedPieces(updated);
      return updated;
    });

    toast({ title: 'Removed', description: 'Item removed from receiving.' });
  };

  const updateReceivedPieces = (currentItems: ReceivedItem[]) => {
    const total = currentItems.reduce((sum, i) => sum + i.received_quantity, 0);
    setReceivedPieces(total);
  };

  // Validate before completion
  const validateCompletion = (): string[] => {
    const errors: string[] = [];
    if (receivedPieces <= 0) errors.push('Received pieces must be greater than 0');
    if (items.length === 0 && !isAdmin) {
      errors.push('At least 1 item line is required (admin can override)');
    }
    // Check all items have description and quantity
    for (const item of items) {
      if (!item.description.trim()) {
        errors.push('All items must have a description');
        break;
      }
      if (item.received_quantity <= 0) {
        errors.push('All items must have a quantity > 0');
        break;
      }
    }
    return errors;
  };

  // Handle complete button
  const handleCompleteClick = () => {
    const errors = validateCompletion();

    // Allow admin override if only issue is no items
    if (items.length === 0 && isAdmin) {
      setShowAdminOverride(true);
      return;
    }

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Complete',
        description: errors.join('. '),
      });
      return;
    }

    setShowCompleteDialog(true);
  };

  // Complete receiving
  const handleComplete = async (adminOverride: boolean = false) => {
    if (!profile?.tenant_id || !profile?.id) return;
    setCompleting(true);

    try {
      let autoApplyArrivalNoIdFlag = true;
      let unidentifiedAccountId: string | null = null;

      try {
        const { data: prefs } = await (supabase as any)
          .from('tenant_preferences')
          .select('auto_apply_arrival_no_id_flag')
          .eq('tenant_id', profile.tenant_id)
          .maybeSingle();

        if (prefs?.auto_apply_arrival_no_id_flag === false) {
          autoApplyArrivalNoIdFlag = false;
        }
      } catch (prefErr) {
        console.warn('[Stage2] failed to read auto_apply_arrival_no_id_flag:', prefErr);
      }

      unidentifiedAccountId = await ensureUnidentifiedAccount(profile.tenant_id);

      let effectiveShipmentAccountId = shipment.account_id;
      if (!effectiveShipmentAccountId && unidentifiedAccountId) {
        const { error: assignAccountErr } = await supabase
          .from('shipments')
          .update({ account_id: unidentifiedAccountId } as any)
          .eq('id', shipmentId);

        if (assignAccountErr) {
          console.warn('[Stage2] could not assign unidentified account to shipment:', assignAccountErr);
        } else {
          effectiveShipmentAccountId = unidentifiedAccountId;
        }
      }

      const isUnidentifiedShipment =
        !!unidentifiedAccountId && effectiveShipmentAccountId === unidentifiedAccountId;

      // Resolve default receiving location
      let receivingLocationId: string | null = null;
      try {
        const { data: locResult } = await supabase.rpc('rpc_resolve_receiving_location', {
          p_warehouse_id: shipment.warehouse_id || '',
          p_account_id: effectiveShipmentAccountId,
        });
        const loc = locResult as any;
        if (loc?.ok) receivingLocationId = loc.location_id;
      } catch {
        console.warn('[Stage2] could not resolve receiving location');
      }

      if (!receivingLocationId) {
        toast({
          variant: 'destructive',
          title: 'No Receiving Location',
          description: 'Could not resolve a default receiving location. Please configure one.',
        });
        setCompleting(false);
        return;
      }

      // Create/update shipment items, inventory units, containers, movements
      const touchedShipmentItemIds: string[] = [];
      for (const item of items) {
        // Create or update shipment_item
        let shipmentItemId = item.shipment_item_id;
        if (!shipmentItemId) {
          const { data: si, error: siErr } = await (supabase as any)
            .from('shipment_items')
            .insert({
              shipment_id: shipmentId,
              expected_description: item.description,
              expected_quantity: item.expected_quantity,
              actual_quantity: item.received_quantity,
              expected_vendor: item.vendor || null,
              expected_sidemark: item.sidemark || null,
              expected_class_id: item.class_id || null,
              status: 'received',
              received_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (siErr) {
            console.error('[Stage2] create shipment_item error:', siErr);
            continue;
          }
          shipmentItemId = si.id;
        } else {
          // Update existing
          await (supabase as any)
            .from('shipment_items')
            .update({
              actual_quantity: item.received_quantity,
              status: 'received',
              received_at: new Date().toISOString(),
            })
            .eq('id', shipmentItemId);
        }

        if (shipmentItemId) {
          touchedShipmentItemIds.push(shipmentItemId);
        }

        // Generate IC codes and create inventory_units
        const qty = item.received_quantity;
        const unitIds: string[] = [];

        for (let i = 0; i < qty; i++) {
          // Generate IC code
          const { data: icCode, error: icErr } = await supabase.rpc('generate_ic_code', {
            p_tenant_id: profile.tenant_id,
          });

          if (icErr || !icCode) {
            console.error('[Stage2] IC code generation error:', icErr);
            toast({
              variant: 'destructive',
              title: 'IC Code Error',
              description: 'Failed to generate inventory control code. Retry this item.',
            });
            continue;
          }

          // If the shipment is flagged MIS_SHIP or RETURN_TO_SENDER, quarantine units
          const unitStatus =
            shipment.shipment_exception_type === 'MIS_SHIP' ||
            shipment.shipment_exception_type === 'RETURN_TO_SENDER'
              ? 'QUARANTINE'
              : 'active';

          const { data: unit, error: unitErr } = await (supabase as any)
            .from('inventory_units')
            .insert({
              tenant_id: profile.tenant_id,
              account_id: effectiveShipmentAccountId,
              ic_code: icCode,
              location_id: receivingLocationId,
              shipment_id: shipmentId,
              shipment_item_id: shipmentItemId,
              status: unitStatus,
              created_by: profile.id,
            })
            .select('id')
            .single();

          if (unitErr) {
            console.error('[Stage2] create unit error:', unitErr);
            continue;
          }

          unitIds.push(unit.id);

          // Create inventory_movement for this unit
          await (supabase as any)
            .from('inventory_movements')
            .insert({
              tenant_id: profile.tenant_id,
              unit_id: unit.id,
              movement_type: 'RECEIVED',
              to_location_id: receivingLocationId,
              created_by: profile.id,
            });
        }

        // Container creation logic
        if (item.packages === 0 || qty === 1) {
          // qty=1: no container needed (Scenario C)
          // packages=0: skip containers
        } else if (item.packages === 1) {
          // Scenario A: single container for all units
          if (unitIds.length > 1) {
            const { data: containerCode } = await supabase.rpc('generate_ic_code', {
              p_tenant_id: profile.tenant_id,
            });

            const { data: container, error: containerErr } = await (supabase as any)
              .from('containers')
              .insert({
                tenant_id: profile.tenant_id,
                container_code: containerCode || `CTN-${Date.now()}`,
                container_type: 'Carton',
                location_id: receivingLocationId,
                warehouse_id: shipment.warehouse_id,
                status: 'active',
                is_active: true,
                created_by: profile.id,
              })
              .select('id')
              .single();

            if (!containerErr && container) {
              // Assign units to container
              for (const unitId of unitIds) {
                await (supabase as any)
                  .from('inventory_units')
                  .update({ container_id: container.id })
                  .eq('id', unitId);
              }
            }
          }
        } else if (item.packages > 1) {
          // Scenario B: multiple containers
          const unitsPerContainer = Math.ceil(unitIds.length / item.packages);
          for (let p = 0; p < item.packages; p++) {
            const containerUnits = unitIds.slice(p * unitsPerContainer, (p + 1) * unitsPerContainer);
            if (containerUnits.length === 0) continue;

            const { data: containerCode } = await supabase.rpc('generate_ic_code', {
              p_tenant_id: profile.tenant_id,
            });

            const { data: container, error: containerErr } = await (supabase as any)
              .from('containers')
              .insert({
                tenant_id: profile.tenant_id,
                container_code: containerCode || `CTN-${Date.now()}-${p}`,
                container_type: 'Carton',
                location_id: receivingLocationId,
                warehouse_id: shipment.warehouse_id,
                status: 'active',
                is_active: true,
                created_by: profile.id,
              })
              .select('id')
              .single();

            if (!containerErr && container) {
              for (const unitId of containerUnits) {
                await (supabase as any)
                  .from('inventory_units')
                  .update({ container_id: container.id })
                  .eq('id', unitId);
              }
            }
          }
        }
      }

      let autoFlaggedItemCount = 0;
      if (autoApplyArrivalNoIdFlag && isUnidentifiedShipment && touchedShipmentItemIds.length > 0) {
        const uniqueShipmentItemIds = [...new Set(touchedShipmentItemIds)];

        const { data: shipmentItemRows, error: shipmentItemsErr } = await (supabase as any)
          .from('shipment_items')
          .select('id, flags')
          .in('id', uniqueShipmentItemIds);

        if (shipmentItemsErr) {
          console.error('[Stage2] failed to load shipment item flags:', shipmentItemsErr);
        } else {
          for (const row of (shipmentItemRows || []) as Array<{ id: string; flags: string[] | null }>) {
            const existingFlags = Array.isArray(row.flags)
              ? row.flags.filter((flag) => typeof flag === 'string')
              : [];

            if (existingFlags.includes(ARRIVAL_NO_ID_FLAG)) {
              continue;
            }

            const { error: updateFlagErr } = await (supabase as any)
              .from('shipment_items')
              .update({ flags: [...existingFlags, ARRIVAL_NO_ID_FLAG] })
              .eq('id', row.id);

            if (updateFlagErr) {
              console.error('[Stage2] failed to apply ARRIVAL_NO_ID flag:', updateFlagErr);
              continue;
            }

            autoFlaggedItemCount += 1;
          }
        }
      }

      // Log admin override if used
      if (adminOverride) {
        logActivity({
          entityType: 'shipment',
          tenantId: profile.tenant_id,
          entityId: shipmentId,
          actorUserId: profile.id,
          eventType: 'receiving_admin_override',
          eventLabel: 'Admin override: completed receiving without items',
          details: { reason: overrideReason },
        });
      }

      // Update shipment to closed
      const { error: closeErr } = await supabase
        .from('shipments')
        .update({
          inbound_status: 'closed',
          received_pieces: receivedPieces,
          received_at: new Date().toISOString(),
        } as any)
        .eq('id', shipmentId);

      if (closeErr) throw closeErr;

      // Assign receiving location as safety net
      try {
        await supabase.rpc('rpc_assign_receiving_location_for_shipment', {
          p_shipment_id: shipmentId,
          p_note: 'Auto-assigned on Stage 2 completion',
        });
      } catch {
        // Non-blocking
      }

      // Log completion
      logActivity({
        entityType: 'shipment',
        tenantId: profile.tenant_id,
        entityId: shipmentId,
        actorUserId: profile.id,
        eventType: 'receiving_completed',
        eventLabel: 'Receiving completed (Stage 2)',
        details: {
          received_pieces: receivedPieces,
          items_count: items.length,
        },
      });

      if (isUnidentifiedShipment && autoApplyArrivalNoIdFlag && autoFlaggedItemCount > 0) {
        try {
          await queueUnidentifiedIntakeCompletedAlert(
            profile.tenant_id,
            shipmentId,
            shipmentNumber,
            autoFlaggedItemCount
          );
        } catch (alertErr) {
          // Alerting should not block receiving completion.
          console.warn('[Stage2] failed to queue unidentified intake alert:', alertErr);
        }
      }

      toast({
        title: 'Receiving Complete',
        description:
          autoFlaggedItemCount > 0
            ? `Shipment closed. ${autoFlaggedItemCount} item(s) auto-flagged ARRIVAL_NO_ID.`
            : 'Shipment has been received and closed.',
      });
      setShowCompleteDialog(false);
      setShowAdminOverride(false);
      onComplete();
    } catch (err: any) {
      console.error('[Stage2] complete error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to complete receiving',
      });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MaterialIcon name="inventory_2" size="md" className="text-primary" />
                Stage 2 — Detailed Receiving
                <Badge variant="outline">{shipmentNumber}</Badge>
                <ShipmentExceptionBadge
                  shipmentId={shipmentId}
                  count={exceptionCount}
                  onClick={onOpenExceptions}
                />
              </CardTitle>
              <CardDescription className="mt-1">
                Receive items, create inventory units, and verify quantities.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                Signed: {shipment.signed_pieces ?? '-'}
              </Badge>
              <Badge variant={receivedPieces > 0 ? 'default' : 'outline'} className="text-sm">
                Received: {receivedPieces}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Received Pieces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="pin" size="sm" />
            Received Pieces <span className="text-red-500">*</span>
            <HelpTip tooltip="Total number of pieces received at dock intake stage 2." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={0}
              value={receivedPieces || ''}
              onChange={(e) => setReceivedPieces(parseInt(e.target.value) || 0)}
              className="w-32"
            />
            {shipment.signed_pieces && receivedPieces !== shipment.signed_pieces && receivedPieces > 0 && (
              <Badge variant="destructive" className="gap-1">
                <MaterialIcon name="warning" size="sm" />
                {receivedPieces > shipment.signed_pieces ? 'Over' : 'Short'} by {Math.abs(receivedPieces - shipment.signed_pieces)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MaterialIcon name="list_alt" size="sm" />
              Items ({items.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowManifestSelector(true)}>
                <MaterialIcon name="content_paste_go" size="sm" className="mr-1" />
                Add From Manifest
              </Button>
              <Button variant="outline" size="sm" onClick={addManualItem}>
                <MaterialIcon name="add" size="sm" className="mr-1" />
                Manual Entry
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MaterialIcon name="inventory_2" size="xl" className="mb-2 opacity-30" />
              <p>No items added yet.</p>
              <p className="text-sm mt-1">Add items from a linked manifest or enter manually.</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" onClick={() => setShowManifestSelector(true)}>
                  <MaterialIcon name="content_paste_go" size="sm" className="mr-1" />
                  Add From Manifest
                </Button>
                <Button variant="outline" onClick={addManualItem}>
                  <MaterialIcon name="add" size="sm" className="mr-1" />
                  Manual Entry
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20 text-right">Expected</TableHead>
                    <TableHead className="w-24 text-right">Received</TableHead>
                    <TableHead className="w-20">
                      <span className="flex items-center gap-1">
                        Pkg
                        <HelpTip tooltip="Number of containers. 0 = no containers, 1 = single container for all units, 2+ = split across containers. Set automatically by the placement prompt." />
                      </span>
                    </TableHead>
                    <TableHead className="w-20">Source</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.sourceType === 'manual' ? (
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Item description"
                            className="h-8"
                          />
                        ) : (
                          <span className="text-sm">{item.description || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.expected_quantity}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.received_quantity}
                          onChange={(e) => updateItem(item.id, 'received_quantity', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.packages}
                          onChange={(e) => updateItem(item.id, 'packages', parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <MaterialIcon name="delete" size="sm" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Complete Button */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          size="lg"
          onClick={handleCompleteClick}
          disabled={completing}
          className="gap-2"
        >
          {completing ? (
            <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
          ) : (
            <MaterialIcon name="check_circle" size="sm" />
          )}
          Complete Receiving
        </Button>
      </div>

      {/* Full-screen manifest selector */}
      <AddFromManifestSelector
        shipmentId={shipmentId}
        accountId={shipment.account_id}
        open={showManifestSelector}
        onClose={() => setShowManifestSelector(false)}
        onAdd={handleAddFromManifest}
        onOpenMatchingPanel={() => {
          setShowManifestSelector(false);
          setShowMatchingPanel(true);
        }}
      />

      {/* Complete Confirmation Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Receiving?</DialogTitle>
            <DialogDescription>
              This will close the shipment and create inventory units for all received items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span>Signed Pieces:</span>
              <span className="font-medium">{shipment.signed_pieces ?? '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Received Pieces:</span>
              <span className="font-medium">{receivedPieces}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Items:</span>
              <span className="font-medium">{items.length}</span>
            </div>
            {receivedPieces !== shipment.signed_pieces && shipment.signed_pieces && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                <MaterialIcon name="warning" size="sm" className="inline mr-1" />
                Signed and received piece counts are different.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleComplete(false)} disabled={completing}>
              {completing ? (
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
              ) : (
                <MaterialIcon name="check_circle" size="sm" className="mr-2" />
              )}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Container Placement Dialog */}
      <Dialog
        open={!!containerPromptItemId}
        onOpenChange={(open) => { if (!open) setContainerPromptItemId(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MaterialIcon name="package_2" size="sm" />
              Container Placement
            </DialogTitle>
            <DialogDescription>
              You're receiving {containerPromptQty} units. How should they be containerized?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => containerPromptItemId && applyContainerChoice(containerPromptItemId, 1)}
            >
              <MaterialIcon name="inbox" size="sm" className="text-primary" />
              <div className="text-left">
                <div className="font-medium">All in 1 container</div>
                <div className="text-xs text-muted-foreground">
                  {containerPromptQty} units grouped in a single container
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => containerPromptItemId && applyContainerChoice(containerPromptItemId, containerPromptQty)}
            >
              <MaterialIcon name="grid_view" size="sm" className="text-primary" />
              <div className="text-left">
                <div className="font-medium">{containerPromptQty} separate containers</div>
                <div className="text-xs text-muted-foreground">
                  1 unit per container
                </div>
              </div>
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 justify-start gap-3 h-auto py-3"
                onClick={() => containerPromptItemId && applyContainerChoice(containerPromptItemId, customContainerCount)}
              >
                <MaterialIcon name="tune" size="sm" className="text-primary" />
                <div className="text-left">
                  <div className="font-medium">Custom</div>
                  <div className="text-xs text-muted-foreground">Split across containers</div>
                </div>
              </Button>
              <Input
                type="number"
                min={2}
                max={containerPromptQty}
                value={customContainerCount}
                onChange={(e) => setCustomContainerCount(Math.max(2, Math.min(containerPromptQty, parseInt(e.target.value) || 2)))}
                className="w-20 h-10"
              />
            </div>
            <Separator />
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-3 text-muted-foreground"
              onClick={() => containerPromptItemId && applyContainerChoice(containerPromptItemId, 0)}
            >
              <MaterialIcon name="close" size="sm" />
              <div className="text-left">
                <div className="font-medium">No containers</div>
                <div className="text-xs text-muted-foreground">Units stored individually without containers</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Override Dialog */}
      <Dialog open={showAdminOverride} onOpenChange={setShowAdminOverride}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MaterialIcon name="admin_panel_settings" size="sm" />
              Admin Override
            </DialogTitle>
            <DialogDescription>
              Completing without any items requires admin authorization and a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Override Reason <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Explain why receiving is being completed without items..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdminOverride(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleComplete(true)}
              disabled={!overrideReason.trim() || completing}
            >
              {completing ? (
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
              ) : (
                <MaterialIcon name="admin_panel_settings" size="sm" className="mr-2" />
              )}
              Override & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
