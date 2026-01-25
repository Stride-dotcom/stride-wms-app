import { useState, useRef } from 'react';
import {
  Loader2,
  DollarSign,
  Package,
  Wrench,
  Flag,
  Users,
  RefreshCw,
  Save,
  Info,
  Plus,
  Trash2,
  X,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useSizeCategories,
  useUpdateSizeCategory,
  useGlobalServiceRates,
  useUpdateGlobalServiceRate,
  useAssemblyTiers,
  useUpdateAssemblyTier,
  usePricingFlags,
  useUpdatePricingFlag,
  useCreatePricingFlag,
  useDeletePricingFlag,
  useAccountPricingOverrides,
  useSeedDefaultPricing,
  useSeedEnhancedFlags,
  useExportPricingData,
  useImportPricingData,
  useAllFlagServiceRules,
  SizeCategory,
  GlobalServiceRate,
  AssemblyTier,
  PricingFlag,
} from '@/hooks/usePricing';
import { FlagConfigDialog } from './FlagConfigDialog';
import { toast } from 'sonner';

// ============================================================================
// Instructions Component - Reusable help section
// ============================================================================

function InstructionsSection({
  title,
  children,
  defaultOpen = false
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-4">
          <HelpCircle className="h-4 w-4" />
          {title}
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Alert className="mb-4 bg-muted/50">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {children}
          </AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PricingSettingsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pricing Configuration</h2>
          <p className="text-muted-foreground">
            Manage your complete pricing structure for billing automation
          </p>
        </div>
        <SeedPricingButton />
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How Pricing Works</AlertTitle>
        <AlertDescription>
          Pricing flows in priority order: <strong>Account-Specific Rates</strong> → <strong>Size Category Rates</strong> → <strong>Global Service Rates</strong>.
          Flags add percentage surcharges or flat fees on top of calculated rates. Assembly uses tier-based pricing.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="size-categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="size-categories" className="gap-2">
            <Package className="h-4 w-4" />
            Size Categories
          </TabsTrigger>
          <TabsTrigger value="service-rates" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Service Rates
          </TabsTrigger>
          <TabsTrigger value="assembly-tiers" className="gap-2">
            <Wrench className="h-4 w-4" />
            Assembly Tiers
          </TabsTrigger>
          <TabsTrigger value="flags" className="gap-2">
            <Flag className="h-4 w-4" />
            Item Flags
          </TabsTrigger>
          <TabsTrigger value="account-overrides" className="gap-2">
            <Users className="h-4 w-4" />
            Account Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="size-categories">
          <SizeCategoriesTab />
        </TabsContent>

        <TabsContent value="service-rates">
          <ServiceRatesTab />
        </TabsContent>

        <TabsContent value="assembly-tiers">
          <AssemblyTiersTab />
        </TabsContent>

        <TabsContent value="flags">
          <FlagsTab />
        </TabsContent>

        <TabsContent value="account-overrides">
          <AccountOverridesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Seed Pricing Button + Import/Export
// ============================================================================

function SeedPricingButton() {
  const seedPricing = useSeedDefaultPricing();
  const seedEnhancedFlags = useSeedEnhancedFlags();
  const exportPricing = useExportPricingData();
  const importPricing = useImportPricingData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const data = await exportPricing.mutateAsync();

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pricing-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Pricing data exported successfully');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await importPricing.mutateAsync({ data, overwrite: true });
      toast.success('Pricing data imported successfully');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import pricing data. Please check the file format.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => seedPricing.mutate()}
              disabled={seedPricing.isPending}
            >
              {seedPricing.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Load Defaults
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Load default pricing data including size categories,<br/>assembly tiers, services, and common flags</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => seedEnhancedFlags.mutate()}
              disabled={seedEnhancedFlags.isPending}
            >
              {seedEnhancedFlags.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Add Industry Flags
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add warehouse industry-specific flags like<br/>Fragile, High Value, White Glove, etc.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportPricing.isPending}
            >
              {exportPricing.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export all pricing configuration to JSON</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleImportClick}
              disabled={importPricing.isPending}
            >
              {importPricing.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Import pricing configuration from JSON file</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ============================================================================
// Size Categories Tab
// ============================================================================

function SizeCategoriesTab() {
  const { data: categories = [], isLoading } = useSizeCategories();
  const updateCategory = useUpdateSizeCategory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<SizeCategory>>({});

  const startEdit = (category: SizeCategory) => {
    setEditingId(category.id);
    setEditValues({
      storage_rate_per_day: category.storage_rate_per_day,
      inspection_fee_per_item: category.inspection_fee_per_item,
      default_inspection_minutes: category.default_inspection_minutes,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateCategory.mutateAsync({ id: editingId, ...editValues });
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Size Categories</CardTitle>
        <CardDescription>
          Define storage and inspection rates by item size classification
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InstructionsSection title="How to configure Size Categories">
          <div className="space-y-2">
            <p><strong>Purpose:</strong> Size categories (XS, S, M, L, XL) determine base rates for storage and inspection services based on item dimensions.</p>
            <p><strong>Storage Rate/Day:</strong> The daily charge for storing one item of this size. Monthly estimates are calculated as (rate × 30 days).</p>
            <p><strong>Inspection Fee:</strong> The flat fee charged for inspecting one item of this size category.</p>
            <p><strong>Inspection Minutes:</strong> The estimated time to inspect an item of this size (used for scheduling and labor planning).</p>
            <p><strong>Example:</strong> A Medium (M) item at $0.75/day costs ~$22.50/month in storage.</p>
          </div>
        </InstructionsSection>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Storage/Day</TableHead>
              <TableHead className="text-right">Monthly Est.</TableHead>
              <TableHead className="text-right">Inspection Fee</TableHead>
              <TableHead className="text-right">Inspection Min.</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <Badge variant="outline">{category.code}</Badge>
                </TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-right">
                  {editingId === category.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 text-right"
                      value={editValues.storage_rate_per_day ?? ''}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          storage_rate_per_day: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    `$${category.storage_rate_per_day?.toFixed(2) || '0.00'}`
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  ${((category.storage_rate_per_day || 0) * 30).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === category.id ? (
                    <Input
                      type="number"
                      step="1"
                      className="w-24 text-right"
                      value={editValues.inspection_fee_per_item ?? ''}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          inspection_fee_per_item: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    `$${category.inspection_fee_per_item?.toFixed(0) || '0'}`
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === category.id ? (
                    <Input
                      type="number"
                      step="1"
                      className="w-20 text-right"
                      value={editValues.default_inspection_minutes ?? ''}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          default_inspection_minutes: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  ) : (
                    `${category.default_inspection_minutes || 0} min`
                  )}
                </TableCell>
                <TableCell>
                  {editingId === category.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} disabled={updateCategory.isPending}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(category)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {categories.length === 0 && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>No size categories</AlertTitle>
            <AlertDescription>
              Click "Load Defaults" above to populate standard size categories (XS, S, M, L, XL).
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Service Rates Tab
// ============================================================================

function ServiceRatesTab() {
  const { data: services = [], isLoading } = useGlobalServiceRates();
  const updateService = useUpdateGlobalServiceRate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<GlobalServiceRate>>({});

  const startEdit = (service: GlobalServiceRate) => {
    setEditingId(service.id);
    setEditValues({
      base_rate: service.base_rate,
      pricing_mode: service.pricing_mode,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateService.mutateAsync({ id: editingId, ...editValues });
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const getPricingModeLabel = (mode: string) => {
    switch (mode) {
      case 'flat':
        return 'Flat Rate';
      case 'per_size':
        return 'By Size Category';
      case 'assembly_tier':
        return 'By Assembly Tier';
      case 'manual':
        return 'Manual/Quote';
      default:
        return mode;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Service Rates</CardTitle>
        <CardDescription>
          Configure base rates for all billable services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InstructionsSection title="How to configure Service Rates">
          <div className="space-y-2">
            <p><strong>Purpose:</strong> Define how each service type is priced across your warehouse operations.</p>
            <p><strong>Pricing Modes:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Flat Rate:</strong> Fixed price per unit (e.g., $15 per item for receiving)</li>
              <li><strong>By Size Category:</strong> Rate varies by item size (XS-XL) - see Size Categories tab</li>
              <li><strong>By Assembly Tier:</strong> Rate varies by complexity (Tier 1-4) - see Assembly Tiers tab</li>
              <li><strong>Manual/Quote:</strong> Requires custom quote per job (e.g., custom packaging)</li>
            </ul>
            <p><strong>Note:</strong> These are default rates. Individual accounts can have custom pricing overrides.</p>
          </div>
        </InstructionsSection>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Base Rate</TableHead>
              <TableHead>Pricing Mode</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <Badge variant="outline">{service.code}</Badge>
                </TableCell>
                <TableCell className="font-medium">{service.name}</TableCell>
                <TableCell className="text-right">
                  {editingId === service.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 text-right"
                      value={editValues.base_rate ?? ''}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          base_rate: parseFloat(e.target.value) || null,
                        })
                      }
                      disabled={editValues.pricing_mode !== 'flat'}
                    />
                  ) : service.pricing_mode === 'flat' ? (
                    `$${service.base_rate?.toFixed(2) || '0.00'}`
                  ) : (
                    <span className="text-muted-foreground">calculated</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === service.id ? (
                    <Select
                      value={editValues.pricing_mode || 'flat'}
                      onValueChange={(value) =>
                        setEditValues({ ...editValues, pricing_mode: value as any })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="per_size">By Size Category</SelectItem>
                        <SelectItem value="assembly_tier">By Assembly Tier</SelectItem>
                        <SelectItem value="manual">Manual/Quote</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{getPricingModeLabel(service.pricing_mode)}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{service.charge_unit}</TableCell>
                <TableCell>
                  {editingId === service.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} disabled={updateService.isPending}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(service)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {services.length === 0 && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>No services configured</AlertTitle>
            <AlertDescription>
              Services should be set up in your billable services configuration.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Assembly Tiers Tab
// ============================================================================

function AssemblyTiersTab() {
  const { data: tiers = [], isLoading } = useAssemblyTiers();
  const updateTier = useUpdateAssemblyTier();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<AssemblyTier>>({});

  const startEdit = (tier: AssemblyTier) => {
    setEditingId(tier.id);
    setEditValues({
      rate: tier.rate,
      default_minutes: tier.default_minutes,
      billing_mode: tier.billing_mode,
      requires_special_installer: tier.requires_special_installer,
      requires_manual_quote: tier.requires_manual_quote,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateTier.mutateAsync({ id: editingId, ...editValues });
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assembly Tiers</CardTitle>
        <CardDescription>
          Configure pricing for assembly services by complexity level
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InstructionsSection title="How to configure Assembly Tiers">
          <div className="space-y-2">
            <p><strong>Purpose:</strong> Assembly pricing varies significantly by complexity. Use tiers to standardize pricing for different job difficulties.</p>
            <p><strong>Tier Levels:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Tier 1 (Very Easy):</strong> Simple assemblies like small shelves, basic furniture (15-20 min)</li>
              <li><strong>Tier 2 (Default):</strong> Standard furniture assembly, moderate complexity (30-60 min)</li>
              <li><strong>Tier 3 (Skilled):</strong> Complex assemblies requiring experienced technicians (60-90 min)</li>
              <li><strong>Tier 4 (Special):</strong> Custom work requiring special installers or manual quotes</li>
            </ul>
            <p><strong>Billing Modes:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Flat per Item:</strong> Fixed price regardless of actual time</li>
              <li><strong>Per Minute:</strong> Charge based on actual labor time</li>
              <li><strong>Manual Quote:</strong> Custom pricing per job</li>
            </ul>
          </div>
        </InstructionsSection>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Tier</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Billing Mode</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Default Min.</TableHead>
              <TableHead className="text-center">Special Installer</TableHead>
              <TableHead className="text-center">Manual Quote</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier) => (
              <TableRow key={tier.id}>
                <TableCell>
                  <Badge>{tier.tier_number}</Badge>
                </TableCell>
                <TableCell className="font-medium">{tier.display_name}</TableCell>
                <TableCell>
                  {editingId === tier.id ? (
                    <Select
                      value={editValues.billing_mode || 'flat_per_item'}
                      onValueChange={(value) =>
                        setEditValues({ ...editValues, billing_mode: value as any })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat_per_item">Flat per Item</SelectItem>
                        <SelectItem value="per_minute">Per Minute</SelectItem>
                        <SelectItem value="manual_quote">Manual Quote</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{tier.billing_mode.replace(/_/g, ' ')}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === tier.id ? (
                    <Input
                      type="number"
                      step="1"
                      className="w-24 text-right"
                      value={editValues.rate ?? ''}
                      onChange={(e) =>
                        setEditValues({ ...editValues, rate: parseFloat(e.target.value) || null })
                      }
                      disabled={editValues.billing_mode === 'manual_quote'}
                    />
                  ) : tier.rate ? (
                    `$${tier.rate.toFixed(0)}`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === tier.id ? (
                    <Input
                      type="number"
                      step="1"
                      className="w-20 text-right"
                      value={editValues.default_minutes ?? ''}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          default_minutes: parseInt(e.target.value) || null,
                        })
                      }
                    />
                  ) : tier.default_minutes ? (
                    `${tier.default_minutes} min`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === tier.id ? (
                    <Switch
                      checked={editValues.requires_special_installer ?? false}
                      onCheckedChange={(checked) =>
                        setEditValues({ ...editValues, requires_special_installer: checked })
                      }
                    />
                  ) : tier.requires_special_installer ? (
                    <Badge variant="destructive">Yes</Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === tier.id ? (
                    <Switch
                      checked={editValues.requires_manual_quote ?? false}
                      onCheckedChange={(checked) =>
                        setEditValues({ ...editValues, requires_manual_quote: checked })
                      }
                    />
                  ) : tier.requires_manual_quote ? (
                    <Badge variant="destructive">Yes</Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === tier.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} disabled={updateTier.isPending}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(tier)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {tiers.length === 0 && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>No assembly tiers</AlertTitle>
            <AlertDescription>
              Click "Load Defaults" above to populate standard assembly tiers (1-4).
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Flags Tab - Enhanced with full CRUD and FlagConfigDialog
// ============================================================================

function FlagsTab() {
  const { data: flags = [], isLoading, refetch } = usePricingFlags();
  const { data: allServiceRules = [] } = useAllFlagServiceRules();
  const deleteFlag = useDeletePricingFlag();

  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<PricingFlag | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleEditFlag = (flag: PricingFlag) => {
    setSelectedFlag(flag);
    setConfigDialogOpen(true);
  };

  const handleAddFlag = () => {
    setSelectedFlag(null);
    setConfigDialogOpen(true);
  };

  const handleDeleteFlag = async (flagId: string) => {
    await deleteFlag.mutateAsync(flagId);
    setDeleteConfirm(null);
  };

  const handleDialogSaved = () => {
    refetch();
  };

  // Count service rules per flag
  const getServiceRulesCount = (flagId: string) => {
    return allServiceRules.filter((r) => r.flag_id === flagId).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Item Flags</CardTitle>
              <CardDescription>
                Configure flags that can be applied to items with automatic billing, tasks, and alerts
              </CardDescription>
            </div>
            <Button onClick={handleAddFlag}>
              <Plus className="mr-2 h-4 w-4" />
              Add Flag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <InstructionsSection title="How to configure Item Flags">
            <div className="space-y-2">
              <p><strong>Purpose:</strong> Flags are toggles that can be applied to individual items. When enabled, they can automatically trigger billing events, create tasks, or send alerts.</p>
              <p><strong>Key Settings:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Billable:</strong> Flag represents a chargeable service/surcharge</li>
                <li><strong>Flat Fee:</strong> Fixed amount charged when flag is enabled</li>
                <li><strong>Adds %:</strong> Percentage surcharge added to applicable services</li>
                <li><strong>Per-Service Rules:</strong> Override default pricing for specific services (e.g., Overweight adds +10% to Storage but +20% to Delivery)</li>
                <li><strong>Creates Billing Event:</strong> Automatically generates a billing record</li>
                <li><strong>Triggers Task:</strong> Automatically creates a task (e.g., repair, inspection)</li>
                <li><strong>Triggers Alert:</strong> Sends notification to office staff</li>
              </ul>
              <p><strong>Client Visibility:</strong> Control whether clients can see or toggle flags in their portal.</p>
              <p><strong>Example:</strong> "Overweight" flag with +15% surcharge + $25 flat fee + alert to notify office of heavy item.</p>
            </div>
          </InstructionsSection>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Billable</TableHead>
                <TableHead className="text-right">Flat Fee</TableHead>
                <TableHead className="text-right">Adds %</TableHead>
                <TableHead className="text-center">Service Rules</TableHead>
                <TableHead className="text-center">Auto Billing</TableHead>
                <TableHead className="text-center">Auto Task</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => {
                const rulesCount = getServiceRulesCount(flag.id);
                return (
                  <TableRow key={flag.id} className={!flag.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <Badge variant="outline">{flag.flag_key}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{flag.display_name}</span>
                        {flag.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-48">{flag.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {flag.is_active ? (
                        <Badge className="bg-green-500">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {flag.is_billable ? (
                        <Badge className="bg-amber-500">$</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {flag.flat_fee > 0 ? (
                        `$${flag.flat_fee.toFixed(2)}`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {flag.adds_percent > 0 ? (
                        <Badge variant="secondary">+{flag.adds_percent}%</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {rulesCount > 0 ? (
                        <Badge variant="outline" className="bg-blue-50">
                          {rulesCount} rule{rulesCount > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">default</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {flag.creates_billing_event ? (
                        <Badge className="bg-blue-500">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {flag.triggers_task_type ? (
                        <Badge>{flag.triggers_task_type}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => handleEditFlag(flag)}>
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Configure flag settings and per-service rules</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(flag.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {flags.length === 0 && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle>No flags configured</AlertTitle>
              <AlertDescription>
                Click "Load Defaults" above to populate standard flags, "Add Industry Flags" for warehouse-specific flags, or click "Add Flag" to create custom flags.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Flag Config Dialog */}
      <FlagConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        flag={selectedFlag}
        onSaved={handleDialogSaved}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this flag. Any items with this flag will have it removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && handleDeleteFlag(deleteConfirm)}
            >
              {deleteFlag.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Account Overrides Tab
// ============================================================================

function AccountOverridesTab() {
  const { data: overrides = [], isLoading } = useAccountPricingOverrides();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Pricing Overrides</CardTitle>
        <CardDescription>
          View all account-level pricing adjustments configured in your system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InstructionsSection title="How Account Overrides Work">
          <div className="space-y-2">
            <p><strong>Purpose:</strong> Apply percentage markup or discount to all services for specific accounts.</p>
            <p><strong>How to Configure:</strong> Account pricing overrides are set in the individual Account settings page under the "Pricing" tab.</p>
            <p><strong>Calculation:</strong> Base rate × (1 + adjustment). Example: $100 service with +10% markup = $110.</p>
            <p><strong>Positive values:</strong> Markup (customer pays more)</p>
            <p><strong>Negative values:</strong> Discount (customer pays less)</p>
          </div>
        </InstructionsSection>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right">% Adjustment</TableHead>
              <TableHead>Effect</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overrides.map((override: any) => (
              <TableRow key={override.id}>
                <TableCell>
                  <Badge variant="outline">{override.account?.account_code}</Badge>
                </TableCell>
                <TableCell className="font-medium">{override.account?.account_name}</TableCell>
                <TableCell className="text-right">
                  {override.percent_adjust > 0 ? (
                    <Badge className="bg-amber-500">+{(override.percent_adjust * 100).toFixed(1)}%</Badge>
                  ) : override.percent_adjust < 0 ? (
                    <Badge className="bg-green-500">{(override.percent_adjust * 100).toFixed(1)}%</Badge>
                  ) : (
                    <span className="text-muted-foreground">0%</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {override.percent_adjust > 0
                    ? 'Markup'
                    : override.percent_adjust < 0
                    ? 'Discount'
                    : 'Standard rates'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {overrides.length === 0 && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>No account overrides</AlertTitle>
            <AlertDescription>
              Account pricing adjustments can be configured in individual Account settings under the Pricing tab.
              All accounts use standard rates by default.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
