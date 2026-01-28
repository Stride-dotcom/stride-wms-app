/**
 * ServiceEventsPricingTab - Complete pricing management using service_events table
 */

import { useState, useRef, useMemo } from 'react';
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
  AlertCircle,
  X,
  Check,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useServiceEventsAdmin,
  ServiceEvent,
  BILLING_TRIGGERS,
  CLASS_CODES,
  CLASS_LABELS,
  BILLING_UNITS,
} from '@/hooks/useServiceEventsAdmin';
import { useServiceEvents } from '@/hooks/useServiceEvents';
import { AddServiceDialog } from './AddServiceDialog';
import { CSVImportServiceDialog } from './CSVImportServiceDialog';
import { ServiceAuditDialog } from './ServiceAuditDialog';
import { cn } from '@/lib/utils';

// ============================================================================
// Inline Rate Editor
// ============================================================================

interface InlineRateEditorProps {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  disabled?: boolean;
}

function InlineRateEditor({ value, onSave, disabled }: InlineRateEditorProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    if (disabled) return;
    setEditValue(value.toFixed(2));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleSave = async () => {
    const numValue = parseFloat(editValue);
    if (isNaN(numValue) || numValue < 0) {
      setEditValue(value.toFixed(2));
      setEditing(false);
      return;
    }

    if (numValue === value) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(numValue);
      setEditing(false);
    } catch (e) {
      setEditValue(value.toFixed(2));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value.toFixed(2));
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">$</span>
        <Input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-20 h-7 text-right text-sm"
          disabled={saving}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      disabled={disabled}
      className={cn(
        "text-right font-mono cursor-pointer hover:bg-muted/80 px-2 py-1 rounded transition-colors",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      ${value.toFixed(2)}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ServiceEventsPricingTab() {
  const {
    filteredServiceEvents,
    groupedServiceEvents,
    uniqueServiceCodes,
    uniqueBillingTriggers,
    loading,
    saving,
    filters,
    setFilters,
    refetch,
    updateServiceEvent,
    deleteServiceEvent,
    toggleActive,
    exportToCSV,
    generateTemplate,
  } = useServiceEventsAdmin();

  // Get seed function from useServiceEvents
  const { seedServiceEvents } = useServiceEvents();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [selectedServiceCode, setSelectedServiceCode] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; deleteAll: boolean } | null>(null);
  const [groupByService, setGroupByService] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [duplicateService, setDuplicateService] = useState<ServiceEvent | null>(null);
  const [seeding, setSeeding] = useState(false);

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

  // Toggle group expansion
  const toggleGroup = (serviceCode: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(serviceCode)) {
      newExpanded.delete(serviceCode);
    } else {
      newExpanded.add(serviceCode);
    }
    setExpandedGroups(newExpanded);
  };

  // Handle rate update
  const handleRateUpdate = async (id: string, newRate: number) => {
    await updateServiceEvent({ id, rate: newRate });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

          {/* View Toggle */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
            <Checkbox
              id="groupByService"
              checked={groupByService}
              onCheckedChange={(checked) => setGroupByService(!!checked)}
            />
            <Label htmlFor="groupByService" className="text-sm cursor-pointer">
              Group by service code
            </Label>
            <span className="text-sm text-muted-foreground ml-4">
              {filteredServiceEvents.length} service{filteredServiceEvents.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Service Events Table */}
      <Card>
        <CardContent className="p-0">
          {groupByService ? (
            <GroupedServiceTable
              groupedServiceEvents={groupedServiceEvents}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              onRateUpdate={handleRateUpdate}
              onToggleActive={toggleActive}
              onDelete={(id, name, deleteAll) => setDeleteConfirm({ id, name, deleteAll })}
              onDuplicate={handleDuplicate}
              onViewAudit={openAuditDialog}
              saving={saving}
            />
          ) : (
            <FlatServiceTable
              serviceEvents={filteredServiceEvents}
              onRateUpdate={handleRateUpdate}
              onToggleActive={toggleActive}
              onDelete={(id, name) => setDeleteConfirm({ id, name, deleteAll: false })}
              onDuplicate={handleDuplicate}
              onViewAudit={openAuditDialog}
              saving={saving}
            />
          )}

          {filteredServiceEvents.length === 0 && (
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
// Grouped Service Table
// ============================================================================

interface GroupedServiceTableProps {
  groupedServiceEvents: Map<string, ServiceEvent[]>;
  expandedGroups: Set<string>;
  toggleGroup: (serviceCode: string) => void;
  onRateUpdate: (id: string, rate: number) => Promise<void>;
  onToggleActive: (id: string) => Promise<boolean>;
  onDelete: (id: string, name: string, deleteAll: boolean) => void;
  onDuplicate: (service: ServiceEvent) => void;
  onViewAudit: (serviceCode: string) => void;
  saving: boolean;
}

function GroupedServiceTable({
  groupedServiceEvents,
  expandedGroups,
  toggleGroup,
  onRateUpdate,
  onToggleActive,
  onDelete,
  onDuplicate,
  onViewAudit,
  saving,
}: GroupedServiceTableProps) {
  return (
    <div className="divide-y">
      {Array.from(groupedServiceEvents.entries()).map(([serviceCode, events]) => {
        const isExpanded = expandedGroups.has(serviceCode);
        const firstEvent = events[0];
        const hasMultipleVariants = events.length > 1;
        const allActive = events.every(e => e.is_active);
        const someActive = events.some(e => e.is_active);

        return (
          <Collapsible
            key={serviceCode}
            open={isExpanded}
            onOpenChange={() => toggleGroup(serviceCode)}
          >
            <CollapsibleTrigger asChild>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/50 cursor-pointer">
                {/* Mobile: Top row with code, name, and rate */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {hasMultipleVariants ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}
                  <Badge variant="outline" className="font-mono flex-shrink-0 text-xs">{serviceCode}</Badge>
                  <span className="font-medium truncate">{firstEvent.service_name}</span>
                  {hasMultipleVariants && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0 hidden sm:inline-flex">
                      {events.length} classes
                    </Badge>
                  )}
                </div>

                {/* Mobile: Bottom row with metadata */}
                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 text-sm pl-6 sm:pl-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{firstEvent.billing_trigger}</Badge>
                    {hasMultipleVariants && (
                      <Badge variant="secondary" className="text-xs sm:hidden">
                        {events.length} classes
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    {!hasMultipleVariants ? (
                      <span className="font-mono text-right font-semibold">${firstEvent.rate.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground text-right text-xs sm:text-sm">varies</span>
                    )}
                    <div className={cn(
                      "text-xs sm:text-sm font-medium",
                      allActive ? "text-green-600" : someActive ? "text-amber-600" : "text-muted-foreground"
                    )}>
                      {allActive ? "Active" : someActive ? "Mixed" : "Inactive"}
                    </div>
                  </div>
                  {/* Action buttons - hidden on mobile in collapsed view */}
                  <div className="hidden sm:flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onViewAudit(serviceCode)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View history</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onDuplicate(firstEvent)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate service</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDelete(firstEvent.id, firstEvent.service_name, hasMultipleVariants)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete {hasMultipleVariants ? 'all variants' : 'service'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-muted/30 border-t">
                {/* Mobile: Card-based layout */}
                <div className="sm:hidden divide-y">
                  {/* Mobile action buttons for the service group */}
                  <div className="flex items-center justify-end gap-2 px-4 py-2 bg-muted/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onViewAudit(serviceCode); }}
                    >
                      <History className="h-4 w-4 mr-1" />
                      History
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onDuplicate(firstEvent); }}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(firstEvent.id, firstEvent.service_name, hasMultipleVariants); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {events.map((event) => (
                    <div key={event.id} className={cn("px-4 py-3 space-y-2", !event.is_active && "opacity-50")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {event.class_code ? (
                            <Badge variant="outline">{event.class_code}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No class</span>
                          )}
                        </div>
                        <span className="font-mono font-semibold">${event.rate.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {event.service_time_minutes && (
                            <span><Clock className="h-3 w-3 inline mr-1" />{event.service_time_minutes}min</span>
                          )}
                          {event.taxable && <span className="text-green-600">Taxable</span>}
                          {event.add_flag && <span className="text-blue-600">Flag</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={event.is_active}
                            onCheckedChange={() => onToggleActive(event.id)}
                            disabled={saving}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onDelete(event.id, event.service_name, false)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table layout */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 pl-12">Class</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Time (min)</TableHead>
                        <TableHead className="text-center">Taxable</TableHead>
                        <TableHead className="text-center">Show Flag</TableHead>
                        <TableHead className="text-center">Scan Event</TableHead>
                        <TableHead className="text-center">Active</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id} className={cn(!event.is_active && "opacity-50")}>
                          <TableCell className="pl-12">
                            {event.class_code ? (
                              <Badge variant="outline">{event.class_code}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <InlineRateEditor
                              value={event.rate}
                              onSave={(rate) => onRateUpdate(event.id, rate)}
                              disabled={saving}
                            />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {event.service_time_minutes ?? '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {event.taxable ? <Check className="h-4 w-4 mx-auto text-green-600" /> : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {event.add_flag ? <Check className="h-4 w-4 mx-auto text-green-600" /> : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {event.add_to_service_event_scan ? <Check className="h-4 w-4 mx-auto text-green-600" /> : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={event.is_active}
                              onCheckedChange={() => onToggleActive(event.id)}
                              disabled={saving}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => onDelete(event.id, event.service_name, false)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ============================================================================
// Flat Service Table with Sorting
// ============================================================================

type SortField = 'service_code' | 'service_name' | 'class_code' | 'billing_unit' | 'rate' | 'service_time_minutes' | 'billing_trigger';
type SortDirection = 'asc' | 'desc';

interface FlatServiceTableProps {
  serviceEvents: ServiceEvent[];
  onRateUpdate: (id: string, rate: number) => Promise<void>;
  onToggleActive: (id: string) => Promise<boolean>;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (service: ServiceEvent) => void;
  onViewAudit: (serviceCode: string) => void;
  saving: boolean;
}

function FlatServiceTable({
  serviceEvents,
  onRateUpdate,
  onToggleActive,
  onDelete,
  onDuplicate,
  onViewAudit,
  saving,
}: FlatServiceTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle sort click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction or reset
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
    if (!sortField) return serviceEvents;

    return [...serviceEvents].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle null values
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      // Numeric comparison for rate and time
      if (sortField === 'rate' || sortField === 'service_time_minutes') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        // String comparison
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [serviceEvents, sortField, sortDirection]);

  // Sortable header component
  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-muted/50', className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
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

  return (
    <>
      {/* Mobile: Card-based layout */}
      <div className="sm:hidden divide-y">
        {sortedEvents.map((event) => (
          <div key={event.id} className={cn("px-4 py-3 space-y-2", !event.is_active && "opacity-50")}>
            {/* Row 1: Code and Name */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono text-xs flex-shrink-0">{event.service_code}</Badge>
                  {event.class_code && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{event.class_code}</Badge>
                  )}
                </div>
                <p className="font-medium text-sm truncate">{event.service_name}</p>
              </div>
              <span className="font-mono font-semibold text-lg">${event.rate.toFixed(2)}</span>
            </div>

            {/* Row 2: Metadata */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline" className="text-xs">{event.billing_trigger}</Badge>
              <Badge variant="outline" className="text-xs">{event.billing_unit}</Badge>
              {event.service_time_minutes && (
                <span><Clock className="h-3 w-3 inline mr-1" />{event.service_time_minutes}min</span>
              )}
              {event.taxable && <span className="text-green-600">Taxable</span>}
            </div>

            {/* Row 3: Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onViewAudit(event.service_code)}
                >
                  <History className="h-3 w-3 mr-1" />
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onDuplicate(event)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive"
                  onClick={() => onDelete(event.id, event.service_name)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Switch
                checked={event.is_active}
                onCheckedChange={() => onToggleActive(event.id)}
                disabled={saving}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="service_code">Service Code</SortableHeader>
              <SortableHeader field="service_name">Service Name</SortableHeader>
              <SortableHeader field="class_code">Class</SortableHeader>
              <SortableHeader field="billing_unit">Billing Unit</SortableHeader>
              <SortableHeader field="rate" className="text-right">Rate</SortableHeader>
              <SortableHeader field="service_time_minutes" className="text-right">Time (min)</SortableHeader>
              <TableHead className="text-center">Taxable</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <SortableHeader field="billing_trigger">Billing Trigger</SortableHeader>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvents.map((event) => (
              <TableRow key={event.id} className={cn(!event.is_active && "opacity-50")}>
                <TableCell>
                  <Badge variant="outline" className="font-mono">{event.service_code}</Badge>
                </TableCell>
                <TableCell className="font-medium">{event.service_name}</TableCell>
                <TableCell>
                  {event.class_code ? (
                    <Badge variant="outline">{event.class_code}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{event.billing_unit}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <InlineRateEditor
                    value={event.rate}
                    onSave={(rate) => onRateUpdate(event.id, rate)}
                    disabled={saving}
                  />
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {event.service_time_minutes ?? '-'}
                </TableCell>
                <TableCell className="text-center">
                  {event.taxable ? <Check className="h-4 w-4 mx-auto text-green-600" /> : '-'}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={event.is_active}
                    onCheckedChange={() => onToggleActive(event.id)}
                    disabled={saving}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{event.billing_trigger}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onViewAudit(event.service_code)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View history</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onDuplicate(event)}
                          >
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
                            onClick={() => onDelete(event.id, event.service_name)}
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
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
