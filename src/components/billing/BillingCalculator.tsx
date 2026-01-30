/**
 * BillingCalculator Component
 *
 * Displays real-time billing preview using the SAME calculation logic
 * that creates actual billing events. This guarantees the Calculator
 * shows exactly what will appear in Billing Reports once triggered.
 *
 * Uses shared logic from: src/lib/billing/billingCalculation.ts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  calculateTaskBillingPreview,
  calculateShipmentBillingPreview,
  getAssemblyServices,
  getRepairServiceRate,
  BillingPreview,
  BillingLineItem,
} from '@/lib/billing/billingCalculation';

// ============================================================================
// TYPES
// ============================================================================

interface CustomCharge {
  id: string;
  description: string;
  amount: number;
}

interface BillingCalculatorProps {
  // Context - provide ONE of these
  taskId?: string;
  shipmentId?: string;

  // Context details
  taskType?: string;
  shipmentDirection?: 'inbound' | 'outbound' | 'return';

  // For Assembly/Repair - manual service selection
  selectedServiceCode?: string | null;
  billingQuantity?: number | null;
  billingRate?: number | null;

  // Callbacks for Assembly/Repair
  onServiceChange?: (serviceCode: string | null) => void;
  onQuantityChange?: (quantity: number) => void;
  onRateChange?: (rate: number | null) => void;
  onTotalChange?: (total: number) => void;

  // Existing billing events (add-ons already created)
  existingCharges?: Array<{
    id: string;
    charge_type: string;
    description: string | null;
    quantity: number;
    unit_rate: number;
    total_amount: number;
  }>;

  // Refresh trigger
  refreshKey?: number;

  // Display options
  title?: string;
  compact?: boolean;
  readOnly?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BillingCalculator({
  taskId,
  shipmentId,
  taskType,
  shipmentDirection = 'inbound',
  selectedServiceCode,
  billingQuantity,
  billingRate,
  onServiceChange,
  onQuantityChange,
  onRateChange,
  onTotalChange,
  existingCharges = [],
  refreshKey = 0,
  title = 'Billing Charges',
  compact = true,
  readOnly = false,
}: BillingCalculatorProps) {
  const { profile } = useAuth();
  const { hasRole } = usePermissions();
  const canEdit = !readOnly && (hasRole('admin') || hasRole('tenant_admin') || hasRole('manager'));

  // State
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [assemblyServices, setAssemblyServices] = useState<Array<{
    serviceCode: string;
    serviceName: string;
    rate: number;
  }>>([]);
  const [repairService, setRepairService] = useState<{
    serviceCode: string;
    serviceName: string;
    rate: number;
  } | null>(null);

  // Custom charges (for add charge dialog)
  const [customCharges, setCustomCharges] = useState<CustomCharge[]>([]);
  const [showAddChargeDialog, setShowAddChargeDialog] = useState(false);
  const [newChargeDescription, setNewChargeDescription] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');

  // Local state for inputs
  const [localQuantity, setLocalQuantity] = useState('0');
  const [localRate, setLocalRate] = useState('');

  // Determine context
  const isTask = !!taskId;
  const isShipment = !!shipmentId && !taskId;
  const isAssembly = taskType === 'Assembly';
  const isRepair = taskType === 'Repair';
  const isPerTaskBilling = isAssembly || isRepair;

  // Load assembly/repair services for dropdowns
  useEffect(() => {
    if (!profile?.tenant_id) return;

    const loadServices = async () => {
      if (isAssembly) {
        const services = await getAssemblyServices(profile.tenant_id);
        setAssemblyServices(services);
      }
      if (isRepair) {
        const service = await getRepairServiceRate(profile.tenant_id);
        setRepairService(service);
      }
    };

    loadServices();
  }, [profile?.tenant_id, isAssembly, isRepair]);

  // Calculate billing preview
  const calculatePreview = useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let result: BillingPreview;

      if (isTask && taskId && taskType) {
        result = await calculateTaskBillingPreview(
          profile.tenant_id,
          taskId,
          taskType,
          selectedServiceCode,
          billingQuantity,
          billingRate
        );
      } else if (isShipment && shipmentId) {
        result = await calculateShipmentBillingPreview(
          profile.tenant_id,
          shipmentId,
          shipmentDirection
        );
      } else {
        result = {
          lineItems: [],
          subtotal: 0,
          hasErrors: false,
          serviceCode: '',
          serviceName: '',
        };
      }

      setPreview(result);
    } catch (error) {
      console.error('[BillingCalculator] Error calculating preview:', error);
      setPreview({
        lineItems: [],
        subtotal: 0,
        hasErrors: true,
        serviceCode: '',
        serviceName: '',
      });
    } finally {
      setLoading(false);
    }
  }, [
    profile?.tenant_id,
    isTask,
    isShipment,
    taskId,
    shipmentId,
    taskType,
    shipmentDirection,
    selectedServiceCode,
    billingQuantity,
    billingRate,
  ]);

  // Recalculate when dependencies change
  useEffect(() => {
    calculatePreview();
  }, [calculatePreview, refreshKey]);

  // Sync local inputs with props
  useEffect(() => {
    if (billingQuantity !== null && billingQuantity !== undefined) {
      setLocalQuantity(billingQuantity.toString());
    }
  }, [billingQuantity]);

  useEffect(() => {
    if (billingRate !== null && billingRate !== undefined) {
      setLocalRate(billingRate.toString());
    }
  }, [billingRate]);

  // Get default rate for Assembly/Repair
  const defaultRate = useMemo(() => {
    if (isAssembly && selectedServiceCode) {
      return assemblyServices.find(s => s.serviceCode === selectedServiceCode)?.rate || 0;
    }
    if (isRepair) {
      return repairService?.rate || 0;
    }
    return 0;
  }, [isAssembly, isRepair, selectedServiceCode, assemblyServices, repairService]);

  // Effective rate (override or default)
  const effectiveRate = billingRate !== null && billingRate !== undefined ? billingRate : defaultRate;
  const effectiveQuantity = billingQuantity ?? 0;

  // Calculate totals
  const baseTotal = preview?.subtotal || 0;
  const existingChargesTotal = existingCharges.reduce((sum, c) => sum + (c.total_amount || 0), 0);
  const customChargesTotal = customCharges.reduce((sum, c) => sum + c.amount, 0);
  const grandTotal = baseTotal + existingChargesTotal + customChargesTotal;

  // Notify parent of total changes
  useEffect(() => {
    onTotalChange?.(grandTotal);
  }, [grandTotal, onTotalChange]);

  // Handlers for Assembly/Repair inputs
  const handleServiceChange = (serviceCode: string) => {
    onServiceChange?.(serviceCode);
    // Reset rate override when service changes
    if (billingRate !== null) {
      onRateChange?.(null);
    }
    setLocalRate('');
  };

  const handleQuantityBlur = () => {
    const qty = parseFloat(localQuantity) || 0;
    if (qty !== billingQuantity) {
      onQuantityChange?.(qty);
    }
  };

  const handleRateBlur = () => {
    const rate = localRate === '' ? null : parseFloat(localRate);
    if (localRate !== '' && (isNaN(rate!) || rate! < 0)) return;
    onRateChange?.(rate);
  };

  // Custom charge handlers
  const handleAddCharge = () => {
    const amount = parseFloat(newChargeAmount);
    if (!newChargeDescription.trim() || isNaN(amount) || amount <= 0) return;

    setCustomCharges(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        description: newChargeDescription.trim(),
        amount,
      },
    ]);

    setShowAddChargeDialog(false);
    setNewChargeDescription('');
    setNewChargeAmount('');
  };

  const handleRemoveCustomCharge = (id: string) => {
    setCustomCharges(prev => prev.filter(c => c.id !== id));
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <Card className={compact ? 'shadow-sm' : ''}>
        <CardHeader className={compact ? 'py-3 px-4' : ''}>
          <CardTitle className={compact ? 'text-sm font-medium flex items-center gap-2' : ''}>
            <MaterialIcon name="attach_money" size="sm" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-3' : ''}>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
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
            <MaterialIcon name="attach_money" size="sm" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-3 space-y-3' : 'space-y-4'}>

          {/* Assembly Task - Service Dropdown + Quantity */}
          {isAssembly && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Assembly Service</label>
                {canEdit ? (
                  <Select
                    value={selectedServiceCode || '60MA'}
                    onValueChange={handleServiceChange}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select assembly time..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assemblyServices.map((service) => (
                        <SelectItem key={service.serviceCode} value={service.serviceCode}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span>{service.serviceName}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatCurrency(service.rate)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm font-medium">
                    {assemblyServices.find(s => s.serviceCode === selectedServiceCode)?.serviceName || 'Assembly'}
                  </div>
                )}
              </div>

              {/* Quantity × Rate = Subtotal */}
              <div className="flex items-center gap-3 py-2 border-y">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Qty</label>
                  {canEdit ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={localQuantity}
                      onChange={(e) => setLocalQuantity(e.target.value)}
                      onBlur={handleQuantityBlur}
                      className="h-8 w-20"
                    />
                  ) : (
                    <div className="text-sm font-medium">{effectiveQuantity}</div>
                  )}
                </div>
                <div className="text-muted-foreground">×</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Rate</label>
                    {billingRate !== null && billingRate !== undefined && (
                      <Badge variant="secondary" className="text-[10px] px-1">Override</Badge>
                    )}
                  </div>
                  {canEdit ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={localRate}
                      onChange={(e) => setLocalRate(e.target.value)}
                      onBlur={handleRateBlur}
                      placeholder={defaultRate > 0 ? defaultRate.toFixed(2) : '0.00'}
                      className="h-8 w-24"
                    />
                  ) : (
                    <div className="text-sm font-medium">{formatCurrency(effectiveRate)}</div>
                  )}
                </div>
                <div className="text-muted-foreground">=</div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Subtotal</label>
                  <div className="text-sm font-semibold">{formatCurrency(baseTotal)}</div>
                </div>
              </div>

              {effectiveQuantity === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <MaterialIcon name="warning" size="sm" />
                  Set quantity to complete task
                </p>
              )}
            </div>
          )}

          {/* Repair Task - Hours × Rate */}
          {isRepair && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Repair Service</label>
                <div className="text-sm font-medium flex items-center gap-2">
                  {repairService?.serviceName || '1 Hr Repair'}
                  <span className="text-muted-foreground text-xs">
                    ({formatCurrency(repairService?.rate || 0)}/hr)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 py-2 border-y">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Hours</label>
                  {canEdit ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={localQuantity}
                      onChange={(e) => setLocalQuantity(e.target.value)}
                      onBlur={handleQuantityBlur}
                      className="h-8 w-20"
                      placeholder="0"
                    />
                  ) : (
                    <div className="text-sm font-medium">{effectiveQuantity}</div>
                  )}
                </div>
                <div className="text-muted-foreground">×</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Rate</label>
                    {billingRate !== null && billingRate !== undefined && (
                      <Badge variant="secondary" className="text-[10px] px-1">Override</Badge>
                    )}
                  </div>
                  {canEdit ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={localRate}
                      onChange={(e) => setLocalRate(e.target.value)}
                      onBlur={handleRateBlur}
                      placeholder={defaultRate > 0 ? defaultRate.toFixed(2) : '0.00'}
                      className="h-8 w-24"
                    />
                  ) : (
                    <div className="text-sm font-medium">{formatCurrency(effectiveRate)}</div>
                  )}
                </div>
                <div className="text-muted-foreground">=</div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Subtotal</label>
                  <div className="text-sm font-semibold">{formatCurrency(baseTotal)}</div>
                </div>
              </div>

              {effectiveQuantity === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <MaterialIcon name="warning" size="sm" />
                  Set hours to complete task
                </p>
              )}
            </div>
          )}

          {/* Per-Item Billing (Shipments, Inspection, etc.) */}
          {!isPerTaskBilling && preview && (
            <div className="space-y-2">
              {/* Show line items grouped by class */}
              {preview.lineItems.length > 0 ? (
                <>
                  {/* Group by class for cleaner display */}
                  {(() => {
                    const byClass = new Map<string | null, { qty: number; rate: number; total: number; hasError: boolean }>();
                    preview.lineItems.forEach(item => {
                      const key = item.classCode;
                      const existing = byClass.get(key) || { qty: 0, rate: item.unitRate, total: 0, hasError: false };
                      existing.qty += item.quantity;
                      existing.total += item.totalAmount;
                      if (item.hasRateError) existing.hasError = true;
                      byClass.set(key, existing);
                    });

                    return Array.from(byClass.entries()).map(([classCode, data]) => (
                      <div key={classCode || 'default'} className="flex items-center justify-between py-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{preview.serviceName}</span>
                          {classCode && (
                            <Badge variant="outline" className="text-xs">{classCode}</Badge>
                          )}
                          <span className="text-muted-foreground">×{data.qty}</span>
                          {data.hasError && (
                            <MaterialIcon name="warning" size="sm" className="text-amber-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{formatCurrency(data.rate)}</span>
                          <span className="font-medium min-w-[70px] text-right">{formatCurrency(data.total)}</span>
                        </div>
                      </div>
                    ));
                  })()}

                  {preview.hasErrors && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                      <MaterialIcon name="info" size="sm" />
                      Some items have no rate defined in Price List
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm font-medium">
                    {taskType ? `${taskType} Rate` : 'Base Rate'}
                  </span>
                  <span className="text-sm font-medium">{formatCurrency(0)}</span>
                </div>
              )}
            </div>
          )}

          {/* Existing Charges (from billing_events) */}
          {existingCharges.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Add-on Charges
              </p>
              {existingCharges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between py-1.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="truncate block">{charge.charge_type}</span>
                    {charge.description && (
                      <span className="text-xs text-muted-foreground truncate block">
                        {charge.description}
                      </span>
                    )}
                  </div>
                  <span className="font-medium ml-2">{formatCurrency(charge.total_amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Custom Charges (local state) */}
          {customCharges.length > 0 && (
            <div className="space-y-1">
              {customCharges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">{charge.description}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(charge.amount)}</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveCustomCharge(charge.id)}
                      >
                        <MaterialIcon name="close" size="sm" className="text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(grandTotal)}
            </span>
          </div>

          {/* Breakdown */}
          {(baseTotal > 0 || existingCharges.length > 0 || customCharges.length > 0) && (
            <div className="text-xs text-muted-foreground text-right space-x-2">
              {baseTotal > 0 && <span>Base: {formatCurrency(baseTotal)}</span>}
              {existingChargesTotal > 0 && <span>Add-ons: {formatCurrency(existingChargesTotal)}</span>}
              {customChargesTotal > 0 && <span>Custom: {formatCurrency(customChargesTotal)}</span>}
            </div>
          )}

          {/* Add Charge Button */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setShowAddChargeDialog(true)}
            >
              <MaterialIcon name="add" size="sm" className="mr-1" />
              Add Charge
            </Button>
          )}
        </CardContent>
      </Card>

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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
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
