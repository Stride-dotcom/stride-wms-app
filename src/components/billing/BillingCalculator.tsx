/**
 * BillingCalculator Component
 *
 * A reusable, embeddable billing calculator that provides real-time
 * billing charge calculations for shipments, tasks, and other contexts.
 *
 * Features:
 * - Dynamic service lookup using pattern matching
 * - Rate overrides
 * - Custom charge support
 * - Tax calculation
 * - Compact display
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useBillingCalculator } from '@/hooks/useBillingCalculator';
import {
  BillingCalculatorProps,
  BillingLineItem,
  CustomCharge,
} from '@/lib/billing/calculatorTypes';

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Generate unique ID for custom charges
 */
function generateId(): string {
  return `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function BillingCalculator({
  contextType,
  contextData,
  items,
  rateOverrides: externalOverrides = [],
  customCharges: externalCustomCharges = [],
  showTax = false,
  taxRate = 0,
  onRateOverride,
  onAddCustomCharge,
  onRemoveCustomCharge,
  onCalculationChange,
  readOnly = false,
  compact = true,
  title = 'Billing Charges',
}: BillingCalculatorProps) {
  // Internal state for overrides and custom charges when callbacks not provided
  const [internalOverrides, setInternalOverrides] = useState(externalOverrides);
  const [internalCustomCharges, setInternalCustomCharges] = useState<CustomCharge[]>(
    externalCustomCharges
  );

  // Dialog state
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [showAddChargeDialog, setShowAddChargeDialog] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<BillingLineItem | null>(null);
  const [overrideRate, setOverrideRate] = useState('');
  const [newChargeDescription, setNewChargeDescription] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');

  // Use external or internal state
  const rateOverrides = onRateOverride ? externalOverrides : internalOverrides;
  const customCharges = onAddCustomCharge ? externalCustomCharges : internalCustomCharges;

  // Get calculation from hook
  const { calculation, loading, error } = useBillingCalculator({
    contextType,
    contextData,
    items,
    rateOverrides,
    customCharges,
    showTax,
    taxRate,
  });

  // Notify parent of calculation changes
  useEffect(() => {
    if (onCalculationChange) {
      onCalculationChange(calculation);
    }
  }, [calculation, onCalculationChange]);

  // Handle rate override
  const handleOpenOverrideDialog = useCallback((lineItem: BillingLineItem) => {
    setEditingLineItem(lineItem);
    setOverrideRate(lineItem.rate.toString());
    setShowOverrideDialog(true);
  }, []);

  const handleApplyOverride = useCallback(() => {
    if (!editingLineItem) return;

    const newRate = parseFloat(overrideRate);
    if (isNaN(newRate) || newRate < 0) return;

    if (onRateOverride) {
      onRateOverride(editingLineItem.class_code, newRate);
    } else {
      setInternalOverrides((prev) => {
        // Remove existing override for this class
        const filtered = prev.filter((o) => o.class_code !== editingLineItem.class_code);
        return [...filtered, { class_code: editingLineItem.class_code, rate: newRate }];
      });
    }

    setShowOverrideDialog(false);
    setEditingLineItem(null);
    setOverrideRate('');
  }, [editingLineItem, overrideRate, onRateOverride]);

  // Handle custom charge
  const handleOpenAddChargeDialog = useCallback(() => {
    setNewChargeDescription('');
    setNewChargeAmount('');
    setShowAddChargeDialog(true);
  }, []);

  const handleAddCharge = useCallback(() => {
    const amount = parseFloat(newChargeAmount);
    if (!newChargeDescription.trim() || isNaN(amount) || amount <= 0) return;

    if (onAddCustomCharge) {
      onAddCustomCharge(newChargeDescription.trim(), amount);
    } else {
      setInternalCustomCharges((prev) => [
        ...prev,
        { id: generateId(), description: newChargeDescription.trim(), amount },
      ]);
    }

    setShowAddChargeDialog(false);
    setNewChargeDescription('');
    setNewChargeAmount('');
  }, [newChargeDescription, newChargeAmount, onAddCustomCharge]);

  const handleRemoveCharge = useCallback(
    (chargeId: string) => {
      if (onRemoveCustomCharge) {
        onRemoveCustomCharge(chargeId);
      } else {
        setInternalCustomCharges((prev) => prev.filter((c) => c.id !== chargeId));
      }
    },
    [onRemoveCustomCharge]
  );

  // Loading state
  if (loading) {
    return (
      <Card className={compact ? 'shadow-sm' : ''}>
        <CardHeader className={compact ? 'py-3 px-4' : ''}>
          <CardTitle className={compact ? 'text-sm font-medium' : ''}>{title}</CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-3' : ''}>
          <div className="flex items-center justify-center py-4">
            <MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={compact ? 'shadow-sm' : ''}>
        <CardHeader className={compact ? 'py-3 px-4' : ''}>
          <CardTitle className={compact ? 'text-sm font-medium' : ''}>{title}</CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-3' : ''}>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  // No items state
  if (items.length === 0) {
    return (
      <Card className={compact ? 'shadow-sm' : ''}>
        <CardHeader className={compact ? 'py-3 px-4' : ''}>
          <CardTitle className={compact ? 'text-sm font-medium' : ''}>{title}</CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-3' : ''}>
          <div className="text-sm text-muted-foreground text-center py-2">
            No items to calculate
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={compact ? 'shadow-sm' : ''}>
        <CardHeader className={compact ? 'py-3 px-4' : ''}>
          <CardTitle className={compact ? 'text-sm font-medium flex items-center gap-2' : ''}>
            <MaterialIcon name="receipt_long" size="sm" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-3 space-y-2' : 'space-y-4'}>
          {/* Service not found warning */}
          {!calculation.serviceFound && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex items-center gap-1">
              <MaterialIcon name="warning" size="sm" />
              No matching service found in Price List
            </div>
          )}

          {/* Rate errors warning */}
          {calculation.hasRateErrors && calculation.serviceFound && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex items-center gap-1">
              <MaterialIcon name="info" size="sm" />
              Some items have no rate defined
            </div>
          )}

          {/* Line items */}
          <div className="space-y-1">
            {calculation.lineItems.map((item, index) => (
              <div
                key={`${item.service_code}-${item.class_code || 'default'}-${index}`}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate">
                    {item.service_name}
                    {item.class_name && (
                      <span className="text-muted-foreground"> ({item.class_name})</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">×{item.quantity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-right min-w-[60px]">
                    {formatCurrency(item.rate)}
                  </span>
                  <span className="font-mono font-medium text-right min-w-[70px]">
                    {formatCurrency(item.total)}
                  </span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleOpenOverrideDialog(item)}
                      title="Override rate"
                    >
                      <MaterialIcon
                        name={item.is_override ? 'edit' : 'edit_note'}
                        size="sm"
                        className={item.is_override ? 'text-primary' : 'text-muted-foreground'}
                      />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Custom charges */}
            {calculation.customCharges.map((charge) => (
              <div
                key={charge.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate text-muted-foreground">{charge.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-right min-w-[60px]">-</span>
                  <span className="font-mono font-medium text-right min-w-[70px]">
                    {formatCurrency(charge.amount)}
                  </span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleRemoveCharge(charge.id)}
                      title="Remove charge"
                    >
                      <MaterialIcon name="close" size="sm" className="text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-2" />

          {/* Totals */}
          <div className="space-y-1 text-sm">
            {calculation.customChargesTotal > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(calculation.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Additional Charges</span>
                  <span className="font-mono">{formatCurrency(calculation.customChargesTotal)}</span>
                </div>
              </>
            )}

            {showTax && calculation.taxRate > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Pre-Tax Total</span>
                  <span className="font-mono">{formatCurrency(calculation.preTaxTotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({calculation.taxRate}%)</span>
                  <span className="font-mono">{formatCurrency(calculation.taxAmount)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between font-medium pt-1">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(calculation.grandTotal)}</span>
            </div>
          </div>

          {/* Add charge button */}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleOpenAddChargeDialog}
            >
              <MaterialIcon name="add" size="sm" className="mr-1" />
              Add Charge
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Rate Override Dialog */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Override Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingLineItem && (
              <>
                <div className="text-sm">
                  <span className="font-medium">{editingLineItem.service_name}</span>
                  {editingLineItem.class_name && (
                    <span className="text-muted-foreground"> - {editingLineItem.class_name}</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Current rate: {formatCurrency(editingLineItem.rate)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="override-rate">New Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="override-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={overrideRate}
                      onChange={(e) => setOverrideRate(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyOverride}>Apply Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Charge Dialog */}
      <Dialog open={showAddChargeDialog} onOpenChange={setShowAddChargeDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Custom Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="charge-description">Description</Label>
              <Input
                id="charge-description"
                value={newChargeDescription}
                onChange={(e) => setNewChargeDescription(e.target.value)}
                placeholder="e.g., Rush Processing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="charge-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newChargeAmount}
                  onChange={(e) => setNewChargeAmount(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddChargeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCharge}>Add Charge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BillingCalculator;
