import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  flagAddsCharge: boolean;
  flagAlertOffice: boolean;
  flagAddsTime: boolean;
  flagTimeMinutes: string;
  notes: string;
}

const STEPS = [
  { number: 1, label: 'Basic Info' },
  { number: 2, label: 'Category & Trigger' },
  { number: 3, label: 'Pricing' },
  { number: 4, label: 'Options' },
];

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
  { value: 'class_based', label: 'Class-Based Pricing', description: fieldDescriptions.classBasedPricing, icon: 'category' },
  { value: 'flat_per_item', label: 'Flat Rate Per Item', description: fieldDescriptions.flatPerItem, icon: 'straighten' },
  { value: 'flat_per_task', label: 'Flat Rate Per Task', description: fieldDescriptions.flatPerTask, icon: 'assignment' },
  { value: 'unit_price', label: 'Unit Price', description: fieldDescriptions.unitPrice, icon: 'inventory' },
] as const;

export function AddServiceForm({ onClose, onSaved, editingChargeType, navigateToTab }: AddServiceFormProps) {
  const { chargeTypes, createChargeType, updateChargeType } = useChargeTypes();
  const { createPricingRule, deletePricingRule } = usePricingRules();
  const { classes } = useClasses();
  const { activeCategories } = useServiceCategories();
  const { toast } = useToast();

  const isEditing = editingChargeType && editingChargeType.id !== '';
  const isDuplicating = editingChargeType && editingChargeType.id === '';

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

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
        flagAddsCharge: editingChargeType.add_flag,
        flagAlertOffice: editingChargeType.alert_rule === 'office',
        flagAddsTime: false,
        flagTimeMinutes: '',
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
      flagAddsCharge: true,
      flagAlertOffice: false,
      flagAddsTime: false,
      flagTimeMinutes: '',
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
  }, [classes]);

  const updateForm = (updates: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const isCodeUnique = (code: string): boolean => {
    if (isEditing && editingChargeType?.charge_code === code) return true;
    return !chargeTypes.some(ct => ct.charge_code === code);
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return form.name.trim() !== '' && form.code.trim() !== '' && isCodeUnique(form.code);
      case 2: return form.category !== '' && form.trigger !== undefined;
      case 3: {
        if (form.pricingMethod === 'class_based') {
          return form.classRates.some(r => r.rate !== '');
        }
        return form.flatRate !== '';
      }
      case 4: return true;
      default: return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditing && editingChargeType) {
        // Update existing charge type
        const updated = await updateChargeType({
          id: editingChargeType.id,
          charge_code: form.code,
          charge_name: form.name,
          category: form.category.toLowerCase(),
          is_active: form.isActive,
          is_taxable: form.isTaxable,
          default_trigger: form.trigger,
          input_mode: 'qty',
          add_to_scan: form.addToScan,
          add_flag: form.addFlag,
          alert_rule: form.flagAlertOffice ? 'office' : undefined,
          notes: form.notes || undefined,
        });

        if (!updated) throw new Error('Failed to update');

        // Delete existing pricing rules
        for (const rule of editingChargeType.pricing_rules) {
          await deletePricingRule(rule.id);
        }

        // Create new pricing rules
        await createPricingRules(editingChargeType.id);
      } else {
        // Create new charge type
        const chargeType = await createChargeType({
          charge_code: form.code,
          charge_name: form.name,
          category: form.category.toLowerCase(),
          is_active: form.isActive,
          is_taxable: form.isTaxable,
          default_trigger: form.trigger,
          input_mode: 'qty',
          add_to_scan: form.addToScan,
          add_flag: form.addFlag,
          alert_rule: form.flagAlertOffice ? 'office' : undefined,
          notes: form.notes || undefined,
        });

        if (!chargeType) throw new Error('Failed to create');

        // Create pricing rules
        await createPricingRules(chargeType.id);
      }

      toast({
        title: isEditing ? 'Service Updated' : 'Service Created',
        description: `${form.name} has been ${isEditing ? 'updated' : 'created'} successfully.`,
      });
      onSaved();
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

  return (
    <div className="space-y-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <MaterialIcon name="arrow_back" size="sm" />
        </Button>
        <h3 className="text-lg font-semibold">
          {isEditing ? 'Edit Service' : isDuplicating ? 'Duplicate Service' : 'Add Service'}
        </h3>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <button
              onClick={() => s.number <= step && setStep(s.number)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                step === s.number
                  ? 'bg-primary text-primary-foreground'
                  : s.number < step
                    ? 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20'
                    : 'bg-muted text-muted-foreground'
              )}
              disabled={s.number > step}
            >
              {s.number < step ? (
                <MaterialIcon name="check" size="sm" />
              ) : (
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">
                  {s.number}
                </span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn('w-8 h-px mx-1', s.number < step ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {step === 1 && <Step1BasicInfo form={form} updateForm={updateForm} isEditing={!!isEditing} isCodeUnique={isCodeUnique} />}
        {step === 2 && <Step2CategoryTrigger form={form} updateForm={updateForm} activeCategories={activeCategories} navigateToTab={navigateToTab} />}
        {step === 3 && <Step3Pricing form={form} updateForm={updateForm} classes={classes} navigateToTab={navigateToTab} handlePricingMethodSelect={handlePricingMethodSelect} getActivePricingCard={getActivePricingCard} />}
        {step === 4 && <Step4Options form={form} updateForm={updateForm} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <MaterialIcon name="arrow_back" size="sm" className="mr-1" />
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next
              <MaterialIcon name="arrow_forward" size="sm" className="ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !canProceed()} className="bg-green-600 hover:bg-green-700 text-white">
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
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STEP 1: BASIC INFO
// =============================================================================

function Step1BasicInfo({ form, updateForm, isEditing, isCodeUnique }: {
  form: FormState;
  updateForm: (u: Partial<FormState>) => void;
  isEditing: boolean;
  isCodeUnique: (code: string) => boolean;
}) {
  const codeIsValid = form.code === '' || isCodeUnique(form.code);

  return (
    <div className="space-y-4 max-w-lg">
      <div className="space-y-2">
        <LabelWithTooltip htmlFor="serviceName" tooltip={fieldDescriptions.serviceName} required>
          Service Name
        </LabelWithTooltip>
        <Input
          id="serviceName"
          value={form.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          placeholder="e.g., Standard Inspection"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <LabelWithTooltip htmlFor="serviceCode" tooltip={fieldDescriptions.serviceCode} required>
          Service Code
        </LabelWithTooltip>
        <div className="relative">
          <Input
            id="serviceCode"
            value={form.code}
            onChange={(e) => updateForm({ code: e.target.value.toUpperCase(), codeManual: true })}
            placeholder="AUTO"
            className={cn(
              'font-mono',
              !form.codeManual && 'text-muted-foreground',
              !codeIsValid && 'border-destructive'
            )}
            readOnly={isEditing}
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
        {!codeIsValid && (
          <p className="text-xs text-destructive">This code is already in use</p>
        )}
        {!form.codeManual && (
          <p className="text-xs text-muted-foreground">Auto-generated from service name</p>
        )}
      </div>

      <div className="space-y-2">
        <LabelWithTooltip htmlFor="glCode" tooltip={fieldDescriptions.glAccountCode}>
          GL Account Code
        </LabelWithTooltip>
        <Input
          id="glCode"
          value={form.glCode}
          onChange={(e) => updateForm({ glCode: e.target.value })}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <LabelWithTooltip htmlFor="description" tooltip={fieldDescriptions.description}>
          Description
        </LabelWithTooltip>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          placeholder="Brief description for invoices..."
          rows={2}
        />
      </div>
    </div>
  );
}

// =============================================================================
// STEP 2: CATEGORY & TRIGGER
// =============================================================================

function Step2CategoryTrigger({ form, updateForm, activeCategories, navigateToTab }: {
  form: FormState;
  updateForm: (u: Partial<FormState>) => void;
  activeCategories: ReturnType<typeof useServiceCategories>['activeCategories'];
  navigateToTab: (tab: string) => void;
}) {
  const handleCategorySelect = (categoryName: string) => {
    const lower = categoryName.toLowerCase();
    updateForm({
      category: lower,
      trigger: (categoryTriggerDefaults[lower] as FormState['trigger']) || 'manual',
    });
  };

  return (
    <div className="space-y-6">
      {/* Category */}
      <div className="space-y-3">
        <LabelWithTooltip tooltip={fieldDescriptions.chargeCategory} required>
          Service Category
        </LabelWithTooltip>

        {activeCategories.length === 0 ? (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MaterialIcon name="warning" className="text-amber-600 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No categories configured</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Categories organize your services in menus and reports.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => navigateToTab('categories')}>
                      <MaterialIcon name="add" size="sm" className="mr-1" />
                      Set Up Categories
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateForm({ category: 'general' })}>
                      Continue with General
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {activeCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={cn(
                  'text-left p-3 rounded-lg border-2 transition-colors',
                  form.category === cat.name.toLowerCase()
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => handleCategorySelect(cat.name)}
              >
                <p className="font-medium text-sm">{cat.name}</p>
                {cat.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trigger */}
      <div className="space-y-3">
        <LabelWithTooltip tooltip={fieldDescriptions.billingTrigger} required>
          Billing Trigger
        </LabelWithTooltip>

        <div className="space-y-2">
          {TRIGGER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'w-full text-left p-3 rounded-lg border-2 transition-colors flex items-start gap-3',
                form.trigger === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
              onClick={() => updateForm({ trigger: opt.value as FormState['trigger'] })}
            >
              <div className={cn(
                'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
                form.trigger === opt.value ? 'border-primary' : 'border-muted-foreground/30'
              )}>
                {form.trigger === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// STEP 3: PRICING
// =============================================================================

function Step3Pricing({ form, updateForm, classes, navigateToTab, handlePricingMethodSelect, getActivePricingCard }: {
  form: FormState;
  updateForm: (u: Partial<FormState>) => void;
  classes: ReturnType<typeof useClasses>['classes'];
  navigateToTab: (tab: string) => void;
  handlePricingMethodSelect: (value: string) => void;
  getActivePricingCard: () => string;
}) {
  const activePricingCard = getActivePricingCard();

  const updateClassRate = (classCode: string, field: 'rate' | 'serviceTimeMinutes', value: string) => {
    updateForm({
      classRates: form.classRates.map(cr =>
        cr.classCode === classCode ? { ...cr, [field]: value } : cr
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* Pricing Method */}
      <div className="space-y-3">
        <LabelWithTooltip tooltip={fieldDescriptions.pricingMethod} required>
          Pricing Method
        </LabelWithTooltip>

        <div className="grid grid-cols-2 gap-2">
          {PRICING_METHOD_CARDS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              className={cn(
                'text-left p-3 rounded-lg border-2 transition-colors',
                activePricingCard === pm.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
              onClick={() => handlePricingMethodSelect(pm.value)}
            >
              <div className="flex items-center gap-2 mb-1">
                <MaterialIcon name={pm.icon} size="sm" className="text-muted-foreground" />
                <p className="font-medium text-sm">{pm.label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{pm.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Class-Based pricing */}
      {form.pricingMethod === 'class_based' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Class Rates</h4>
          {classes.length === 0 ? (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <MaterialIcon name="warning" className="text-amber-600 shrink-0" />
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">No classes configured</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">{fieldDescriptions.classExplanation}</p>
                    <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                      <p className="font-medium">Example class schemes:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><strong>By Size:</strong> Small, Medium, Large, Oversized</li>
                        <li><strong>By Value:</strong> Bronze, Silver, Gold, Platinum</li>
                        <li><strong>By Type:</strong> Standard, Fragile, High-Value, Hazmat</li>
                      </ul>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => navigateToTab('classes')}>
                        <MaterialIcon name="add" size="sm" className="mr-1" />
                        Set Up Classes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handlePricingMethodSelect('flat_per_item')}>
                        Continue with Flat Pricing
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-1">
              {form.classRates.map((cr) => {
                const cls = classes.find(c => c.code === cr.classCode);
                if (!cls) return null;
                return (
                  <AccordionItem key={cr.classCode} value={cr.classCode} className="border rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                      <div className="flex items-center gap-2 flex-1">
                        <Badge variant="outline" className="font-mono text-xs">{cr.classCode}</Badge>
                        <span className="text-sm">{cls.name}</span>
                        {cr.rate && (
                          <span className="text-sm text-muted-foreground ml-auto mr-2">${parseFloat(cr.rate).toFixed(2)}</span>
                        )}
                        {!cr.rate && (
                          <span className="text-xs text-muted-foreground ml-auto mr-2">Set rate</span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Rate ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={cr.rate}
                            onChange={(e) => updateClassRate(cr.classCode, 'rate', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Service Time (min)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={cr.serviceTimeMinutes}
                            onChange={(e) => updateClassRate(cr.classCode, 'serviceTimeMinutes', e.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      {(cls.min_cubic_feet !== null || cls.max_cubic_feet !== null) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Range: {cls.min_cubic_feet ?? 0} – {cls.max_cubic_feet ?? '∞'} cu ft
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      )}

      {/* Flat rate pricing */}
      {form.pricingMethod === 'flat' && (
        <div className="space-y-4 max-w-lg">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <LabelWithTooltip htmlFor="flatRate" tooltip="The rate to charge per unit" required>
                Rate ($)
              </LabelWithTooltip>
              <Input
                id="flatRate"
                type="number"
                step="0.01"
                min="0"
                value={form.flatRate}
                onChange={(e) => updateForm({ flatRate: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit" className="text-sm font-medium">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => updateForm({ unit: v })}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <LabelWithTooltip htmlFor="serviceTimeFull" tooltip={fieldDescriptions.serviceTime}>
              Service Time (minutes)
            </LabelWithTooltip>
            <Input
              id="serviceTimeFull"
              type="number"
              min="0"
              value={form.serviceTime}
              onChange={(e) => updateForm({ serviceTime: e.target.value })}
              placeholder="Optional"
              className="max-w-[160px]"
            />
          </div>
        </div>
      )}

      {/* Minimum charge (both methods) */}
      <div className="space-y-2 max-w-lg">
        <LabelWithTooltip htmlFor="minimumCharge" tooltip={fieldDescriptions.minimumCharge}>
          Minimum Charge ($)
        </LabelWithTooltip>
        <Input
          id="minimumCharge"
          type="number"
          step="0.01"
          min="0"
          value={form.minimumCharge}
          onChange={(e) => updateForm({ minimumCharge: e.target.value })}
          placeholder="Optional"
          className="max-w-[160px]"
        />
      </div>

      {/* Quick tips */}
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <CardContent className="pt-4 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium mb-2">Quick Tips</p>
          <ul className="space-y-1 text-xs list-disc pl-4">
            <li><strong>Class-Based</strong> — Use when different item groups should cost more or less</li>
            <li><strong>Flat Per Item</strong> — Simple, predictable billing regardless of item characteristics</li>
            <li><strong>Flat Per Task</strong> — Best for jobs where you charge once, not per item</li>
            <li><strong>Minimum Charge</strong> — Protects against unprofitable small orders</li>
            <li>Customer-specific rates can override these defaults in account agreements</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// STEP 4: OPTIONS
// =============================================================================

function Step4Options({ form, updateForm }: {
  form: FormState;
  updateForm: (u: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-4 max-w-lg">
      {/* Active */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <LabelWithTooltip tooltip={fieldDescriptions.activeToggle}>Active</LabelWithTooltip>
          </div>
          <Switch checked={form.isActive} onCheckedChange={(v) => updateForm({ isActive: v })} />
        </CardContent>
      </Card>

      {/* Taxable */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <LabelWithTooltip tooltip={fieldDescriptions.taxableToggle}>Taxable</LabelWithTooltip>
          </div>
          <Switch checked={form.isTaxable} onCheckedChange={(v) => updateForm({ isTaxable: v })} />
        </CardContent>
      </Card>

      {/* Scan Hub */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <LabelWithTooltip tooltip={fieldDescriptions.scanHubToggle}>Show in Scan Hub</LabelWithTooltip>
          </div>
          <Switch checked={form.addToScan} onCheckedChange={(v) => updateForm({ addToScan: v })} />
        </CardContent>
      </Card>

      {/* Flag */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <LabelWithTooltip tooltip={fieldDescriptions.flagToggle}>Create as Flag</LabelWithTooltip>
            </div>
            <Switch checked={form.addFlag} onCheckedChange={(v) => updateForm({ addFlag: v })} />
          </div>

          {form.addFlag && (
            <div className="ml-4 border-l-2 border-primary/20 pl-4 space-y-3 animate-in slide-in-from-left-2 duration-200">
              <div className="flex items-center justify-between">
                <LabelWithTooltip tooltip={fieldDescriptions.flagAddsCharge}>Add Charge</LabelWithTooltip>
                <Switch checked={form.flagAddsCharge} onCheckedChange={(v) => updateForm({ flagAddsCharge: v })} />
              </div>
              <div className="flex items-center justify-between">
                <LabelWithTooltip tooltip={fieldDescriptions.flagAlertOffice}>Alert Office</LabelWithTooltip>
                <Switch checked={form.flagAlertOffice} onCheckedChange={(v) => updateForm({ flagAlertOffice: v })} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <LabelWithTooltip tooltip={fieldDescriptions.flagAddsTime}>Add Service Time</LabelWithTooltip>
                  <Switch checked={form.flagAddsTime} onCheckedChange={(v) => updateForm({ flagAddsTime: v })} />
                </div>
                {form.flagAddsTime && (
                  <Input
                    type="number"
                    min="0"
                    value={form.flagTimeMinutes}
                    onChange={(e) => updateForm({ flagTimeMinutes: e.target.value })}
                    placeholder="Minutes"
                    className="max-w-[120px] ml-auto"
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(e) => updateForm({ notes: e.target.value })}
          placeholder="Internal notes (not shown on invoices)"
          rows={2}
        />
      </div>
    </div>
  );
}
