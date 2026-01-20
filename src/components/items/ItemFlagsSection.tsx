import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useBillingEvents } from '@/hooks/useBillingEvents';
import { useTenantPreferences } from '@/hooks/useTenantPreferences';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Package,
  Ruler,
  Layers,
  Box,
  Wrench,
  Search,
  Hammer,
  Bell,
  HelpCircle,
} from 'lucide-react';

interface ItemFlags {
  is_overweight: boolean;
  is_oversize: boolean;
  is_unstackable: boolean;
  is_crated: boolean;
  needs_repair: boolean;
  needs_inspection: boolean;
  needs_warehouse_assembly: boolean;
  notify_dispatch: boolean;
  has_damage: boolean;
  received_without_id: boolean;
  needs_minor_touchup: boolean;
}

interface ItemFlagsSectionProps {
  itemId: string;
  accountId?: string;
  flags: ItemFlags;
  onFlagsChange: (flags: ItemFlags) => void;
  isClientUser?: boolean;
}

interface FlagConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  billable: boolean;
  clientEditable?: boolean;
}

const FLAG_CONFIG: FlagConfig[] = [
  { key: 'is_overweight', label: 'Overweight', icon: Package, billable: true },
  { key: 'is_oversize', label: 'Oversize', icon: Ruler, billable: true },
  { key: 'is_unstackable', label: 'Unstackable', icon: Layers, billable: true },
  { key: 'is_crated', label: 'Crate Disposal', icon: Box, billable: true },
  { key: 'needs_minor_touchup', label: 'Minor Touch Up', icon: Wrench, billable: true },
  { key: 'received_without_id', label: 'Received Without ID', icon: HelpCircle, billable: true },
  { key: 'needs_repair', label: 'Needs Repair', icon: Wrench, billable: false, clientEditable: true },
  { key: 'needs_inspection', label: 'Needs Inspection', icon: Search, billable: false, clientEditable: true },
  { key: 'needs_warehouse_assembly', label: 'Needs Warehouse Assembly', icon: Hammer, billable: false },
  { key: 'notify_dispatch', label: 'Notify Dispatch', icon: Bell, billable: false },
];

export function ItemFlagsSection({
  itemId,
  accountId,
  flags,
  onFlagsChange,
  isClientUser = false,
}: ItemFlagsSectionProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { createFlagBillingEvent } = useBillingEvents();
  const { preferences } = useTenantPreferences();
  const [updating, setUpdating] = useState<string | null>(null);

  // Helper to create a repair task automatically
  const createRepairTask = async () => {
    if (!profile?.tenant_id) return;

    try {
      // Get item details for task title
      const { data: item } = await (supabase
        .from('items') as any)
        .select('item_code, client_account, warehouse_id')
        .eq('id', itemId)
        .single();

      // Find account_id from client_account name
      let taskAccountId = accountId;
      if (!taskAccountId && item?.client_account) {
        const { data: account } = await supabase
          .from('accounts')
          .select('id')
          .eq('account_name', item.client_account)
          .maybeSingle();
        taskAccountId = account?.id;
      }

      // Create the repair task
      const { data: newTask, error } = await (supabase
        .from('tasks') as any)
        .insert({
          tenant_id: profile.tenant_id,
          title: `Repair - ${item?.item_code || '1 item'}`,
          task_type: 'Repair',
          status: 'in_queue',
          priority: 'medium',
          warehouse_id: item?.warehouse_id || null,
          account_id: taskAccountId || null,
          bill_to: 'account',
        })
        .select()
        .single();

      if (error) throw error;

      // Link item to task
      if (newTask) {
        await (supabase.from('task_items') as any).insert({
          task_id: newTask.id,
          item_id: itemId,
        });

        toast({
          title: 'Repair Task Created',
          description: 'An automatic repair task has been created for this item.',
        });
      }
    } catch (error) {
      console.error('Error creating repair task:', error);
      // Don't show error toast - the flag update was successful
    }
  };

  const handleFlagChange = async (flagKey: keyof ItemFlags, value: boolean) => {
    // Client users can only edit needs_repair and needs_inspection
    if (isClientUser) {
      const config = FLAG_CONFIG.find(f => f.key === flagKey);
      if (!config?.clientEditable) {
        toast({
          title: 'Permission Denied',
          description: 'You do not have permission to change this flag.',
          variant: 'destructive',
        });
        return;
      }
    }

    setUpdating(flagKey);

    try {
      const updateData: Record<string, any> = {};
      updateData[flagKey] = value;

      // Auto-set corresponding status to 'in_queue' when enabling needs_* flags
      if (value) {
        if (flagKey === 'needs_inspection') {
          updateData['inspection_status'] = 'in_queue';
        } else if (flagKey === 'needs_repair') {
          updateData['repair_status'] = 'in_queue';
        } else if (flagKey === 'needs_warehouse_assembly') {
          updateData['assembly_status'] = 'in_queue';
        }
      }

      const { error } = await (supabase
        .from('items') as any)
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      // Create billing event for billable flags (only when setting to true)
      const config = FLAG_CONFIG.find(f => f.key === flagKey);
      if (config?.billable && value) {
        await createFlagBillingEvent(itemId, flagKey, value);
      }

      // Auto-create repair task when needs_repair is enabled and preference is set
      if (flagKey === 'needs_repair' && value && preferences?.auto_repair_on_damage) {
        await createRepairTask();
      }

      // Update local state including status changes
      const updatedFlags = { ...flags, [flagKey]: value };
      onFlagsChange(updatedFlags);

      toast({
        title: 'Flag Updated',
        description: `${config?.label} ${value ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error updating flag:', error);
      toast({
        title: 'Error',
        description: 'Failed to update flag.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Item Flags
          {flags.has_damage && (
            <Badge variant="destructive" className="ml-2">
              Damage Reported
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {FLAG_CONFIG.map((config) => {
            const Icon = config.icon;
            const isDisabled = isClientUser && !config.clientEditable;
            const isUpdating = updating === config.key;
            const isChecked = flags[config.key as keyof ItemFlags] || false;

            return (
              <div
                key={config.key}
                className={`flex items-center gap-3 p-2 rounded-md ${
                  isDisabled ? 'opacity-50' : 'hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  id={config.key}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleFlagChange(config.key as keyof ItemFlags, checked as boolean)
                  }
                  disabled={isDisabled || isUpdating}
                />
                <Label
                  htmlFor={config.key}
                  className={`flex items-center gap-2 cursor-pointer ${
                    isDisabled ? 'cursor-not-allowed' : ''
                  }`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{config.label}</span>
                  {config.billable && (
                    <Badge variant="outline" className="text-xs">
                      $
                    </Badge>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
        
        {isClientUser && (
          <p className="text-xs text-muted-foreground mt-4">
            As a client, you can only modify "Needs Repair" and "Needs Inspection" flags.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
