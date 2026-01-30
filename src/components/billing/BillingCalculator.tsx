/**
 * BillingCalculator Component
 *
 * Displays real-time billing view combining:
 * 1. Preview of charges that WILL be created (based on current items/rates)
 * 2. Actual billing_events that already EXIST in the database
 *
 * This is a READ-ONLY view - use the page-level "Add Charge" button to add charges.
 *
 * Uses shared logic from: src/lib/billing/billingCalculation.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateTaskBillingPreview,
  calculateShipmentBillingPreview,
  BillingPreview,
} from '@/lib/billing/billingCalculation';

// ============================================================================
// TYPES
// ============================================================================

interface ExistingBillingEvent {
  id: string;
  charge_type: string;
  description: string | null;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  event_type: string;
  status: string;
}

interface BillingCalculatorProps {
  // Context - provide ONE of these
  taskId?: string;
  shipmentId?: string;

  // Context details
  taskType?: string;
  shipmentDirection?: 'inbound' | 'outbound' | 'return';

  // For Assembly/Repair - billing parameters (read-only display)
  selectedServiceCode?: string | null;
  billingQuantity?: number | null;
  billingRate?: number | null;

  // Refresh trigger
  refreshKey?: number;

  // Display options
  title?: string;
  compact?: boolean;
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
  refreshKey = 0,
  title = 'Billing Charges',
  compact = true,
}: BillingCalculatorProps) {
  const { profile } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [existingEvents, setExistingEvents] = useState<ExistingBillingEvent[]>([]);

  // Determine context
  const isTask = !!taskId;
  const isShipment = !!shipmentId && !taskId;

  // Fetch existing billing events from database
  const fetchExistingEvents = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      let query = (supabase.from('billing_events') as any)
        .select('id, charge_type, description, quantity, unit_rate, total_amount, event_type, status')
        .eq('tenant_id', profile.tenant_id)
        .in('status', ['unbilled', 'flagged', 'billed']);

      // Filter by shipment or task
      if (shipmentId) {
        query = query.eq('shipment_id', shipmentId);
      } else if (taskId) {
        query = query.eq('task_id', taskId);
      } else {
        setExistingEvents([]);
        return;
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[BillingCalculator] Error fetching existing events:', error);
        setExistingEvents([]);
        return;
      }

      setExistingEvents(data || []);
    } catch (error) {
      console.error('[BillingCalculator] Unexpected error:', error);
      setExistingEvents([]);
    }
  }, [profile?.tenant_id, shipmentId, taskId]);

  // Calculate billing preview (what WILL be created)
  const calculatePreview = useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch existing events first
      await fetchExistingEvents();

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
    fetchExistingEvents,
  ]);

  // Recalculate when dependencies change
  useEffect(() => {
    calculatePreview();
  }, [calculatePreview, refreshKey]);

  // Calculate totals - existing events from DB + preview
  const existingEventsTotal = existingEvents.reduce((sum, e) => sum + (e.total_amount || e.unit_rate * e.quantity), 0);
  const previewTotal = preview?.subtotal || 0;
  
  // For shipments that are already received, don't show preview (events already exist)
  // For tasks, check if task_completion event exists
  const showPreview = isTask 
    ? !existingEvents.some(e => e.event_type === 'task_completion')
    : (isShipment && existingEvents.filter(e => 
        e.event_type === 'receiving' || e.event_type === 'returns_processing'
      ).length === 0);
  
  const grandTotal = existingEventsTotal + (showPreview ? previewTotal : 0);

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
    <Card className={compact ? 'shadow-sm' : ''}>
      <CardHeader className={compact ? 'py-3 px-4' : ''}>
        <CardTitle className={compact ? 'text-sm font-medium flex items-center gap-2' : ''}>
          <MaterialIcon name="attach_money" size="sm" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? 'px-4 pb-3 space-y-3' : 'space-y-4'}>

        {/* Per-Item Billing Preview (Shipments, Tasks, etc.) */}
        {showPreview && preview && preview.lineItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MaterialIcon name="schedule" size="sm" />
              Pending Charges (Preview)
            </p>
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
          </div>
        )}

        {/* Existing Billing Events from Database */}
        {existingEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MaterialIcon name="receipt_long" size="sm" />
              Recorded Charges ({existingEvents.length})
            </p>
            {existingEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{event.charge_type}</span>
                    <Badge 
                      variant={event.status === 'billed' ? 'default' : 'secondary'} 
                      className="text-[10px] px-1"
                    >
                      {event.status}
                    </Badge>
                  </div>
                  {event.description && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {event.description}
                    </span>
                  )}
                </div>
                <span className="font-medium ml-2">
                  {formatCurrency(event.total_amount || event.unit_rate * event.quantity)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {existingEvents.length === 0 && (!showPreview || !preview || preview.lineItems.length === 0) && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No billing charges yet
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
        {(existingEventsTotal > 0 || (showPreview && previewTotal > 0)) && (
          <div className="text-xs text-muted-foreground text-right space-x-2">
            {showPreview && previewTotal > 0 && <span>Preview: {formatCurrency(previewTotal)}</span>}
            {existingEventsTotal > 0 && <span>Recorded: {formatCurrency(existingEventsTotal)}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BillingCalculator;
