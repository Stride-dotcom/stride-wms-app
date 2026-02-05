import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { LabelWithTooltip } from '@/components/ui/label-with-tooltip';
import { fieldDescriptions } from '@/lib/pricing/fieldDescriptions';
import { generateServiceCode } from '@/lib/pricing/codeGenerator';
import {
  useChargeTypes,
  usePricingRules,
  UNIT_OPTIONS,
  type ChargeTypeWithRules,
} from '@/hooks/useChargeTypes';
import { useClasses } from '@/hooks/useClasses';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface AddServiceFormProps {
  onClose: () => void;
  onSaved: () => void;
  editingChargeType?: ChargeTypeWithRules | null;
  navigateToTab: (tab: string) => void;
}

interface ClassRate {
  classCode: string;
  rate: string;
  serviceTimeMinutes: string;
}

interface FormState {
  name: string;
  code: string;
  codeManual: boolean;
  glCode: string;
  description: string;
  category: string;
  trigger: 'manual' | 'task' | 'shipment' | 'storage' | 'auto';
  pricingMethod: 'class_based' | 'flat';
  classRates: ClassRate[];
  flatRate: string;
  unit: string;
  minimumCharge: string;
  serviceTime: string;
  isActive: boolean;
  isTaxable: boolean;
  addToScan: boolean;
  addFlag: boolean;
  notes: string;
}

type FormErrors = Partial<Record<string, string>>;

// =============================================================================
// CONSTANTS
// =============================================================================

const categoryTriggerDefaults: Record<string, string> = {
  'service': 'auto',
  'receiving': 'auto',
  'task': 'task',
  'storage': 'storage',
  'handling': 'manual',
  'shipping': 'shipment',
  'inspection': 'task',
  'assembly': 'task',
};

const TRIGGER_OPTIONS = [
  { value: 'auto', label: 'Receiving / Processing', description: fieldDescriptions.triggerAuto, icon: 'inventory_2' },
  { value: 'task', label: 'Task Completion', description: fieldDescriptions.triggerTask, icon: 'task_alt' },
  { value: 'shipment', label: 'Shipment Completion', description: fieldDescriptions.triggerShipment, icon: 'local_shipping' },
  { value: 'storage', label: 'Storage', description: fieldDescriptions.triggerStorage, icon: 'warehouse' },
  { value: 'manual', label: 'Manual Entry', description: fieldDescriptions.triggerManual, icon: 'edit' },
] as const;

const PRICING_METHOD_CARDS = [
  { value: 'class_based', label: 'Class-Based', icon: 'category' },
  { value: 'flat_per_item', label: 'Flat Rate Per Item', icon: 'straighten' },
  { value: 'flat_per_task', label: 'Flat Rate Per Task', icon: 'assignment' },
  { value: 'unit_price', label: 'Unit Price', icon: 'inventory' },
] as const;

