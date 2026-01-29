import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Warehouse } from '@/hooks/useWarehouses';
import { Location } from '@/hooks/useLocations';

const locationSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50).regex(/^[A-Z0-9_-]+$/i, 'Code must be alphanumeric with dashes or underscores'),
  name: z.string().optional(),
  type: z.enum(['zone', 'aisle', 'bay', 'bin', 'shelf', 'release']),
  warehouse_id: z.string().min(1, 'Warehouse is required'),
  parent_location_id: z.string().optional(),
  capacity: z.number().optional(),
  status: z.enum(['active', 'inactive', 'full']),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  warehouses: Warehouse[];
  locations: Location[];
  defaultWarehouseId?: string;
  onSuccess: () => void;
}

const LOCATION_TYPES = [
  { value: 'zone', label: 'Zone', description: 'Large area of the warehouse' },
  { value: 'aisle', label: 'Aisle', description: 'Row between shelving units' },
  { value: 'bay', label: 'Bay', description: 'Section of an aisle' },
  { value: 'shelf', label: 'Shelf', description: 'Individual shelf level' },
  { value: 'bin', label: 'Bin', description: 'Specific storage location' },
  { value: 'release', label: 'Release', description: 'Items moved here are automatically released' },
];

export function LocationDialog({
  open,
  onOpenChange,
  locationId,
  warehouses,
  locations,
  defaultWarehouseId,
  onSuccess,
}: LocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: '',
      name: '',
      type: 'bin',
      warehouse_id: defaultWarehouseId || '',
      parent_location_id: 'none',
      capacity: undefined,
      status: 'active',
    },
  });

  const selectedWarehouseId = form.watch('warehouse_id');

  // Filter parent locations to same warehouse
  const parentLocationOptions = locations.filter(
    (l) => l.warehouse_id === selectedWarehouseId && l.id !== locationId
  );

  useEffect(() => {
    if (open && locationId) {
      fetchLocation(locationId);
    } else if (open && !locationId) {
      form.reset({
        code: '',
        name: '',
        type: 'bin',
        warehouse_id: defaultWarehouseId || (warehouses.length > 0 ? warehouses[0].id : ''),
        parent_location_id: 'none',
        capacity: undefined,
        status: 'active',
      });
    }
  }, [open, locationId, defaultWarehouseId, warehouses]);

  const fetchLocation = async (id: string) => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      form.reset({
        code: data.code,
        name: data.name || '',
        type: data.type as 'zone' | 'aisle' | 'bay' | 'bin' | 'shelf' | 'release',
        warehouse_id: data.warehouse_id,
        parent_location_id: data.parent_location_id || 'none',
        capacity: data.capacity ? Number(data.capacity) : undefined,
        status: data.status as 'active' | 'inactive' | 'full',
      });
    } catch (error) {
      console.error('Error fetching location:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load location details',
      });
      onOpenChange(false);
    } finally {
      setFetching(false);
    }
  };

  const onSubmit = async (data: LocationFormData) => {
    try {
      setLoading(true);

      const locationData = {
        code: data.code,
        name: data.name || null,
        type: data.type,
        warehouse_id: data.warehouse_id,
        parent_location_id: data.parent_location_id === 'none' ? null : data.parent_location_id || null,
        capacity: data.capacity || null,
        status: data.status,
      };

      if (locationId) {
        const { error } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', locationId);

        if (error) throw error;

        toast({
          title: 'Location updated',
          description: `${data.code} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase.from('locations').insert([locationData]);

        if (error) throw error;

        toast({
          title: 'Location created',
          description: `${data.code} has been created successfully.`,
        });
      }

      onSuccess();
    } catch (error: unknown) {
      console.error('Error saving location:', error);
      const errorMessage =
        error instanceof Error && 'code' in error && (error as { code: string }).code === '23505'
          ? 'A location with this code already exists in this warehouse'
          : 'Failed to save location';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!locationId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Location' : 'Add Location'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the location details below.'
              : 'Create a new zone, aisle, or bin location.'}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center h-48">
            <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="warehouse_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="A-01-B3"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormDescription>Unique identifier</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOCATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Storage Zone" {...field} />
                    </FormControl>
                    <FormDescription>Optional friendly name</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_location_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedWarehouseId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None (top level)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (top level)</SelectItem>
                        {parentLocationOptions.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.code} {loc.name ? `(${loc.name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Optional hierarchical parent</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormDescription>Max items</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="full">Full</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />}
                  {isEditing ? 'Update Location' : 'Create Location'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
