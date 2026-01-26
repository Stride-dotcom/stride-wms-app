/**
 * AddServiceDialog - Create or duplicate service events
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  ServiceEvent,
  CreateServiceEventInput,
  BILLING_TRIGGERS,
  CLASS_CODES,
  CLASS_LABELS,
  BILLING_UNITS,
  ALERT_RULES,
} from '@/hooks/useServiceEventsAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateFrom?: ServiceEvent | null;
  onSuccess: () => void;
}

interface ClassRate {
  class_code: string;
  rate: number;
  service_time_minutes?: number;
}

export function AddServiceDialog({
  open,
  onOpenChange,
  duplicateFrom,
  onSuccess,
}: AddServiceDialogProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    service_code: string;
    service_name: string;
    billing_unit: 'Day' | 'Item' | 'Task';
    rate: number;
    service_time_minutes: number | null;
    taxable: boolean;
    is_active: boolean;
    notes: string;
    add_flag: boolean;
    add_to_service_event_scan: boolean;
    alert_rule: string;
    billing_trigger: string;
    uses_class_pricing: boolean;
  }>({
    service_code: '',
    service_name: '',
    billing_unit: 'Item',
    rate: 0,
    service_time_minutes: null,
    taxable: true,
    is_active: true,
    notes: '',
    add_flag: false,
    add_to_service_event_scan: false,
    alert_rule: 'none',
    billing_trigger: 'SCAN EVENT',
    uses_class_pricing: false,
  });

  const [classRates, setClassRates] = useState<ClassRate[]>([]);

  // Initialize form when duplicating or opening
  useEffect(() => {
    if (open) {
      if (duplicateFrom) {
        setFormData({
          service_code: '', // Always blank for duplicate
          service_name: `${duplicateFrom.service_name} (Copy)`,
          billing_unit: duplicateFrom.billing_unit,
          rate: duplicateFrom.rate,
          service_time_minutes: duplicateFrom.service_time_minutes,
          taxable: duplicateFrom.taxable,
          is_active: true,
          notes: duplicateFrom.notes || '',
          add_flag: duplicateFrom.add_flag,
          add_to_service_event_scan: duplicateFrom.add_to_service_event_scan,
          alert_rule: duplicateFrom.alert_rule,
          billing_trigger: duplicateFrom.billing_trigger,
          uses_class_pricing: duplicateFrom.uses_class_pricing,
        });
        // If duplicating a class-based service, initialize class rates
        if (duplicateFrom.uses_class_pricing) {
          setClassRates(
            CLASS_CODES.map((code) => ({
              class_code: code,
              rate: duplicateFrom.rate,
              service_time_minutes: duplicateFrom.service_time_minutes || undefined,
            }))
          );
        } else {
          setClassRates([]);
        }
      } else {
        // Reset form for new service
        setFormData({
          service_code: '',
          service_name: '',
          billing_unit: 'Item',
          rate: 0,
          service_time_minutes: null,
          taxable: true,
          is_active: true,
          notes: '',
          add_flag: false,
          add_to_service_event_scan: false,
          alert_rule: 'none',
          billing_trigger: 'SCAN EVENT',
          uses_class_pricing: false,
        });
        setClassRates([]);
      }
    }
  }, [open, duplicateFrom]);

  // Toggle class pricing
  const handleToggleClassPricing = (checked: boolean) => {
    setFormData({ ...formData, uses_class_pricing: checked });
    if (checked && classRates.length === 0) {
      // Initialize class rates with current rate
      setClassRates(
        CLASS_CODES.map((code) => ({
          class_code: code,
          rate: formData.rate,
          service_time_minutes: formData.service_time_minutes || undefined,
        }))
      );
    }
  };

  // Update class rate
  const updateClassRate = (classCode: string, field: 'rate' | 'service_time_minutes', value: number) => {
    setClassRates((prev) =>
      prev.map((cr) =>
        cr.class_code === classCode ? { ...cr, [field]: value } : cr
      )
    );
  };

  // Handle save
  const handleSave = async () => {
    if (!profile?.tenant_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Not authenticated',
      });
      return;
    }

    if (!formData.service_code.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Service code is required',
      });
      return;
    }

    if (!formData.service_name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Service name is required',
      });
      return;
    }

    setSaving(true);
    try {
      const serviceCode = formData.service_code.toUpperCase().replace(/\s+/g, '_');

      // Check if service code exists
      const { data: existing } = await (supabase
        .from('service_events') as any)
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('service_code', serviceCode)
        .limit(1);

      if (existing && existing.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Service Code Exists',
          description: `Service code "${serviceCode}" already exists. Please choose a unique code.`,
        });
        setSaving(false);
        return;
      }

      const baseData = {
        tenant_id: profile.tenant_id,
        service_code: serviceCode,
        service_name: formData.service_name.trim(),
        billing_unit: formData.billing_unit,
        taxable: formData.taxable,
        uses_class_pricing: formData.uses_class_pricing,
        is_active: formData.is_active,
        notes: formData.notes.trim() || null,
        add_flag: formData.add_flag,
        add_to_service_event_scan: formData.add_to_service_event_scan,
        alert_rule: formData.alert_rule,
        billing_trigger: formData.billing_trigger,
      };

      if (formData.uses_class_pricing) {
        // Insert multiple rows for class-based pricing
        const inserts = classRates.map((cr) => ({
          ...baseData,
          class_code: cr.class_code,
          rate: cr.rate,
          service_time_minutes: cr.service_time_minutes || null,
        }));

        const { error } = await (supabase
          .from('service_events') as any)
          .insert(inserts);

        if (error) throw error;
      } else {
        // Insert single row
        const { error } = await (supabase
          .from('service_events') as any)
          .insert({
            ...baseData,
            class_code: null,
            rate: formData.rate,
            service_time_minutes: formData.service_time_minutes,
          });

        if (error) throw error;
      }

      toast({
        title: 'Service Created',
        description: `Service "${formData.service_name}" has been created successfully.`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('[AddServiceDialog] Save error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create service',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {duplicateFrom ? 'Duplicate Service' : 'Add New Service'}
          </DialogTitle>
          <DialogDescription>
            {duplicateFrom
              ? `Create a new service based on "${duplicateFrom.service_name}"`
              : 'Create a new service event for billing'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_code">Service Code *</Label>
              <Input
                id="service_code"
                value={formData.service_code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    service_code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                  })
                }
                placeholder="e.g., STORAGE_DAILY"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier (uppercase, underscores allowed)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_name">Service Name *</Label>
              <Input
                id="service_name"
                value={formData.service_name}
                onChange={(e) =>
                  setFormData({ ...formData, service_name: e.target.value })
                }
                placeholder="e.g., Daily Storage"
              />
            </div>
          </div>

          {/* Billing Settings */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Billing Unit *</Label>
              <Select
                value={formData.billing_unit}
                onValueChange={(value: 'Day' | 'Item' | 'Task') =>
                  setFormData({ ...formData, billing_unit: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing Trigger *</Label>
              <Select
                value={formData.billing_trigger}
                onValueChange={(value) =>
                  setFormData({ ...formData, billing_trigger: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Alert Rule</Label>
              <Select
                value={formData.alert_rule}
                onValueChange={(value) =>
                  setFormData({ ...formData, alert_rule: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_RULES.map((rule) => (
                    <SelectItem key={rule.value} value={rule.value}>
                      {rule.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Class Pricing Toggle */}
          <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
            <Checkbox
              id="uses_class_pricing"
              checked={formData.uses_class_pricing}
              onCheckedChange={handleToggleClassPricing}
            />
            <div className="flex-1">
              <Label htmlFor="uses_class_pricing" className="cursor-pointer font-medium">
                Use Class-Based Pricing
              </Label>
              <p className="text-xs text-muted-foreground">
                Set different rates for each size class (XS, S, M, L, XL, XXL)
              </p>
            </div>
          </div>

          {/* Rate Input (single rate) */}
          {!formData.uses_class_pricing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate">Rate ($) *</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate}
                  onChange={(e) =>
                    setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_time_minutes">Service Time (minutes)</Label>
                <Input
                  id="service_time_minutes"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.service_time_minutes ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_time_minutes: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          {/* Class-based Rates */}
          {formData.uses_class_pricing && (
            <div className="space-y-3 p-4 border rounded-lg">
              <Label>Rates by Class</Label>
              <div className="grid gap-3">
                {classRates.map((cr) => (
                  <div key={cr.class_code} className="grid grid-cols-3 gap-3 items-center">
                    <div className="font-medium text-sm">
                      {CLASS_LABELS[cr.class_code] || cr.class_code}
                    </div>
                    <div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cr.rate}
                        onChange={(e) =>
                          updateClassRate(cr.class_code, 'rate', parseFloat(e.target.value) || 0)
                        }
                        placeholder="Rate"
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={cr.service_time_minutes ?? ''}
                        onChange={(e) =>
                          updateClassRate(
                            cr.class_code,
                            'service_time_minutes',
                            e.target.value ? parseInt(e.target.value) : 0
                          )
                        }
                        placeholder="Minutes"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="taxable"
                  checked={formData.taxable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, taxable: !!checked })
                  }
                />
                <Label htmlFor="taxable" className="cursor-pointer">
                  Taxable
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: !!checked })
                  }
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Active
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="add_flag"
                  checked={formData.add_flag}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, add_flag: !!checked })
                  }
                />
                <Label htmlFor="add_flag" className="cursor-pointer">
                  Show in Item Flags
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="add_to_service_event_scan"
                  checked={formData.add_to_service_event_scan}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, add_to_service_event_scan: !!checked })
                  }
                />
                <Label htmlFor="add_to_service_event_scan" className="cursor-pointer">
                  Show in Service Event Scan
                </Label>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Internal notes about this service..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {duplicateFrom ? 'Create Duplicate' : 'Create Service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
