import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getServiceRate } from '@/lib/billingRates';
import { queueShipmentReceivedAlert, queueShipmentCompletedAlert } from '@/lib/alertQueue';

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
  received_items: { description: string; quantity: number; item_id?: string; receivedWithoutId?: boolean }[];
  discrepancies: { description: string; expected: number; received: number }[];
  backorder_items?: { description: string; quantity: number }[];
  [key: string]: unknown;
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
  ) => {
    if (!session || !profile?.tenant_id) return false;

    setLoading(true);
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
        // Get shipment details for account info
        const { data: shipment } = await supabase
          .from('shipments')
          .select('account_id, warehouse_id')
          .eq('id', session.shipment_id)
          .single();

        if (shipment) {
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
            // Generate item code
            const itemCode = `ITM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            
            // Create item with received_without_id flag if set
            const itemData: Record<string, any> = {
              tenant_id: profile.tenant_id,
              account_id: shipment.account_id,
              warehouse_id: shipment.warehouse_id,
              item_code: itemCode,
              description: item.description,
              quantity: item.quantity,
              status: 'available',
              receiving_shipment_id: session.shipment_id,
              received_at: new Date().toISOString(),
            };

            // Set received_without_id flag if checked
            if (item.receivedWithoutId) {
              itemData.received_without_id = true;
            }

            const { data: newItem, error: itemError } = await (supabase
              .from('items') as any)
              .insert(itemData)
              .select('id, item_type_id')
              .single();

            if (itemError) {
              console.error('Error creating item:', itemError);
              continue;
            }

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
                  .update({ assembly_status: 'in_queue' })
                  .eq('id', newItem.id);
              }
            }

            // Get receiving rate using unified rate lookup
            const receivingRateResult = await getServiceRate({
              accountId: shipment.account_id,
              itemTypeId: newItem?.item_type_id || null,
              serviceType: 'receiving',
            });

            const totalAmount = receivingRateResult.rate * item.quantity;

            // Create billing event for receiving with actual rates
            await (supabase
              .from('billing_events') as any)
              .insert({
                tenant_id: profile.tenant_id,
                account_id: shipment.account_id,
                item_id: newItem?.id,
                event_type: 'receiving',
                charge_type: 'receiving',
                description: `Receiving: ${item.description}`,
                quantity: item.quantity,
                unit_rate: receivingRateResult.rate,
                total_amount: totalAmount,
                created_by: profile.id,
                rate_source: receivingRateResult.source,
                service_category: receivingRateResult.category,
                needs_review: receivingRateResult.source === 'default',
              });

            // Create billing event for "Received Without ID" if flag is set
            if (item.receivedWithoutId && newItem) {
              const noIdRateResult = await getServiceRate({
                accountId: shipment.account_id,
                itemTypeId: newItem?.item_type_id || null,
                serviceType: 'received_without_id',
              });

              await (supabase
                .from('billing_events') as any)
                .insert({
                  tenant_id: profile.tenant_id,
                  account_id: shipment.account_id,
                  item_id: newItem?.id,
                  event_type: 'flag_change',
                  charge_type: 'received_without_id',
                  description: `Received Without ID: ${item.description}`,
                  quantity: 1,
                  unit_rate: noIdRateResult.rate,
                  total_amount: noIdRateResult.rate,
                  created_by: profile.id,
                  rate_source: noIdRateResult.source,
                  service_category: noIdRateResult.category,
                  needs_review: noIdRateResult.source === 'default',
                });
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

      return true;
    } catch (error: any) {
      console.error('Error finishing session:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete receiving',
      });
      return false;
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
