/**
 * AddServiceDialog - Create or duplicate service events
 * Supports class-based pricing with auto-generation of class rows
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ServiceEvent,
  CreateServiceEventInput,
  BILLING_TRIGGERS,
  CLASS_CODES,
  CLASS_LABELS,
  BILLING_UNITS,
  ALERT_RULES,
} from '@/hooks/useServiceEventsAdmin';
import { useServiceCategories } from '@/hooks/useServiceCategories';
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
  const { activeCategories } = useServiceCategories();
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
    category_id: string | null;
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
    category_id: null,
  });

  // Track if user has manually edited the service code
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  const [classRates, setClassRates] = useState<ClassRate[]>([]);

  // Generate service code from service name
  const generateServiceCode = (name: string): string => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '') // Remove special characters except spaces
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^_+|_+$/g, '') // Trim leading/trailing underscores
      .substring(0, 20); // Limit length
  };

  // Handle service name change - auto-generate code if not manually edited
  const handleServiceNameChange = (name: string) => {
    const updates: Partial<typeof formData> = { service_name: name };

    // Auto-generate service code if user hasn't manually edited it
    if (!codeManuallyEdited) {
      updates.service_code = generateServiceCode(name);
    }

    setFormData({ ...formData, ...updates });
  };

  // Handle service code change - mark as manually edited
  const handleServiceCodeChange = (code: string) => {
    setCodeManuallyEdited(true);
    setFormData({
      ...formData,
      service_code: code.toUpperCase().replace(/\s+/g, '_'),
    });
  };

  // Initialize form when duplicating or opening
  useEffect(() => {
    if (open) {
      if (duplicateFrom) {
        const copyName = `${duplicateFrom.service_name} (Copy)`;
        setFormData({
          service_code: generateServiceCode(copyName), // Auto-generate from name
          service_name: copyName,
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
          category_id: duplicateFrom.category_id || null,
        });
        setCodeManuallyEdited(false); // Reset manual edit flag
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
          category_id: null,
        });
        setCodeManuallyEdited(false); // Reset manual edit flag
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

  // Copy first rate to all class rates
  const copyFirstRateToAll = () => {
    if (classRates.length === 0) return;
    const firstRate = classRates[0].rate;
    const firstTime = classRates[0].service_time_minutes;
    setClassRates((prev) =>
      prev.map((cr) => ({
        ...cr,
        rate: firstRate,
        service_time_minutes: firstTime,
      }))
    );
  };

  // Scale rates by size (XS=base, each size increases by 50%)
  const scaleRatesBySize = () => {
    if (classRates.length === 0) return;
    const baseRate = classRates[0].rate;
    const baseTime = classRates[0].service_time_minutes || 0;
    const multipliers: Record<string, number> = {
      XS: 1.0,
      S: 1.25,
      M: 1.5,
      L: 2.0,
      XL: 2.5,
      XXL: 3.0,
    };
    setClassRates((prev) =>
      prev.map((cr) => ({
        ...cr,
        rate: Math.round(baseRate * (multipliers[cr.class_code] || 1) * 100) / 100,
        service_time_minutes: baseTime ? Math.round(baseTime * (multipliers[cr.class_code] || 1)) : undefined,
      }))
    );
  };

  // Get billing trigger description
  const getBillingTriggerDescription = (trigger: string): string => {
    const descriptions: Record<string, string> = {
      'SCAN EVENT': 'Charge created when item is scanned for this service',
      'AUTOCALCULATE': 'System automatically calculates (e.g., daily storage)',
      'Per Item Auto Calculated': 'Rate × quantity, automatically generated',
      'Flag': 'Creates a flag for manual review before billing',
      'Task - Assign Rate': 'Rate is locked in when task is assigned',
      'Through Task': 'Billed when associated task is completed',
      'Shipment': 'Billed per shipment, not per item',
      'Stocktake': 'Billed during stocktake/inventory count',
    };
    return descriptions[trigger] || '';
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
        category_id: formData.category_id,
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
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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
              <Label htmlFor="service_name">Service Name *</Label>
              <Input
                id="service_name"
                value={formData.service_name}
                onChange={(e) => handleServiceNameChange(e.target.value)}
                placeholder="e.g., Daily Storage"
              />
              <p className="text-xs text-muted-foreground">
                Display name for the service
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_code">Service Code *</Label>
              <Input
                id="service_code"
                value={formData.service_code}
                onChange={(e) => handleServiceCodeChange(e.target.value)}
                placeholder="e.g., STORAGE_DAILY"
              />
              <p className="text-xs text-muted-foreground">
                {codeManuallyEdited ? 'Manually set' : 'Auto-generated from name'}
              </p>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category_id || 'none'}
              onValueChange={(value) =>
                setFormData({ ...formData, category_id: value === 'none' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No category</span>
                </SelectItem>
                {activeCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Categories help organize services in the Price List (does not affect billing)
            </p>
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
                  value={formData.rate === 0 ? '' : formData.rate}
                  onChange={(e) =>
                    setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0"
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
              <div className="flex items-center justify-between">
                <Label>Rates by Class</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyFirstRateToAll}
                    disabled={classRates.length === 0}
                  >
                    <MaterialIcon name="content_copy" size="sm" className="mr-1" />
                    Copy XS to All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={scaleRatesBySize}
                    disabled={classRates.length === 0}
                  >
                    <MaterialIcon name="trending_up" size="sm" className="mr-1" />
                    Scale by Size
                  </Button>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground font-medium">
                  <div>Class</div>
                  <div>Rate ($)</div>
                  <div>Time (min)</div>
                </div>
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
              <p className="text-xs text-muted-foreground">
                "Scale by Size" applies multipliers: XS=1×, S=1.25×, M=1.5×, L=2×, XL=2.5×, XXL=3×
              </p>
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

          {/* Preview Section */}
          {formData.service_code && formData.service_name && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <MaterialIcon name="visibility" size="sm" className="text-muted-foreground" />
                <Label className="text-sm font-medium">Preview</Label>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Service:</span>
                  <Badge variant="outline" className="font-mono">
                    {formData.service_code.toUpperCase().replace(/\s+/g, '_')}
                  </Badge>
                  <span>-</span>
                  <span>{formData.service_name}</span>
                </div>
                <div>
                  <span className="font-medium">Billing: </span>
                  {formData.uses_class_pricing ? (
                    <span>
                      Per {formData.billing_unit} (varies by size)
                      <div className="mt-1 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {classRates.map((cr) => (
                          <span key={cr.class_code}>
                            {cr.class_code}: ${cr.rate.toFixed(2)}
                            {cr.service_time_minutes ? ` (${cr.service_time_minutes}m)` : ''}
                          </span>
                        ))}
                      </div>
                    </span>
                  ) : (
                    <span>
                      ${formData.rate.toFixed(2)} per {formData.billing_unit}
                      {formData.service_time_minutes ? ` (${formData.service_time_minutes} min)` : ''}
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-medium">Billed: </span>
                  <span>{getBillingTriggerDescription(formData.billing_trigger) || formData.billing_trigger}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    <span className="font-medium">Taxable: </span>
                    {formData.taxable ? 'Yes' : 'No'}
                  </span>
                  <span>
                    <span className="font-medium">Status: </span>
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {(formData.add_flag || formData.add_to_service_event_scan) && (
                  <div className="flex gap-2">
                    {formData.add_flag && (
                      <Badge variant="secondary" className="text-xs">Item Flags</Badge>
                    )}
                    {formData.add_to_service_event_scan && (
                      <Badge variant="secondary" className="text-xs">Scan Events</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
            {duplicateFrom ? 'Create Duplicate' : 'Create Service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
