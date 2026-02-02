/**
 * ShipmentCoverageDialog - Apply coverage to entire shipment
 * Allows selecting coverage type and applying to all items in a shipment
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

// Canonical coverage types
type CoverageType = 'standard' | 'full_replacement_no_deductible' | 'full_replacement_deductible';

interface ShipmentCoverageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  accountId: string | null;
  shipmentNumber: string;
  itemCount: number;
  currentCoverageType?: CoverageType | null;
  currentDeclaredValue?: number | null;
  onSuccess?: () => void;
}

const COVERAGE_LABELS: Record<CoverageType, string> = {
  standard: 'Standard (60c/lb)',
  full_replacement_no_deductible: 'Full Replacement (No Deductible)',
  full_replacement_deductible: 'Full Replacement (With Deductible)',
};

export function ShipmentCoverageDialog({
  open,
  onOpenChange,
  shipmentId,
  accountId,
  shipmentNumber,
  itemCount,
  currentCoverageType,
  currentDeclaredValue,
  onSuccess,
}: ShipmentCoverageDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [coverageType, setCoverageType] = useState<CoverageType>(currentCoverageType || 'standard');
  const [declaredValue, setDeclaredValue] = useState(currentDeclaredValue?.toString() || '');
  const [applyToItems, setApplyToItems] = useState(true);
  const [saving, setSaving] = useState(false);

  // Coverage rates
  const [rates, setRates] = useState({
    full_replacement_no_deductible: 0.0188,
    full_replacement_deductible: 0.0142,
    deductible_amount: 300,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCoverageType(currentCoverageType || 'standard');
      setDeclaredValue(currentDeclaredValue?.toString() || '');
      setApplyToItems(true);
    }
  }, [open, currentCoverageType, currentDeclaredValue]);

  // Fetch coverage rates
  useEffect(() => {
    async function fetchRates() {
      if (!profile?.tenant_id) return;

      try {
        // Check for account-level override
        if (accountId) {
          const { data: accountSettings } = await (supabase as any)
            .from('account_coverage_settings')
            .select('*')
            .eq('tenant_id', profile.tenant_id)
            .eq('account_id', accountId)
            .maybeSingle();

          if (accountSettings?.override_enabled) {
            setRates({
              full_replacement_no_deductible: accountSettings.coverage_rate_full_no_deductible ?? 0.0188,
              full_replacement_deductible: accountSettings.coverage_rate_full_deductible ?? 0.0142,
              deductible_amount: accountSettings.coverage_deductible_amount ?? 300,
            });
            return;
          }
        }

        // Fall back to tenant settings
        const { data: orgSettings } = await (supabase as any)
          .from('organization_claim_settings')
          .select('coverage_rate_full_no_deductible, coverage_rate_full_deductible, coverage_deductible_amount')
          .eq('tenant_id', profile.tenant_id)
          .maybeSingle();

        if (orgSettings) {
          setRates({
            full_replacement_no_deductible: orgSettings.coverage_rate_full_no_deductible ?? 0.0188,
            full_replacement_deductible: orgSettings.coverage_rate_full_deductible ?? 0.0142,
            deductible_amount: orgSettings.coverage_deductible_amount ?? 300,
          });
        }
      } catch (error) {
        console.error('Error fetching coverage rates:', error);
      }
    }

    if (open) {
      fetchRates();
    }
  }, [open, profile?.tenant_id, accountId]);

  // Calculate premium
  const calculatePremium = (): number => {
    const dv = parseFloat(declaredValue) || 0;
    if (coverageType === 'standard') return 0;
    if (coverageType === 'full_replacement_no_deductible') {
      return dv * rates.full_replacement_no_deductible;
    }
    if (coverageType === 'full_replacement_deductible') {
      return dv * rates.full_replacement_deductible;
    }
    return 0;
  };

  // Get rate for display
  const getRate = (): number => {
    if (coverageType === 'full_replacement_no_deductible') {
      return rates.full_replacement_no_deductible;
    }
    if (coverageType === 'full_replacement_deductible') {
      return rates.full_replacement_deductible;
    }
    return 0;
  };

  // Get deductible for display
  const getDeductible = (): number => {
    if (coverageType === 'full_replacement_deductible') {
      return rates.deductible_amount;
    }
    return 0;
  };

  const handleSave = async () => {
    const dv = parseFloat(declaredValue) || 0;

    // Validation for full replacement coverage
    if ((coverageType === 'full_replacement_no_deductible' || coverageType === 'full_replacement_deductible') && dv <= 0) {
      toast({
        variant: 'destructive',
        title: 'Declared Value Required',
        description: 'Full replacement coverage requires a declared value.',
      });
      return;
    }

    setSaving(true);
    try {
      const rate = getRate();
      const deductible = getDeductible();
      const premium = calculatePremium();

      // STEP 1: Void/delete existing coverage billing events for this shipment
      // This prevents double billing when changing coverage
      if (profile?.tenant_id) {
        await supabase
          .from('billing_events')
          .delete()
          .eq('shipment_id', shipmentId)
          .eq('event_type', 'coverage')
          .eq('status', 'unbilled');
      }

      // STEP 2: Update shipment with coverage info
      const { error: shipmentError } = await (supabase as any)
        .from('shipments')
        .update({
          coverage_type: coverageType,
          coverage_declared_value: dv || null,
          coverage_rate: rate,
          coverage_deductible: deductible,
          coverage_premium: premium,
          coverage_scope: applyToItems ? 'items' : 'shipment',
          coverage_selected_at: new Date().toISOString(),
          coverage_selected_by: profile?.id,
        })
        .eq('id', shipmentId);

      if (shipmentError) throw shipmentError;

      // STEP 3: If apply to items is checked, update all items in the shipment
      // IMPORTANT: Set coverage_source='shipment' and do NOT overwrite declared_value
      if (applyToItems) {
        // Get all items linked to this shipment
        const { data: shipmentItems, error: itemsError } = await supabase
          .from('shipment_items')
          .select('item_id')
          .eq('shipment_id', shipmentId)
          .not('item_id', 'is', null);

        if (itemsError) throw itemsError;

        const itemIds = shipmentItems
          .map(si => si.item_id)
          .filter((id): id is string => id !== null);

        if (itemIds.length > 0) {
          // Update all items with coverage - set coverage_source='shipment'
          // Do NOT overwrite declared_value - items keep their own declared values
          const { error: updateError } = await supabase
            .from('items')
            .update({
              coverage_type: coverageType,
              coverage_source: 'shipment', // Attribution: covered via shipment
              coverage_rate: rate,
              coverage_deductible: deductible,
              coverage_selected_at: new Date().toISOString(),
              coverage_selected_by: profile?.id,
            })
            .in('id', itemIds);

          if (updateError) throw updateError;
        }
      }

      // STEP 4: Create ONE billing event for shipment-level coverage if applicable
      if (coverageType !== 'standard' && premium > 0 && profile?.tenant_id) {
        // Get item count for metadata
        const { data: shipmentItems } = await supabase
          .from('shipment_items')
          .select('item_id')
          .eq('shipment_id', shipmentId)
          .not('item_id', 'is', null);

        const coveredItemCount = shipmentItems?.length || itemCount;

        await supabase.from('billing_events').insert([{
          tenant_id: profile.tenant_id,
          account_id: accountId,
          shipment_id: shipmentId,
          event_type: 'coverage',
          charge_type: 'handling_coverage',
          description: `Shipment Coverage: ${COVERAGE_LABELS[coverageType]} (${shipmentNumber})`,
          quantity: 1,
          unit_rate: premium,
          total_amount: premium,
          status: 'unbilled',
          occurred_at: new Date().toISOString(),
          metadata: {
            coverage_type: coverageType,
            coverage_source: 'shipment',
            rate: rate,
            declared_value_total: dv,
            shipment_number: shipmentNumber,
            covered_item_count: coveredItemCount,
            deductible: deductible,
            scope: applyToItems ? 'items' : 'shipment',
          },
          created_by: profile.id,
        }]);
      }

      toast({
        title: 'Coverage Applied',
        description: applyToItems
          ? `Coverage has been applied to shipment and ${itemCount} items.`
          : 'Coverage has been applied to shipment.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error applying coverage:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to apply coverage to shipment.',
      });
    } finally {
      setSaving(false);
    }
  };

  const premium = calculatePremium();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon name="verified_user" className="h-5 w-5 text-blue-600" />
            Add Shipment Coverage
          </DialogTitle>
          <DialogDescription>
            Apply valuation coverage to shipment {shipmentNumber} and all its items.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 py-4">
            {/* Coverage Type */}
            <div className="space-y-2">
              <Label>Coverage Type</Label>
              <Select
                value={coverageType}
                onValueChange={(v) => setCoverageType(v as CoverageType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    <div className="flex flex-col">
                      <span>Standard (60c/lb)</span>
                      <span className="text-xs text-muted-foreground">No additional charge</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="full_replacement_no_deductible">
                    <div className="flex flex-col">
                      <span>Full Replacement (No Deductible)</span>
                      <span className="text-xs text-muted-foreground">{(rates.full_replacement_no_deductible * 100).toFixed(2)}% of declared value</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="full_replacement_deductible">
                    <div className="flex flex-col">
                      <span>Full Replacement (${rates.deductible_amount} Deductible)</span>
                      <span className="text-xs text-muted-foreground">{(rates.full_replacement_deductible * 100).toFixed(2)}% of declared value</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Declared Value */}
            {coverageType !== 'standard' && (
              <div className="space-y-2">
                <Label>Total Declared Value ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={declaredValue}
                  onChange={(e) => setDeclaredValue(e.target.value)}
                  placeholder="Enter total declared value"
                />
                <p className="text-xs text-muted-foreground">
                  This amount will be distributed across {itemCount} items.
                </p>
              </div>
            )}

            {/* Apply to Items */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="applyToItems"
                checked={applyToItems}
                onCheckedChange={(checked) => setApplyToItems(checked === true)}
              />
              <Label htmlFor="applyToItems" className="text-sm cursor-pointer">
                Apply coverage to all items in this shipment
              </Label>
            </div>

            {/* Premium Preview */}
            {coverageType !== 'standard' && declaredValue && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <h4 className="font-medium text-blue-900">Coverage Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-blue-700">Coverage Rate:</span>
                  <span className="font-mono text-right">{(getRate() * 100).toFixed(2)}%</span>

                  <span className="text-blue-700">Declared Value:</span>
                  <span className="font-mono text-right">${parseFloat(declaredValue).toFixed(2)}</span>

                  {coverageType === 'full_replacement_deductible' && (
                    <>
                      <span className="text-blue-700">Deductible:</span>
                      <span className="font-mono text-right">${getDeductible().toFixed(2)}</span>
                    </>
                  )}
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between">
                  <span className="font-medium text-blue-900">Coverage Premium:</span>
                  <Badge className="bg-blue-600 text-lg font-mono">
                    ${premium.toFixed(2)}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || ((coverageType !== 'standard') && (!declaredValue || parseFloat(declaredValue) <= 0))}
          >
            {saving ? (
              <>
                <MaterialIcon name="progress_activity" className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <MaterialIcon name="verified_user" className="h-4 w-4 mr-2" />
                Apply Coverage
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
