import { useEffect, useState, useMemo } from 'react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SaveButton } from '@/components/ui/SaveButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Warehouse } from '@/hooks/useWarehouses';
import { Location } from '@/hooks/useLocations';

const locationSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50).regex(/^[A-Z0-9_-]+$/i, 'Code must be alphanumeric with dashes or underscores'),
  name: z.string().optional(),
  type: z.enum(['zone', 'aisle', 'bay', 'bin', 'shelf', 'release', 'dock']),
  warehouse_id: z.string().min(1, 'Warehouse is required'),
  parent_location_id: z.string().optional(),
  capacity: z.number().optional(),
  capacity_sq_ft: z.number().optional(),
  capacity_cu_ft: z.number().optional(),
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
  { value: 'dock', label: 'Dock', description: 'Receiving or shipping dock' },
  { value: 'release', label: 'Release', description: 'Items moved here are automatically released' },
];

/** Convert total inches to { ft, inches } for display. Returns undefined pair if null. */
function decomposeInches(totalIn: number | null | undefined): { ft: number | undefined; inches: number | undefined } {
  if (totalIn == null || totalIn <= 0) return { ft: undefined, inches: undefined };
  return { ft: Math.floor(totalIn / 12), inches: totalIn % 12 };
}

/** Convert ft + in to total inches. Returns null when both are empty. */
function composeTotalInches(ft: number | undefined, inches: number | undefined): number | null {
  if (ft == null && inches == null) return null;
  const total = ((ft || 0) * 12) + (inches || 0);
  return total > 0 ? total : null;
}

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

  // Measurement state (ft + inches decomposition)
  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [lengthFt, setLengthFt] = useState<number | undefined>();
  const [lengthInField, setLengthInField] = useState<number | undefined>();
  const [widthFt, setWidthFt] = useState<number | undefined>();
  const [widthInField, setWidthInField] = useState<number | undefined>();
  const [heightFt, setHeightFt] = useState<number | undefined>();
  const [heightInField, setHeightInField] = useState<number | undefined>();

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: '',
      name: '',
      type: 'bin',
      warehouse_id: defaultWarehouseId || '',
      parent_location_id: 'none',
      capacity: undefined,
      capacity_sq_ft: undefined,
      capacity_cu_ft: undefined,
      status: 'active',
    },
  });

  const selectedWarehouseId = form.watch('warehouse_id');

  // Filter parent locations to same warehouse
  const parentLocationOptions = locations.filter(
    (l) => l.warehouse_id === selectedWarehouseId && l.id !== locationId
  );

  // Live capacity computations
  const lengthTotal = composeTotalInches(lengthFt, lengthInField);
  const widthTotal = composeTotalInches(widthFt, widthInField);
  const heightTotal = composeTotalInches(heightFt, heightInField);

  const liveFootprint = useMemo(() => {
    if (lengthTotal == null || widthTotal == null) return null;
    return (lengthTotal * widthTotal) / 144;
  }, [lengthTotal, widthTotal]);

  const liveCapacity = useMemo(() => {
    if (lengthTotal == null || widthTotal == null || heightTotal == null) return null;
    return (lengthTotal * widthTotal * heightTotal) / 1728;
  }, [lengthTotal, widthTotal, heightTotal]);

  const resetMeasurements = () => {
    setLengthFt(undefined);
    setLengthInField(undefined);
    setWidthFt(undefined);
    setWidthInField(undefined);
    setHeightFt(undefined);
    setHeightInField(undefined);
  };

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
        capacity_sq_ft: undefined,
        capacity_cu_ft: undefined,
        status: 'active',
      });
      resetMeasurements();
      setMeasurementsOpen(false);
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
        type: data.type as 'zone' | 'aisle' | 'bay' | 'bin' | 'shelf' | 'release' | 'dock',
        warehouse_id: data.warehouse_id,
        parent_location_id: data.parent_location_id || 'none',
        capacity: data.capacity ? Number(data.capacity) : undefined,
        capacity_sq_ft: data.capacity_sq_ft ? Number(data.capacity_sq_ft) : undefined,
        capacity_cu_ft: data.capacity_cu_ft ? Number(data.capacity_cu_ft) : undefined,
        status: data.status as 'active' | 'inactive' | 'full',
      });

      // Prefill measurement fields from DB inches
      const d = data as any;
      const lenDec = decomposeInches(d.length_in);
      setLengthFt(lenDec.ft);
      setLengthInField(lenDec.inches);
      const widDec = decomposeInches(d.width_in);
      setWidthFt(widDec.ft);
      setWidthInField(widDec.inches);
      const htDec = decomposeInches(d.usable_height_in);
      setHeightFt(htDec.ft);
      setHeightInField(htDec.inches);

      // Auto-open measurements section when location has dimensions
      if (d.length_in || d.width_in || d.usable_height_in) {
        setMeasurementsOpen(true);
      } else {
        setMeasurementsOpen(false);
      }
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

      // Compute measurement inches
      const lenIn = composeTotalInches(lengthFt, lengthInField);
      const widIn = composeTotalInches(widthFt, widthInField);
      const htIn = composeTotalInches(heightFt, heightInField);

      // If any dim is missing → send NULL for all three
      const allDimsPresent = lenIn != null && widIn != null && htIn != null;

      const locationData: Record<string, unknown> = {
        code: data.code,
        name: data.name || null,
        type: data.type,
        warehouse_id: data.warehouse_id,
        parent_location_id: data.parent_location_id === 'none' ? null : data.parent_location_id || null,
        capacity: data.capacity || null,
        capacity_sq_ft: data.capacity_sq_ft ?? null,
        capacity_cu_ft: data.capacity_cu_ft ?? null,
        status: data.status,
        length_in: allDimsPresent ? lenIn : null,
        width_in: allDimsPresent ? widIn : null,
        usable_height_in: allDimsPresent ? htIn : null,
      };

      if (locationId) {
        const { error } = await (supabase
          .from('locations') as any)
          .update(locationData)
          .eq('id', locationId);

        if (error) throw error;

        toast({
          title: 'Location updated',
          description: `${data.code} has been updated successfully.`,
        });
      } else {
        const { error } = await (supabase.from('locations') as any).insert([locationData]);

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

  /** Height preset helper */
  const applyHeightPreset = (totalInches: number) => {
    setHeightFt(Math.floor(totalInches / 12));
    setHeightInField(totalInches % 12);
  };

  /** Constrain inches input to 0-11 */
  const clampInches = (val: string): number | undefined => {
    if (!val) return undefined;
    const n = Math.max(0, Math.min(11, parseInt(val, 10)));
    return isNaN(n) ? undefined : n;
  };

  const parseFeet = (val: string): number | undefined => {
    if (!val) return undefined;
    const n = Math.max(0, parseInt(val, 10));
    return isNaN(n) ? undefined : n;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-4 pr-2">
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

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Items</FormLabel>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity_sq_ft"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (sq ft)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacity_cu_ft"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (cu ft)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ---- Capacity / Measurements (Optional) ---- */}
              <Collapsible open={measurementsOpen} onOpenChange={setMeasurementsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <MaterialIcon name="straighten" size="sm" />
                      Capacity / Measurements (Optional)
                    </span>
                    <MaterialIcon
                      name="expand_more"
                      size="sm"
                      className={`transition-transform duration-200 ${measurementsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  {/* Length */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Length</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={lengthFt ?? ''}
                          onChange={(e) => setLengthFt(parseFeet(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={11}
                          placeholder="0"
                          value={lengthInField ?? ''}
                          onChange={(e) => setLengthInField(clampInches(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
                      </div>
                    </div>
                  </div>

                  {/* Width */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Width</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={widthFt ?? ''}
                          onChange={(e) => setWidthFt(parseFeet(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={11}
                          placeholder="0"
                          value={widthInField ?? ''}
                          onChange={(e) => setWidthInField(clampInches(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
                      </div>
                    </div>
                  </div>

                  {/* Usable Height */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Usable Height</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={heightFt ?? ''}
                          onChange={(e) => setHeightFt(parseFeet(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={11}
                          placeholder="0"
                          value={heightInField ?? ''}
                          onChange={(e) => setHeightInField(clampInches(e.target.value))}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
                      </div>
                    </div>
                    {/* Preset buttons */}
                    <div className="flex gap-2 mt-1">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => applyHeightPreset(108)}>
                        Ground 9 ft
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => applyHeightPreset(50)}>
                        Rack 50 in
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => applyHeightPreset(72)}>
                        Top rack 6 ft
                      </Button>
                    </div>
                  </div>

                  {/* Live display */}
                  <div className="flex gap-4 text-sm text-muted-foreground border-t pt-3">
                    <div>
                      <span className="font-medium">Footprint:</span>{' '}
                      {liveFootprint != null ? `${liveFootprint.toFixed(1)} sqft` : '\u2014'}
                    </div>
                    <div>
                      <span className="font-medium">Capacity:</span>{' '}
                      {liveCapacity != null ? `${liveCapacity.toFixed(1)} cuft` : '\u2014'}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

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

            </form>
          </Form>
        )}

        {!fetching && (
          <DialogFooter className="pt-4 border-t mt-4 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <SaveButton
              type="button"
              onClick={() => form.handleSubmit(onSubmit)()}
              label={isEditing ? 'Update Location' : 'Create Location'}
              savingLabel={isEditing ? 'Updating...' : 'Creating...'}
              savedLabel={isEditing ? 'Updated' : 'Created'}
              saveDisabled={loading}
            />
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
