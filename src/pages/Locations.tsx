import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LocationList } from '@/components/locations/LocationList';
import { LocationDialog } from '@/components/locations/LocationDialog';
import { PrintLabelsDialog } from '@/components/locations/PrintLabelsDialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Printer } from 'lucide-react';
import { useLocations, Location } from '@/hooks/useLocations';
import { useWarehouses } from '@/hooks/useWarehouses';

export default function Locations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
  
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { locations, loading, refetch } = useLocations(
    selectedWarehouse === 'all' ? undefined : selectedWarehouse
  );

  const handleCreate = () => {
    setEditingLocation(null);
    setDialogOpen(true);
  };

  const handleEdit = (locationId: string) => {
    setEditingLocation(locationId);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingLocation(null);
  };

  const handleSuccess = () => {
    handleDialogClose();
    refetch();
  };

  const handlePrintSelected = (selected: Location[]) => {
    setSelectedLocations(selected);
    setPrintDialogOpen(true);
  };

  const handlePrintAll = () => {
    setSelectedLocations(locations);
    setPrintDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
            <p className="text-muted-foreground">
              Manage warehouse zones, aisles, and bin locations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrintAll} disabled={locations.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Print All Labels
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>
        </div>

        {/* Warehouse Filter */}
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger>
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
          </div>
        </div>

        <LocationList
          locations={locations}
          warehouses={warehouses}
          loading={loading || warehousesLoading}
          onEdit={handleEdit}
          onRefresh={refetch}
          onPrintSelected={handlePrintSelected}
        />

        <LocationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          locationId={editingLocation}
          warehouses={warehouses}
          locations={locations}
          defaultWarehouseId={selectedWarehouse === 'all' ? undefined : selectedWarehouse}
          onSuccess={handleSuccess}
        />

        <PrintLabelsDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          locations={selectedLocations}
          warehouses={warehouses}
        />
      </div>
    </DashboardLayout>
  );
}
