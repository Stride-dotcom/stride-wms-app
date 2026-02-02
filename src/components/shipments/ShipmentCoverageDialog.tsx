/**
 * ShipmentCoverageDialog
 * Modal for adding coverage to an entire shipment or selected items
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCoverageSettings, normalizeCoverageType } from '@/hooks/useCoverageSettings';
import { CoverageTypeValue } from '@/hooks/useOrganizationClaimSettings';
import { supabase } from '@/integrations/supabase/client';

interface ShipmentItem {
  id: string;
  item_id: string | null;
  expected_description: string | null;
  expected_quantity: number;
  item?: {
    id: string;
    item_code: string;
    description: string | null;
    declared_value: number | null;
    coverage_type: string | null;
  } | null;
}

interface ShipmentCoverageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  shipmentNumber: string;
  accountId: string | null;
  items: ShipmentItem[];
  onSuccess: () => void;
}

export function ShipmentCoverageDialog({
  open,
  onOpenChange,
  shipmentId,
  shipmentNumber,
  accountId,
  items,
  onSuccess,
}: ShipmentCoverageDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { effectiveRates, loading: ratesLoading } = useCoverageSettings({
    accountId: accountId || undefined,
  });

  // Form state
  const [coverageScope, setCoverageScope] = useState<'shipment' | 'selected'>('shipment');
  const [coverageType, setCoverageType] = useState<CoverageTypeValue>('standard');
  const [declaredValueTotal, setDeclaredValueTotal] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCoverageScope('shipment');
      setCoverageType('standard');
      setDeclaredValueTotal('');
      setSelectedItemIds(new Set());
    }
  }, [open]);

  // Get items that have actual item records (received items)
  const receivedItems = useMemo(() => {
    return items.filter(item => item.item_id && item.item);
  }, [items]);

  // Calculate coverage cost
  const calculateCost = (type: CoverageTypeValue, value: number): number => {
    if (type === 'standard') return 0;
    const rate = type === 'full_replacement_no_deductible'
      ? effectiveRates.full_replacement_no_deductible_rate
      : effectiveRates.full_replacement_deductible_rate;
    return value * rate;
  };

  // Get coverage label
  const getCoverageLabel = (type: CoverageTypeValue): string => {
    switch (type) {
      case 'full_replacement_no_deductible':
        return 'Full Replacement (No Deductible)';
      case 'full_replacement_deductible':
        return `Full Replacement ($${effectiveRates.deductible_amount} Deductible)`;
      case 'standard':
      default:
        return 'Standard Coverage';
    }
  };

  // Toggle item selection
  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItemIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItemIds(newSelected);
  };

  // Calculate total declared value from selected items
  const selectedItemsValue = useMemo(() => {
    if (coverageScope !== 'selected') return 0;
    return receivedItems
      .filter(item => selectedItemIds.has(item.id))
      .reduce((sum, item) => sum + (item.item?.declared_value || 0), 0);
  }, [coverageScope, receivedItems, selectedItemIds]);

  // Handle save
  const handleSave = async () => {
    if (!profile?.tenant_id) return;

    // Validation
    if (coverageType !== 'standard') {
      if (coverageScope === 'shipment' && (!declaredValueTotal || parseFloat(declaredValueTotal) <= 0)) {
        toast({
          variant: 'destructive',
          title: 'Declared Value Required',
          description: 'Please enter the total declared value for the shipment.',
        });
        return;
      }
      if (coverageScope === 'selected' && selectedItemIds.size === 0) {
        toast({
          variant: 'destructive',
          title: 'No Items Selected',
          description: 'Please select at least one item for coverage.',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const rate = coverageType === 'full_replacement_no_deductible'
        ? effectiveRates.full_replacement_no_deductible_rate
        : coverageType === 'full_replacement_deductible'
        ? effectiveRates.full_replacement_deductible_rate
        : 0;

      if (coverageScope === 'shipment') {
        // Shipment-level coverage
        const totalValue = parseFloat(declaredValueTotal) || 0;
        const cost = calculateCost(coverageType, totalValue);

        // Update shipment metadata with coverage info
        const { data: shipmentData, error: shipmentFetchError } = await supabase
          .from('shipments')
          .select('metadata')
          .eq('id', shipmentId)
          .single();

        if (shipmentFetchError) throw shipmentFetchError;

        const currentMetadata = (shipmentData?.metadata as Record<string, any>) || {};
        const newMetadata = {
          ...currentMetadata,
          coverage: {
            type: coverageType,
            scope: 'shipment',
            declared_value_total: totalValue,
            rate,
            deductible: coverageType === 'full_replacement_deductible' ? effectiveRates.deductible_amount : 0,
            cost,
            covered_item_count: receivedItems.length,
            applied_at: new Date().toISOString(),
            applied_by: profile.id,
          },
        };

        const { error: shipmentError } = await supabase
          .from('shipments')
          .update({ metadata: newMetadata })
          .eq('id', shipmentId);

        if (shipmentError) throw shipmentError;

        // Mark all items as covered via shipment
        if (receivedItems.length > 0) {
          const itemIds = receivedItems.map(item => item.item_id).filter(Boolean);
          const { error: itemsError } = await supabase
            .from('items')
            .update({
              coverage_type: coverageType,
              coverage_rate: rate,
              coverage_deductible: coverageType === 'full_replacement_deductible' ? effectiveRates.deductible_amount : 0,
              coverage_selected_at: new Date().toISOString(),
              coverage_selected_by: profile.id,
              // Store coverage source in metadata
              metadata: supabase.sql`COALESCE(metadata, '{}'::jsonb) || '{"coverage_source": "shipment", "shipment_id": "${shipmentId}"}'::jsonb`,
            })
            .in('id', itemIds as string[]);

          if (itemsError) {
            console.error('Error updating items coverage:', itemsError);
            // Don't throw - items update is secondary
          }
        }

        // Create ONE billing event for shipment-level coverage
        if (coverageType !== 'standard' && cost > 0) {
          const { error: billingError } = await supabase.from('billing_events').insert([{
            tenant_id: profile.tenant_id,
            account_id: accountId,
            shipment_id: shipmentId,
            event_type: 'coverage',
            charge_type: 'handling_coverage',
            description: `Shipment Coverage: ${getCoverageLabel(coverageType)} - ${shipmentNumber} (${receivedItems.length} items, $${totalValue.toLocaleString()} declared)`,
            quantity: 1,
            unit_rate: cost,
            total_amount: cost,
            status: 'unbilled',
            occurred_at: new Date().toISOString(),
            metadata: {
              coverage_type: coverageType,
              coverage_scope: 'shipment',
              rate,
              declared_value_total: totalValue,
              covered_item_count: receivedItems.length,
              shipment_number: shipmentNumber,
            },
            created_by: profile.id,
          }]);

          if (billingError) throw billingError;
        }

        toast({
          title: 'Shipment Coverage Applied',
          description: coverageType === 'standard'
            ? 'Standard coverage applied to all items.'
            : `${getCoverageLabel(coverageType)} applied. Cost: $${cost.toFixed(2)}`,
        });

      } else {
        // Selected items coverage - create individual billing events
        const selectedItems = receivedItems.filter(item => selectedItemIds.has(item.id));
        let totalCost = 0;

        for (const item of selectedItems) {
          if (!item.item_id || !item.item) continue;

          const itemValue = item.item.declared_value || 0;
          const itemCost = calculateCost(coverageType, itemValue);
          totalCost += itemCost;

          // Update item coverage
          const { error: itemError } = await supabase
            .from('items')
            .update({
              coverage_type: coverageType,
              coverage_rate: rate,
              coverage_deductible: coverageType === 'full_replacement_deductible' ? effectiveRates.deductible_amount : 0,
              coverage_selected_at: new Date().toISOString(),
              coverage_selected_by: profile.id,
            })
            .eq('id', item.item_id);

          if (itemError) throw itemError;

          // Create billing event per item if not standard
          if (coverageType !== 'standard' && itemCost > 0) {
            const { error: billingError } = await supabase.from('billing_events').insert([{
              tenant_id: profile.tenant_id,
              account_id: accountId,
              item_id: item.item_id,
              shipment_id: shipmentId,
              event_type: 'coverage',
              charge_type: 'handling_coverage',
              description: `Coverage: ${getCoverageLabel(coverageType)} - ${item.item.item_code} ($${itemValue.toLocaleString()} declared)`,
              quantity: 1,
              unit_rate: itemCost,
              total_amount: itemCost,
              status: 'unbilled',
              occurred_at: new Date().toISOString(),
              metadata: {
                coverage_type: coverageType,
                coverage_scope: 'item',
                rate,
                declared_value: itemValue,
                item_code: item.item.item_code,
              },
              created_by: profile.id,
            }]);

            if (billingError) throw billingError;
          }
        }

        toast({
          title: 'Item Coverage Applied',
          description: coverageType === 'standard'
            ? `Standard coverage applied to ${selectedItems.length} items.`
            : `${getCoverageLabel(coverageType)} applied to ${selectedItems.length} items. Total: $${totalCost.toFixed(2)}`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error applying coverage:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to apply coverage. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const estimatedCost = useMemo(() => {
    if (coverageType === 'standard') return 0;
    if (coverageScope === 'shipment') {
      return calculateCost(coverageType, parseFloat(declaredValueTotal) || 0);
    }
    return calculateCost(coverageType, selectedItemsValue);
  }, [coverageType, coverageScope, declaredValueTotal, selectedItemsValue, effectiveRates]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon name="verified_user" size="md" />
            Add Coverage - {shipmentNumber}
          </DialogTitle>
          <DialogDescription>
            Apply valuation coverage to protect items in this shipment.
          </DialogDescription>
        </DialogHeader>

        {ratesLoading ? (
          <div className="flex items-center justify-center py-8">
            <MaterialIcon name="progress_activity" className="animate-spin h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Coverage Scope */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Coverage Scope</Label>
              <RadioGroup
                value={coverageScope}
                onValueChange={(v) => setCoverageScope(v as 'shipment' | 'selected')}
                className="grid grid-cols-1 gap-3"
              >
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="shipment" id="scope-shipment" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="scope-shipment" className="font-medium cursor-pointer">
                      Cover Entire Shipment
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Apply one coverage policy to all {receivedItems.length} items. Creates a single billing charge.
                    </p>
                  </div>
                  <Badge variant="secondary">Recommended</Badge>
                </div>
                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="selected" id="scope-selected" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="scope-selected" className="font-medium cursor-pointer">
                      Cover Selected Items Only
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Choose specific items to cover. Each item will have its own billing charge.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Coverage Type */}
            <div className="space-y-2">
              <Label>Coverage Type</Label>
              <Select
                value={coverageType}
                onValueChange={(v) => setCoverageType(v as CoverageTypeValue)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Coverage (No charge)</SelectItem>
                  <SelectItem value="full_replacement_no_deductible">
                    Full Replacement (No Deductible) - {(effectiveRates.full_replacement_no_deductible_rate * 100).toFixed(2)}%
                  </SelectItem>
                  <SelectItem value="full_replacement_deductible">
                    Full Replacement (${effectiveRates.deductible_amount} Deductible) - {(effectiveRates.full_replacement_deductible_rate * 100).toFixed(2)}%
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shipment Total Declared Value */}
            {coverageScope === 'shipment' && coverageType !== 'standard' && (
              <div className="space-y-2">
                <Label>Total Declared Value for Shipment</Label>
                <div className="relative max-w-xs">
                  <MaterialIcon name="attach_money" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={declaredValueTotal}
                    onChange={(e) => setDeclaredValueTotal(e.target.value)}
                    placeholder="0.00"
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the total declared value for all items in this shipment.
                </p>
              </div>
            )}

            {/* Item Selection for Selected Items Scope */}
            {coverageScope === 'selected' && (
              <div className="space-y-3">
                <Label>Select Items to Cover</Label>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {receivedItems.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No received items available for coverage.
                    </div>
                  ) : (
                    receivedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedItemIds.has(item.id)}
                          onCheckedChange={() => toggleItem(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {item.item?.item_code || item.expected_description || 'Unknown Item'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {item.item?.description || 'No description'}
                          </p>
                        </div>
                        <div className="text-right">
                          {item.item?.declared_value ? (
                            <p className="font-mono">${item.item.declared_value.toLocaleString()}</p>
                          ) : (
                            <p className="text-muted-foreground text-sm">No value</p>
                          )}
                          {item.item?.coverage_type && item.item.coverage_type !== 'standard' && (
                            <Badge variant="outline" className="text-xs">
                              Already covered
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {coverageType !== 'standard' && selectedItemsValue === 0 && selectedItemIds.size > 0 && (
                  <p className="text-sm text-yellow-600">
                    Selected items have no declared values. Please add declared values before applying full coverage.
                  </p>
                )}
              </div>
            )}

            {/* Cost Preview */}
            {coverageType !== 'standard' && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Coverage Rate:</span>
                      <span>
                        {coverageType === 'full_replacement_no_deductible'
                          ? (effectiveRates.full_replacement_no_deductible_rate * 100).toFixed(2)
                          : (effectiveRates.full_replacement_deductible_rate * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deductible:</span>
                      <span>
                        {coverageType === 'full_replacement_deductible'
                          ? `$${effectiveRates.deductible_amount}`
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Declared Value:</span>
                      <span>
                        ${(coverageScope === 'shipment'
                          ? parseFloat(declaredValueTotal) || 0
                          : selectedItemsValue
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-medium">
                        <span>Estimated Coverage Cost:</span>
                        <span className="text-primary text-lg">${estimatedCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || ratesLoading}>
            {saving && <MaterialIcon name="progress_activity" size="sm" className="animate-spin mr-2" />}
            Apply Coverage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
