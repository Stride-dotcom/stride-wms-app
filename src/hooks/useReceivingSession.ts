import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { queueShipmentReceivedAlert, queueShipmentCompletedAlert } from '@/lib/alertQueue';
import { BILLING_DISABLED_ERROR } from '@/lib/billing/chargeTypeUtils';

// Helper to get rate from Price List (service_events table)
async function getRateFromPriceList(
  tenantId: string,
  serviceCode: string,
  classCode: string | null,
  accountId?: string | null
): Promise<{ rate: number; hasError: boolean; errorMessage?: string }> {
  try {
    // Check account_service_settings for is_enabled
    if (accountId) {
      const { data: accountSetting } = await supabase
        .from('account_service_settings')
        .select('is_enabled')
        .eq('account_id', accountId)
        .eq('service_code', serviceCode)
        .maybeSingle();

      if (accountSetting && accountSetting.is_enabled === false) {
        throw new Error(BILLING_DISABLED_ERROR);
      }
    }

    // Try class-specific rate first
    if (classCode) {
      const { data: classRate } = await (supabase
        .from('service_events') as any)
        .select('rate')
        .eq('tenant_id', tenantId)
        .eq('service_code', serviceCode)
        .eq('class_code', classCode)
        .eq('is_active', true)
        .maybeSingle();

      if (classRate) {
        return { rate: classRate.rate, hasError: false };
      }
    }

    // Fall back to general rate (no class_code)
    const { data: generalRate } = await (supabase
      .from('service_events') as any)
      .select('rate')
      .eq('tenant_id', tenantId)
      .eq('service_code', serviceCode)
      .is('class_code', null)
      .eq('is_active', true)
      .maybeSingle();

    if (generalRate) {
      return { rate: generalRate.rate, hasError: false };
    }

    // No rate found
    return {
      rate: 0,
      hasError: true,
      errorMessage: `No rate found in Price List for service: ${serviceCode}`,
    };
  } catch (error: any) {
    if (error?.message === BILLING_DISABLED_ERROR) {
      throw error; // Re-throw billing disabled errors for caller to handle
    }
    console.error('[getRateFromPriceList] Error:', error);
    return {
      rate: 0,
      hasError: true,
      errorMessage: 'Error looking up rate from Price List',
    };
  }
}

interface ReceivingSession {
  id: string;
  shipment_id: string;
  started_by: string;
  started_at: string;
  finished_at: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  verification_data: any;
  started_by_user?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface VerificationData {
  expected_items: { description: string; quantity: number }[];
  received_items: { description: string; quantity: number; item_id?: string; receivedWithoutId?: boolean; shipment_item_id?: string }[];
  discrepancies: { description: string; expected: number; received: number }[];
  backorder_items?: { description: string; quantity: number }[];
  [key: string]: unknown;
}

export interface FinishSessionResult {
  success: boolean;
  createdItemIds: string[];
}

export function useReceivingSession(shipmentId: string | undefined) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<ReceivingSession | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSession = useCallback(async () => {
    if (!shipmentId) return null;

    const { data, error } = await supabase
      .from('receiving_sessions')
      .select(`
        *,
        started_by_user:users!receiving_sessions_started_by_fkey(first_name, last_name, email)
      `)
      .eq('shipment_id', shipmentId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (!error && data) {
      setSession(data as any);
      return data;
    }
    setSession(null);
    return null;
  }, [shipmentId]);

  const startSession = async () => {
    if (!shipmentId || !profile?.tenant_id || !profile?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Unable to start receiving session',
      });
      return null;
    }

    setLoading(true);
    try {
      // Check if there's already an active session
      const existing = await fetchSession();
      if (existing) {
        toast({
          variant: 'destructive',
          title: 'Session Already Active',
          description: `This shipment is being received by another user.`,
        });
        return null;
      }

      const { data, error } = await supabase
        .from('receiving_sessions')
        .insert({
          tenant_id: profile.tenant_id,
          shipment_id: shipmentId,
          started_by: profile.id,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;

      // Update shipment status
      await supabase
        .from('shipments')
        .update({ status: 'receiving' })
        .eq('id', shipmentId);

      setSession(data as any);
      toast({
        title: 'Receiving Started',
        description: 'You can now receive items for this shipment.',
      });

      return data;
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to start receiving session',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateSessionNotes = async (notes: string) => {
    if (!session) return;

    const { error } = await supabase
      .from('receiving_sessions')
      .update({ notes })
      .eq('id', session.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save notes',
      });
    }
  };

