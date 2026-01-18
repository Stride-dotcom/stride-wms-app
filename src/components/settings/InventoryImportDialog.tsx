import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Warehouse } from '@/hooks/useWarehouses';
import { Location } from '@/hooks/useLocations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InventoryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  warehouses: Warehouse[];
  locations: Location[];
  onSuccess: () => void;
}

interface ParsedItem {
  quantity: number;
  boxCount?: number;
  vendor: string;
  description: string;
  itemCode: string;
  locationCode: string;
  project: string;
  room: string;
  photoUrl: string;
  inspectionNotes: string;
  assemblyStatus: string;
  itemNotes: string;
  tech: string;
  repairStatus: string;
  dateRepaired: string;
  dateReceived: string;
  dateReleased: string;
  size: number;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  skipped: number;
}

// Column header mappings (case-insensitive)
const COLUMN_MAP: Record<string, keyof ParsedItem> = {
  'qty': 'quantity',
  'quantity': 'quantity',
  'box cnt': 'boxCount',
  'box count': 'boxCount',
  'vendor': 'vendor',
  'description': 'description',
  'id#': 'itemCode',
  'id': 'itemCode',
  'item code': 'itemCode',
  'item_code': 'itemCode',
  'location': 'locationCode',
  'project': 'project',
  'room': 'room',
  'photos': 'photoUrl',
  'photo': 'photoUrl',
  'photo url': 'photoUrl',
  'inspection notes': 'inspectionNotes',
  'inspection': 'inspectionNotes',
  'assembly status': 'assemblyStatus',
  'assembly': 'assemblyStatus',
  'item notes': 'itemNotes',
  'notes': 'itemNotes',
  'tech': 'tech',
  'technician': 'tech',
  'repair status': 'repairStatus',
  'repair': 'repairStatus',
  'date repaired': 'dateRepaired',
  'date received': 'dateReceived',
  'received': 'dateReceived',
  'date released': 'dateReleased',
  'released': 'dateReleased',
  'size': 'size',
};

function parseAssemblyStatus(value: string): string | null {
  if (!value) return null;
  const upper = value.toUpperCase().trim();
  if (upper.includes('NEEDS') || upper.includes('REQUIRED') || upper === 'YES') return 'in_queue';
  if (upper.includes('NO') || upper.includes('N/A') || upper === 'NO ASSM REQ') return 'not_required';
  if (upper.includes('COMPLETE') || upper.includes('DONE')) return 'complete';
  if (upper.includes('DO NOT')) return 'not_required';
  return null;
}

function parseRepairStatus(value: string): string | null {
  if (!value) return null;
  const upper = value.toUpperCase().trim();
  if (upper === 'OK' || upper === 'COMPLETE' || upper === 'DONE') return 'complete';
  if (upper.includes('NEEDS') || upper.includes('REQUIRED')) return 'in_queue';
  return null;
}

function parseDate(value: string | number): string | null {
  if (!value) return null;
  
  // Handle Excel date serial numbers
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date.toISOString();
  }
  
  // Handle string dates
  const str = String(value).trim();
  if (!str) return null;
  
  // Try parsing common formats: M/D/YYYY, M/D/YY, YYYY-MM-DD
  const parts = str.split('/');
  if (parts.length === 3) {
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000; // Handle 2-digit years
    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  // Try standard Date parsing
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  return null;
}

