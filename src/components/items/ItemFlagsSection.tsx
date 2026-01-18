import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useBillingEvents } from '@/hooks/useBillingEvents';
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
}

interface ItemFlagsSectionProps {
  itemId: string;
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
  { key: 'is_crated', label: 'Crated', icon: Box, billable: true },
  { key: 'needs_repair', label: 'Needs Repair', icon: Wrench, billable: false, clientEditable: true },
  { key: 'needs_inspection', label: 'Needs Inspection', icon: Search, billable: false, clientEditable: true },
  { key: 'needs_warehouse_assembly', label: 'Needs Warehouse Assembly', icon: Hammer, billable: false },
  { key: 'notify_dispatch', label: 'Notify Dispatch', icon: Bell, billable: false },
];

export function ItemFlagsSection({
  itemId,
  flags,
  onFlagsChange,
  isClientUser = false,
}: ItemFlagsSectionProps) {
  const { toast } = useToast();
  const { createFlagBillingEvent } = useBillingEvents();
  const [updating, setUpdating] = useState<string | null>(null);

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
      const updateData: Record<string, boolean> = {};
      updateData[flagKey] = value;

      const { error } = await (supabase
        .from('items') as any)
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      // Create billing event for billable flags
      const config = FLAG_CONFIG.find(f => f.key === flagKey);
      if (config?.billable && value) {
        await createFlagBillingEvent(itemId, flagKey, value);
      }

      onFlagsChange({ ...flags, [flagKey]: value });

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
