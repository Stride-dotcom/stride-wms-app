/**
 * PricingSettingsTab - Admin UI for Charge Types and Pricing Rules
 *
 * New pricing system management interface.
 */

import { useState, useEffect } from 'react';
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
import { useClasses } from '@/hooks/useClasses';
import {
  useChargeTypes,
  usePricingRules,
  useChargeTypesWithRules,
  CHARGE_CATEGORIES,
  TRIGGER_OPTIONS,
  INPUT_MODE_OPTIONS,
  UNIT_OPTIONS,
  PRICING_METHOD_OPTIONS,
  type ChargeType,
  type PricingRule,
  type CreateChargeTypeInput,
  type CreatePricingRuleInput,
} from '@/hooks/useChargeTypes';
import { FlagSettingsSection } from '@/components/settings/preferences/FlagSettingsSection';

export function PricingSettingsTab() {
  const [activeTab, setActiveTab] = useState('charge-types');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Pricing Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Manage charge types, pricing rules, and item flags for billing.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="charge-types">Charge Types</TabsTrigger>
          <TabsTrigger value="pricing-rules">Pricing Rules</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="charge-types" className="mt-4">
          <ChargeTypesPanel />
        </TabsContent>

        <TabsContent value="pricing-rules" className="mt-4">
          <PricingRulesPanel />
        </TabsContent>

        <TabsContent value="flags" className="mt-4">
          <FlagSettingsSection />
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
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(() => {
    return localStorage.getItem('pricing_category_filter') || 'all';
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return localStorage.getItem('pricing_status_filter') || 'active';
  });
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem('pricing_category_filter', categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    localStorage.setItem('pricing_status_filter', statusFilter);
  }, [statusFilter]);

  const filteredChargeTypes = chargeTypes.filter(ct => {
    const matchesSearch =
      ct.charge_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ct.charge_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || ct.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && ct.is_active) ||
      (statusFilter === 'inactive' && !ct.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleDelete = async (ct: ChargeType) => {
    if (confirm(`Delete charge type "${ct.charge_name}"?`)) {
      await deleteChargeType(ct.id);
    }
  };

  const handleInlineUpdate = async (ct: ChargeType, updates: Partial<CreateChargeTypeInput>) => {
    await updateChargeType({ id: ct.id, ...updates });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <MaterialIcon name="progress_activity" className="animate-spin mr-2" />
        Loading charge types...
      </div>
    );
  }

  // CSV template download
  const handleDownloadTemplate = () => {
    const headers = ['charge_code', 'charge_name', 'category', 'is_active', 'is_taxable', 'default_trigger', 'input_mode', 'add_to_scan', 'add_flag', 'notes'];
    const sampleRow = ['INSP', 'Inspection', 'task', 'true', 'false', 'task', 'qty', 'true', 'false', 'Sample charge type'];
    const csv = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'charge_types_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV import handler
  const handleImportCSV = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast({ variant: 'destructive', title: 'Error', description: 'CSV file must have a header row and at least one data row' });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['charge_code', 'charge_name'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast({ variant: 'destructive', title: 'Error', description: `Missing required columns: ${missingHeaders.join(', ')}` });
        return;
      }

      let imported = 0;
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        if (!row.charge_code || !row.charge_name) {
          errors++;
          continue;
        }

        try {
          await createChargeType({
            charge_code: row.charge_code.toUpperCase(),
            charge_name: row.charge_name,
            category: row.category || 'general',
            is_active: row.is_active !== 'false',
            is_taxable: row.is_taxable === 'true',
            default_trigger: (row.default_trigger as any) || 'manual',
            input_mode: (row.input_mode as any) || 'qty',
            add_to_scan: row.add_to_scan === 'true',
            add_flag: row.add_flag === 'true',
            notes: row.notes || undefined,
          });
          imported++;
        } catch {
          errors++;
        }
      }

      toast({
        title: 'Import Complete',
        description: `Imported ${imported} charge types. ${errors > 0 ? `${errors} errors.` : ''}`,
      });
      setShowImportDialog(false);
      refetch();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <MaterialIcon name="download" size="sm" className="mr-1" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <MaterialIcon name="upload" size="sm" className="mr-1" />
            Import
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <MaterialIcon name="add" size="sm" className="mr-1" />
            Add Charge Type
          </Button>
        </div>
      </div>

      {/* Table - Inline Editable */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="w-[130px]">Trigger</TableHead>
              <TableHead className="w-[100px]">Scan</TableHead>
              <TableHead className="w-[100px]">Flag</TableHead>
              <TableHead className="w-[100px]">Taxable</TableHead>
              <TableHead className="w-[80px]">Active</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChargeTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {chargeTypes.length === 0
                    ? 'No charge types found. Create one to get started.'
                    : 'No charge types match your search.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredChargeTypes.map((ct) => (
                <InlineChargeTypeRow
                  key={ct.id}
                  chargeType={ct}
                  onUpdate={handleInlineUpdate}
                  onDelete={handleDelete}
                />
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

      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Charge Types</DialogTitle>
            <DialogDescription>
              Upload a CSV file with charge types. Download the template first to see the required format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                id="csv-import"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportCSV(file);
                }}
              />
              <label
                htmlFor="csv-import"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <MaterialIcon name="upload_file" size="xl" className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click to select a CSV file
                </span>
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>Required columns:</strong> charge_code, charge_name</p>
              <p><strong>Optional columns:</strong> category, is_active, is_taxable, default_trigger, input_mode, add_to_scan, add_flag, notes</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <MaterialIcon name="download" size="sm" className="mr-1" />
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// =============================================================================
// INLINE EDITABLE CHARGE TYPE ROW
// =============================================================================

interface InlineChargeTypeRowProps {
  chargeType: ChargeType;
  onUpdate: (ct: ChargeType, updates: Partial<CreateChargeTypeInput>) => Promise<void>;
  onDelete: (ct: ChargeType) => Promise<void>;
}

function InlineChargeTypeRow({ chargeType, onUpdate, onDelete }: InlineChargeTypeRowProps) {
  const [name, setName] = useState(chargeType.charge_name);

  // Sync local state if chargeType changes from external source
  useEffect(() => {
    setName(chargeType.charge_name);
  }, [chargeType.charge_name]);

  const handleNameBlur = () => {
    if (name !== chargeType.charge_name && name.trim()) {
      onUpdate(chargeType, { charge_name: name.trim() });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{chargeType.charge_code}</TableCell>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <Select
          value={chargeType.category}
          onValueChange={(value) => onUpdate(chargeType, { category: value })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHARGE_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={chargeType.default_trigger}
          onValueChange={(value: string) => onUpdate(chargeType, { default_trigger: value as CreateChargeTypeInput['default_trigger'] })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Switch
          checked={chargeType.add_to_scan}
          onCheckedChange={(checked) => onUpdate(chargeType, { add_to_scan: checked })}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={chargeType.add_flag}
          onCheckedChange={(checked) => onUpdate(chargeType, { add_flag: checked })}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={chargeType.is_taxable}
          onCheckedChange={(checked) => onUpdate(chargeType, { is_taxable: checked })}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={chargeType.is_active}
          onCheckedChange={(checked) => onUpdate(chargeType, { is_active: checked })}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(chargeType)}
          className="h-8 w-8 p-0"
        >
          <MaterialIcon name="delete" size="sm" className="text-muted-foreground" />
        </Button>
      </TableCell>
    </TableRow>
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
  useEffect(() => {
    if (open) {
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
    }
  }, [open, chargeType]);

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
  const [expandedChargeType, setExpandedChargeType] = useState<string>('');
  const [showAddRuleDialog, setShowAddRuleDialog] = useState<string | null>(null);

  const handleDeleteRule = async (rule: PricingRule, chargeTypeId: string) => {
    if (confirm('Delete this pricing rule?')) {
      await deletePricingRule(rule.id, chargeTypeId);
      refetch();
    }
  };

  const handleInlineRuleUpdate = async (rule: PricingRule, chargeTypeId: string, updates: Partial<CreatePricingRuleInput>) => {
    await updatePricingRule({ id: rule.id, charge_type_id: chargeTypeId, ...updates });
    refetch();
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
        Click on a charge type to view and manage its pricing rules. Edit rates and settings directly in the table.
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

                {/* Rules Table - Inline Editable */}
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
                        <TableHead className="w-[120px]">Rate</TableHead>
                        <TableHead className="w-[120px]">Min Charge</TableHead>
                        <TableHead className="w-[80px]">Default</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ct.pricing_rules.map((rule) => (
                        <InlinePricingRuleRow
                          key={rule.id}
                          rule={rule}
                          chargeTypeId={ct.id}
                          onUpdate={handleInlineRuleUpdate}
                          onDelete={handleDeleteRule}
                        />
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
    </div>
  );
}


// =============================================================================
// INLINE EDITABLE PRICING RULE ROW
// =============================================================================

interface InlinePricingRuleRowProps {
  rule: PricingRule;
  chargeTypeId: string;
  onUpdate: (rule: PricingRule, chargeTypeId: string, updates: Partial<CreatePricingRuleInput>) => Promise<void>;
  onDelete: (rule: PricingRule, chargeTypeId: string) => Promise<void>;
}

function InlinePricingRuleRow({ rule, chargeTypeId, onUpdate, onDelete }: InlinePricingRuleRowProps) {
  const [rate, setRate] = useState(rule.rate.toString());
  const [minCharge, setMinCharge] = useState(rule.minimum_charge?.toString() || '');

  useEffect(() => {
    setRate(rule.rate.toString());
    setMinCharge(rule.minimum_charge?.toString() || '');
  }, [rule.rate, rule.minimum_charge]);

  const handleRateBlur = () => {
    const numVal = parseFloat(rate);
    if (!isNaN(numVal) && numVal !== rule.rate) {
      onUpdate(rule, chargeTypeId, { rate: numVal });
    }
  };

  const handleMinChargeBlur = () => {
    const numVal = minCharge ? parseFloat(minCharge) : undefined;
    if (numVal !== rule.minimum_charge) {
      onUpdate(rule, chargeTypeId, { minimum_charge: numVal });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <TableRow>
      <TableCell className="text-sm">
        {rule.class_code || <span className="text-muted-foreground">Any</span>}
      </TableCell>
      <TableCell>
        <Select
          value={rule.pricing_method}
          onValueChange={(value: string) => onUpdate(rule, chargeTypeId, { pricing_method: value as CreatePricingRuleInput['pricing_method'] })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRICING_METHOD_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={rule.unit}
          onValueChange={(value) => onUpdate(rule, chargeTypeId, { unit: value })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={handleRateBlur}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm pl-5 font-mono"
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={minCharge}
            onChange={(e) => setMinCharge(e.target.value)}
            onBlur={handleMinChargeBlur}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm pl-5 font-mono"
            placeholder="-"
          />
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={rule.is_default}
          onCheckedChange={(checked) => onUpdate(rule, chargeTypeId, { is_default: checked })}
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(rule, chargeTypeId)}
          className="h-8 w-8 p-0"
        >
          <MaterialIcon name="delete" size="sm" className="text-muted-foreground" />
        </Button>
      </TableCell>
    </TableRow>
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
  const { classes } = useClasses();
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
              <Label htmlFor="class_code">Class</Label>
              <Select
                value={formData.class_code || '_none'}
                onValueChange={(value) => setFormData({ ...formData, class_code: value === '_none' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Any (Default)</SelectItem>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.code}>
                      {cls.code} - {cls.name}
                    </SelectItem>
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
