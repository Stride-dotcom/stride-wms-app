import { useState } from 'react';
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
import { HelpTip } from '@/components/ui/help-tip';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SaveButton } from '@/components/ui/SaveButton';
import { useContainers } from '@/hooks/useContainers';

const CONTAINER_TYPES = [
  { value: 'Carton', label: 'Carton' },
  { value: 'Gaylord', label: 'Gaylord' },
  { value: 'Pallet', label: 'Pallet' },
];

const containerSchema = z.object({
  container_code: z.string().min(1, 'Container code is required').max(50),
  container_type: z.string().min(1, 'Container type is required'),
  footprint_cu_ft: z.number().optional(),
});

type ContainerFormData = z.infer<typeof containerSchema>;

interface CreateContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  locationId?: string;
  onSuccess: () => void;
}

export function CreateContainerDialog({
  open,
  onOpenChange,
  warehouseId,
  locationId,
  onSuccess,
}: CreateContainerDialogProps) {
  const [saving, setSaving] = useState(false);
  const { createContainer } = useContainers();

  const form = useForm<ContainerFormData>({
    resolver: zodResolver(containerSchema),
    defaultValues: {
      container_code: '',
      container_type: 'Carton',
      footprint_cu_ft: undefined,
    },
  });

  const onSubmit = async (data: ContainerFormData) => {
    setSaving(true);
    try {
      const result = await createContainer({
        container_code: data.container_code.toUpperCase(),
        container_type: data.container_type,
        warehouse_id: warehouseId,
        location_id: locationId ?? null,
        footprint_cu_ft: data.footprint_cu_ft ?? null,
      });

      if (result) {
        form.reset();
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create Container</DialogTitle>
          <DialogDescription>
            Add a new container to this location. Containers hold inventory units and can be moved between locations.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="container_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <HelpTip tooltip="A unique code for this container. Must match the physical barcode label on the container.">
                      Container Code *
                    </HelpTip>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="CT-12345"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="container_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <HelpTip tooltip="The physical type of container. Affects default handling and capacity calculations.">
                      Type *
                    </HelpTip>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTAINER_TYPES.map((type) => (
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

            <FormField
              control={form.control}
              name="footprint_cu_ft"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <HelpTip tooltip="The physical footprint volume of the container itself. Used in bounded footprint capacity calculations. Leave empty if unknown.">
                      Footprint (cu ft)
                    </HelpTip>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Optional"
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <SaveButton
                type="submit"
                label="Create Container"
                savingLabel="Creating..."
                savedLabel="Created"
                saveDisabled={saving}
              />
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
