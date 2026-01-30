/**
 * BillingChargesSection - Displays and allows editing of billing charges
 * Shows auto-calculated base rate + add-on charges with editable breakdown
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceEvents } from '@/hooks/useServiceEvents';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

interface BillingCharge {
  id: string;
  charge_type: string;
  description: string | null;
  quantity: number;
  unit_rate: number;
  total_amount: number | null;
  status: string;
  event_type: string;
  is_calculated?: boolean; // True for auto-calculated charges
}

interface BillingChargesSectionProps {
  // Either taskId or shipmentId must be provided
  taskId?: string;
  shipmentId?: string;
  accountId?: string;
  accountName?: string;
  taskType?: string; // For calculating base rate
  itemCount?: number; // Number of items for calculating base rate
  refreshKey?: number; // Increment to trigger rate recalculation
  baseRate?: number | null; // Override billing rate from task/shipment
  onTotalChange?: (total: number) => void;
  onBaseRateChange?: (rate: number | null) => void;
  onSuccess?: () => void; // Callback when billing events are generated
}

// Map task types to service codes in the Price List
const TASK_TYPE_TO_SERVICE_CODE: Record<string, string> = {
  'Inspection': 'INSP',
  'Will Call': 'Will_Call',
  'Disposal': 'Disposal',
  'Assembly': '15MA',
  'Repair': '1HRO',
  'Receiving': 'RCVG',
  'Returns': 'Returns',
  'Shipping': 'Shipping',
  'Delivery': 'Delivery',
};

// Map shipment types to service codes
const SHIPMENT_TYPE_TO_SERVICE_CODE: Record<string, string> = {
  'inbound': 'RCVG',
  'return': 'Returns',
  'outbound': 'Shipping',
};

export function BillingChargesSection({
  taskId,
  shipmentId,
  accountId,
  accountName,
  taskType,
  itemCount = 1,
  refreshKey = 0,
  baseRate,
  onTotalChange,
  onBaseRateChange,
  onSuccess,
}: BillingChargesSectionProps) {
  const { profile } = useAuth();
  const { hasRole } = usePermissions();
  const { toast } = useToast();
  const { getServiceRate, loading: serviceEventsLoading } = useServiceEvents();

  const canEditBilling = hasRole('admin') || hasRole('tenant_admin') || hasRole('manager');

  const [charges, setCharges] = useState<BillingCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [calculatedBaseRate, setCalculatedBaseRate] = useState<number>(0);
  const [localBaseRate, setLocalBaseRate] = useState<string>('');
  const baseRateInitialized = useRef(false);

  // Fetch billing events for this task/shipment
  const fetchCharges = useCallback(async () => {
    if (!profile?.tenant_id || (!taskId && !shipmentId)) {
      setLoading(false);
      return;
    }

    try {
      // Build query for billing_events
      let query = (supabase.from('billing_events') as any)
        .select('id, charge_type, description, quantity, unit_rate, total_amount, status, event_type')
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['unbilled', 'flagged']);

      // Filter by task or shipment using direct columns
      if (taskId) {
        query = query.eq('task_id', taskId);
      } else if (shipmentId) {
        query = query.eq('shipment_id', shipmentId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        console.error('[BillingChargesSection] Error fetching charges:', error);
      }

      setCharges((data || []).map((c: any) => ({
        ...c,
        is_calculated: false,
      })));
    } catch (error) {
      console.error('[BillingChargesSection] Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, taskId, shipmentId]);

  // Calculate base rate from service_events pricing (using class-based rate lookup)
  const calculateBaseRate = useCallback(async () => {
    if (!profile?.tenant_id || serviceEventsLoading) {
      setCalculatedBaseRate(0);
      return;
    }

    // Determine service code from task type
    const serviceCode = taskType ? TASK_TYPE_TO_SERVICE_CODE[taskType] : null;
    if (!serviceCode && !shipmentId) {
      setCalculatedBaseRate(0);
      return;
    }

    try {
      let totalRate = 0;

      // For tasks, check billing unit first
      if (taskId && serviceCode) {
        // Check if this service is billed per task (like Assembly) or per item
        const serviceInfo = getServiceRate(serviceCode, null);

        if (serviceInfo.billingUnit === 'Task') {
          // Task-level billing: single rate for the whole task
          totalRate = serviceInfo.rate;
        } else {
          // Item-level billing: rate per item based on class
          // First fetch all classes to map class_id to code
          const { data: allClasses } = await (supabase
            .from('classes') as any)
            .select('id, code')
            .eq('tenant_id', profile.tenant_id);

          const classMap = new Map((allClasses || []).map((c: any) => [c.id, c.code]));

          const { data: taskItems, error } = await (supabase
            .from('task_items') as any)
            .select(`
              id,
              quantity,
              item:items!task_items_item_id_fkey(
                id,
                item_code,
                class_id
              )
            `)
            .eq('task_id', taskId);

          if (error) {
            console.error('[BillingChargesSection] Error fetching task items:', error);
            return;
          }

          // Deduplicate task_items by item_id (keep the first occurrence)
          const seenItemIds = new Set<string>();
          const uniqueTaskItems = (taskItems || []).filter((ti: any) => {
            const itemId = ti.item?.id;
            if (!itemId || seenItemIds.has(itemId)) {
              return false;
            }
            seenItemIds.add(itemId);
            return true;
          });

          // Look up rate for each unique item based on its class
          for (const taskItem of uniqueTaskItems) {
            const classCode = taskItem.item?.class_id ? classMap.get(taskItem.item.class_id) : null;
            const quantity = taskItem.quantity || 1;

            // Get rate from service_events using pre-fetched data (same as QuoteBuilder)
            const rateInfo = getServiceRate(serviceCode, classCode);
            totalRate += rateInfo.rate * quantity;
          }
        }
      }

      // For shipments, get shipment_items with their class codes
      if (shipmentId) {
        // First get shipment type to determine service code
        const { data: shipment } = await (supabase
          .from('shipments') as any)
          .select('shipment_type')
          .eq('id', shipmentId)
          .single();

        const shipmentServiceCode = shipment?.shipment_type
          ? SHIPMENT_TYPE_TO_SERVICE_CODE[shipment.shipment_type] || serviceCode
          : serviceCode;

        if (!shipmentServiceCode) {
          setCalculatedBaseRate(0);
          return;
        }

        // Fetch all classes to map class_id to code
        const { data: allClasses } = await (supabase
          .from('classes') as any)
          .select('id, code')
          .eq('tenant_id', profile.tenant_id);

        const classMap = new Map((allClasses || []).map((c: any) => [c.id, c.code]));

        const { data: shipmentItems, error } = await (supabase
          .from('shipment_items') as any)
          .select(`
            id,
            expected_quantity,
            actual_quantity,
            expected_class_id,
            item:items!shipment_items_item_id_fkey(
              id,
              item_code,
              class_id
            )
          `)
          .eq('shipment_id', shipmentId);

        if (error) {
          console.error('[BillingChargesSection] Error fetching shipment items:', error);
          return;
        }

        // Look up rate for each item based on its class
        for (const shipmentItem of shipmentItems || []) {
          // Use item's class_id if received, otherwise use expected_class_id
          const classId = shipmentItem.item?.class_id || shipmentItem.expected_class_id;
          const classCode = classId ? classMap.get(classId) : null;
          const quantity = shipmentItem.actual_quantity || shipmentItem.expected_quantity || 1;

          // Get rate from service_events using pre-fetched data (same as QuoteBuilder)
          const rateInfo = getServiceRate(shipmentServiceCode, classCode);
          totalRate += rateInfo.rate * quantity;
        }
      }

      setCalculatedBaseRate(totalRate);
    } catch (error) {
      console.error('[BillingChargesSection] Error calculating base rate:', error);
    }
  }, [taskId, shipmentId, taskType, itemCount, refreshKey, profile?.tenant_id, getServiceRate, serviceEventsLoading]);

  useEffect(() => {
    fetchCharges();
    calculateBaseRate();
  }, [fetchCharges, calculateBaseRate]);

  // Calculate totals
  const effectiveBaseRate = baseRate !== null && baseRate !== undefined ? baseRate : calculatedBaseRate;
  const addOnTotal = charges.reduce((sum, c) => sum + (c.total_amount || c.unit_rate * c.quantity), 0);
  const grandTotal = effectiveBaseRate + addOnTotal;

  useEffect(() => {
    onTotalChange?.(grandTotal);
  }, [grandTotal, onTotalChange]);

  // Handle editing a charge
  const handleStartEdit = (charge: BillingCharge) => {
    setEditingId(charge.id);
    setEditAmount(String(charge.unit_rate));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditAmount('');
  };

  const handleSaveEdit = async (chargeId: string) => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: 'Invalid amount' });
      return;
    }

    setSavingId(chargeId);
    try {
      const charge = charges.find(c => c.id === chargeId);
      const totalAmount = amount * (charge?.quantity || 1);

      const { error } = await (supabase.from('billing_events') as any)
        .update({ unit_rate: amount, total_amount: totalAmount })
        .eq('id', chargeId);

      if (error) throw error;

      setCharges(prev => prev.map(c =>
        c.id === chargeId ? { ...c, unit_rate: amount, total_amount: totalAmount } : c
      ));
      setEditingId(null);
      setEditAmount('');
      toast({ title: 'Charge Updated' });
    } catch (error) {
      console.error('Error updating charge:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update charge' });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteCharge = async (chargeId: string) => {
    setSavingId(chargeId);
    try {
      const { error } = await (supabase.from('billing_events') as any)
        .delete()
        .eq('id', chargeId);

      if (error) throw error;

      setCharges(prev => prev.filter(c => c.id !== chargeId));
      toast({ title: 'Charge Removed' });
    } catch (error) {
      console.error('Error deleting charge:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove charge' });
    } finally {
      setSavingId(null);
    }
  };

  // Initialize local base rate from prop
  useEffect(() => {
    if (baseRate !== null && baseRate !== undefined) {
      setLocalBaseRate(baseRate.toString());
      baseRateInitialized.current = true;
    } else if (calculatedBaseRate > 0 && !baseRateInitialized.current) {
      setLocalBaseRate('');
    }
  }, [baseRate, calculatedBaseRate]);

  const handleBaseRateChange = (value: string) => {
    // Just update local state - don't save to DB yet
    setLocalBaseRate(value);
  };

  const handleBaseRateBlur = () => {
    // Save on blur
    const rate = localBaseRate === '' ? null : parseFloat(localBaseRate);
    if (localBaseRate !== '' && (isNaN(rate!) || rate! < 0)) return;
    // Only save if value actually changed
    const currentRate = baseRate !== null && baseRate !== undefined ? baseRate : null;
    if (rate !== currentRate) {
      onBaseRateChange?.(rate);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="attach_money" size="sm" />
            Billing Charges
          </CardTitle>
        </CardHeader>
        <CardContent>
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MaterialIcon name="attach_money" size="sm" />
          Billing Charges
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Charge Breakdown */}
        <div className="space-y-2">
          {/* Base Rate Row */}
          <div className="flex items-center justify-between py-2 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {taskType ? `${taskType} Rate` : 'Base Rate'}
              </span>
              {calculatedBaseRate > 0 && baseRate === null && (
                <Badge variant="outline" className="text-xs">Auto</Badge>
              )}
              {baseRate !== null && baseRate !== undefined && (
                <Badge variant="secondary" className="text-xs">Override</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEditBilling ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={localBaseRate}
                  onChange={(e) => handleBaseRateChange(e.target.value)}
                  onBlur={handleBaseRateBlur}
                  placeholder={calculatedBaseRate > 0 ? calculatedBaseRate.toFixed(2) : '0.00'}
                  className="w-24 h-8 text-right"
                />
              ) : (
                <span className="text-sm font-medium">
                  ${effectiveBaseRate.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Add-on Charges */}
          {charges.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide pt-2">
                Add-on Charges
              </p>
              {charges.map((charge) => (
                <div
                  key={charge.id}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">
                      {charge.charge_type}
                    </span>
                    {charge.description && (
                      <span className="text-xs text-muted-foreground truncate block">
                        {charge.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {editingId === charge.id ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-20 h-7 text-right text-sm"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleSaveEdit(charge.id)}
                          disabled={savingId === charge.id}
                        >
                          {savingId === charge.id ? (
                            <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                          ) : (
                            <MaterialIcon name="save" size="sm" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={handleCancelEdit}
                        >
                          <MaterialIcon name="close" size="sm" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium min-w-[60px] text-right">
                          ${(charge.total_amount || charge.unit_rate * charge.quantity).toFixed(2)}
                        </span>
                        {canEditBilling && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleStartEdit(charge)}
                            >
                              <MaterialIcon name="edit" size="sm" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDeleteCharge(charge.id)}
                              disabled={savingId === charge.id}
                            >
                              {savingId === charge.id ? (
                                <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                              ) : (
                                <MaterialIcon name="delete" size="sm" />
                              )}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No charges message */}
          {charges.length === 0 && effectiveBaseRate === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No billing charges yet
            </p>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold text-primary">
            ${grandTotal.toFixed(2)}
          </span>
        </div>

        {/* Breakdown summary */}
        {(effectiveBaseRate > 0 || charges.length > 0) && (
          <div className="text-xs text-muted-foreground text-right">
            {effectiveBaseRate > 0 && (
              <span>Base: ${effectiveBaseRate.toFixed(2)}</span>
            )}
            {effectiveBaseRate > 0 && charges.length > 0 && ' + '}
            {charges.length > 0 && (
              <span>Add-ons: ${addOnTotal.toFixed(2)}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
