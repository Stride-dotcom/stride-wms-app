import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  useAccountPricingOverrides,
  useSeedDefaultPricing,
  SizeCategory,
  GlobalServiceRate,
  AssemblyTier,
  PricingFlag,
} from '@/hooks/usePricing';

export function PricingSettingsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pricing Configuration</h2>
          <p className="text-muted-foreground">
            Manage your pricing structure: size categories, service rates, assembly tiers, and flags
          </p>
        </div>
        <SeedPricingButton />
      </div>

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
            Flags
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
// Seed Pricing Button
// ============================================================================

function SeedPricingButton() {
  const seedPricing = useSeedDefaultPricing();

  return (
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
          XS–XL are your core buckets. These drive STORAGE + INSPECTION defaults.
          Storage is FLAT RATE PER DAY per item.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
          Global base service rates (tenant defaults). These are the rates you charge unless an account override exists.
          Storage and Inspection are driven by Size Categories.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
          Assembly pricing is variable. Use tier flags on items: Tier 1 = Very Easy (simple),
          Tier 2 = Default, Tier 3 = Skilled, Tier 4 = Special Installer / Custom Quote.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
// Flags Tab
// ============================================================================

function FlagsTab() {
  const { data: flags = [], isLoading } = usePricingFlags();
  const updateFlag = useUpdatePricingFlag();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PricingFlag>>({});

  const startEdit = (flag: PricingFlag) => {
    setEditingId(flag.id);
    setEditValues({
      adds_percent: flag.adds_percent,
      adds_minutes: flag.adds_minutes,
      applies_to_services: flag.applies_to_services,
      visible_to_client: flag.visible_to_client,
      client_can_set: flag.client_can_set,
      triggers_task_type: flag.triggers_task_type,
      triggers_alert: flag.triggers_alert,
      is_active: flag.is_active,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateFlag.mutateAsync({ id: editingId, ...editValues });
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
        <CardTitle>Pricing Flags</CardTitle>
        <CardDescription>
          Tenant-customizable flags. Keep flags data-driven so other subscribers can add/hide/remove without code.
          Flags can add percentage adjustments or extra time to service pricing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-center">Client Visible</TableHead>
              <TableHead className="text-right">Adds %</TableHead>
              <TableHead className="text-right">Adds Min.</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Triggers Task</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.map((flag) => (
              <TableRow key={flag.id} className={!flag.is_active ? 'opacity-50' : ''}>
                <TableCell>
                  <Badge variant="outline">{flag.flag_key}</Badge>
                </TableCell>
                <TableCell className="font-medium">{flag.display_name}</TableCell>
                <TableCell className="text-center">
                  {editingId === flag.id ? (
                    <Switch
                      checked={editValues.is_active ?? true}
                      onCheckedChange={(checked) =>
                        setEditValues({ ...editValues, is_active: checked })
                      }
                    />
                  ) : flag.is_active ? (
                    <Badge className="bg-green-500">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editingId === flag.id ? (
                    <Switch
                      checked={editValues.visible_to_client ?? true}
                      onCheckedChange={(checked) =>
                        setEditValues({ ...editValues, visible_to_client: checked })
                      }
                    />
                  ) : flag.visible_to_client ? (
                    'Yes'
                  ) : (
                    'No'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === flag.id ? (
                    <Input
                      type="number"
                      step="1"
                      className="w-20 text-right"
                      value={editValues.adds_percent ?? 0}
                      onChange={(e) =>
                        setEditValues({ ...editValues, adds_percent: parseFloat(e.target.value) || 0 })
                      }
                    />
                  ) : flag.adds_percent > 0 ? (
                    <Badge variant="secondary">+{flag.adds_percent}%</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === flag.id ? (
                    <Input
                      type="number"
                      step="1"
                      className="w-20 text-right"
                      value={editValues.adds_minutes ?? 0}
                      onChange={(e) =>
                        setEditValues({ ...editValues, adds_minutes: parseInt(e.target.value) || 0 })
                      }
                    />
                  ) : flag.adds_minutes > 0 ? (
                    `+${flag.adds_minutes} min`
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === flag.id ? (
                    <Select
                      value={editValues.applies_to_services || 'ALL'}
                      onValueChange={(value) =>
                        setEditValues({ ...editValues, applies_to_services: value })
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Services</SelectItem>
                        <SelectItem value="STORAGE">Storage</SelectItem>
                        <SelectItem value="INSPECTION">Inspection</SelectItem>
                        <SelectItem value="ASSEMBLY">Assembly</SelectItem>
                        <SelectItem value="REPAIR">Repair</SelectItem>
                        <SelectItem value="RECEIVING">Receiving</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{flag.applies_to_services}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === flag.id ? (
                    <Input
                      className="w-24"
                      value={editValues.triggers_task_type || ''}
                      onChange={(e) =>
                        setEditValues({ ...editValues, triggers_task_type: e.target.value || null })
                      }
                      placeholder="none"
                    />
                  ) : flag.triggers_task_type ? (
                    <Badge>{flag.triggers_task_type}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === flag.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} disabled={updateFlag.isPending}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(flag)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {flags.length === 0 && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertTitle>No flags configured</AlertTitle>
            <AlertDescription>
              Click "Load Defaults" above to populate standard flags (Overweight, Oversize, Crated, etc.).
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
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
          % adjustments per account. Positive values = markup, negative values = discount.
          These multiply all base rates for that customer.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              Account pricing adjustments can be configured in the Account settings under the Pricing tab.
              All accounts use standard rates by default.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
