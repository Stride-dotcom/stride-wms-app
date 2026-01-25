import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  PricingFlag,
  FlagServiceRule,
  useUpdatePricingFlag,
  useCreatePricingFlag,
  useFlagServiceRules,
  useUpsertFlagServiceRule,
  useDeleteFlagServiceRule,
  useGlobalServiceRates,
} from '@/hooks/usePricing';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  DollarSign,
  Clock,
  Percent,
  AlertTriangle,
  Info,
} from 'lucide-react';

// Available icons for flags
const AVAILABLE_ICONS = [
  { value: 'flag', label: 'Flag' },
  { value: 'alert-triangle', label: 'Warning' },
  { value: 'package', label: 'Package' },
  { value: 'weight', label: 'Weight' },
  { value: 'maximize', label: 'Size' },
  { value: 'ruler', label: 'Ruler' },
  { value: 'layers', label: 'Layers' },
  { value: 'box', label: 'Box' },
  { value: 'wrench', label: 'Wrench' },
  { value: 'hammer', label: 'Hammer' },
  { value: 'bell', label: 'Bell' },
  { value: 'help-circle', label: 'Question' },
  { value: 'glass-water', label: 'Water' },
  { value: 'gem', label: 'Gem' },
  { value: 'thermometer', label: 'Temperature' },
  { value: 'biohazard', label: 'Hazard' },
  { value: 'hand', label: 'Hand' },
  { value: 'zap', label: 'Lightning' },
  { value: 'paintbrush', label: 'Paint' },
  { value: 'package-x', label: 'No Package' },
  { value: 'puzzle', label: 'Puzzle' },
];

// Available colors for flags
const AVAILABLE_COLORS = [
  { value: 'default', label: 'Default (Gray)' },
  { value: 'warning', label: 'Warning (Amber)' },
  { value: 'destructive', label: 'Destructive (Red)' },
  { value: 'success', label: 'Success (Green)' },
];

// Task types that can be triggered
const TASK_TYPES = [
  { value: '', label: 'None' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'repair', label: 'Repair' },
  { value: 'assembly', label: 'Assembly' },
  { value: 'photo_documentation', label: 'Photo Documentation' },
  { value: 'custom', label: 'Custom Task' },
];

interface FlagConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flag?: PricingFlag | null;
  onSaved?: () => void;
}

