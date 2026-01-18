import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WarehouseList } from '@/components/warehouses/WarehouseList';
import { WarehouseDialog } from '@/components/warehouses/WarehouseDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useWarehouses } from '@/hooks/useWarehouses';

export default function Warehouses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<string | null>(null);
  const { warehouses, loading, refetch } = useWarehouses();

  const handleCreate = () => {
    setEditingWarehouse(null);
    setDialogOpen(true);
  };

  const handleEdit = (warehouseId: string) => {
    setEditingWarehouse(warehouseId);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingWarehouse(null);
  };

  const handleSuccess = () => {
    handleDialogClose();
    refetch();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warehouses</h1>
            <p className="text-muted-foreground">
              Manage your warehouse locations and configurations
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Warehouse
          </Button>
        </div>

        <WarehouseList
          warehouses={warehouses}
          loading={loading}
          onEdit={handleEdit}
          onRefresh={refetch}
        />

        <WarehouseDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          warehouseId={editingWarehouse}
          onSuccess={handleSuccess}
        />
      </div>
    </DashboardLayout>
  );
}