function extractPhotoUrl(value: string): string | null {
  if (!value) return null;
  
  // Extract URL from markdown link format [text](url) or plain URL
  const markdownMatch = value.match(/\]\((https?:\/\/[^)]+)\)/);
  if (markdownMatch) return markdownMatch[1];
  
  // Match plain URLs
  const urlMatch = value.match(/(https?:\/\/[^\s<>)"]+)/);
  if (urlMatch) return urlMatch[1];
  
  return null;
}

async function parseFile(file: File): Promise<{ items: ParsedItem[]; headers: string[] }> {
  const items: ParsedItem[] = [];
  const fileName = file.name.toLowerCase();
  let headers: string[] = [];
  
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  
  if (data.length < 2) return { items: [], headers: [] };
  
  // Find header row (first row with recognizable column names)
  let headerRowIndex = 0;
  let columnIndices: Record<keyof ParsedItem, number> = {} as Record<keyof ParsedItem, number>;
  
  for (let i = 0; i < Math.min(data.length, 5); i++) {
    const row = data[i];
    if (!row) continue;
    
    const tempIndices: Record<string, number> = {};
    let matchCount = 0;
    
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase().trim();
      // Remove HTML tags and parenthetical content
      const cleanCell = cell.replace(/<[^>]*>/g, '').replace(/\([^)]*\)/g, '').trim();
      
      for (const [key, mappedKey] of Object.entries(COLUMN_MAP)) {
        if (cleanCell === key || cleanCell.includes(key)) {
          tempIndices[mappedKey] = j;
          matchCount++;
          break;
        }
      }
    }
    
    if (matchCount >= 3) { // Found at least 3 matching columns
      headerRowIndex = i;
      columnIndices = tempIndices as Record<keyof ParsedItem, number>;
      headers = row.map(c => String(c || ''));
      break;
    }
  }
  
  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    const getValue = (key: keyof ParsedItem): string => {
      const idx = columnIndices[key];
      if (idx === undefined) return '';
      return String(row[idx] || '').trim();
    };
    
    const getNumValue = (key: keyof ParsedItem): number => {
      const idx = columnIndices[key];
      if (idx === undefined) return 0;
      const val = row[idx];
      if (typeof val === 'number') return val;
      return parseInt(String(val || '0')) || 0;
    };
    
    const itemCode = getValue('itemCode');
    const quantity = getNumValue('quantity');
    
    // Skip empty rows or rows without item code
    if (!itemCode && quantity === 0) continue;
    
    items.push({
      quantity: quantity || 1,
      boxCount: getNumValue('boxCount'),
      vendor: getValue('vendor'),
      description: getValue('description'),
      itemCode,
      locationCode: getValue('locationCode').toUpperCase(),
      project: getValue('project'),
      room: getValue('room'),
      photoUrl: getValue('photoUrl'),
      inspectionNotes: getValue('inspectionNotes'),
      assemblyStatus: getValue('assemblyStatus'),
      itemNotes: getValue('itemNotes'),
      tech: getValue('tech'),
      repairStatus: getValue('repairStatus'),
      dateRepaired: getValue('dateRepaired'),
      dateReceived: getValue('dateReceived'),
      dateReleased: getValue('dateReleased'),
      size: getNumValue('size'),
    });
  }
  
  return { items, headers };
}