export function FlagConfigDialog({
  open,
  onOpenChange,
  flag,
  onSaved,
}: FlagConfigDialogProps) {
  const isEditing = !!flag;

  // Form state
  const [formData, setFormData] = useState<Partial<PricingFlag>>({
    flag_key: '',
    display_name: '',
    description: '',
    icon: 'flag',
    color: 'default',
    is_active: true,
    visible_to_client: true,
    client_can_set: false,
    is_billable: false,
    creates_billing_event: false,
    billing_charge_type: '',
    flat_fee: 0,
    adds_percent: 0,
    adds_minutes: 0,
    applies_to_services: 'ALL',
    triggers_task_type: null,
    triggers_alert: false,
  });

  // Service rule being edited
  const [editingRule, setEditingRule] = useState<Partial<FlagServiceRule> | null>(null);
  const [newRuleServiceCode, setNewRuleServiceCode] = useState('');

  // Mutations
  const updateFlag = useUpdatePricingFlag();
  const createFlag = useCreatePricingFlag();
  const upsertRule = useUpsertFlagServiceRule();
  const deleteRule = useDeleteFlagServiceRule();

  // Queries
  const { data: serviceRules = [], isLoading: rulesLoading } = useFlagServiceRules(flag?.id);
  const { data: services = [] } = useGlobalServiceRates();

  // Initialize form when flag changes
  useEffect(() => {
    if (flag) {
      setFormData({
        flag_key: flag.flag_key,
        display_name: flag.display_name,
        description: flag.description || '',
        icon: flag.icon || 'flag',
        color: flag.color || 'default',
        is_active: flag.is_active,
        visible_to_client: flag.visible_to_client,
        client_can_set: flag.client_can_set,
        is_billable: flag.is_billable,
        creates_billing_event: flag.creates_billing_event,
        billing_charge_type: flag.billing_charge_type || '',
        flat_fee: flag.flat_fee || 0,
        adds_percent: flag.adds_percent || 0,
        adds_minutes: flag.adds_minutes || 0,
        applies_to_services: flag.applies_to_services || 'ALL',
        triggers_task_type: flag.triggers_task_type || null,
        triggers_alert: flag.triggers_alert,
      });
    } else {
      setFormData({
        flag_key: '',
        display_name: '',
        description: '',
        icon: 'flag',
        color: 'default',
        is_active: true,
        visible_to_client: true,
        client_can_set: false,
        is_billable: false,
        creates_billing_event: false,
        billing_charge_type: '',
        flat_fee: 0,
        adds_percent: 0,
        adds_minutes: 0,
        applies_to_services: 'ALL',
        triggers_task_type: null,
        triggers_alert: false,
      });
    }
    setEditingRule(null);
    setNewRuleServiceCode('');
  }, [flag, open]);

  const handleSave = async () => {
    if (!formData.display_name) {
      toast.error('Display name is required');
      return;
    }

    try {
      if (isEditing && flag) {
        await updateFlag.mutateAsync({
          id: flag.id,
          ...formData,
          triggers_task_type: formData.triggers_task_type || null,
        });
      } else {
        const flagKey = formData.flag_key || formData.display_name?.toUpperCase().replace(/\s+/g, '_');
        await createFlag.mutateAsync({
          ...formData,
          flag_key: flagKey,
          display_name: formData.display_name,
          triggers_task_type: formData.triggers_task_type || null,
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleAddServiceRule = () => {
    if (!newRuleServiceCode || !flag) return;

    setEditingRule({
      flag_id: flag.id,
      service_code: newRuleServiceCode,
      adds_percent: 0,
      adds_flat_fee: 0,
      adds_minutes: 0,
      multiplier: 1,
    });
  };

  const handleSaveServiceRule = async () => {
    if (!editingRule || !flag) return;

    try {
      await upsertRule.mutateAsync({
        flag_id: flag.id,
        service_code: editingRule.service_code!,
        adds_percent: editingRule.adds_percent || 0,
        adds_flat_fee: editingRule.adds_flat_fee || 0,
        adds_minutes: editingRule.adds_minutes || 0,
        multiplier: editingRule.multiplier || 1,
      });
      setEditingRule(null);
      setNewRuleServiceCode('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeleteServiceRule = async (serviceCode: string) => {
    if (!flag) return;

    try {
      await deleteRule.mutateAsync({
        flagId: flag.id,
        serviceCode,
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Get services that don't have a rule yet
  const availableServicesForRules = services.filter(
    (s) => !serviceRules.some((r) => r.service_code === s.code)
  );

  const isSaving = updateFlag.isPending || createFlag.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Flag: ${flag.display_name}` : 'Add New Flag'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="pricing">Default Pricing</TabsTrigger>
            <TabsTrigger value="service-rules" disabled={!isEditing}>
              Per-Service Rules
            </TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="e.g., Overweight"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="flag_key">Flag Key</Label>
                <Input
                  id="flag_key"
                  value={formData.flag_key || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, flag_key: e.target.value.toUpperCase().replace(/\s+/g, '_') })
                  }
                  placeholder="Auto-generated from name"
                  disabled={isEditing}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier (auto-generated if blank)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe when this flag should be used..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={formData.icon || 'flag'}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>
                        {icon.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <Select
                  value={formData.color || 'default'}
                  onValueChange={(value) => setFormData({ ...formData, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Client Portal Settings</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="visible_to_client"
                    checked={formData.visible_to_client}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, visible_to_client: !!checked })
                    }
                  />
                  <Label htmlFor="visible_to_client" className="cursor-pointer">
                    Visible to clients (show in client portal)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="client_can_set"
                    checked={formData.client_can_set}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, client_can_set: !!checked })
                    }
                  />
                  <Label htmlFor="client_can_set" className="cursor-pointer">
                    Clients can toggle this flag
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
                    Flag is active
                  </Label>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Default Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Default Pricing Adjustments</p>
                  <p className="text-xs text-muted-foreground">
                    These values apply to all services unless overridden by per-service rules.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_billable"
                  checked={formData.is_billable}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_billable: !!checked })
                  }
                />
                <Label htmlFor="is_billable" className="cursor-pointer">
                  This flag is billable
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="creates_billing_event"
                  checked={formData.creates_billing_event}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, creates_billing_event: !!checked })
                  }
                />
                <Label htmlFor="creates_billing_event" className="cursor-pointer">
                  Automatically create billing event when flag is set
                </Label>
              </div>
            </div>

            {formData.creates_billing_event && (
              <div className="space-y-2">
                <Label>Billing Charge Type</Label>
                <Input
                  value={formData.billing_charge_type || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, billing_charge_type: e.target.value })
                  }
                  placeholder="e.g., FLAG_SURCHARGE"
                />
                <p className="text-xs text-muted-foreground">
                  The charge type code for billing events
                </p>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Flat Fee
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.flat_fee || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, flat_fee: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Fixed amount added
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Adds Percent (%)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.adds_percent || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, adds_percent: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  % added to rate
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Adds Minutes
                </Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.adds_minutes || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, adds_minutes: parseInt(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Extra time added
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Applies to Services</Label>
              <Input
                value={formData.applies_to_services || 'ALL'}
                onChange={(e) =>
                  setFormData({ ...formData, applies_to_services: e.target.value })
                }
                placeholder="ALL or comma-separated: STORAGE,INSPECTION"
              />
              <p className="text-xs text-muted-foreground">
                Enter "ALL" or specific service codes separated by commas
              </p>
            </div>
          </TabsContent>

          {/* Per-Service Rules Tab */}
          <TabsContent value="service-rules" className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Per-Service Adjustments</p>
                  <p className="text-xs text-muted-foreground">
                    Override the default pricing adjustments for specific services.
                    For example, Overweight might add +10% to Storage but +20% to Delivery.
                  </p>
                </div>
              </div>
            </div>

            {/* Add new rule */}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label>Add Service-Specific Rule</Label>
                <Select
                  value={newRuleServiceCode}
                  onValueChange={setNewRuleServiceCode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServicesForRules.map((service) => (
                      <SelectItem key={service.code} value={service.code}>
                        {service.name} ({service.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddServiceRule}
                disabled={!newRuleServiceCode}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Rule
              </Button>
            </div>

            {/* Editing rule form */}
            {editingRule && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    Configure: {services.find((s) => s.code === editingRule.service_code)?.name || editingRule.service_code}
                  </h4>
                  <Badge variant="outline">{editingRule.service_code}</Badge>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Flat Fee ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingRule.adds_flat_fee || 0}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          adds_flat_fee: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Adds Percent (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editingRule.adds_percent || 0}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          adds_percent: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Adds Minutes</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={editingRule.adds_minutes || 0}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          adds_minutes: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Multiplier</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editingRule.multiplier || 1}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          multiplier: parseFloat(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingRule(null);
                      setNewRuleServiceCode('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveServiceRule} disabled={upsertRule.isPending}>
                    {upsertRule.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Save Rule
                  </Button>
                </div>
              </div>
            )}

            {/* Existing rules table */}
            {rulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : serviceRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No per-service rules configured.</p>
                <p className="text-sm">Default pricing adjustments will apply to all services.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Flat Fee</TableHead>
                    <TableHead className="text-right">Adds %</TableHead>
                    <TableHead className="text-right">Minutes</TableHead>
                    <TableHead className="text-right">Multiplier</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        {services.find((s) => s.code === rule.service_code)?.name || rule.service_code}
                        <Badge variant="outline" className="ml-2">{rule.service_code}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${(rule.adds_flat_fee || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {rule.adds_percent || 0}%
                      </TableCell>
                      <TableCell className="text-right">
                        {rule.adds_minutes || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {rule.multiplier || 1}x
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingRule(rule)}
                          >
                            <Percent className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteServiceRule(rule.service_code)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-4 mt-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Automation Settings</p>
                  <p className="text-xs text-muted-foreground">
                    Configure automatic actions when this flag is set on an item.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="triggers_alert"
                  checked={formData.triggers_alert}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, triggers_alert: !!checked })
                  }
                />
                <Label htmlFor="triggers_alert" className="cursor-pointer">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Send alert notification when flag is set
                  </span>
                </Label>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Auto-Create Task</Label>
                <Select
                  value={formData.triggers_task_type || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, triggers_task_type: value || null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No automatic task" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Automatically create a task of this type when the flag is set
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Flag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
