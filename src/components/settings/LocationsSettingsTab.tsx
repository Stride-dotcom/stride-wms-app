import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  DISPLAY_LOCATION_TYPE_BADGE_COLORS,
  getLocationTypeLabel,
  normalizeLocationType,
  parseDisplayLocationType,
} from '@/lib/locationTypeUtils';

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
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Default shipment location state
  const [defaultRecvLocationId, setDefaultRecvLocationId] = useState<string>('');
  const [defaultOutboundLocationId, setDefaultOutboundLocationId] = useState<string>('');
  const [savingDefaultLocation, setSavingDefaultLocation] = useState(false);
  const [locationValidationErrors, setLocationValidationErrors] = useState<{ inbound?: string; outbound?: string }>({});

  // Persist warehouse filter per user
  useEffect(() => {
    if (profile?.id) {
      const saved = localStorage.getItem(`stride_location_view_${profile.id}`);
      if (saved && (saved === 'all' || warehouses.some(w => w.id === saved))) {
        onWarehouseChange(saved);
      }
    }
  }, [profile?.id, warehouses]);

  const handleWarehouseFilterChange = useCallback((value: string) => {
    onWarehouseChange(value);
    if (profile?.id) {
      localStorage.setItem(`stride_location_view_${profile.id}`, value);
    }
  }, [onWarehouseChange, profile?.id]);

  // Sync default locations when warehouse selection changes
  useEffect(() => {
    if (selectedWarehouse && selectedWarehouse !== 'all') {
      const wh = warehouses.find(w => w.id === selectedWarehouse);
      setDefaultRecvLocationId((wh as any)?.default_receiving_location_id || '');
      setDefaultOutboundLocationId((wh as any)?.default_outbound_location_id || '');
    } else {
      setDefaultRecvLocationId('');
      setDefaultOutboundLocationId('');
    }
    setLocationValidationErrors({});
  }, [selectedWarehouse, warehouses]);

  const handleSaveDefaultLocations = async () => {
    if (!selectedWarehouse || selectedWarehouse === 'all') return;

    // Validate both fields are set
    const errors: { inbound?: string; outbound?: string } = {};
    if (!defaultRecvLocationId) {
      errors.inbound = 'Default shipment location is required';
    }
    if (!defaultOutboundLocationId) {
      errors.outbound = 'Default outbound location is required';
    }
    if (Object.keys(errors).length > 0) {
      setLocationValidationErrors(errors);
      return;
    }
    setLocationValidationErrors({});

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
        description: 'Default shipment and outbound locations updated for this warehouse.',
      });
      onWarehouseRefresh?.();
    } catch (error: any) {
      console.error('Error saving default locations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save default locations.',
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
    const template = [
      'location_name,warehouse_name,type,status',
      'A1.1,,bin,active',
      'BAY-01,,bay,active',
      'DOCK-01,,dock,active',
      'AREA-A,,area,active',
    ].join('\n');
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
      csvRows.push(`${loc.code},${warehouse?.name || ''},${normalizeLocationType(getDisplayType(loc))},${loc.status}`);
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
    const normalizedType = normalizeLocationType(type);
    return (
      <Badge variant="outline" className={DISPLAY_LOCATION_TYPE_BADGE_COLORS[normalizedType]}>
        {getLocationTypeLabel(type)}
      </Badge>
    );
  };

  const getDisplayType = (location: Location): string => {
    if (parseDisplayLocationType(location.type)) {
      return location.type;
    }
    const legacyLocationType = (location as any).location_type as string | null | undefined;
    if (parseDisplayLocationType(legacyLocationType)) {
      return legacyLocationType as string;
    }
    return location.type;
  };

  const activeCount = locations.filter(l => (l as any).is_active !== false).length;
  const archivedCount = locations.filter(l => (l as any).is_active === false).length;

  return (
    <>
      <div className="space-y-4">
        {/* Default Shipment Locations Card - only visible when a specific warehouse is selected */}
        {selectedWarehouse && selectedWarehouse !== 'all' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MaterialIcon name="pin_drop" size="sm" />
                Default Shipment Locations
              </CardTitle>
              <CardDescription>
                Configure default locations for inbound receiving and outbound shipments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-recv-location">
                    Default Shipment Locations <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={defaultRecvLocationId || '_none_'}
                    onValueChange={(val) => {
                      setDefaultRecvLocationId(val === '_none_' ? '' : val);
                      setLocationValidationErrors(prev => ({ ...prev, inbound: undefined }));
                    }}
                  >
                    <SelectTrigger id="default-recv-location" className={locationValidationErrors.inbound ? 'border-red-500' : ''}>
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
                  {locationValidationErrors.inbound && (
                    <p className="text-xs text-red-500">{locationValidationErrors.inbound}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Default location where inbound items are received
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-outbound-location">
                    Default Outbound Location <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={defaultOutboundLocationId || '_none_'}
                    onValueChange={(val) => {
                      setDefaultOutboundLocationId(val === '_none_' ? '' : val);
                      setLocationValidationErrors(prev => ({ ...prev, outbound: undefined }));
                    }}
                  >
                    <SelectTrigger id="default-outbound-location" className={locationValidationErrors.outbound ? 'border-red-500' : ''}>
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
                  {locationValidationErrors.outbound && (
                    <p className="text-xs text-red-500">{locationValidationErrors.outbound}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    When pulling items for outbound, scanned items will automatically be assigned to this location
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveDefaultLocations}
                  disabled={savingDefaultLocation || (!defaultRecvLocationId && !defaultOutboundLocationId)}
                >
                  {savingDefaultLocation ? (
                    <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  ) : (
                    <MaterialIcon name="save" size="sm" className="mr-2" />
                  )}
                  Save Locations
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Storage Locations List Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <MaterialIcon name="location_on" size="md" />
                <div>
                  <CardTitle>Storage Locations</CardTitle>
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
                  Add Location
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
                  placeholder="Search storage locations..."
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
                    ? 'No storage locations yet. Use Add Location to create one.'
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
                      <TableHead>Capacity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Sq Ft</TableHead>
                      <TableHead className="text-right">Cu Ft</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLocations.map((location) => {
                      const warehouse = warehouseMap.get(location.warehouse_id);
                      const isActive = (location as any).is_active !== false;
                      return (
                        <TableRow
                          key={location.id}
                          className={`${!isActive ? 'opacity-60' : ''} cursor-pointer hover:bg-muted/50`}
                          onClick={() => navigate(`/locations/${location.id}`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(location.id)}
                              onCheckedChange={() => toggleSelect(location.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {location.code}
                          </TableCell>
                          <TableCell>{location.name || '—'}</TableCell>
                          <TableCell>{getTypeBadge(getDisplayType(location))}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {warehouse?.name || '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {((location as any).capacity_cuft ?? location.capacity_cu_ft) != null
                              ? `${Number((location as any).capacity_cuft ?? location.capacity_cu_ft).toFixed(1)} cuft`
                              : '\u2014'}
                          </TableCell>
                          <TableCell>{getStatusBadge(location.status, isActive)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {location.capacity_sq_ft != null ? location.capacity_sq_ft : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {(location.capacity_cu_ft ?? (location as any).capacity_cuft) != null
                              ? (location.capacity_cu_ft ?? (location as any).capacity_cuft)
                              : '—'}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
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
