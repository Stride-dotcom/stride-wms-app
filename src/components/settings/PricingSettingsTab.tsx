/**
 * PricingSettingsTab - Admin UI for Charge Types and Pricing Rules
 *
 * New pricing system management interface.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useToast } from '@/hooks/use-toast';
import {
  useChargeTypes,
  usePricingRules,
  useChargeTypesWithRules,
  CHARGE_CATEGORIES,
  TRIGGER_OPTIONS,
  INPUT_MODE_OPTIONS,
  UNIT_OPTIONS,
  PRICING_METHOD_OPTIONS,
  CLASS_CODES,
  type ChargeType,
  type PricingRule,
  type CreateChargeTypeInput,
  type CreatePricingRuleInput,
} from '@/hooks/useChargeTypes';

export function PricingSettingsTab() {
  const [activeTab, setActiveTab] = useState('charge-types');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Pricing Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Manage charge types and pricing rules for billing.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="charge-types">Charge Types</TabsTrigger>
          <TabsTrigger value="pricing-rules">Pricing Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="charge-types" className="mt-4">
          <ChargeTypesPanel />
        </TabsContent>

        <TabsContent value="pricing-rules" className="mt-4">
          <PricingRulesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}


// =============================================================================
// CHARGE TYPES PANEL
// =============================================================================

function ChargeTypesPanel() {
  const { chargeTypes, loading, createChargeType, updateChargeType, deleteChargeType, refetch } = useChargeTypes();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingChargeType, setEditingChargeType] = useState<ChargeType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredChargeTypes = chargeTypes.filter(ct => {
    const matchesSearch =
      ct.charge_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ct.charge_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || ct.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDelete = async (ct: ChargeType) => {
    if (confirm(`Delete charge type "${ct.charge_name}"?`)) {
      await deleteChargeType(ct.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <MaterialIcon name="progress_activity" className="animate-spin mr-2" />
        Loading charge types...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Search charge types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CHARGE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <MaterialIcon name="add" size="sm" className="mr-1" />
          Add Charge Type
        </Button>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChargeTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {chargeTypes.length === 0
                    ? 'No charge types found. Create one to get started.'
                    : 'No charge types match your search.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredChargeTypes.map((ct) => (
                <TableRow key={ct.id}>
                  <TableCell className="font-mono text-sm">{ct.charge_code}</TableCell>
                  <TableCell className="font-medium">{ct.charge_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CHARGE_CATEGORIES.find(c => c.value === ct.category)?.label || ct.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {TRIGGER_OPTIONS.find(t => t.value === ct.default_trigger)?.label || ct.default_trigger}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {ct.add_to_scan && (
                        <Badge variant="secondary" className="text-xs">Scan</Badge>
                      )}
                      {ct.add_flag && (
                        <Badge variant="secondary" className="text-xs">Flag</Badge>
                      )}
                      {ct.is_taxable && (
                        <Badge variant="secondary" className="text-xs">Tax</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ct.is_active ? 'default' : 'secondary'}>
                      {ct.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingChargeType(ct)}
                      >
                        <MaterialIcon name="edit" size="sm" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(ct)}
                      >
                        <MaterialIcon name="delete" size="sm" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <ChargeTypeDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSave={async (data) => {
          const result = await createChargeType(data);
          if (result) {
            setShowCreateDialog(false);
          }
        }}
      />

      {/* Edit Dialog */}
      <ChargeTypeDialog
        open={!!editingChargeType}
        onOpenChange={(open) => !open && setEditingChargeType(null)}
        chargeType={editingChargeType}
        onSave={async (data) => {
          if (editingChargeType) {
            const success = await updateChargeType({ id: editingChargeType.id, ...data });
            if (success) {
              setEditingChargeType(null);
            }
          }
        }}
      />
    </div>
  );
}


// =============================================================================
// CHARGE TYPE DIALOG
// =============================================================================

interface ChargeTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chargeType?: ChargeType | null;
  onSave: (data: CreateChargeTypeInput) => Promise<void>;
}

