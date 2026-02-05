import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useChargeTypesWithRules, useChargeTypes, type ChargeTypeWithRules } from '@/hooks/useChargeTypes';
import { useClasses } from '@/hooks/useClasses';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { AddServiceForm } from './AddServiceForm';
import { cn } from '@/lib/utils';

interface PriceListTabProps {
  navigateToTab: (tab: string) => void;
}

type ViewMode = 'list' | 'matrix';
type StatusFilter = 'all' | 'active' | 'inactive';

export function PriceListTab({ navigateToTab }: PriceListTabProps) {
  const { chargeTypesWithRules, loading, refetch } = useChargeTypesWithRules();
  const { deleteChargeType } = useChargeTypes();
  const { classes } = useClasses();
  const { activeCategories } = useServiceCategories();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChargeType, setEditingChargeType] = useState<ChargeTypeWithRules | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ChargeTypeWithRules | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return chargeTypesWithRules.filter((ct) => {
      const matchesSearch = !search ||
        ct.charge_code.toLowerCase().includes(search.toLowerCase()) ||
        ct.charge_name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || ct.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && ct.is_active) ||
        (statusFilter === 'inactive' && !ct.is_active);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [chargeTypesWithRules, search, categoryFilter, statusFilter]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteChargeType(deleteConfirm.id);
    setDeleteConfirm(null);
    refetch();
  };

  const handleEdit = (ct: ChargeTypeWithRules) => {
    setEditingChargeType(ct);
    setShowAddForm(true);
  };

  const handleDuplicate = (ct: ChargeTypeWithRules) => {
    const dup = {
      ...ct,
      id: '',
      charge_code: ct.charge_code + '-COPY',
      charge_name: ct.charge_name + ' (Copy)',
    };
    setEditingChargeType(dup as ChargeTypeWithRules);
    setShowAddForm(true);
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const headers = ['Code', 'Name', 'Category', 'Trigger', 'Method', 'Unit', 'Rate', 'Min Charge', 'Active', 'Taxable', 'Scan', 'Flag'];
    const rows = filtered.map(ct => {
      const isClassBased = ct.pricing_rules.some(r => r.pricing_method === 'class_based');
      const rates = ct.pricing_rules.map(r => r.rate);
      const rateDisplay = rates.length === 0 ? '' : isClassBased
        ? `${Math.min(...rates).toFixed(2)}-${Math.max(...rates).toFixed(2)}`
        : rates[0]?.toFixed(2) || '';
      return [
        ct.charge_code,
        ct.charge_name,
        ct.category,
        ct.default_trigger,
        isClassBased ? 'class_based' : 'flat',
        ct.pricing_rules[0]?.unit || 'each',
        rateDisplay,
        ct.pricing_rules[0]?.minimum_charge?.toFixed(2) || '',
        ct.is_active ? 'Yes' : 'No',
        ct.is_taxable ? 'Yes' : 'No',
        ct.add_to_scan ? 'Yes' : 'No',
        ct.add_flag ? 'Yes' : 'No',
      ];
    });

    // Add class-specific rate columns
    if (classes.length > 0) {
      headers.push(...classes.map(c => `Rate: ${c.code}`));
      rows.forEach((row, idx) => {
        const ct = filtered[idx];
        classes.forEach(cls => {
          const rule = ct.pricing_rules.find(r => r.class_code === cls.code);
          row.push(rule ? rule.rate.toFixed(2) : '');
        });
      });
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Price List');
    XLSX.writeFile(wb, 'price-list-export.xlsx');
    toast({ title: 'Exported', description: `${filtered.length} services exported to Excel.` });
  };

  if (showAddForm) {
    return (
      <AddServiceForm
        onClose={() => {
          setShowAddForm(false);
          setEditingChargeType(null);
        }}
        onSaved={() => {
          refetch();
          setShowAddForm(false);
          setEditingChargeType(null);
        }}
        editingChargeType={editingChargeType}
        navigateToTab={navigateToTab}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chargeTypesWithRules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MaterialIcon name="payments" size="xl" className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No services configured</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Add your first service to start billing, or use Quick Start to load a template.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => setShowAddForm(true)}>
            <MaterialIcon name="add" size="sm" className="mr-1.5" />
            Add Service
          </Button>
          <Button variant="outline" onClick={() => navigateToTab('quick-start')}>
            <MaterialIcon name="rocket_launch" size="sm" className="mr-1.5" />
            Go to Quick Start
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <MaterialIcon name="search" size="sm" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {activeCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name.toLowerCase()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex border rounded-md overflow-hidden">
          <button
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            onClick={() => setViewMode('list')}
          >
            <MaterialIcon name="view_list" size="sm" />
          </button>
          <button
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              viewMode === 'matrix' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
            )}
            onClick={() => setViewMode('matrix')}
          >
            <MaterialIcon name="grid_view" size="sm" />
          </button>
        </div>

        <Button variant="outline" onClick={handleExport} className="hidden sm:flex">
          <MaterialIcon name="download" size="sm" className="mr-1.5" />
          Export
        </Button>

        <Button onClick={() => setShowAddForm(true)} className="w-full sm:w-auto">
          <MaterialIcon name="add" size="sm" className="mr-1.5" />
          Add Service
        </Button>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {chargeTypesWithRules.length} services
      </p>

      {/* List or Matrix view */}
      {viewMode === 'list' ? (
        <ListView
          items={filtered}
          classes={classes}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={setDeleteConfirm}
          expandedItems={expandedItems}
          setExpandedItems={setExpandedItems}
        />
      ) : (
        <MatrixView
          items={filtered}
          classes={classes}
          onEdit={handleEdit}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.charge_name}"?
              This action cannot be undone. Historical billing data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// LIST VIEW
// =============================================================================

interface ListViewProps {
  items: ChargeTypeWithRules[];
  classes: ReturnType<typeof useClasses>['classes'];
  onEdit: (ct: ChargeTypeWithRules) => void;
  onDuplicate: (ct: ChargeTypeWithRules) => void;
  onDelete: (ct: ChargeTypeWithRules) => void;
  expandedItems: string[];
  setExpandedItems: (items: string[]) => void;
}

function ListView({ items, classes, onEdit, onDuplicate, onDelete, expandedItems, setExpandedItems }: ListViewProps) {
  const getPricingMethodLabel = (ct: ChargeTypeWithRules) => {
    const hasClassRules = ct.pricing_rules.some(r => r.pricing_method === 'class_based');
    return hasClassRules ? 'Class-Based' : 'Flat';
  };

  const getRateDisplay = (ct: ChargeTypeWithRules) => {
    if (ct.pricing_rules.length === 0) return 'No rates';
    const rates = ct.pricing_rules.map(r => r.rate).filter(Boolean);
    if (rates.length === 0) return 'No rates';
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  };

  const getTriggerLabel = (trigger: string) => {
    const map: Record<string, string> = {
      manual: 'Manual',
      task: 'Task',
      shipment: 'Shipment',
      storage: 'Storage',
      auto: 'Auto',
    };
    return map[trigger] || trigger;
  };

  return (
    <Accordion
      type="multiple"
      value={expandedItems}
      onValueChange={setExpandedItems}
      className="space-y-2"
    >
      {items.map((ct) => (
        <AccordionItem key={ct.id} value={ct.id} className="border rounded-lg overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <Badge variant="outline" className="font-mono text-xs shrink-0">
                {ct.charge_code}
              </Badge>
              <span className={cn('font-medium truncate', !ct.is_active && 'opacity-50')}>
                {ct.charge_name}
              </span>
              <div className="hidden sm:flex items-center gap-1.5 ml-auto mr-4">
                {ct.category && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {ct.category}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {getPricingMethodLabel(ct)}
                </Badge>
                {ct.add_to_scan && (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-xs">Scan</Badge>
                      </TooltipTrigger>
                      <TooltipContent>Available in Scan Hub</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {ct.add_flag && (
                  <Badge variant="outline" className="text-xs">Flag</Badge>
                )}
                {ct.is_taxable && (
                  <Badge variant="outline" className="text-xs">Tax</Badge>
                )}
                <span className="text-sm text-muted-foreground ml-2">
                  {getRateDisplay(ct)}
                </span>
                {!ct.is_active && (
                  <Badge variant="secondary" className="text-xs">Inactive</Badge>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-4 pt-2">
              {/* Mobile badges */}
              <div className="flex flex-wrap gap-1.5 sm:hidden">
                {ct.category && (
                  <Badge variant="secondary" className="text-xs capitalize">{ct.category}</Badge>
                )}
                <Badge variant="outline" className="text-xs">{getPricingMethodLabel(ct)}</Badge>
                {ct.add_to_scan && <Badge variant="outline" className="text-xs">Scan</Badge>}
                {ct.add_flag && <Badge variant="outline" className="text-xs">Flag</Badge>}
                {ct.is_taxable && <Badge variant="outline" className="text-xs">Tax</Badge>}
                {!ct.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                <span className="text-sm text-muted-foreground">{getRateDisplay(ct)}</span>
              </div>

              {/* Pricing Rules */}
              <div>
                <h4 className="text-sm font-medium mb-2">Pricing Rules</h4>
                {ct.pricing_rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No pricing rules configured</p>
                ) : ct.pricing_rules.some(r => r.pricing_method === 'class_based') ? (
                  <div className="space-y-1">
                    {ct.pricing_rules
                      .sort((a, b) => (a.class_code || '').localeCompare(b.class_code || ''))
                      .map((rule) => {
                        const cls = classes.find(c => c.code === rule.class_code);
                        return (
                          <div key={rule.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-muted/50 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">{rule.class_code || 'Default'}</Badge>
                              {cls && <span className="text-muted-foreground">{cls.name}</span>}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-medium">${rule.rate.toFixed(2)}</span>
                              {rule.service_time_minutes && (
                                <span className="text-xs text-muted-foreground">{rule.service_time_minutes}min</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="py-1.5 px-3 rounded bg-muted/50 text-sm flex items-center justify-between">
                    <span>{ct.pricing_rules[0]?.unit || 'each'}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-medium">${ct.pricing_rules[0]?.rate.toFixed(2)}</span>
                      {ct.pricing_rules[0]?.service_time_minutes && (
                        <span className="text-xs text-muted-foreground">{ct.pricing_rules[0].service_time_minutes}min</span>
                      )}
                    </div>
                  </div>
                )}
                {ct.pricing_rules.some(r => r.minimum_charge) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum charge: ${ct.pricing_rules.find(r => r.minimum_charge)?.minimum_charge?.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Config summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Trigger</span>
                  <p className="font-medium">{getTriggerLabel(ct.default_trigger)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Taxable</span>
                  <p className="font-medium">{ct.is_taxable ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Scan Hub</span>
                  <p className="font-medium">{ct.add_to_scan ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Flag</span>
                  <p className="font-medium">{ct.add_flag ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {/* Notes */}
              {ct.notes && (
                <p className="text-sm text-muted-foreground italic">{ct.notes}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => onEdit(ct)}>
                  <MaterialIcon name="edit" size="sm" className="mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDuplicate(ct)}>
                  <MaterialIcon name="content_copy" size="sm" className="mr-1" />
                  Duplicate
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(ct)}>
                  <MaterialIcon name="delete" size="sm" className="mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// =============================================================================
// MATRIX VIEW
// =============================================================================

interface MatrixViewProps {
  items: ChargeTypeWithRules[];
  classes: ReturnType<typeof useClasses>['classes'];
  onEdit: (ct: ChargeTypeWithRules) => void;
}

function MatrixView({ items, classes, onEdit }: MatrixViewProps) {
  const getTriggerLabel = (trigger: string) => {
    const map: Record<string, string> = {
      manual: 'Manual',
      task: 'Task',
      shipment: 'Ship',
      storage: 'Storage',
      auto: 'Auto',
    };
    return map[trigger] || trigger;
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Service</TableHead>
            <TableHead className="text-center w-20">Trigger</TableHead>
            {classes.map((cls) => (
              <TableHead key={cls.id} className="text-center min-w-[80px]">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger className="font-mono text-xs">
                      {cls.code}
                    </TooltipTrigger>
                    <TooltipContent>{cls.name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[80px]">Min</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((ct) => (
            <TableRow key={ct.id} className={cn(!ct.is_active && 'opacity-50')}>
              <TableCell className="sticky left-0 bg-background z-10">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs shrink-0">{ct.charge_code}</Badge>
                  <span className="text-sm truncate">{ct.charge_name}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="text-xs">{getTriggerLabel(ct.default_trigger)}</Badge>
              </TableCell>
              {classes.map((cls) => {
                const rule = ct.pricing_rules.find(r => r.class_code === cls.code);
                return (
                  <TableCell key={cls.id} className="text-center">
                    {rule ? (
                      <div>
                        <span className="text-sm font-medium">${rule.rate.toFixed(2)}</span>
                        {rule.service_time_minutes && (
                          <div className="text-[10px] text-muted-foreground">{rule.service_time_minutes}m</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="text-center">
                {ct.pricing_rules.find(r => r.minimum_charge) ? (
                  <span className="text-sm">${ct.pricing_rules.find(r => r.minimum_charge)?.minimum_charge?.toFixed(2)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => onEdit(ct)}>
                  <MaterialIcon name="edit" size="sm" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
