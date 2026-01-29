/**
 * BillableServicesSettingsTab
 * Manage billable services catalog for the tenant
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBillableServices, ServiceCategory, ChargeUnit } from '@/hooks/useBillableServices';
import { useToast } from '@/hooks/use-toast';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

const CATEGORY_OPTIONS: { value: ServiceCategory; label: string }[] = [
  { value: 'item_service', label: 'Item Service' },
  { value: 'storage', label: 'Storage' },
  { value: 'labor', label: 'Labor' },
  { value: 'accessorial', label: 'Accessorial' },
  { value: 'addon', label: 'Add-on' },
];

const CHARGE_UNIT_OPTIONS: { value: ChargeUnit; label: string }[] = [
  { value: 'per_item', label: 'Per Item' },
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_cubic_foot', label: 'Per Cubic Foot' },
  { value: 'flat', label: 'Flat Fee' },
  { value: 'per_event', label: 'Per Event' },
];

interface ServiceFormData {
  code: string;
  name: string;
  description: string;
  category: ServiceCategory;
  charge_unit: ChargeUnit;
  is_taxable: boolean;
}

const DEFAULT_FORM_DATA: ServiceFormData = {
  code: '',
  name: '',
  description: '',
  category: 'item_service',
  charge_unit: 'per_item',
  is_taxable: false,
};

export function BillableServicesSettingsTab() {
  const { services, loading, createService, updateService, deleteService, refetch } = useBillableServices();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(DEFAULT_FORM_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM_DATA);
    setDialogOpen(true);
  };

  const handleOpenEdit = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    setEditingId(serviceId);
    setFormData({
      code: service.code,
      name: service.name,
      description: service.description || '',
      category: service.category as ServiceCategory,
      charge_unit: service.charge_unit as ChargeUnit,
      is_taxable: service.is_taxable ?? false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Code and Name are required.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updateService(editingId, {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category,
          charge_unit: formData.charge_unit,
          is_taxable: formData.is_taxable,
        });
        toast({ title: 'Service Updated' });
      } else {
        await createService({
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          category: formData.category,
          charge_unit: formData.charge_unit,
          is_taxable: formData.is_taxable,
        });
        toast({ title: 'Service Created' });
      }
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving service:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save service.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    setDeletingId(serviceId);
    try {
      await deleteService(serviceId);
      toast({ title: 'Service Deactivated' });
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to deactivate service.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      item_service: 'bg-blue-100 text-blue-800',
      storage: 'bg-green-100 text-green-800',
      labor: 'bg-orange-100 text-orange-800',
      accessorial: 'bg-purple-100 text-purple-800',
      addon: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      item_service: 'Item Service',
      storage: 'Storage',
      labor: 'Labor',
      accessorial: 'Accessorial',
      addon: 'Add-on',
    };
    return (
      <Badge variant="secondary" className={colors[category] || ''}>
        {labels[category] || category}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MaterialIcon name="attach_money" size="md" className="text-muted-foreground" />
              <div>
                <CardTitle>Billable Services</CardTitle>
                <CardDescription>
                  Define the services you charge for (receiving, storage, handling, etc.)
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleOpenCreate}>
              <MaterialIcon name="add" size="sm" className="mr-2" />
              Add Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MaterialIcon name="inventory_2" size="lg" className="mx-auto mb-3 opacity-50" />
              <p>No billable services defined yet.</p>
              <p className="text-sm">Add services to start building your rate cards.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Charge Unit</TableHead>
                    <TableHead className="hidden md:table-cell">Taxable</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-mono text-sm">{service.code}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{service.name}</span>
                          {service.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {getCategoryBadge(service.category)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {CHARGE_UNIT_OPTIONS.find(u => u.value === service.charge_unit)?.label || service.charge_unit}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {service.is_taxable ? (
                          <Badge variant="outline">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(service.id)}
                          >
                            <MaterialIcon name="edit" size="sm" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(service.id)}
                            disabled={deletingId === service.id}
                          >
                            {deletingId === service.id ? (
                              <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                            ) : (
                              <MaterialIcon name="delete" size="sm" className="text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Service' : 'Add Billable Service'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the service details.'
                : 'Define a new billable service for your rate cards.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="RECV"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Receiving"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this service covers..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v as ServiceCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Charge Unit</Label>
                <Select
                  value={formData.charge_unit}
                  onValueChange={(v) => setFormData({ ...formData, charge_unit: v as ChargeUnit })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGE_UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="is_taxable">Taxable</Label>
                <p className="text-xs text-muted-foreground">Apply sales tax to this service</p>
              </div>
              <Switch
                id="is_taxable"
                checked={formData.is_taxable}
                onCheckedChange={(v) => setFormData({ ...formData, is_taxable: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