function ChargeTypeDialog({ open, onOpenChange, chargeType, onSave }: ChargeTypeDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateChargeTypeInput>({
    charge_code: '',
    charge_name: '',
    category: 'general',
    is_active: true,
    is_taxable: false,
    default_trigger: 'manual',
    input_mode: 'qty',
    add_to_scan: false,
    add_flag: false,
    notes: '',
  });

  // Reset form when dialog opens/closes or chargeType changes
  useState(() => {
    if (chargeType) {
      setFormData({
        charge_code: chargeType.charge_code,
        charge_name: chargeType.charge_name,
        category: chargeType.category,
        is_active: chargeType.is_active,
        is_taxable: chargeType.is_taxable,
        default_trigger: chargeType.default_trigger,
        input_mode: chargeType.input_mode,
        qty_step: chargeType.qty_step || undefined,
        min_qty: chargeType.min_qty || undefined,
        time_unit_default: chargeType.time_unit_default || undefined,
        min_minutes: chargeType.min_minutes || undefined,
        add_to_scan: chargeType.add_to_scan,
        add_flag: chargeType.add_flag,
        alert_rule: chargeType.alert_rule || undefined,
        notes: chargeType.notes || '',
      });
    } else {
      setFormData({
        charge_code: '',
        charge_name: '',
        category: 'general',
        is_active: true,
        is_taxable: false,
        default_trigger: 'manual',
        input_mode: 'qty',
        add_to_scan: false,
        add_flag: false,
        notes: '',
      });
    }
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {chargeType ? 'Edit Charge Type' : 'Create Charge Type'}
          </DialogTitle>
          <DialogDescription>
            {chargeType
              ? 'Update the charge type configuration.'
              : 'Create a new charge type for billing.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="charge_code">Charge Code *</Label>
              <Input
                id="charge_code"
                value={formData.charge_code}
                onChange={(e) => setFormData({ ...formData, charge_code: e.target.value.toUpperCase() })}
                placeholder="e.g., INSP, RCVG"
                disabled={!!chargeType}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge_name">Charge Name *</Label>
              <Input
                id="charge_name"
                value={formData.charge_name}
                onChange={(e) => setFormData({ ...formData, charge_name: e.target.value })}
                placeholder="e.g., Inspection"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARGE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_trigger">Default Trigger</Label>
              <Select
                value={formData.default_trigger}
                onValueChange={(value: any) => setFormData({ ...formData, default_trigger: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="input_mode">Input Mode</Label>
              <Select
                value={formData.input_mode}
                onValueChange={(value: any) => setFormData({ ...formData, input_mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INPUT_MODE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Flags */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-medium">Options</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active" className="font-normal">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_taxable" className="font-normal">Taxable</Label>
                <Switch
                  id="is_taxable"
                  checked={formData.is_taxable}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_taxable: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="add_to_scan" className="font-normal">Show in Scan</Label>
                <Switch
                  id="add_to_scan"
                  checked={formData.add_to_scan}
                  onCheckedChange={(checked) => setFormData({ ...formData, add_to_scan: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="add_flag" className="font-normal">Add Flag</Label>
                <Switch
                  id="add_flag"
                  checked={formData.add_flag}
                  onCheckedChange={(checked) => setFormData({ ...formData, add_flag: checked })}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Internal notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.charge_code || !formData.charge_name}>
            {saving ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="animate-spin mr-1" />
                Saving...
              </>
            ) : (
              chargeType ? 'Update' : 'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// =============================================================================
// PRICING RULES PANEL
// =============================================================================

function PricingRulesPanel() {
  const { chargeTypesWithRules, loading, refetch } = useChargeTypesWithRules();
  const { createPricingRule, updatePricingRule, deletePricingRule } = usePricingRules();
  const [expandedChargeType, setExpandedChargeType] = useState<string | undefined>();
  const [showAddRuleDialog, setShowAddRuleDialog] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<{ rule: PricingRule; chargeTypeId: string } | null>(null);
  const { toast } = useToast();

  const handleDeleteRule = async (rule: PricingRule, chargeTypeId: string) => {
    if (confirm('Delete this pricing rule?')) {
      await deletePricingRule(rule.id, chargeTypeId);
      refetch();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <MaterialIcon name="progress_activity" className="animate-spin mr-2" />
        Loading pricing rules...
      </div>
    );
  }

  if (chargeTypesWithRules.length === 0) {
    return (
      <Card className="p-8 text-center">
        <MaterialIcon name="payments" size="xl" className="text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          No charge types found. Create charge types first, then add pricing rules.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click on a charge type to view and manage its pricing rules.
      </p>

      <Accordion
        type="single"
        collapsible
        value={expandedChargeType}
        onValueChange={setExpandedChargeType}
      >
        {chargeTypesWithRules.map((ct) => (
          <AccordionItem key={ct.id} value={ct.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 flex-1 text-left">
                <div>
                  <span className="font-mono text-sm text-muted-foreground mr-2">{ct.charge_code}</span>
                  <span className="font-medium">{ct.charge_name}</span>
                </div>
                <Badge variant="outline" className="ml-auto mr-4">
                  {ct.pricing_rules.length} rule{ct.pricing_rules.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2 pb-4 space-y-4">
                {/* Add Rule Button */}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddRuleDialog(ct.id)}
                  >
                    <MaterialIcon name="add" size="sm" className="mr-1" />
                    Add Rule
                  </Button>
                </div>

                {/* Rules Table */}
                {ct.pricing_rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pricing rules. Add a rule to set rates for this charge type.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Min Charge</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ct.pricing_rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>
                            {rule.class_code || <span className="text-muted-foreground">Any</span>}
                          </TableCell>
                          <TableCell>
                            {PRICING_METHOD_OPTIONS.find(m => m.value === rule.pricing_method)?.label || rule.pricing_method}
                          </TableCell>
                          <TableCell>
                            {UNIT_OPTIONS.find(u => u.value === rule.unit)?.label || rule.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${rule.rate.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {rule.minimum_charge ? `$${rule.minimum_charge.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell>
                            {rule.is_default && <Badge variant="secondary">Default</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingRule({ rule, chargeTypeId: ct.id })}
                              >
                                <MaterialIcon name="edit" size="sm" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteRule(rule, ct.id)}
                              >
                                <MaterialIcon name="delete" size="sm" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Add Rule Dialog */}
      {showAddRuleDialog && (
        <PricingRuleDialog
          open={true}
          onOpenChange={() => setShowAddRuleDialog(null)}
          chargeTypeId={showAddRuleDialog}
          onSave={async (data) => {
            const result = await createPricingRule(data);
            if (result) {
              setShowAddRuleDialog(null);
              refetch();
            }
          }}
        />
      )}

      {/* Edit Rule Dialog */}
      {editingRule && (
        <PricingRuleDialog
          open={true}
          onOpenChange={() => setEditingRule(null)}
          chargeTypeId={editingRule.chargeTypeId}
          rule={editingRule.rule}
          onSave={async (data) => {
            const success = await updatePricingRule({ id: editingRule.rule.id, ...data });
            if (success) {
              setEditingRule(null);
              refetch();
            }
          }}
        />
      )}
    </div>
  );
}


// =============================================================================
// PRICING RULE DIALOG
// =============================================================================

interface PricingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chargeTypeId: string;
  rule?: PricingRule | null;
  onSave: (data: CreatePricingRuleInput) => Promise<void>;
}

function PricingRuleDialog({ open, onOpenChange, chargeTypeId, rule, onSave }: PricingRuleDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreatePricingRuleInput>({
    charge_type_id: chargeTypeId,
    pricing_method: rule?.pricing_method || 'flat',
    class_code: rule?.class_code || null,
    unit: rule?.unit || 'each',
    rate: rule?.rate || 0,
    minimum_charge: rule?.minimum_charge || undefined,
    is_default: rule?.is_default || false,
    service_time_minutes: rule?.service_time_minutes || undefined,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {rule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pricing_method">Pricing Method</Label>
              <Select
                value={formData.pricing_method}
                onValueChange={(value: any) => setFormData({ ...formData, pricing_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_METHOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class_code">Class Code</Label>
              <Select
                value={formData.class_code || '_none'}
                onValueChange={(value) => setFormData({ ...formData, class_code: value === '_none' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Any (Default)</SelectItem>
                  {CLASS_CODES.map(code => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">Rate ($) *</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minimum_charge">Minimum Charge ($)</Label>
              <Input
                id="minimum_charge"
                type="number"
                step="0.01"
                min="0"
                value={formData.minimum_charge || ''}
                onChange={(e) => setFormData({ ...formData, minimum_charge: parseFloat(e.target.value) || undefined })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_time_minutes">Service Time (min)</Label>
              <Input
                id="service_time_minutes"
                type="number"
                min="0"
                value={formData.service_time_minutes || ''}
                onChange={(e) => setFormData({ ...formData, service_time_minutes: parseInt(e.target.value) || undefined })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <Label htmlFor="is_default" className="font-normal">
              Default Rule
              <span className="text-xs text-muted-foreground block">
                Used when no class-specific rule matches
              </span>
            </Label>
            <Switch
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="animate-spin mr-1" />
                Saving...
              </>
            ) : (
              rule ? 'Update' : 'Add'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
