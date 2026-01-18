import { useState } from 'react';
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
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Warehouse } from '@/hooks/useWarehouses';

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
  parentCode?: string;
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
      upperCode === 'IA' || upperCode === 'I-J' || upperCode === 'E-F' || upperCode === 'G-H') {
    return 'zone';
  }
  
  // Bays - BAY-* pattern or SW*, WW* staging areas
  if (upperCode.startsWith('BAY-') || /^[SW][W]?\d+$/.test(upperCode) || 
      /^W[W]\d+$/.test(upperCode)) {
    return 'bay';
  }
  
  // Aisles - *RR.* pattern (rack rows)
  if (/^[A-Z]+RR\.\d+$/.test(upperCode)) {
    return 'aisle';
  }
  
  // Bins - alphanumeric with dots (e.g., A1.2W, B3.4C)
  if (/^[A-Z]\d+\.\d+[WCE]?$/.test(upperCode)) {
    return 'bin';
  }
  
  // Default to bin for unknown patterns
  return 'bin';
}

function parseCSV(content: string): ParsedLocation[] {
  const lines = content.trim().split('\n');
  const locations: ParsedLocation[] = [];
  
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
      const parentCode = parts[3] || '';
      
      locations.push({ code, name, type, parentCode });
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
  const { toast } = useToast();

  const handleFileRead = async () => {
    if (!file) return;
    
    const content = await file.text();
    const locations = parseCSV(content);
    setParsedLocations(locations);
  };

  // Read file when dialog opens
  useState(() => {
    if (open && file) {
      handleFileRead();
    }
  });

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

  // Re-read file when it changes
  if (open && file && parsedLocations.length === 0) {
    handleFileRead();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Locations from CSV</DialogTitle>
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
              <select
                className="w-full mt-1 border rounded-md p-2"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Locations found:</span>
                <span className="text-2xl font-bold">{parsedLocations.length}</span>
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
              <Button onClick={handleImport} disabled={parsedLocations.length === 0}>
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
