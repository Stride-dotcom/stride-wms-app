/**
 * ServiceEventsPricingTab - Complete pricing management using service_events table
 * Features:
 * - Sortable column headers
 * - Expandable rows to view all fields
 * - Column visibility controls
 * - Inline editing with save button
 * - Mobile responsive design
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Loader2,
  DollarSign,
  Plus,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  Copy,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  X,
  Check,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Save,
  Settings2,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useServiceEventsAdmin,
  ServiceEvent,
  BILLING_TRIGGERS,
  CLASS_CODES,
  BILLING_UNITS,
  ALERT_RULES,
  UpdateServiceEventInput,
} from '@/hooks/useServiceEventsAdmin';
import { useServiceEvents } from '@/hooks/useServiceEvents';
import { AddServiceDialog } from './AddServiceDialog';
import { CSVImportServiceDialog } from './CSVImportServiceDialog';
import { ServiceAuditDialog } from './ServiceAuditDialog';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type SortField = 'service_code' | 'service_name' | 'class_code' | 'billing_unit' | 'rate' | 'service_time_minutes' | 'billing_trigger' | 'is_active';
type SortDirection = 'asc' | 'desc';

interface ColumnConfig {
  key: string;
  label: string;
  defaultVisible: boolean;
  sortable?: boolean;
  sortKey?: SortField;
}

const ALL_COLUMNS: ColumnConfig[] = [
  { key: 'service_code', label: 'Service Code', defaultVisible: true, sortable: true, sortKey: 'service_code' },
  { key: 'service_name', label: 'Service Name', defaultVisible: true, sortable: true, sortKey: 'service_name' },
  { key: 'class_code', label: 'Class', defaultVisible: true, sortable: true, sortKey: 'class_code' },
  { key: 'billing_unit', label: 'Billing Unit', defaultVisible: true, sortable: true, sortKey: 'billing_unit' },
  { key: 'rate', label: 'Rate', defaultVisible: true, sortable: true, sortKey: 'rate' },
  { key: 'service_time_minutes', label: 'Time (min)', defaultVisible: false, sortable: true, sortKey: 'service_time_minutes' },
  { key: 'taxable', label: 'Taxable', defaultVisible: false },
  { key: 'uses_class_pricing', label: 'Class Pricing', defaultVisible: false },
  { key: 'is_active', label: 'Active', defaultVisible: true, sortable: true, sortKey: 'is_active' },
  { key: 'notes', label: 'Notes', defaultVisible: false },
  { key: 'add_flag', label: 'Show Flag', defaultVisible: false },
  { key: 'add_to_service_event_scan', label: 'Scan Event', defaultVisible: false },
  { key: 'alert_rule', label: 'Alert Rule', defaultVisible: false },
  { key: 'billing_trigger', label: 'Billing Trigger', defaultVisible: true, sortable: true, sortKey: 'billing_trigger' },
];

// ============================================================================
// Pending Changes Tracking
// ============================================================================

type PendingChange = Partial<Omit<ServiceEvent, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;

// ============================================================================
// Main Component
// ============================================================================

export function ServiceEventsPricingTab() {
  const {
    filteredServiceEvents,
    uniqueServiceCodes,
    uniqueBillingTriggers,
    loading,
    saving,
    filters,
    setFilters,
    refetch,
    updateServiceEvent,
    bulkUpdateServiceEvents,
    deleteServiceEvent,
    toggleActive,
    exportToCSV,
    generateTemplate,
  } = useServiceEventsAdmin();

  // Get seed function from useServiceEvents
  const { seedServiceEvents } = useServiceEvents();

  // UI State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [selectedServiceCode, setSelectedServiceCode] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; deleteAll: boolean } | null>(null);
  const [duplicateService, setDuplicateService] = useState<ServiceEvent | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('priceListVisibleColumns');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch {
        // Fall through to default
      }
    }
    return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
  });

  // Pending changes for inline editing
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem('priceListVisibleColumns', JSON.stringify(Array.from(visibleColumns)));
  }, [visibleColumns]);

  // Handle seed default pricing
  const handleSeedPricing = async () => {
    setSeeding(true);
    await seedServiceEvents();
    await refetch();
    setSeeding(false);
  };

  // Handle export
  const handleExport = () => {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-events-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle template download
  const handleDownloadTemplate = () => {
    const csv = generateTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'service-events-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort events
  const sortedEvents = useMemo(() => {
    if (!sortField) return filteredServiceEvents;

    return [...filteredServiceEvents].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle null values
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      // Numeric comparison for rate and time
      if (sortField === 'rate' || sortField === 'service_time_minutes') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortField === 'is_active') {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      } else {
        // String comparison
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredServiceEvents, sortField, sortDirection]);

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle column visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Update pending change for a field
  const updatePendingChange = useCallback((id: string, field: string, value: any) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      const existing = next.get(id) || {};
      next.set(id, { ...existing, [field]: value });
      return next;
    });
  }, []);

  // Get current value (pending or original)
  const getCurrentValue = useCallback((event: ServiceEvent, field: keyof ServiceEvent) => {
    const pending = pendingChanges.get(event.id);
    if (pending && field in pending) {
      return pending[field as keyof PendingChange];
    }
    return event[field];
  }, [pendingChanges]);

  // Check if a field has been changed
  const hasFieldChanged = useCallback((event: ServiceEvent, field: keyof ServiceEvent) => {
    const pending = pendingChanges.get(event.id);
    if (!pending || !(field in pending)) return false;
    return pending[field as keyof PendingChange] !== event[field];
  }, [pendingChanges]);

  // Save all pending changes
  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) return;

    const updates: UpdateServiceEventInput[] = [];

    pendingChanges.forEach((changes, id) => {
      // Only include actual changes
      const event = filteredServiceEvents.find(e => e.id === id);
      if (!event) return;

      const actualChanges: Partial<UpdateServiceEventInput> = { id };
      let hasChanges = false;

      Object.entries(changes).forEach(([key, value]) => {
        if (value !== event[key as keyof ServiceEvent]) {
          (actualChanges as any)[key] = value;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        updates.push(actualChanges as UpdateServiceEventInput);
      }
    });

    if (updates.length > 0) {
      const success = await bulkUpdateServiceEvents(updates);
      if (success) {
        setPendingChanges(new Map());
      }
    }
  };

  // Discard pending changes
  const handleDiscardChanges = () => {
    setPendingChanges(new Map());
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteServiceEvent(deleteConfirm.id, deleteConfirm.deleteAll);
    setDeleteConfirm(null);
  };

  // Open audit dialog
  const openAuditDialog = (serviceCode: string) => {
    setSelectedServiceCode(serviceCode);
    setAuditDialogOpen(true);
  };

  // Duplicate service
  const handleDuplicate = (service: ServiceEvent) => {
    setDuplicateService(service);
    setAddDialogOpen(true);
  };

  // Visible columns list
  const visibleColumnsList = ALL_COLUMNS.filter(c => visibleColumns.has(c.key));

  // Has pending changes
  const hasPendingChanges = pendingChanges.size > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Bar - Sticky at top when there are pending changes */}
      {hasPendingChanges && (
        <div className="sticky top-0 z-50 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">
              You have unsaved changes ({pendingChanges.size} item{pendingChanges.size !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscardChanges}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Discard
            </Button>
            <Button
              size="sm"
              onClick={handleSaveChanges}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Price List Management
          </h2>
          <p className="text-muted-foreground">
            Manage service rates, billing triggers, and service configurations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filteredServiceEvents.length === 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleSeedPricing}
                    disabled={seeding}
                  >
                    {seeding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Load Default Pricing
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Load standard price list with all default services and rates</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button onClick={() => { setDuplicateService(null); setAddDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Service
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <div className="flex gap-2">
              {/* Column Visibility Toggle */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-1" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Visible Columns</p>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {ALL_COLUMNS.map(col => (
                        <div key={col.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`col-${col.key}`}
                            checked={visibleColumns.has(col.key)}
                            onCheckedChange={() => toggleColumn(col.key)}
                          />
                          <Label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer">
                            {col.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setVisibleColumns(new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)))}
                      >
                        Reset to Default
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                      <Download className="h-4 w-4 mr-1" />
                      Template
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download CSV import template</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Service Code Filter */}
            <Select
              value={filters.service_code || 'all'}
              onValueChange={(value) => setFilters({ ...filters, service_code: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Service Code" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServiceCodes.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Billing Trigger Filter */}
            <Select
              value={filters.billing_trigger || 'all'}
              onValueChange={(value) => setFilters({ ...filters, billing_trigger: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Billing Trigger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Triggers</SelectItem>
                {uniqueBillingTriggers.map((trigger) => (
                  <SelectItem key={trigger} value={trigger}>{trigger}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Class Code Filter */}
            <Select
              value={filters.class_code || 'all'}
              onValueChange={(value) => setFilters({ ...filters, class_code: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="none">No Class</SelectItem>
                {CLASS_CODES.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Active Filter */}
            <Select
              value={filters.is_active === undefined ? 'all' : filters.is_active ? 'active' : 'inactive'}
              onValueChange={(value) => setFilters({ ...filters, is_active: value === 'all' ? undefined : value === 'active' })}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(filters.search || filters.service_code || filters.billing_trigger || filters.class_code || filters.is_active !== undefined) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({})}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {sortedEvents.length} service{sortedEvents.length !== 1 ? 's' : ''} found
            </span>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              Click row to expand details • Edit fields inline
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Service Events Table */}
      <Card>
        <CardContent className="p-0">
          {/* Mobile: Card-based layout */}
          <div className="sm:hidden divide-y">
            {sortedEvents.map((event) => (
              <MobileServiceCard
                key={event.id}
                event={event}
                isExpanded={expandedRows.has(event.id)}
                onToggleExpand={() => toggleRowExpansion(event.id)}
                getCurrentValue={getCurrentValue}
                hasFieldChanged={hasFieldChanged}
                updatePendingChange={updatePendingChange}
                onViewAudit={() => openAuditDialog(event.service_code)}
                onDuplicate={() => handleDuplicate(event)}
                onDelete={() => setDeleteConfirm({ id: event.id, name: event.service_name, deleteAll: false })}
                saving={saving}
              />
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  {visibleColumnsList.map(col => (
                    <SortableTableHead
                      key={col.key}
                      column={col}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  ))}
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEvents.map((event) => (
                  <ServiceEventRow
                    key={event.id}
                    event={event}
                    visibleColumns={visibleColumnsList}
                    isExpanded={expandedRows.has(event.id)}
                    onToggleExpand={() => toggleRowExpansion(event.id)}
                    getCurrentValue={getCurrentValue}
                    hasFieldChanged={hasFieldChanged}
                    updatePendingChange={updatePendingChange}
                    onViewAudit={() => openAuditDialog(event.service_code)}
                    onDuplicate={() => handleDuplicate(event)}
                    onDelete={() => setDeleteConfirm({ id: event.id, name: event.service_name, deleteAll: false })}
                    saving={saving}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {sortedEvents.length === 0 && (
            <div className="py-12 text-center">
              <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No services found</h3>
              <p className="text-muted-foreground mb-4">
                {filters.search || filters.service_code || filters.billing_trigger || filters.class_code || filters.is_active !== undefined
                  ? 'Try adjusting your filters'
                  : 'Load the standard price list or add services manually'}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {!(filters.search || filters.service_code || filters.billing_trigger || filters.class_code || filters.is_active !== undefined) && (
                  <Button onClick={handleSeedPricing} disabled={seeding}>
                    {seeding ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Load Default Pricing
                  </Button>
                )}
                <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Service
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Service Dialog */}
      <AddServiceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        duplicateFrom={duplicateService}
        onSuccess={() => {
          setAddDialogOpen(false);
          setDuplicateService(null);
          refetch();
        }}
      />

      {/* CSV Import Dialog */}
      <CSVImportServiceDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => {
          setImportDialogOpen(false);
          refetch();
        }}
      />

      {/* Audit Dialog */}
      <ServiceAuditDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
        serviceCode={selectedServiceCode}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.deleteAll ? (
                <>
                  This will permanently delete <strong>all class variants</strong> of "{deleteConfirm?.name}".
                  This action cannot be undone.
                </>
              ) : (
                <>
                  This will permanently delete this service entry.
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Sortable Table Head
// ============================================================================

interface SortableTableHeadProps {
  column: ColumnConfig;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

function SortableTableHead({ column, sortField, sortDirection, onSort }: SortableTableHeadProps) {
  if (!column.sortable || !column.sortKey) {
    return (
      <TableHead className={cn(
        column.key === 'rate' && 'text-right',
        column.key === 'service_time_minutes' && 'text-right'
      )}>
        {column.label}
      </TableHead>
    );
  }

  const isActive = sortField === column.sortKey;

  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none hover:bg-muted/50',
        column.key === 'rate' && 'text-right',
        column.key === 'service_time_minutes' && 'text-right'
      )}
      onClick={() => onSort(column.sortKey!)}
    >
      <div className={cn('flex items-center gap-1', column.key === 'rate' && 'justify-end')}>
        {column.label}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

// ============================================================================
// Service Event Row (Desktop)
// ============================================================================

interface ServiceEventRowProps {
  event: ServiceEvent;
  visibleColumns: ColumnConfig[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  getCurrentValue: (event: ServiceEvent, field: keyof ServiceEvent) => any;
  hasFieldChanged: (event: ServiceEvent, field: keyof ServiceEvent) => boolean;
  updatePendingChange: (id: string, field: string, value: any) => void;
  onViewAudit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  saving: boolean;
}

function ServiceEventRow({
  event,
  visibleColumns,
  isExpanded,
  onToggleExpand,
  getCurrentValue,
  hasFieldChanged,
  updatePendingChange,
  onViewAudit,
  onDuplicate,
  onDelete,
  saving,
}: ServiceEventRowProps) {
  const isActive = getCurrentValue(event, 'is_active');

  return (
    <>
      <TableRow
        className={cn(
          !isActive && 'opacity-50',
          'cursor-pointer hover:bg-muted/50'
        )}
        onClick={onToggleExpand}
      >
        <TableCell onClick={(e) => e.stopPropagation()}>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>

        {visibleColumns.map(col => (
          <TableCell
            key={col.key}
            className={cn(
              col.key === 'rate' && 'text-right',
              col.key === 'service_time_minutes' && 'text-right',
              hasFieldChanged(event, col.key as keyof ServiceEvent) && 'bg-amber-50 dark:bg-amber-950'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <InlineEditCell
              event={event}
              field={col.key}
              getCurrentValue={getCurrentValue}
              updatePendingChange={updatePendingChange}
              saving={saving}
            />
          </TableCell>
        ))}

        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onViewAudit}>
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View history</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded row showing all fields */}
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={visibleColumns.length + 2}>
            <ExpandedDetails
              event={event}
              getCurrentValue={getCurrentValue}
              hasFieldChanged={hasFieldChanged}
              updatePendingChange={updatePendingChange}
              saving={saving}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================================
// Expanded Details
// ============================================================================

interface ExpandedDetailsProps {
  event: ServiceEvent;
  getCurrentValue: (event: ServiceEvent, field: keyof ServiceEvent) => any;
  hasFieldChanged: (event: ServiceEvent, field: keyof ServiceEvent) => boolean;
  updatePendingChange: (id: string, field: string, value: any) => void;
  saving: boolean;
}

function ExpandedDetails({ event, getCurrentValue, hasFieldChanged, updatePendingChange, saving }: ExpandedDetailsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
      {ALL_COLUMNS.map(col => (
        <div key={col.key} className={cn(
          'space-y-1',
          hasFieldChanged(event, col.key as keyof ServiceEvent) && 'bg-amber-50 dark:bg-amber-950 p-2 rounded'
        )}>
          <Label className="text-xs text-muted-foreground">{col.label}</Label>
          <div>
            <InlineEditCell
              event={event}
              field={col.key}
              getCurrentValue={getCurrentValue}
              updatePendingChange={updatePendingChange}
              saving={saving}
              showLabel={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Inline Edit Cell
// ============================================================================

interface InlineEditCellProps {
  event: ServiceEvent;
  field: string;
  getCurrentValue: (event: ServiceEvent, field: keyof ServiceEvent) => any;
  updatePendingChange: (id: string, field: string, value: any) => void;
  saving: boolean;
  showLabel?: boolean;
}

function InlineEditCell({ event, field, getCurrentValue, updatePendingChange, saving, showLabel = true }: InlineEditCellProps) {
  const value = getCurrentValue(event, field as keyof ServiceEvent);

  // Boolean fields
  if (['taxable', 'uses_class_pricing', 'is_active', 'add_flag', 'add_to_service_event_scan'].includes(field)) {
    return (
      <Switch
        checked={!!value}
        onCheckedChange={(checked) => updatePendingChange(event.id, field, checked)}
        disabled={saving}
      />
    );
  }

  // Rate field
  if (field === 'rate') {
    return (
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value ?? ''}
        onChange={(e) => updatePendingChange(event.id, field, parseFloat(e.target.value) || 0)}
        className="w-24 h-8 text-right font-mono"
        disabled={saving}
      />
    );
  }

  // Service time field
  if (field === 'service_time_minutes') {
    return (
      <Input
        type="number"
        step="1"
        min="0"
        value={value ?? ''}
        onChange={(e) => updatePendingChange(event.id, field, e.target.value ? parseInt(e.target.value) : null)}
        className="w-20 h-8 text-right"
        disabled={saving}
        placeholder="-"
      />
    );
  }

  // Billing unit select
  if (field === 'billing_unit') {
    return (
      <Select
        value={value || 'Item'}
        onValueChange={(val) => updatePendingChange(event.id, field, val)}
        disabled={saving}
      >
        <SelectTrigger className="w-24 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BILLING_UNITS.map(u => (
            <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Billing trigger select
  if (field === 'billing_trigger') {
    return (
      <Select
        value={value || 'SCAN EVENT'}
        onValueChange={(val) => updatePendingChange(event.id, field, val)}
        disabled={saving}
      >
        <SelectTrigger className="w-40 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BILLING_TRIGGERS.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Alert rule select
  if (field === 'alert_rule') {
    return (
      <Select
        value={value || 'none'}
        onValueChange={(val) => updatePendingChange(event.id, field, val)}
        disabled={saving}
      >
        <SelectTrigger className="w-32 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALERT_RULES.map(r => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Class code - read only badge
  if (field === 'class_code') {
    return value ? (
      <Badge variant="outline">{value}</Badge>
    ) : (
      <span className="text-muted-foreground">-</span>
    );
  }

  // Service code - read only badge
  if (field === 'service_code') {
    return <Badge variant="outline" className="font-mono">{value}</Badge>;
  }

  // Service name - editable text
  if (field === 'service_name') {
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => updatePendingChange(event.id, field, e.target.value)}
        className="h-8"
        disabled={saving}
      />
    );
  }

  // Notes - editable text
  if (field === 'notes') {
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => updatePendingChange(event.id, field, e.target.value || null)}
        className="h-8"
        disabled={saving}
        placeholder="Add notes..."
      />
    );
  }

  // Default text display
  return <span className="text-sm">{value ?? '-'}</span>;
}

// ============================================================================
// Mobile Service Card
// ============================================================================

interface MobileServiceCardProps {
  event: ServiceEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
  getCurrentValue: (event: ServiceEvent, field: keyof ServiceEvent) => any;
  hasFieldChanged: (event: ServiceEvent, field: keyof ServiceEvent) => boolean;
  updatePendingChange: (id: string, field: string, value: any) => void;
  onViewAudit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  saving: boolean;
}

function MobileServiceCard({
  event,
  isExpanded,
  onToggleExpand,
  getCurrentValue,
  hasFieldChanged,
  updatePendingChange,
  onViewAudit,
  onDuplicate,
  onDelete,
  saving,
}: MobileServiceCardProps) {
  const isActive = getCurrentValue(event, 'is_active');

  return (
    <div className={cn('px-4 py-3', !isActive && 'opacity-50')}>
      {/* Header row - always visible */}
      <div className="flex items-start justify-between gap-2" onClick={onToggleExpand}>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono text-xs">{event.service_code}</Badge>
              {event.class_code && (
                <Badge variant="secondary" className="text-xs">{event.class_code}</Badge>
              )}
            </div>
            <p className="font-medium text-sm">{getCurrentValue(event, 'service_name')}</p>
          </div>
        </div>
        <div className="text-right" onClick={(e) => e.stopPropagation()}>
          <Input
            type="number"
            step="0.01"
            value={getCurrentValue(event, 'rate') ?? ''}
            onChange={(e) => updatePendingChange(event.id, 'rate', parseFloat(e.target.value) || 0)}
            className={cn(
              'w-24 h-8 text-right font-mono font-semibold',
              hasFieldChanged(event, 'rate') && 'bg-amber-50 dark:bg-amber-950'
            )}
            disabled={saving}
          />
        </div>
      </div>

      {/* Quick info row */}
      <div className="flex items-center gap-2 mt-2 ml-6 text-xs text-muted-foreground flex-wrap">
        <Badge variant="outline" className="text-xs">{getCurrentValue(event, 'billing_trigger')}</Badge>
        <Badge variant="outline" className="text-xs">{getCurrentValue(event, 'billing_unit')}</Badge>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-4 ml-6 space-y-4">
          {/* All editable fields */}
          <div className="grid grid-cols-2 gap-3">
            {ALL_COLUMNS.filter(c => !['service_code', 'class_code'].includes(c.key)).map(col => (
              <div key={col.key} className={cn(
                'space-y-1',
                hasFieldChanged(event, col.key as keyof ServiceEvent) && 'bg-amber-50 dark:bg-amber-950 p-2 rounded'
              )}>
                <Label className="text-xs text-muted-foreground">{col.label}</Label>
                <InlineEditCell
                  event={event}
                  field={col.key}
                  getCurrentValue={getCurrentValue}
                  updatePendingChange={updatePendingChange}
                  saving={saving}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={onViewAudit}>
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