export function InventoryImportDialog({
  open,
  onOpenChange,
  file,
  warehouses,
  locations,
  onSuccess,
}: InventoryImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0]?.id || '');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<'preview' | 'importing' | 'complete'>('preview');
  const [parsing, setParsing] = useState(false);
  const { toast } = useToast();

  // Create a location lookup map
  const locationMap = new Map<string, string>();
  locations.forEach(loc => {
    locationMap.set(loc.code.toUpperCase(), loc.id);
  });

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouse) {
      setSelectedWarehouse(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouse]);

  useEffect(() => {
    if (open && file && parsedItems.length === 0 && !parsing) {
      handleFileRead();
    }
  }, [open, file]);

  const handleFileRead = async () => {
    if (!file) return;
    
    setParsing(true);
    try {
      const { items, headers: parsedHeaders } = await parseFile(file);
      setParsedItems(items);
      setHeaders(parsedHeaders);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to parse the file. Please check the format.',
      });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedWarehouse || parsedItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a warehouse and ensure there are items to import.',
      });
      return;
    }

    // Get tenant_id from the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to import items.',
      });
      return;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not determine your organization.',
      });
      return;
    }

    setStep('importing');
    setImporting(true);
    setProgress(0);

    const batchSize = 25;
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < parsedItems.length; i += batchSize) {
        const batch = parsedItems.slice(i, i + batchSize);
        
        const insertData = batch
          .filter(item => item.itemCode) // Skip items without item code
          .map((item) => {
            const locationId = locationMap.get(item.locationCode);
            const photoUrl = extractPhotoUrl(item.photoUrl);
            
            return {
              tenant_id: profile.tenant_id,
              warehouse_id: selectedWarehouse,
              item_code: item.itemCode,
              description: item.description || null,
              vendor: item.vendor || null,
              quantity: item.quantity || 1,
              size: item.size || null,
              current_location_id: locationId || null,
              sidemark: item.project || null,
              status: item.dateReleased ? 'released' : 'in_storage',
              assembly_status: parseAssemblyStatus(item.assemblyStatus),
              repair_status: parseRepairStatus(item.repairStatus),
              received_at: parseDate(item.dateReceived),
              primary_photo_url: photoUrl,
              photo_urls: photoUrl ? [photoUrl] : null,
              metadata: {
                room: item.room || null,
                box_count: item.boxCount || null,
                inspection_notes: item.inspectionNotes || null,
                item_notes: item.itemNotes || null,
                tech: item.tech || null,
                date_repaired: item.dateRepaired || null,
                date_released: item.dateReleased || null,
                imported_from: file?.name || 'excel_import',
              },
            };
          });

        skippedCount += batch.length - insertData.length;

        if (insertData.length === 0) {
          setProgress(Math.round(((i + batch.length) / parsedItems.length) * 100));
          continue;
        }

        const { data, error } = await supabase
          .from('items')
          .upsert(insertData, { onConflict: 'tenant_id,item_code', ignoreDuplicates: false })
          .select();

        if (error) {
          failedCount += insertData.length;
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          failedCount += insertData.length - (data?.length || 0);
        }

        setProgress(Math.round(((i + batch.length) / parsedItems.length) * 100));
      }

      setResult({ success: successCount, failed: failedCount, errors, skipped: skippedCount });
      setStep('complete');

      if (successCount > 0) {
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${successCount} items.`,
        });
        onSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'An unexpected error occurred during import.',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('preview');
    setProgress(0);
    setResult(null);
    setParsedItems([]);
    setHeaders([]);
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    window.open('/inventory-template.csv', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Inventory</DialogTitle>
          <DialogDescription>
            {step === 'preview' && 'Review the items to be imported.'}
            {step === 'importing' && 'Importing inventory items...'}
            {step === 'complete' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-sm font-medium">Target Warehouse</label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="ml-4 mt-6" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Items found:</span>
                  <span className="text-2xl font-bold">
                    {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : parsedItems.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  File: {file?.name}
                </p>
                {headers.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Columns detected: {headers.filter(h => h).slice(0, 6).join(', ')}
                    {headers.filter(h => h).length > 6 && '...'}
                  </p>
                )}
              </div>

              {parsedItems.length > 0 && (
                <ScrollArea className="h-[250px] border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">ID#</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">Vendor</th>
                        <th className="text-left p-2">Location</th>
                        <th className="text-left p-2">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedItems.slice(0, 20).map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-mono text-xs">{item.itemCode}</td>
                          <td className="p-2 max-w-[150px] truncate">{item.description}</td>
                          <td className="p-2 max-w-[100px] truncate">{item.vendor}</td>
                          <td className="p-2 font-mono text-xs">
                            {item.locationCode}
                            {item.locationCode && !locationMap.has(item.locationCode) && (
                              <span className="text-amber-500 ml-1" title="Location not found">⚠</span>
                            )}
                          </td>
                          <td className="p-2">{item.quantity}</td>
                        </tr>
                      ))}
                      {parsedItems.length > 20 && (
                        <tr className="border-t">
                          <td colSpan={5} className="p-2 text-muted-foreground text-center">
                            ... and {parsedItems.length - 20} more
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              )}

              {parsedItems.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  ⚠ Items with unrecognized locations will be imported without a location assignment.
                </p>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>Importing items...</span>
              </div>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">
                {progress}% complete
              </p>
            </div>
          )}

          {step === 'complete' && result && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle className="h-6 w-6" />
                <span className="font-medium">{result.success} items imported successfully</span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <AlertTriangle className="h-6 w-6" />
                  <span>{result.skipped} items skipped (no item code)</span>
                </div>
              )}
              {result.failed > 0 && (
                <div className="flex items-center gap-3 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                  <span>{result.failed} items failed to import</span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950 rounded-md p-3 max-h-[100px] overflow-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-sm text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={parsedItems.length === 0 || parsing}>
                Import {parsedItems.length} Items
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
