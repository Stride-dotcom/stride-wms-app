import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  Upload, 
  Download, 
  Search,
  Package,
  DollarSign,
  Clock,
  Settings2,
  RefreshCw
} from 'lucide-react';

// Type definition matching all database columns
interface ItemType {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  // Physical attributes
  weight: number | null;
  weight_unit: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimension_unit: string | null;
  cubic_feet: number | null;
  model_number: string | null;
  default_item_notes: string | null;
  delivery_pieces: number | null;
  billing_pieces: number | null;
  people_to_deliver: number | null;
  // Time fields (minutes)
  minutes_to_deliver: number | null;
  minutes_to_move: number | null;
  minutes_to_assemble: number | null;
  minutes_to_load: number | null;
  minutes_to_inspect: number | null;
  minutes_to_put_in_warehouse: number | null;
  minutes_per_felt_pad: number | null;
  // Rate fields
  assembly_rate: number | null;
  same_day_assembly_rate: number | null;
  move_rate: number | null;
  felt_pad_price: number | null;
  extra_fee: number | null;
  oversize_rate: number | null;
  inspection_fee: number | null;
  removal_rate: number | null;
  will_call_rate: number | null;
  storage_rate: number | null;
  storage_rate_per_day: number | null;
  storage_billing_frequency: string | null;
  unstackable_extra_fee: number | null;
  receiving_rate: number | null;
  picking_rate: number | null;
  packing_rate: number | null;
  shipping_rate: number | null;
  pull_for_delivery_rate: number | null;
  pallet_sale_rate: number | null;
  minor_touchup_rate: number | null;
  custom_packaging_rate: number | null;
  assemblies_in_base_rate: number | null;
  // Boolean flags
  allow_on_reservation: boolean;
  notify_dispatch: boolean;
  allow_on_order_entry: boolean;
  auto_add_assembly_fee: boolean;
  created_at: string;
  updated_at: string;
}

// Default empty item type for creating new items
const getDefaultItemType = (): Partial<ItemType> => ({
  name: '',
  is_active: true,
  sort_order: 0,
  weight: null,
  weight_unit: 'lbs',
  length: null,
  width: null,
  height: null,
  dimension_unit: 'inches',
  cubic_feet: null,
  model_number: null,
  default_item_notes: null,
  delivery_pieces: 1,
  billing_pieces: 1,
  people_to_deliver: 2,
  minutes_to_deliver: null,
  minutes_to_move: null,
  minutes_to_assemble: null,
  minutes_to_load: null,
  minutes_to_inspect: null,
  minutes_to_put_in_warehouse: null,
  minutes_per_felt_pad: null,
  assembly_rate: null,
  same_day_assembly_rate: null,
  move_rate: null,
  felt_pad_price: null,
  extra_fee: null,
  oversize_rate: null,
  inspection_fee: null,
  removal_rate: null,
  will_call_rate: null,
  storage_rate: null,
  storage_rate_per_day: null,
  storage_billing_frequency: 'daily',
  unstackable_extra_fee: null,
  receiving_rate: null,
  picking_rate: null,
  packing_rate: null,
  shipping_rate: null,
  pull_for_delivery_rate: null,
  pallet_sale_rate: null,
  minor_touchup_rate: null,
  custom_packaging_rate: null,
  assemblies_in_base_rate: 0,
  allow_on_reservation: false,
  notify_dispatch: false,
  allow_on_order_entry: true,
  auto_add_assembly_fee: false,
});

// CSV column headers for export/import template
const CSV_HEADERS = [
  'name',
  'is_active',
  'sort_order',
  'delivery_pieces',
  'billing_pieces',
  'assembly_rate',
  'same_day_assembly_rate',
  'move_rate',
  'minutes_to_deliver',
  'minutes_to_move',
  'minutes_to_assemble',
  'minutes_to_load',
  'felt_pad_price',
  'extra_fee',
  'oversize_rate',
  'minutes_to_inspect',
  'inspection_fee',
  'default_item_notes',
  'removal_rate',
  'will_call_rate',
  'storage_rate_per_day',
  'unstackable_extra_fee',
  'receiving_rate',
  'pull_for_delivery_rate',
  'assemblies_in_base_rate',
  'minutes_to_put_in_warehouse',
  'minutes_per_felt_pad',
  'people_to_deliver',
  'cubic_feet',
  'model_number',
  'weight',
  'allow_on_reservation',
  'notify_dispatch',
  'allow_on_order_entry',
  'auto_add_assembly_fee',
];