  const finishSession = async (
    verificationData: VerificationData,
    createItems: boolean = true
  ): Promise<FinishSessionResult> => {
    if (!session || !profile?.tenant_id) return { success: false, createdItemIds: [] };

    setLoading(true);
    const createdItemIds: string[] = [];
    try {
      // Update session
      const { error: sessionError } = await supabase
        .from('receiving_sessions')
        .update({
          status: 'completed' as const,
          finished_at: new Date().toISOString(),
          verification_data: JSON.parse(JSON.stringify(verificationData)),
        })
        .eq('id', session.id);

      if (sessionError) throw sessionError;

      // Update shipment status
      const hasBackorders = verificationData.backorder_items && verificationData.backorder_items.length > 0;
      await supabase
        .from('shipments')
        .update({ 
          status: hasBackorders ? 'partial' : 'received',
          received_at: new Date().toISOString(),
        })
        .eq('id', session.shipment_id);

      // Create inventory items if requested
      if (createItems && verificationData.received_items.length > 0) {
        // Get shipment details for account info - include sidemark_id and shipment_type
        const { data: shipment } = await supabase
          .from('shipments')
          .select('account_id, warehouse_id, sidemark_id, shipment_type')
          .eq('id', session.shipment_id)
          .single();

        if (shipment) {
          // Get receiving dock location for this warehouse
          const { data: receivingDockId, error: dockError } = await supabase
            .rpc('get_or_create_receiving_dock', { p_warehouse_id: shipment.warehouse_id });

          if (dockError) {
            console.error('Error getting receiving dock:', dockError);
          }

          // Get the account to check auto_inspection and auto_assembly settings
          const { data: account } = await supabase
            .from('accounts')
            .select('auto_inspection_on_receiving, auto_assembly_on_receiving')
            .eq('id', shipment.account_id)
            .single();

          // Get tenant preferences for should_create_inspections and auto_assembly
          const { data: tenantPreferences } = await supabase
            .from('tenant_preferences')
            .select('should_create_inspections, auto_assembly_on_receiving')
            .eq('tenant_id', profile.tenant_id)
            .maybeSingle();

          // Use tenant preference if set, otherwise fall back to account setting
          const shouldCreateInspections = tenantPreferences?.should_create_inspections || account?.auto_inspection_on_receiving;
          const shouldCreateAssembly = tenantPreferences?.auto_assembly_on_receiving || account?.auto_assembly_on_receiving;

          for (const item of verificationData.received_items) {
            let currentItemId: string | null = null;
            let itemClassId: string | null = null; // Track class_id for billing

            // Check if this item already exists (created during shipment creation)
            // by looking up the shipment_item to see if it has an item_id
            let existingItemClassId: string | null = null;
            if (item.shipment_item_id) {
              const { data: shipmentItem } = await (supabase
                .from('shipment_items') as any)
                .select('item_id, expected_class_id')
                .eq('id', item.shipment_item_id)
                .single();

              if (shipmentItem?.item_id) {
                // Item already exists - UPDATE it instead of creating
                const updateData: Record<string, any> = {
                  current_location_id: receivingDockId || null,
                  description: item.description,
                  quantity: item.quantity,
                  status: 'active',
                  received_at: new Date().toISOString(),
                };

                // Set received_without_id flag if checked
                if (item.receivedWithoutId) {
                  updateData.received_without_id = true;
                }

                const { error: updateError } = await (supabase
                  .from('items') as any)
                  .update(updateData)
                  .eq('id', shipmentItem.item_id);

                if (updateError) {
                  console.error('Error updating item:', updateError);
                  continue;
                }

                currentItemId = shipmentItem.item_id;
                createdItemIds.push(currentItemId);

                // Get the item's class_id for billing lookups
                const { data: existingItem } = await (supabase
                  .from('items') as any)
                  .select('class_id')
                  .eq('id', shipmentItem.item_id)
                  .single();
                existingItemClassId = existingItem?.class_id || shipmentItem.expected_class_id || null;
                itemClassId = existingItemClassId;

                // Update shipment_item status
                await (supabase.from('shipment_items') as any)
                  .update({
                    status: 'received',
                    actual_quantity: item.quantity,
                  })
                  .eq('id', item.shipment_item_id);
              }
            }

            // If item doesn't exist yet, CREATE it (for backward compatibility)
            if (!currentItemId) {
              // Let DB trigger generate item_code (ITM-###-####)
              // Create item with received_without_id flag if set
              // Include sidemark_id from shipment if available
              const itemData: Record<string, any> = {
                tenant_id: profile.tenant_id,
                account_id: shipment.account_id,
                warehouse_id: shipment.warehouse_id,
                current_location_id: receivingDockId || null,
                sidemark_id: (shipment as any).sidemark_id || null,
                // item_code is auto-generated by DB trigger
                description: item.description,
                quantity: item.quantity,
                status: 'active',
                receiving_shipment_id: session.shipment_id,
                received_at: new Date().toISOString(),
              };

              // Set received_without_id flag if checked
              if (item.receivedWithoutId) {
                itemData.received_without_id = true;
              }

              const { data: newItemData, error: itemError } = await (supabase
                .from('items') as any)
                .insert(itemData)
                .select('id, item_type_id, class_id')
                .single();

              if (itemError) {
                console.error('Error creating item:', itemError);
                continue;
              }

              // Track created item ID and class_id for label printing and link to shipment_item
              if (newItemData) {
                currentItemId = newItemData.id;
                itemClassId = newItemData.class_id || null;
                createdItemIds.push(newItemData.id);

                // Link the created item back to the shipment_item
                if (item.shipment_item_id) {
                  await (supabase.from('shipment_items') as any)
                    .update({
                      item_id: newItemData.id,
                      status: 'received',
                      actual_quantity: item.quantity,
                    })
                    .eq('id', item.shipment_item_id);
                }
              }
            }

            // Use currentItemId for the rest of the logic (tasks, billing, etc.)
            // Also track class_id for billing lookups
            const newItem = currentItemId ? { id: currentItemId, class_id: itemClassId } : null;

            // Create inspection task if tenant preference or account setting is enabled
            if (shouldCreateInspections && newItem) {
              // Create the inspection task
              const { data: taskData } = await supabase
                .from('tasks')
                .insert({
                  tenant_id: profile.tenant_id,
                  title: `Inspect: ${item.description}`,
                  task_type: 'Inspection',
                  status: 'pending',
                  priority: 'medium',
                  account_id: shipment.account_id,
                  warehouse_id: shipment.warehouse_id,
                })
                .select('id')
                .single();

              // Link the item to the task via task_items
              if (taskData) {
                await supabase
                  .from('task_items')
                  .insert({
                    task_id: taskData.id,
                    item_id: newItem.id,
                  });
              }
            }

            // Create assembly task if tenant preference or account setting is enabled
            if (shouldCreateAssembly && newItem) {
              // Create the assembly task
              const { data: assemblyTaskData } = await supabase
                .from('tasks')
                .insert({
                  tenant_id: profile.tenant_id,
                  title: `Assemble: ${item.description}`,
                  task_type: 'Assembly',
                  status: 'pending',
                  priority: 'medium',
                  account_id: shipment.account_id,
                  warehouse_id: shipment.warehouse_id,
                })
                .select('id')
                .single();

              // Link the item to the task via task_items
              if (assemblyTaskData) {
                await supabase
                  .from('task_items')
                  .insert({
                    task_id: assemblyTaskData.id,
                    item_id: newItem.id,
                  });
                
                // Update item's assembly_status
                await (supabase
                  .from('items') as any)
                  .update({ assembly_status: 'pending' })
                  .eq('id', newItem.id);
              }
            }

            // Determine service type based on shipment type (return shipments use Returns Processing)
            const isReturnShipment = (shipment as any).shipment_type === 'return';
            const serviceCode = isReturnShipment ? 'Returns' : 'RCVG';
            const chargeDescription = isReturnShipment ? 'Returns Processing' : 'Receiving';

            // Get class code for rate lookup (if item has a class assigned)
            let classCode: string | null = null;
            if (newItem?.class_id) {
              const { data: classData } = await (supabase
                .from('classes') as any)
                .select('code')
                .eq('id', newItem.class_id)
                .maybeSingle();
              classCode = classData?.code || null;
            }

            // Get rate from Price List
            try {
              const rateResult = await getRateFromPriceList(
                profile.tenant_id,
                serviceCode,
                classCode,
                shipment.account_id
              );

              const totalAmount = rateResult.rate * item.quantity;

              // Create billing event for receiving/returns processing with actual rates
              await (supabase
                .from('billing_events') as any)
                .insert({
                  tenant_id: profile.tenant_id,
                  account_id: shipment.account_id,
                  shipment_id: session.shipment_id,
                  class_id: newItem?.class_id || null,
                  item_id: newItem?.id,
                  event_type: isReturnShipment ? 'returns_processing' : 'receiving',
                  charge_type: serviceCode,
                  description: `${chargeDescription}: ${item.description}`,
                  quantity: item.quantity,
                  unit_rate: rateResult.rate,
                  total_amount: totalAmount,
                  created_by: profile.id,
                  has_rate_error: rateResult.hasError,
                  rate_error_message: rateResult.errorMessage,
                  metadata: { shipment_id: session.shipment_id },
                });

              // Create billing event for "Received Without ID" if flag is set
              if (item.receivedWithoutId && newItem) {
                const noIdRateResult = await getRateFromPriceList(
                  profile.tenant_id,
                  'RECEIVED_WITHOUT_ID', // Flag service in Price List
                  null, // No class-based pricing for this flag
                  shipment.account_id
                );

                await (supabase
                  .from('billing_events') as any)
                  .insert({
                    tenant_id: profile.tenant_id,
                    account_id: shipment.account_id,
                    shipment_id: session.shipment_id,
                    class_id: newItem?.class_id || null,
                    item_id: newItem?.id,
                    event_type: 'flag_change',
                    charge_type: 'RECEIVED_WITHOUT_ID',
                    description: `Received Without ID: ${item.description}`,
                    quantity: 1,
                    unit_rate: noIdRateResult.rate,
                    total_amount: noIdRateResult.rate,
                    created_by: profile.id,
                    has_rate_error: noIdRateResult.hasError,
                    rate_error_message: noIdRateResult.errorMessage,
                    metadata: { shipment_id: session.shipment_id },
                  });
              }
            } catch (billingErr: any) {
              if (billingErr?.message === BILLING_DISABLED_ERROR) {
                console.warn(`[useReceivingSession] Billing disabled for ${serviceCode} on account ${shipment.account_id}, skipping billing event`);
                toast({ variant: 'destructive', title: 'Billing Disabled', description: BILLING_DISABLED_ERROR });
              } else {
                console.error('[useReceivingSession] Error creating billing event:', billingErr);
              }
            }
          }
        }
      }

      // Queue shipment.received alert
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select('shipment_number')
        .eq('id', session.shipment_id)
        .single();
      
      if (shipmentData && profile.tenant_id) {
        await queueShipmentReceivedAlert(
          profile.tenant_id,
          session.shipment_id,
          shipmentData.shipment_number || session.shipment_id,
          verificationData.received_items.length
        );

        // Also queue shipment.completed if no backorders
        const hasBackorders = verificationData.backorder_items && verificationData.backorder_items.length > 0;
        if (!hasBackorders) {
          await queueShipmentCompletedAlert(
            profile.tenant_id,
            session.shipment_id,
            shipmentData.shipment_number || session.shipment_id,
            verificationData.received_items.length
          );
        }
      }

      setSession(null);
      toast({
        title: 'Receiving Completed',
        description: 'Shipment has been received and items created.',
      });

      return { success: true, createdItemIds };
    } catch (error: any) {
      console.error('Error finishing session:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete receiving',
      });
      return { success: false, createdItemIds: [] };
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = async () => {
    if (!session) return;

    setLoading(true);
    try {
      await supabase
        .from('receiving_sessions')
        .update({
          status: 'cancelled',
          finished_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      // Revert shipment status
      await supabase
        .from('shipments')
        .update({ status: 'expected' })
        .eq('id', session.shipment_id);

      setSession(null);
      toast({
        title: 'Session Cancelled',
        description: 'Receiving session has been cancelled.',
      });
    } catch (error) {
      console.error('Error cancelling session:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    loading,
    fetchSession,
    startSession,
    updateSessionNotes,
    finishSession,
    cancelSession,
  };
}
