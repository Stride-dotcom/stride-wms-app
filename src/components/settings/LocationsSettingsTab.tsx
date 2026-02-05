import { useState, useRef, useCallback, useEffect } from 'react';
import { Location } from '@/hooks/useLocations';
import { Warehouse } from '@/hooks/useWarehouses';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LocationsSettingsTabProps {
  locations: Location[];
  warehouses: Warehouse[];
  loading: boolean;
  selectedWarehouse: string;
  onWarehouseChange: (warehouseId: string) => void;
  onEdit: (locationId: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
  onPrintSelected: (locations: Location[]) => void;
  onImportCSV: (file: File) => void;
  onWarehouseRefresh?: () => void;
}

export function LocationsSettingsTab({
  locations,
  warehouses,
  loading,
  selectedWarehouse,
  onWarehouseChange,
  onEdit,
  onCreate,
  onRefresh,
  onPrintSelected,
  onImportCSV,
  onWarehouseRefresh,
}: LocationsSettingsTabProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Fast Add state
  const [fastAddValue, setFastAddValue] = useState('');
  const [fastAddLoading, setFastAddLoading] = useState(false);
  const [autoUppercase, setAutoUppercase] = useState(true);
  const fastAddInputRef = useRef<HTMLInputElement>(null);

  // Default receiving location state
  const [defaultRecvLocationId, setDefaultRecvLocationId] = useState<string>('');
  const [defaultOutboundLocationId, setDefaultOutboundLocationId] = useState<string>('');
  const [savingDefaultLocation, setSavingDefaultLocation] = useState(false);

  // Sync default receiving + outbound location when warehouse selection changes
  useEffect(() => {
    if (selectedWarehouse && selectedWarehouse !== 'all') {
      const wh = warehouses.find(w => w.id === selectedWarehouse);
      setDefaultRecvLocationId((wh as any)?.default_receiving_location_id || '');
      setDefaultOutboundLocationId((wh as any)?.default_outbound_location_id || '');
    } else {
      setDefaultRecvLocationId('');
      setDefaultOutboundLocationId('');
    }
  }, [selectedWarehouse, warehouses]);

  // Persistent warehouse filter
  useEffect(() => {
    if (profile?.id) {
      const saved = localStorage.getItem(`stride_location_view_${profile.id}`);
      if (saved && (saved === 'all' || warehouses.some(w => w.id === saved))) {
        onWarehouseChange(saved);
      }
    }
  }, [profile?.id, warehouses]);

  const handleWarehouseFilterChange = (value: string) => {
    onWarehouseChange(value);
    if (profile?.id) {
      localStorage.setItem(`stride_location_view_${profile.id}`, value);
    }
  };

  const handleSaveDefaultReceivingLocation = async () => {
    if (!selectedWarehouse || selectedWarehouse === 'all') return;

    setSavingDefaultLocation(true);
    try {
      const { error } = await (supabase.from('warehouses') as any)
        .update({
          default_receiving_location_id: defaultRecvLocationId || null,
          default_outbound_location_id: defaultOutboundLocationId || null,
        })
        .eq('id', selectedWarehouse);

      if (error) throw error;

      toast({
        title: 'Default locations saved',
        description: 'Default shipment locations updated for this warehouse.',
      });
      onWarehouseRefresh?.();
    } catch (error: any) {
      console.error('Error saving default receiving location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save default receiving location.',
      });
    } finally {
      setSavingDefaultLocation(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  // Filter locations
  const filteredLocations = locations.filter((loc) => {
    // Filter by search
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      const matches = 
        loc.code.toLowerCase().includes(query) ||
        (loc.name && loc.name.toLowerCase().includes(query));
      if (!matches) return false;
    }
    
    // Filter archived (using is_active if available, fallback to status)
    const isActive = (loc as any).is_active !== false;
    if (!showArchived && !isActive) return false;
    if (showArchived && isActive) return false;
    
    return true;
  });

  // Fast Add handler
  const handleFastAdd = async () => {
    const code = fastAddValue.trim();
    if (!code) return;

    // Auto-uppercase if enabled
    const finalCode = autoUppercase ? code.toUpperCase() : code;

    // Get warehouse ID
    const warehouseId = selectedWarehouse !== 'all' 
      ? selectedWarehouse 
      : warehouses.length === 1 
        ? warehouses[0].id 
        : null;

    if (!warehouseId) {
      toast({
        variant: 'destructive',
        title: 'Select a warehouse',
        description: 'Please select a warehouse before adding locations.',
      });
      return;
    }

    // Check for duplicate in current warehouse
    const existingLocation = locations.find(
      l => l.code.toLowerCase() === finalCode.toLowerCase() && l.warehouse_id === warehouseId
    );

    if (existingLocation) {
      toast({
        variant: 'destructive',
        title: 'Duplicate location',
        description: `Location "${finalCode}" already exists in this warehouse.`,
      });
      return;
    }

    setFastAddLoading(true);
    try {
      const { error } = await supabase.from('locations').insert({
        code: finalCode,
        warehouse_id: warehouseId,
        type: 'bin',
        status: 'active',
      });

      if (error) throw error;

      toast({
        title: 'Location added',
        description: `${finalCode} has been created.`,
      });

      setFastAddValue('');
      fastAddInputRef.current?.focus();
      onRefresh();
    } catch (error: any) {
      console.error('Error adding location:', error);
      const isDuplicate = error.code === '23505';
      toast({
        variant: 'destructive',
        title: isDuplicate ? 'Duplicate location' : 'Error',
        description: isDuplicate 
          ? `Location "${finalCode}" already exists.` 
          : 'Failed to add location.',
      });
    } finally {
      setFastAddLoading(false);
    }
  };

  const handleFastAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFastAdd();
    }
  };

  const handleDeleteClick = (location: Location) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('locations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', locationToDelete.id);

      if (error) throw error;

      toast({
        title: 'Location deleted',
        description: `${locationToDelete.code} has been deleted.`,
      });
      onRefresh();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete location.',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };

  const handleArchive = async (location: Location) => {
    try {
      const { error } = await supabase
        .from('locations')
        .update({ is_active: false } as any)
        .eq('id', location.id);

      if (error) throw error;

      toast({
        title: 'Location archived',
        description: `${location.code} has been archived.`,
      });
      onRefresh();
    } catch (error) {
      console.error('Error archiving location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to archive location.',
      });
    }
  };

  const handleRestore = async (location: Location) => {
    try {
      const { error } = await supabase
        .from('locations')
        .update({ is_active: true } as any)
        .eq('id', location.id);

      if (error) throw error;

      toast({
        title: 'Location restored',
        description: `${location.code} has been restored.`,
      });
      onRefresh();
    } catch (error) {
      console.error('Error restoring location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to restore location.',
      });
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLocations.map((l) => l.id)));
    }
  };

  const handlePrintSelected = () => {
    const selected = locations.filter((l) => selectedIds.has(l.id));
    onPrintSelected(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportCSV(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    const template = 'location_name,warehouse_name\nBAY-01,\nBAY-02,\nREC-DOCK,';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'locations-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportLocations = () => {
    const csvRows = ['location_name,warehouse_name,type,status'];
    filteredLocations.forEach(loc => {
      const warehouse = warehouseMap.get(loc.warehouse_id);
      csvRows.push(`${loc.code},${warehouse?.name || ''},${loc.type},${loc.status}`);
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'locations-export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string, isActive?: boolean) => {
    if (isActive === false) {
      return <Badge variant="secondary">Archived</Badge>;
    }
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'full':
        return <Badge variant="outline" className="border-amber-500 text-amber-500">Full</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      zone: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      aisle: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      bay: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      bin: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      shelf: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      release: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const activeCount = locations.filter(l => (l as any).is_active !== false).length;
  const archivedCount = locations.filter(l => (l as any).is_active === false).length;

  return (
    <>
      <div className="space-y-4">
        {/* Fast Add Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MaterialIcon name="add" size="sm" />
              Quick Add Bay
            </CardTitle>
            <CardDescription>
              Press Enter to add instantly. Auto-uppercase enabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label htmlFor="fast-add" className="sr-only">Location Name</Label>
                <Input
                  id="fast-add"
                  ref={fastAddInputRef}
                  placeholder="Enter location code (e.g., BAY-01)"
                  value={fastAddValue}
                  onChange={(e) => setFastAddValue(autoUppercase ? e.target.value.toUpperCase() : e.target.value)}
                  onKeyDown={handleFastAddKeyDown}
                  disabled={fastAddLoading}
                  className="font-mono"
                />
              </div>
              {warehouses.length > 1 && selectedWarehouse === 'all' && (
                <Select value={selectedWarehouse} onValueChange={handleWarehouseFilterChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleFastAdd} disabled={fastAddLoading || !fastAddValue.trim()}>
                {fastAddLoading ? <MaterialIcon name="progress_activity" size="sm" className="animate-spin" /> : <MaterialIcon name="add" size="sm" />}
                <span className="ml-2">Add</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Default Receiving Location Card - only visible when a specific warehouse is selected */}
        {selectedWarehouse && selectedWarehouse !== 'all' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MaterialIcon name="pin_drop" size="sm" />
                Default Shipment Locations
              </CardTitle>
              <CardDescription>
                Set default locations for receiving and outbound operations in this warehouse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="default-recv-location">Default Receiving Location</Label>
                    <Select
                      value={defaultRecvLocationId || '_none_'}
                      onValueChange={(val) => setDefaultRecvLocationId(val === '_none_' ? '' : val)}
                    >
                      <SelectTrigger id="default-recv-location">
                        <SelectValue placeholder="Select a location..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">None (no default)</SelectItem>
                        {locations
                          .filter(l => (l as any).is_active !== false)
                          .map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.code}{loc.name ? ` — ${loc.name}` : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Items received into this warehouse will be auto-assigned to this location during receiving
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="default-outbound-location">Default Outbound Location</Label>
                    <Select
                      value={defaultOutboundLocationId || '_none_'}
                      onValueChange={(val) => setDefaultOutboundLocationId(val === '_none_' ? '' : val)}
                    >
                      <SelectTrigger id="default-outbound-location">
                        <SelectValue placeholder="Select a location..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">None (no default)</SelectItem>
                        {locations
                          .filter(l => (l as any).is_active !== false)
                          .map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.code}{loc.name ? ` — ${loc.name}` : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      When pulling items for outbound, scanned items will automatically be assigned to this location
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveDefaultReceivingLocation}
                    disabled={savingDefaultLocation}
                  >
                    {savingDefaultLocation ? (
                      <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                    ) : (
                      <MaterialIcon name="save" size="sm" className="mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bays List Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <MaterialIcon name="location_on" size="md" />
                <div>
                  <CardTitle>Bays</CardTitle>
                  <CardDescription>
                    {activeCount} active • {archivedCount} archived
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <MaterialIcon name="download" size="sm" className="mr-2" />
                  Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportLocations}>
                  <MaterialIcon name="download" size="sm" className="mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <MaterialIcon name="upload" size="sm" className="mr-2" />
                  Import
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {selectedIds.size > 0 && (
                  <Button variant="outline" size="sm" onClick={handlePrintSelected}>
                    <MaterialIcon name="print" size="sm" className="mr-2" />
                    Print {selectedIds.size}
                  </Button>
                )}
                <Button size="sm" onClick={onCreate}>
                  <MaterialIcon name="add" size="sm" className="mr-2" />
                  Add Bay
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search bays..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedWarehouse} onValueChange={handleWarehouseFilterChange}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant={showArchived ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                <MaterialIcon name="archive" size="sm" className="mr-2" />
                {showArchived ? 'Show Active' : 'Show Archived'}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MaterialIcon name="location_on" size="lg" className="text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {locations.length === 0 
                    ? 'No locations yet. Use Quick Add above!' 
                    : showArchived 
                      ? 'No archived locations'
                      : 'No locations match your search'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === filteredLocations.length && filteredLocations.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLocations.map((location) => {
                      const warehouse = warehouseMap.get(location.warehouse_id);
                      const isActive = (location as any).is_active !== false;
                      return (
                        <TableRow key={location.id} className={!isActive ? 'opacity-60' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(location.id)}
                              onCheckedChange={() => toggleSelect(location.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {location.code}
                          </TableCell>
                          <TableCell>{location.name || '—'}</TableCell>
                          <TableCell>{getTypeBadge(location.type)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {warehouse?.name || '—'}
                          </TableCell>
                          <TableCell>{getStatusBadge(location.status, isActive)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MaterialIcon name="more_horiz" size="sm" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEdit(location.id)}>
                                  <MaterialIcon name="edit" size="sm" className="mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onPrintSelected([location])}>
                                  <MaterialIcon name="print" size="sm" className="mr-2" />
                                  Print Label
                                </DropdownMenuItem>
                                {isActive ? (
                                  <DropdownMenuItem onClick={() => handleArchive(location)}>
                                    <MaterialIcon name="archive" size="sm" className="mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleRestore(location)}>
                                    <MaterialIcon name="refresh" size="sm" className="mr-2" />
                                    Restore
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteClick(location)}
                                >
                                  <MaterialIcon name="delete" size="sm" className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{locationToDelete?.code}</strong>?
              This action cannot be undone. Consider archiving instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