export function ItemTypesSettingsTab() {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ItemType> | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemType | null>(null);
  
  // CSV import states
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [importAction, setImportAction] = useState<'replace' | 'skip'>('skip');

  const fetchItemTypes = useCallback(async () => {
    if (!profile?.tenant_id) return;
    
    try {
      setLoading(true);
      const { data, error } = await (supabase
        .from('item_types') as any)
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setItemTypes(data || []);
    } catch (error) {
      console.error('Error fetching item types:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load item types',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchItemTypes();
  }, [fetchItemTypes]);

  const handleCreate = () => {
    setEditingItem(getDefaultItemType());
    setDialogOpen(true);
  };

  const handleEdit = (item: ItemType) => {
    setEditingItem({ ...item });
    setDialogOpen(true);
  };

  const handleDelete = (item: ItemType) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await (supabase
        .from('item_types') as any)
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast({
        title: 'Item Type Deleted',
        description: `"${itemToDelete.name}" has been deleted.`,
      });
      
      fetchItemTypes();
    } catch (error) {
      console.error('Error deleting item type:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete item type',
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleSave = async () => {
    if (!editingItem || !profile?.tenant_id) return;
    
    if (!editingItem.name?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Name is required',
      });
      return;
    }

    try {
      setSaving(true);
      
      const itemData = {
        ...editingItem,
        tenant_id: profile.tenant_id,
      };

      if (editingItem.id) {
        // Update existing
        const { error } = await (supabase
          .from('item_types') as any)
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        
        toast({
          title: 'Item Type Updated',
          description: `"${editingItem.name}" has been updated.`,
        });
      } else {
        // Create new
        const { error } = await (supabase
          .from('item_types') as any)
          .insert(itemData);

        if (error) throw error;
        
        toast({
          title: 'Item Type Created',
          description: `"${editingItem.name}" has been created.`,
        });
      }

      setDialogOpen(false);
      setEditingItem(null);
      fetchItemTypes();
    } catch (error) {
      console.error('Error saving item type:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save item type',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = CSV_HEADERS.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'item_types_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const rows = itemTypes.map(item => 
      CSV_HEADERS.map(header => {
        const value = (item as any)[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? 'YES' : 'NO';
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return value;
      }).join(',')
    );
    
    const csvContent = CSV_HEADERS.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `item_types_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsedData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((header, idx) => {
          let value: any = values[idx] || null;
          
          // Convert YES/NO to boolean
          if (value === 'YES' || value === 'yes') value = true;
          else if (value === 'NO' || value === 'no') value = false;
          // Convert numeric strings
          else if (value && !isNaN(Number(value))) value = Number(value);
          else if (value === '') value = null;
          
          obj[header] = value;
        });
        return obj;
      });

      // Check for duplicates
      const existingNames = itemTypes.map(it => it.name.toLowerCase());
      const duplicateNames = parsedData
        .filter(item => existingNames.includes(item.name?.toLowerCase()))
        .map(item => item.name);

      setCsvData(parsedData);
      setDuplicates([...new Set(duplicateNames)]);
      setImportDialogOpen(true);
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!profile?.tenant_id) return;

    try {
      setSaving(true);
      
      const existingNames = itemTypes.map(it => it.name.toLowerCase());
      
      for (const item of csvData) {
        const isDuplicate = existingNames.includes(item.name?.toLowerCase());
        
        if (isDuplicate && importAction === 'skip') {
          continue;
        }
        
        const itemData = {
          ...getDefaultItemType(),
          ...item,
          tenant_id: profile.tenant_id,
        };

        if (isDuplicate && importAction === 'replace') {
          const existingItem = itemTypes.find(
            it => it.name.toLowerCase() === item.name?.toLowerCase()
          );
          if (existingItem) {
            await (supabase
              .from('item_types') as any)
              .update(itemData)
              .eq('id', existingItem.id);
          }
        } else if (!isDuplicate) {
          await (supabase
            .from('item_types') as any)
            .insert(itemData);
        }
      }

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${csvData.length - (importAction === 'skip' ? duplicates.length : 0)} item types.`,
      });
      
      setImportDialogOpen(false);
      setCsvData([]);
      setDuplicates([]);
      fetchItemTypes();
    } catch (error) {
      console.error('Error importing item types:', error);
      toast({
        variant: 'destructive',
        title: 'Import Error',
        description: 'Failed to import some item types',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredItemTypes = itemTypes.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateField = (field: keyof ItemType, value: any) => {
    if (editingItem) {
      setEditingItem({ ...editingItem, [field]: value });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Package className="h-5 w-5" />
            Item Types
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage item types with pricing rates and attributes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item Type
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search item types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={fetchItemTypes}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Assembly Rate</TableHead>
                <TableHead className="text-right">Inspection Fee</TableHead>
                <TableHead className="text-right">Storage/Day</TableHead>
                <TableHead className="text-right">Will Call</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItemTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No item types found. Click "Add Item Type" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItemTypes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? 'default' : 'secondary'}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.assembly_rate ? `$${item.assembly_rate}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.inspection_fee ? `$${item.inspection_fee}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.storage_rate_per_day ? `$${item.storage_rate_per_day}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.will_call_rate ? `$${item.will_call_rate}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.id ? 'Edit Item Type' : 'Create Item Type'}
            </DialogTitle>
            <DialogDescription>
              Configure pricing rates and attributes for this item type
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Basic
                </TabsTrigger>
                <TabsTrigger value="rates" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Rates
                </TabsTrigger>
                <TabsTrigger value="time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Type Name *</Label>
                    <Input
                      id="name"
                      value={editingItem?.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="e.g., Dining Chair"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sort_order">Sort Order</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      value={editingItem?.sort_order || 0}
                      onChange={(e) => updateField('sort_order', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <div className="flex gap-2">
                      <Input
                        id="weight"
                        type="number"
                        value={editingItem?.weight || ''}
                        onChange={(e) => updateField('weight', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="0"
                      />
                      <Input
                        value={editingItem?.weight_unit || 'lbs'}
                        onChange={(e) => updateField('weight_unit', e.target.value)}
                        className="w-20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cubic_feet">Cubic Feet</Label>
                    <Input
                      id="cubic_feet"
                      type="number"
                      value={editingItem?.cubic_feet || ''}
                      onChange={(e) => updateField('cubic_feet', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model_number">Model Number</Label>
                    <Input
                      id="model_number"
                      value={editingItem?.model_number || ''}
                      onChange={(e) => updateField('model_number', e.target.value || null)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="delivery_pieces"># Delivery Pieces</Label>
                    <Input
                      id="delivery_pieces"
                      type="number"
                      value={editingItem?.delivery_pieces || 1}
                      onChange={(e) => updateField('delivery_pieces', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_pieces"># Billing Pieces</Label>
                    <Input
                      id="billing_pieces"
                      type="number"
                      value={editingItem?.billing_pieces || 1}
                      onChange={(e) => updateField('billing_pieces', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="people_to_deliver"># People to Deliver</Label>
                    <Input
                      id="people_to_deliver"
                      type="number"
                      value={editingItem?.people_to_deliver || 2}
                      onChange={(e) => updateField('people_to_deliver', parseInt(e.target.value) || 2)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_item_notes">Default Item Notes</Label>
                  <Input
                    id="default_item_notes"
                    value={editingItem?.default_item_notes || ''}
                    onChange={(e) => updateField('default_item_notes', e.target.value || null)}
                    placeholder="Notes that will appear on items of this type"
                  />
                </div>
              </TabsContent>

              <TabsContent value="rates" className="space-y-4 mt-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="assembly_rate">Assembly Rate ($)</Label>
                    <Input
                      id="assembly_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.assembly_rate || ''}
                      onChange={(e) => updateField('assembly_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="same_day_assembly_rate">Same Day Assembly ($)</Label>
                    <Input
                      id="same_day_assembly_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.same_day_assembly_rate || ''}
                      onChange={(e) => updateField('same_day_assembly_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assemblies_in_base_rate">Assemblies in Base Rate</Label>
                    <Input
                      id="assemblies_in_base_rate"
                      type="number"
                      value={editingItem?.assemblies_in_base_rate || 0}
                      onChange={(e) => updateField('assemblies_in_base_rate', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="move_rate">Move Rate ($)</Label>
                    <Input
                      id="move_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.move_rate || ''}
                      onChange={(e) => updateField('move_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inspection_fee">Inspection Fee ($)</Label>
                    <Input
                      id="inspection_fee"
                      type="number"
                      step="0.01"
                      value={editingItem?.inspection_fee || ''}
                      onChange={(e) => updateField('inspection_fee', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receiving_rate">Receiving Rate ($)</Label>
                    <Input
                      id="receiving_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.receiving_rate || ''}
                      onChange={(e) => updateField('receiving_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="storage_rate_per_day">Storage Rate/Day ($)</Label>
                    <Input
                      id="storage_rate_per_day"
                      type="number"
                      step="0.01"
                      value={editingItem?.storage_rate_per_day || ''}
                      onChange={(e) => updateField('storage_rate_per_day', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unstackable_extra_fee">Unstackable Extra Fee ($)</Label>
                    <Input
                      id="unstackable_extra_fee"
                      type="number"
                      step="0.01"
                      value={editingItem?.unstackable_extra_fee || ''}
                      onChange={(e) => updateField('unstackable_extra_fee', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="will_call_rate">Will Call Rate ($)</Label>
                    <Input
                      id="will_call_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.will_call_rate || ''}
                      onChange={(e) => updateField('will_call_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="removal_rate">Removal Rate ($)</Label>
                    <Input
                      id="removal_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.removal_rate || ''}
                      onChange={(e) => updateField('removal_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pull_for_delivery_rate">Pull for Delivery ($)</Label>
                    <Input
                      id="pull_for_delivery_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.pull_for_delivery_rate || ''}
                      onChange={(e) => updateField('pull_for_delivery_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oversize_rate">Oversize Rate ($)</Label>
                    <Input
                      id="oversize_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.oversize_rate || ''}
                      onChange={(e) => updateField('oversize_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="felt_pad_price">Felt Pad Price ($)</Label>
                    <Input
                      id="felt_pad_price"
                      type="number"
                      step="0.01"
                      value={editingItem?.felt_pad_price || ''}
                      onChange={(e) => updateField('felt_pad_price', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra_fee">Extra Fee ($)</Label>
                    <Input
                      id="extra_fee"
                      type="number"
                      step="0.01"
                      value={editingItem?.extra_fee || ''}
                      onChange={(e) => updateField('extra_fee', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pallet_sale_rate">Pallet Sale Rate ($)</Label>
                    <Input
                      id="pallet_sale_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.pallet_sale_rate || ''}
                      onChange={(e) => updateField('pallet_sale_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minor_touchup_rate">Minor Touchup Rate ($)</Label>
                    <Input
                      id="minor_touchup_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.minor_touchup_rate || ''}
                      onChange={(e) => updateField('minor_touchup_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom_packaging_rate">Custom Packaging Rate ($)</Label>
                    <Input
                      id="custom_packaging_rate"
                      type="number"
                      step="0.01"
                      value={editingItem?.custom_packaging_rate || ''}
                      onChange={(e) => updateField('custom_packaging_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="time" className="space-y-4 mt-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="minutes_to_deliver">Minutes to Deliver</Label>
                    <Input
                      id="minutes_to_deliver"
                      type="number"
                      value={editingItem?.minutes_to_deliver || ''}
                      onChange={(e) => updateField('minutes_to_deliver', e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutes_to_move">Minutes to Move</Label>
                    <Input
                      id="minutes_to_move"
                      type="number"
                      value={editingItem?.minutes_to_move || ''}
                      onChange={(e) => updateField('minutes_to_move', e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutes_to_assemble">Minutes to Assemble</Label>
                    <Input
                      id="minutes_to_assemble"
                      type="number"
                      value={editingItem?.minutes_to_assemble || ''}
                      onChange={(e) => updateField('minutes_to_assemble', e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="minutes_to_load">Minutes to Load</Label>
                    <Input
                      id="minutes_to_load"
                      type="number"
                      value={editingItem?.minutes_to_load || ''}
                      onChange={(e) => updateField('minutes_to_load', e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutes_to_inspect">Minutes to Inspect</Label>
                    <Input
                      id="minutes_to_inspect"
                      type="number"
                      value={editingItem?.minutes_to_inspect || ''}
                      onChange={(e) => updateField('minutes_to_inspect', e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutes_to_put_in_warehouse">Minutes to Put in Warehouse</Label>
                    <Input
                      id="minutes_to_put_in_warehouse"
                      type="number"
                      value={editingItem?.minutes_to_put_in_warehouse || ''}
                      onChange={(e) => updateField('minutes_to_put_in_warehouse', e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minutes_per_felt_pad">Minutes per Felt Pad</Label>
                  <Input
                    id="minutes_per_felt_pad"
                    type="number"
                    value={editingItem?.minutes_per_felt_pad || ''}
                    onChange={(e) => updateField('minutes_per_felt_pad', e.target.value ? parseInt(e.target.value) : null)}
                    className="max-w-xs"
                  />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Active</Label>
                      <p className="text-sm text-muted-foreground">
                        Whether this item type can be used
                      </p>
                    </div>
                    <Switch
                      checked={editingItem?.is_active ?? true}
                      onCheckedChange={(checked) => updateField('is_active', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow on Reservation System</Label>
                      <p className="text-sm text-muted-foreground">
                        Can this item be reserved
                      </p>
                    </div>
                    <Switch
                      checked={editingItem?.allow_on_reservation ?? false}
                      onCheckedChange={(checked) => updateField('allow_on_reservation', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notify Dispatch</Label>
                      <p className="text-sm text-muted-foreground">
                        Alert dispatch when handling this item
                      </p>
                    </div>
                    <Switch
                      checked={editingItem?.notify_dispatch ?? false}
                      onCheckedChange={(checked) => updateField('notify_dispatch', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow on Order Entry</Label>
                      <p className="text-sm text-muted-foreground">
                        Can this item be added to orders
                      </p>
                    </div>
                    <Switch
                      checked={editingItem?.allow_on_order_entry ?? true}
                      onCheckedChange={(checked) => updateField('allow_on_order_entry', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Add Assembly Fee</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically add assembly charge
                      </p>
                    </div>
                    <Switch
                      checked={editingItem?.auto_add_assembly_fee ?? false}
                      onCheckedChange={(checked) => updateField('auto_add_assembly_fee', checked)}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Item Types</DialogTitle>
            <DialogDescription>
              {csvData.length} items found in the CSV file.
              {duplicates.length > 0 && (
                <span className="block mt-2 text-yellow-600">
                  {duplicates.length} duplicate(s) detected: {duplicates.slice(0, 3).join(', ')}
                  {duplicates.length > 3 && ` and ${duplicates.length - 3} more`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {duplicates.length > 0 && (
            <div className="space-y-4">
              <Label>How should duplicates be handled?</Label>
              <div className="flex gap-4">
                <Button
                  variant={importAction === 'skip' ? 'default' : 'outline'}
                  onClick={() => setImportAction('skip')}
                >
                  Skip Duplicates
                </Button>
                <Button
                  variant={importAction === 'replace' ? 'default' : 'outline'}
                  onClick={() => setImportAction('replace')}
                >
                  Replace Duplicates
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportConfirm} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
