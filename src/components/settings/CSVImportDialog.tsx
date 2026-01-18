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
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Warehouse } from '@/hooks/useWarehouses';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  warehouses: Warehouse[];
  onSuccess: () => void;
}

interface ParsedLocation {
  code: string;
  name: string;
  type: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

function detectLocationType(code: string): string {
  const upperCode = code.toUpperCase();
  
  // Zones - typically single word descriptive areas
  if (upperCode.includes('DOCK') || upperCode.includes('ZONE') || 
      upperCode === 'IA' || upperCode === 'I-J' || upperCode === 'E-F' || upperCode === 'G-H' ||
      upperCode.includes('OVERFLOW') || upperCode.includes('CAP')) {
    return 'zone';
  }
  
  // Bays - BAY-* pattern or SW*, WW* staging areas
  if (upperCode.startsWith('BAY-') || /^SW\d*$/.test(upperCode) || 
      /^WW\d*$/.test(upperCode)) {
    return 'bay';
  }
  
  // Aisles - *RR.* pattern (rack rows) or EFR*, GHR*, IJR* patterns
  if (/^[A-Z]+RR\.\d+$/.test(upperCode) || /^[A-Z]+R\d+$/.test(upperCode)) {
    return 'aisle';
  }
  
  // Bins - alphanumeric with dots (e.g., A1.2W, B3.4C)
  if (/^[A-Z]\d+\.\d+[WCE]?$/.test(upperCode)) {
    return 'bin';
  }
  
  // Default to bin for unknown patterns
  return 'bin';
}

async function parseFile(file: File): Promise<ParsedLocation[]> {
  const locations: ParsedLocation[] = [];
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    // Parse Excel file
    const buffer = await file.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    // Find header row and column index
    let headerRowIndex = 0;
    let codeColumnIndex = 0;
    
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i] as unknown[];
      if (row) {
        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] || '').toLowerCase();
          if (cell.includes('location') || cell.includes('code') || cell.includes('name')) {
            headerRowIndex = i;
            codeColumnIndex = j;
            break;
          }
        }
      }
    }
    
    // Extract locations starting after header
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as unknown[];
      if (row && row[codeColumnIndex]) {
        const rawCode = String(row[codeColumnIndex]).trim();
        if (rawCode && rawCode.length > 0) {
          const code = rawCode.toUpperCase();
          locations.push({
            code,
            name: '',
            type: detectLocationType(code),
          });
        }
      }
    }
  } else {
    // Parse CSV file
    const content = await file.text();
    const lines = content.trim().split('\n');
    
    // Check if first line is a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('code') || firstLine.includes('name') || firstLine.includes('location');
    const startIndex = hasHeader ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      
      if (parts.length >= 1 && parts[0]) {
        const code = parts[0].toUpperCase();
        const name = parts[1] || '';
        const type = parts[2] || detectLocationType(code);
        
        locations.push({ code, name, type });
      }
    }
  }
  
  return locations;
}

export function CSVImportDialog({
  open,
  onOpenChange,
  file,
  warehouses,
  onSuccess,
}: CSVImportDialogProps) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouses[0]?.id || '');
  const [parsedLocations, setParsedLocations] = useState<ParsedLocation[]>([]);
  const [step, setStep] = useState<'preview' | 'importing' | 'complete'>('preview');
  const [parsing, setParsing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouse) {
      setSelectedWarehouse(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouse]);

  useEffect(() => {
    if (open && file && parsedLocations.length === 0 && !parsing) {
      handleFileRead();
    }
  }, [open, file]);

  const handleFileRead = async () => {
    if (!file) return;
    
    setParsing(true);
    try {
      const locations = await parseFile(file);
      setParsedLocations(locations);
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
    if (!selectedWarehouse || parsedLocations.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a warehouse and ensure there are locations to import.',
      });
      return;
    }

    setStep('importing');
    setImporting(true);
    setProgress(0);

    const batchSize = 50;
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < parsedLocations.length; i += batchSize) {
        const batch = parsedLocations.slice(i, i + batchSize);
        
        const insertData = batch.map((loc) => ({
          code: loc.code,
          name: loc.name || null,
          type: loc.type,
          warehouse_id: selectedWarehouse,
          status: 'active',
        }));

        const { data, error } = await supabase
          .from('locations')
          .upsert(insertData, { onConflict: 'warehouse_id,code', ignoreDuplicates: false })
          .select();

        if (error) {
          failedCount += batch.length;
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
          failedCount += batch.length - (data?.length || 0);
        }

        setProgress(Math.round(((i + batch.length) / parsedLocations.length) * 100));
      }

      setResult({ success: successCount, failed: failedCount, errors });
      setStep('complete');

      if (successCount > 0) {
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${successCount} locations.`,
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
    setParsedLocations([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Locations</DialogTitle>
          <DialogDescription>
            {step === 'preview' && 'Review the locations to be imported.'}
            {step === 'importing' && 'Importing locations...'}
            {step === 'complete' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'preview' && (
          <div className="space-y-4">
            <div>
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

            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Locations found:</span>
                <span className="text-2xl font-bold">
                  {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : parsedLocations.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                File: {file?.name}
              </p>
            </div>

            {parsedLocations.length > 0 && (
              <div className="max-h-[200px] overflow-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLocations.slice(0, 10).map((loc, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{loc.code}</td>
                        <td className="p-2">{loc.type}</td>
                      </tr>
                    ))}
                    {parsedLocations.length > 10 && (
                      <tr className="border-t">
                        <td colSpan={2} className="p-2 text-muted-foreground text-center">
                          ... and {parsedLocations.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Importing locations...</span>
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
              <span className="font-medium">{result.success} locations imported successfully</span>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-3 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
                <span>{result.failed} locations failed to import</span>
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

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={parsedLocations.length === 0 || parsing}>
                Import {parsedLocations.length} Locations
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
