import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Trash2, ArrowLeft, Upload } from 'lucide-react';
import { ItemTypeCombobox } from '@/components/items/ItemTypeCombobox';
import { ShipmentItemsImportDialog, ParsedShipmentItem } from '@/components/shipments/ShipmentItemsImportDialog';

const expectedItemSchema = z.object({
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  vendor: z.string().min(1, 'Vendor is required'),
  description: z.string().optional(),
  item_type_id: z.string().optional(),
  sidemark: z.string().optional(),
});

const shipmentSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  warehouse_id: z.string().min(1, 'Warehouse is required'),
  expected_arrival_date: z.string().optional(),
  carrier: z.string().optional(),
  tracking_number: z.string().optional(),
  po_number: z.string().optional(),
  notes: z.string().optional(),
  expected_items: z.array(expectedItemSchema).min(1, 'At least one item is required'),
});

type ShipmentFormData = z.infer<typeof shipmentSchema>;

interface Account {
  id: string;
  account_name: string;
  account_code: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface ItemType {
  id: string;
  name: string;
}

export default function ShipmentCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [fetchingData, setFetchingData] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const form = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      account_id: '',
      warehouse_id: '',
      expected_arrival_date: '',
      carrier: '',
      tracking_number: '',
      po_number: '',
      notes: '',
      expected_items: [
        { quantity: 1, vendor: '', description: '', item_type_id: '', sidemark: '' },
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'expected_items',
  });

  const handleImportItems = (importedItems: ParsedShipmentItem[]) => {
    // Replace all existing items with imported items
    replace(importedItems);
    setImportDialogOpen(false);
    setImportFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportDialogOpen(true);
    }
    e.target.value = '';
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [accountsRes, warehousesRes, itemTypesRes] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, account_name, account_code')
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('account_name'),
        supabase
          .from('warehouses')
          .select('id, name, code')
          .is('deleted_at', null)
          .order('name'),
        supabase
          .from('item_types')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
      ]);

      setAccounts(accountsRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setItemTypes(itemTypesRes.data || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setFetchingData(false);
    }
  };

  const onSubmit = async (data: ShipmentFormData) => {
    if (!profile?.tenant_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No tenant found. Please log in again.',
      });
      return;
    }

    try {
      setLoading(true);

      // Create the shipment (shipment_number will be auto-generated by trigger)
      // Note: Using type assertion until Supabase types are regenerated
      const { data: shipment, error: shipmentError } = await (supabase
        .from('shipments') as any)
        .insert({
          tenant_id: profile.tenant_id,
          shipment_type: 'inbound',
          status: 'expected',
          account_id: data.account_id,
          warehouse_id: data.warehouse_id,
          expected_arrival_date: data.expected_arrival_date || null,
          carrier: data.carrier || null,
          tracking_number: data.tracking_number || null,
          po_number: data.po_number || null,
          notes: data.notes || null,
          created_by: profile.id,
        })
        .select('id, shipment_number')
        .single();

      if (shipmentError) throw shipmentError;

      // Create expected items
      const itemsToInsert = data.expected_items.map((item) => ({
        shipment_id: shipment.id,
        expected_quantity: item.quantity,
        expected_vendor: item.vendor,
        expected_description: item.description || null,
        expected_item_type_id: item.item_type_id || null,
        expected_sidemark: item.sidemark || null,
        status: 'pending',
      }));

      const { error: itemsError } = await (supabase
        .from('shipment_items') as any)
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: 'Shipment created',
        description: `Expected shipment ${shipment.shipment_number} has been created.`,
      });

      navigate('/shipments');
    } catch (error) {
      console.error('Error creating shipment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create shipment. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/shipments')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Shipment</h1>
            <p className="text-muted-foreground">
              Shipment number will be auto-generated • Item IDs assigned at receiving
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Shipment Details</CardTitle>
                <CardDescription>Basic information about the expected shipment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.account_name} ({account.account_code})
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
                            {warehouses.map((wh) => (
                              <SelectItem key={wh.id} value={wh.id}>
                                {wh.name} ({wh.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="expected_arrival_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Arrival</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="carrier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carrier</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., UPS, FedEx" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tracking_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Tracking #" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="po_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Purchase Order #" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this shipment..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Shipment Items</CardTitle>
                    <CardDescription>
                      Items expected on this shipment. Item ID Codes will be assigned when received.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="import-items-file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('import-items-file')?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Import
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({ quantity: 1, vendor: '', description: '', item_type_id: '', sidemark: '' })
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Qty *</TableHead>
                        <TableHead className="w-40">Vendor *</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-40">Item Type</TableHead>
                        <TableHead className="w-32">Sidemark</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`expected_items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={1}
                                      className="w-full"
                                      {...field}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`expected_items.${index}.vendor`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Vendor" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`expected_items.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Item description" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`expected_items.${index}.item_type_id`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <ItemTypeCombobox
                                      itemTypes={itemTypes}
                                      value={field.value || ''}
                                      onChange={field.onChange}
                                      placeholder="Type"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`expected_items.${index}.sidemark`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Sidemark" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {form.formState.errors.expected_items?.root && (
                  <p className="text-sm text-destructive mt-2">
                    {form.formState.errors.expected_items.root.message}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/shipments')}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Shipment
              </Button>
            </div>
          </form>
        </Form>

        <ShipmentItemsImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          file={importFile}
          itemTypes={itemTypes}
          onImport={handleImportItems}
        />
      </div>
    </DashboardLayout>
  );
}