const HELP = {
  serviceName: 'The display name for this service. Appears on invoices, quotes, and work orders.',
  serviceCode: 'A short unique code for this service. Auto-generated from the name but can be customized. Used in reports and integrations.',
  description: 'Brief description shown on invoices and reports. Helps staff and customers understand what this service covers.',
  glAccountCode: 'General Ledger code for accounting integration. Links charges to the correct revenue account.',
  serviceCategory: 'Groups related services together for organization, reporting, and filtering.',
  billingTrigger: "Determines when the charge is automatically created. 'Receiving' triggers on inbound processing. 'Task Completion' triggers when a linked task is marked done. 'Storage' accrues daily/monthly. 'Manual' requires staff to add the charge.",
  pricingMethod: "How rates are calculated. 'Class-Based' uses different rates per item class. 'Flat Per Item' charges the same for every item. 'Flat Per Task' charges once per job. 'Unit Price' is for sellable materials billed by quantity.",
  rate: 'The charge amount for this service. Can be overridden per-customer in account pricing settings.',
  unit: 'The billing unit displayed on invoices. Auto-set based on pricing method but can be customized.',
  minCharge: 'If the calculated charge falls below this amount, the minimum will be used instead. Protects against unprofitable small orders.',
  serviceTime: 'Estimated time to complete this service in minutes. Used for scheduling, capacity planning, and dashboard time estimates.',
  active: 'When active, this service is available for use on work orders, quotes, and billing. Inactive services are hidden from selection but historical data is preserved.',
  taxable: 'When enabled, sales tax will be automatically applied to this charge based on the customer\'s tax rate settings.',
  notes: 'Notes visible only to staff. Use for internal guidance about when to apply this service, special handling instructions, or billing rules.',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AddServiceForm({ onClose, onSaved, editingChargeType, navigateToTab }: AddServiceFormProps) {
  const { chargeTypes, createChargeType, updateChargeType } = useChargeTypes();
  const { createPricingRule, deletePricingRule } = usePricingRules();
  const { classes } = useClasses();
  const { activeCategories } = useServiceCategories();
  const { toast } = useToast();

  const isEditing = editingChargeType && editingChargeType.id !== '';
  const isDuplicating = editingChargeType && editingChargeType.id === '';

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  const getInitialForm = (): FormState => {
    if (editingChargeType) {
      const hasClassRules = editingChargeType.pricing_rules.some(r => r.pricing_method === 'class_based');
      return {
        name: editingChargeType.charge_name,
        code: editingChargeType.charge_code,
        codeManual: true,
        glCode: '',
        description: editingChargeType.notes || '',
        category: editingChargeType.category || '',
        trigger: editingChargeType.default_trigger,
        pricingMethod: hasClassRules ? 'class_based' : 'flat',
        classRates: classes.map(cls => {
          const existingRule = editingChargeType.pricing_rules.find(r => r.class_code === cls.code);
          return {
            classCode: cls.code,
            rate: existingRule ? String(existingRule.rate) : '',
            serviceTimeMinutes: existingRule?.service_time_minutes ? String(existingRule.service_time_minutes) : '',
          };
        }),
        flatRate: !hasClassRules && editingChargeType.pricing_rules[0]
          ? String(editingChargeType.pricing_rules[0].rate)
          : '',
        unit: editingChargeType.pricing_rules[0]?.unit || 'each',
        minimumCharge: editingChargeType.pricing_rules[0]?.minimum_charge
          ? String(editingChargeType.pricing_rules[0].minimum_charge)
          : '',
        serviceTime: !hasClassRules && editingChargeType.pricing_rules[0]?.service_time_minutes
          ? String(editingChargeType.pricing_rules[0].service_time_minutes)
          : '',
        isActive: editingChargeType.is_active,
        isTaxable: editingChargeType.is_taxable,
        addToScan: editingChargeType.add_to_scan,
        addFlag: editingChargeType.add_flag,
        notes: editingChargeType.notes || '',
      };
    }

    return {
      name: '',
      code: '',
      codeManual: false,
      glCode: '',
      description: '',
      category: '',
      trigger: 'manual',
      pricingMethod: 'flat',
      classRates: classes.map(cls => ({
        classCode: cls.code,
        rate: '',
        serviceTimeMinutes: '',
      })),
      flatRate: '',
      unit: 'each',
      minimumCharge: '',
      serviceTime: '',
      isActive: true,
      isTaxable: false,
      addToScan: false,
      addFlag: false,
      notes: '',
    };
  };

  const [form, setForm] = useState<FormState>(getInitialForm);

  // Auto-generate code from name
  useEffect(() => {
    if (!form.codeManual && form.name) {
      setForm(prev => ({ ...prev, code: generateServiceCode(prev.name) }));
    }
  }, [form.name, form.codeManual]);

  // Sync class rates when classes change
  useEffect(() => {
    if (classes.length > 0 && form.classRates.length === 0) {
      setForm(prev => ({
        ...prev,
        classRates: classes.map(cls => ({
          classCode: cls.code,
          rate: '',
          serviceTimeMinutes: '',
        })),
      }));
    }
  }, [classes, form.classRates.length]);

  const updateForm = (updates: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
    // Clear related errors when field changes
    const errorKeys = Object.keys(updates);
    if (errorKeys.length > 0) {
      setErrors(prev => {
        const next = { ...prev };
        errorKeys.forEach(k => delete next[k]);
        return next;
      });
    }
  };

  const isCodeUnique = (code: string): boolean => {
    if (isEditing && editingChargeType?.charge_code === code) return true;
    return !chargeTypes.some(ct => ct.charge_code === code);
  };

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = 'Service name is required';
    if (!form.code.trim()) errs.code = 'Service code is required';
    else if (!isCodeUnique(form.code)) errs.code = 'This code is already in use';
    if (!form.category) errs.category = 'Select a service category';
    if (!form.trigger) errs.trigger = 'Select a billing trigger';
    if (form.pricingMethod === 'class_based') {
      if (!form.classRates.some(r => r.rate !== '')) errs.pricing = 'Set a rate for at least one class';
    } else {
      if (!form.flatRate) errs.pricing = 'Rate is required';
    }
    return errs;
  };

  // ==========================================================================
  // CATEGORY SELECTION
  // ==========================================================================

  const handleCategorySelect = (categoryName: string) => {
    const lower = categoryName.toLowerCase();
    updateForm({
      category: lower,
      trigger: (categoryTriggerDefaults[lower] as FormState['trigger']) || form.trigger,
    });
  };

  // ==========================================================================
  // PRICING METHOD SELECTION
  // ==========================================================================

  const handlePricingMethodSelect = (value: string) => {
    if (value === 'class_based') {
      updateForm({ pricingMethod: 'class_based', unit: 'each' });
    } else if (value === 'flat_per_task') {
      updateForm({ pricingMethod: 'flat', unit: 'per_task' });
    } else if (value === 'unit_price') {
      updateForm({ pricingMethod: 'flat', unit: 'each' });
    } else {
      updateForm({ pricingMethod: 'flat', unit: 'each' });
    }
  };

  const getActivePricingCard = () => {
    if (form.pricingMethod === 'class_based') return 'class_based';
    if (form.unit === 'per_task') return 'flat_per_task';
    return 'flat_per_item';
  };

  const updateClassRate = (classCode: string, field: 'rate' | 'serviceTimeMinutes', value: string) => {
    updateForm({
      classRates: form.classRates.map(cr =>
        cr.classCode === classCode ? { ...cr, [field]: value } : cr
      ),
    });
  };

  // ==========================================================================
  // SAVE HANDLERS
  // ==========================================================================

  const createPricingRules = async (chargeTypeId: string) => {
    if (form.pricingMethod === 'class_based') {
      for (const cr of form.classRates.filter(r => r.rate)) {
        await createPricingRule({
          charge_type_id: chargeTypeId,
          pricing_method: 'class_based',
          class_code: cr.classCode,
          unit: form.unit || 'each',
          rate: parseFloat(cr.rate),
          minimum_charge: form.minimumCharge ? parseFloat(form.minimumCharge) : undefined,
          service_time_minutes: cr.serviceTimeMinutes ? parseInt(cr.serviceTimeMinutes) : undefined,
        });
      }
    } else {
      await createPricingRule({
        charge_type_id: chargeTypeId,
        pricing_method: 'flat',
        class_code: null,
        unit: form.unit,
        rate: parseFloat(form.flatRate),
        minimum_charge: form.minimumCharge ? parseFloat(form.minimumCharge) : undefined,
        is_default: true,
        service_time_minutes: form.serviceTime ? parseInt(form.serviceTime) : undefined,
      });
    }
  };

  const handleSave = async (mode: 'save' | 'draft' | 'saveAndAnother') => {
    // For draft mode, only require name
    if (mode === 'draft') {
      if (!form.name.trim()) {
        setErrors({ name: 'Service name is required' });
        nameInputRef.current?.focus();
        return;
      }
    } else {
      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        // Scroll to first error
        const firstErrorKey = Object.keys(validationErrors)[0];
        const el = document.querySelector(`[data-field="${firstErrorKey}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setSaving(true);
    try {
      const isActiveValue = mode === 'draft' ? false : form.isActive;

      if (isEditing && editingChargeType) {
        // UPDATE existing
        const updated = await updateChargeType({
          id: editingChargeType.id,
          charge_code: form.code,
          charge_name: form.name,
          category: form.category.toLowerCase(),
          is_active: isActiveValue,
          is_taxable: form.isTaxable,
          default_trigger: form.trigger,
          input_mode: 'qty',
          add_to_scan: form.addToScan,
          add_flag: form.addFlag,
          notes: [form.description, form.notes].filter(Boolean).join('\n') || undefined,
        });

        if (!updated) throw new Error('Failed to update');

        // Delete existing pricing rules, then recreate
        for (const rule of editingChargeType.pricing_rules) {
          await deletePricingRule(rule.id);
        }
        await createPricingRules(editingChargeType.id);

        toast({
          title: 'Service Updated',
          description: `${form.name} has been updated successfully.`,
        });
        onSaved();
      } else {
        // INSERT new
        const chargeType = await createChargeType({
          charge_code: form.code,
          charge_name: form.name,
          category: form.category.toLowerCase() || 'service',
          is_active: isActiveValue,
          is_taxable: form.isTaxable,
          default_trigger: form.trigger,
          input_mode: 'qty',
          add_to_scan: form.addToScan,
          add_flag: form.addFlag,
          notes: [form.description, form.notes].filter(Boolean).join('\n') || undefined,
        });

        if (!chargeType) throw new Error('Failed to create');
        await createPricingRules(chargeType.id);

        if (mode === 'draft') {
          toast({ title: 'Service saved as draft' });
          onSaved();
        } else if (mode === 'saveAndAnother') {
          toast({ title: 'Service saved', description: 'Ready for next entry.' });
          // Reset form but keep category and trigger
          const savedCategory = form.category;
          const savedTrigger = form.trigger;
          setForm({
            ...getInitialForm(),
            category: savedCategory,
            trigger: savedTrigger,
          });
          setErrors({});
          nameInputRef.current?.focus();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          toast({
            title: 'Service Created',
            description: `${form.name} has been created successfully.`,
          });
          onSaved();
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const activePricingCard = getActivePricingCard();

  return (
    <div className="space-y-6 pb-24">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <MaterialIcon name="arrow_back" size="sm" />
        </Button>
        <h3 className="text-lg font-semibold">
          {isEditing
            ? `Edit Service: ${editingChargeType?.charge_name}`
            : isDuplicating
              ? 'Duplicate Service'
              : 'Add New Service'}
        </h3>
      </div>

      {/* ================================================================ */}
      {/* SECTION 1: Basic Information                                     */}
      {/* ================================================================ */}
      <Card data-field="name">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <h4 className="font-semibold text-sm">Basic Information</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <LabelWithTooltip htmlFor="serviceName" tooltip={HELP.serviceName} required>
                Service Name
              </LabelWithTooltip>
              <Input
                id="serviceName"
                ref={nameInputRef}
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="e.g., Receiving, Inspection, Assembly"
                autoFocus
                className={cn(errors.name && 'border-destructive')}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="serviceCode" tooltip={HELP.serviceCode} required>
                Service Code
              </LabelWithTooltip>
              <div className="relative">
                <Input
                  id="serviceCode"
                  value={form.code}
                  onChange={(e) => updateForm({ code: e.target.value.toUpperCase(), codeManual: true })}
                  placeholder="Auto-generated"
                  className={cn(
                    'font-mono',
                    !form.codeManual && form.code && 'text-muted-foreground',
                    errors.code && 'border-destructive'
                  )}
                  readOnly={!!isEditing}
                />
                {form.codeManual && !isEditing && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => updateForm({ codeManual: false })}
                  >
                    Auto
                  </button>
                )}
              </div>
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
              {!form.codeManual && !errors.code && (
                <p className="text-xs text-muted-foreground">Auto-generated from service name</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="md:col-span-2 space-y-2">
              <LabelWithTooltip htmlFor="description" tooltip={HELP.description}>
                Description
              </LabelWithTooltip>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="Brief description for invoices and reports"
              />
            </div>
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="glCode" tooltip={HELP.glAccountCode}>
                GL Account Code
              </LabelWithTooltip>
              <Input
                id="glCode"
                value={form.glCode}
                onChange={(e) => updateForm({ glCode: e.target.value })}
                placeholder="e.g., 4100-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* SECTION 2: Category & Billing Trigger                            */}
      {/* ================================================================ */}
      <Card data-field="category">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <h4 className="font-semibold text-sm">Category & Billing Trigger</h4>
          </div>

          {/* Service Category — chip selectors */}
          <div className="space-y-3 mb-6">
            <LabelWithTooltip tooltip={HELP.serviceCategory} required>
              Service Category
            </LabelWithTooltip>

            {activeCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 border rounded-lg border-dashed">
                No categories configured.{' '}
                <button className="text-primary underline" onClick={() => navigateToTab('categories')}>
                  Set up categories
                </button>{' '}
                or{' '}
                <button className="text-primary underline" onClick={() => updateForm({ category: 'general' })}>
                  continue with General
                </button>.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeCategories.map((cat) => {
                  const selected = form.category === cat.name.toLowerCase();
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={cn(
                        'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 text-foreground'
                      )}
                      onClick={() => handleCategorySelect(cat.name)}
                    >
                      {selected && <span className="mr-1">✓</span>}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>

          {/* Billing Trigger — chip selectors */}
          <div className="space-y-3" data-field="trigger">
            <LabelWithTooltip tooltip={HELP.billingTrigger} required>
              Billing Trigger
            </LabelWithTooltip>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_OPTIONS.map((opt) => {
                const selected = form.trigger === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 text-foreground'
                    )}
                    onClick={() => updateForm({ trigger: opt.value as FormState['trigger'] })}
                  >
                    {selected && <span className="mr-1">✓</span>}
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {errors.trigger && <p className="text-xs text-destructive">{errors.trigger}</p>}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* SECTION 3: Pricing                                               */}
      {/* ================================================================ */}
      <Card data-field="pricing">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <h4 className="font-semibold text-sm">Pricing</h4>
          </div>

          {/* Pricing Method — 2x2 grid */}
          <div className="space-y-3 mb-6">
            <LabelWithTooltip tooltip={HELP.pricingMethod} required>
              Pricing Method
            </LabelWithTooltip>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              {PRICING_METHOD_CARDS.map((pm) => {
                const active = activePricingCard === pm.value;
                return (
                  <button
                    key={pm.value}
                    type="button"
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors text-left',
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => handlePricingMethodSelect(pm.value)}
                  >
                    <MaterialIcon name={pm.icon} size="sm" className="text-muted-foreground shrink-0" />
                    <span>{pm.label}</span>
                  </button>
                );
              })}
            </div>
            {errors.pricing && <p className="text-xs text-destructive mt-1">{errors.pricing}</p>}
          </div>

          {/* Dynamic rate config */}
          {form.pricingMethod === 'class_based' ? (
            <ClassBasedRateConfig
              form={form}
              classes={classes}
              updateClassRate={updateClassRate}
              updateForm={updateForm}
              navigateToTab={navigateToTab}
              handlePricingMethodSelect={handlePricingMethodSelect}
            />
          ) : (
            <FlatRateConfig form={form} updateForm={updateForm} />
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* SECTION 4: Options                                               */}
      {/* ================================================================ */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <h4 className="font-semibold text-sm">Options</h4>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4 mb-4">
            <div className="flex items-center gap-3">
              <LabelWithTooltip tooltip={HELP.active}>Active</LabelWithTooltip>
              <Switch checked={form.isActive} onCheckedChange={(v) => updateForm({ isActive: v })} />
            </div>
            <div className="flex items-center gap-3">
              <LabelWithTooltip tooltip={HELP.taxable}>Taxable</LabelWithTooltip>
              <Switch checked={form.isTaxable} onCheckedChange={(v) => updateForm({ isTaxable: v })} />
            </div>
          </div>

          <div className="space-y-2">
            <LabelWithTooltip htmlFor="internalNotes" tooltip={HELP.notes}>
              Internal Notes
            </LabelWithTooltip>
            <Input
              id="internalNotes"
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
              placeholder="Optional — internal notes about when to use this service"
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* PINNED FOOTER BAR                                                */}
      {/* ================================================================ */}
      <div className="sticky bottom-0 z-40 -mx-1 px-1 py-3 mt-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {!isEditing && !isDuplicating && (
              <Button
                variant="secondary"
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="hidden sm:inline-flex"
              >
                Save as Draft
              </Button>
            )}
            <Button onClick={() => handleSave('save')} disabled={saving}>
              {saving ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <MaterialIcon name="check" size="sm" className="mr-1" />
                  {isEditing ? 'Save Changes' : 'Save Service'}
                </>
              )}
            </Button>
            {!isEditing && !isDuplicating && (
              <Button
                onClick={() => handleSave('saveAndAnother')}
                disabled={saving}
                className="hidden sm:inline-flex"
              >
                Save & Add Another
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CLASS-BASED RATE CONFIG
// =============================================================================

function ClassBasedRateConfig({
  form,
  classes,
  updateClassRate,
  updateForm,
  navigateToTab,
  handlePricingMethodSelect,
}: {
  form: FormState;
  classes: ReturnType<typeof useClasses>['classes'];
  updateClassRate: (classCode: string, field: 'rate' | 'serviceTimeMinutes', value: string) => void;
  updateForm: (u: Partial<FormState>) => void;
  navigateToTab: (tab: string) => void;
  handlePricingMethodSelect: (value: string) => void;
}) {
  if (classes.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-2">No classes configured</p>
        <p className="mb-3">Classes let you group items so different groups can have different rates.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigateToTab('classes')}>
            <MaterialIcon name="add" size="sm" className="mr-1" />
            Set Up Classes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handlePricingMethodSelect('flat_per_item')}>
            Use Flat Pricing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rates by Item Class</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {form.classRates.map((cr) => {
          const cls = classes.find(c => c.code === cr.classCode);
          if (!cls) return null;
          return (
            <div key={cr.classCode} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-xs">{cr.classCode}</Badge>
                <span className="text-xs text-muted-foreground truncate">{cls.name}</span>
              </div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cr.rate}
                  onChange={(e) => updateClassRate(cr.classCode, 'rate', e.target.value)}
                  placeholder="0.00"
                  className="pl-5 h-9"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <LabelWithTooltip htmlFor="classUnit" tooltip={HELP.unit}>Unit</LabelWithTooltip>
            <Select value={form.unit} onValueChange={(v) => updateForm({ unit: v })}>
              <SelectTrigger id="classUnit" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <LabelWithTooltip htmlFor="classMinCharge" tooltip={HELP.minCharge}>Min. Charge ($)</LabelWithTooltip>
            <Input
              id="classMinCharge"
              type="number"
              step="0.01"
              min="0"
              value={form.minimumCharge}
              onChange={(e) => updateForm({ minimumCharge: e.target.value })}
              placeholder="Optional"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <LabelWithTooltip htmlFor="classServiceTime" tooltip={HELP.serviceTime}>Service Time (min)</LabelWithTooltip>
            <Input
              id="classServiceTime"
              type="number"
              min="0"
              value={form.serviceTime}
              onChange={(e) => updateForm({ serviceTime: e.target.value })}
              placeholder="Optional"
              className="h-9"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FLAT RATE CONFIG
// =============================================================================

function FlatRateConfig({
  form,
  updateForm,
}: {
  form: FormState;
  updateForm: (u: Partial<FormState>) => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <LabelWithTooltip htmlFor="flatRate" tooltip={HELP.rate} required>Rate ($)</LabelWithTooltip>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id="flatRate"
              type="number"
              step="0.01"
              min="0"
              value={form.flatRate}
              onChange={(e) => updateForm({ flatRate: e.target.value })}
              placeholder="0.00"
              className="pl-5 h-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <LabelWithTooltip htmlFor="flatUnit" tooltip={HELP.unit}>Unit</LabelWithTooltip>
          <Select value={form.unit} onValueChange={(v) => updateForm({ unit: v })}>
            <SelectTrigger id="flatUnit" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <LabelWithTooltip htmlFor="flatMinCharge" tooltip={HELP.minCharge}>Min. Charge ($)</LabelWithTooltip>
          <Input
            id="flatMinCharge"
            type="number"
            step="0.01"
            min="0"
            value={form.minimumCharge}
            onChange={(e) => updateForm({ minimumCharge: e.target.value })}
            placeholder="Optional"
            className="h-9"
          />
        </div>
      </div>
      <div className="space-y-1.5 max-w-[200px]">
        <LabelWithTooltip htmlFor="flatServiceTime" tooltip={HELP.serviceTime}>Service Time (min)</LabelWithTooltip>
        <Input
          id="flatServiceTime"
          type="number"
          min="0"
          value={form.serviceTime}
          onChange={(e) => updateForm({ serviceTime: e.target.value })}
          placeholder="Optional"
          className="h-9"
        />
      </div>
    </div>
  );
}
