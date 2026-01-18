import { useState, useEffect } from 'react';
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
import { Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseFileToRows, canonicalizeHeader, parseNumber } from '@/lib/importUtils';

interface ShipmentItemsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  itemTypes: { id: string; name: string }[];
  onImport: (items: ParsedShipmentItem[]) => void;
}

export interface ParsedShipmentItem {
  quantity: number;
  vendor: string;
  description: string;
  item_type_id: string;
  sidemark: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// Header aliases for shipment item imports
const SHIPMENT_ITEM_HEADER_ALIASES: Record<string, string> = {
  quantity: 'quantity',
  qty: 'quantity',
  count: 'quantity',
  number: 'quantity',
  vendor: 'vendor',
  vendor_name: 'vendor',
  supplier: 'vendor',
  manufacturer: 'vendor',
  description: 'description',
  item_description: 'description',
  desc: 'description',
  item_type: 'item_type',
  type: 'item_type',
  category: 'item_type',
  item_type_name: 'item_type',
  sidemark: 'sidemark',
  side_mark: 'sidemark',
  mark: 'sidemark',
  tag: 'sidemark',
  label: 'sidemark',
};

export function ShipmentItemsImportDialog({
  open,
  onOpenChange,
  file,
  itemTypes,
  onImport,
}: ShipmentItemsImportDialogProps) {
  const { toast } = useToast();
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedShipmentItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (open && file) {
      parseFile(file);
    } else {
      setParsedItems([]);
      setParseErrors([]);
      setImportResult(null);
    }
  }, [open, file]);

  const parseFile = async (file: File) => {
    setParsing(true);
    setParsedItems([]);
    setParseErrors([]);
    setImportResult(null);

    try {
      const { headers, rows } = await parseFileToRows(file);

      if (rows.length === 0) {
        setParseErrors(['No data rows found in file']);
        setParsing(false);
        return;
      }

      // Map headers to field names
      const mappedHeaders = headers.map((h) => {
        const canonical = canonicalizeHeader(h);
        return SHIPMENT_ITEM_HEADER_ALIASES[canonical] || null;
      });

      // Check for required headers
      if (!mappedHeaders.includes('vendor')) {
        setParseErrors(['Missing required column: Vendor']);
        setParsing(false);
        return;
      }

      const items: ParsedShipmentItem[] = [];
      const errors: string[] = [];
      let successCount = 0;
      let failedCount = 0;

      // Create a map of item type names to IDs (case-insensitive)
      const itemTypeMap = new Map<string, string>();
      itemTypes.forEach((type) => {
        itemTypeMap.set(type.name.toLowerCase(), type.id);
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Account for 1-based indexing and header row

        try {
          const item: Record<string, unknown> = {};
          mappedHeaders.forEach((field, colIdx) => {
            if (field && row[colIdx] !== undefined) {
              item[field] = row[colIdx];
            }
          });

          // Parse quantity
          const quantity = parseNumber(item.quantity) || 1;
          if (quantity < 1) {
            throw new Error('Quantity must be at least 1');
          }

          // Get vendor (required)
          const vendor = String(item.vendor || '').trim();
          if (!vendor) {
            throw new Error('Vendor is required');
          }

          // Get description
          const description = String(item.description || '').trim();

          // Get sidemark
          const sidemark = String(item.sidemark || '').trim();

          // Match item type by name
          let itemTypeId = '';
          if (item.item_type) {
            const typeName = String(item.item_type).trim().toLowerCase();
            if (typeName && itemTypeMap.has(typeName)) {
              itemTypeId = itemTypeMap.get(typeName) || '';
            }
          }

          items.push({
            quantity,
            vendor,
            description,
            item_type_id: itemTypeId,
            sidemark,
          });
          successCount++;
        } catch (error: unknown) {
          failedCount++;
          const message = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Row ${rowNum}: ${message}`);
        }
      }

      setParsedItems(items);
      setParseErrors(errors);
      setImportResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10), // Limit displayed errors
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      setParseErrors(['Failed to parse file. Please check the format.']);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = () => {
    if (parsedItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No items to import',
        description: 'The file contains no valid items to import.',
      });
      return;
    }

    onImport(parsedItems);
    
    if (importResult) {
      if (importResult.failed === 0) {
        toast({
          title: 'Import Successful',
          description: `Successfully added ${importResult.success} items.`,
        });
      } else if (importResult.success > 0) {
        toast({
          variant: 'default',
          title: 'Partial Import',
          description: `Added ${importResult.success} items. ${importResult.failed} rows had errors.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: `All ${importResult.failed} rows had errors.`,
        });
      }
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Shipment Items</DialogTitle>
          <DialogDescription>
            Import items from a CSV or Excel file. Required column: Vendor
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {parsing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Parsing file...</span>
              </div>
              <Progress value={50} />
            </div>
          )}

          {!parsing && parseErrors.length > 0 && parsedItems.length === 0 && (
            <div className="rounded-md bg-destructive/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error parsing file</p>
                  <ul className="mt-2 text-sm text-destructive/80 list-disc list-inside">
                    {parseErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!parsing && importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-md bg-green-50 p-4 border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Ready to import</p>
                      <p className="text-sm text-green-600">{importResult.success} items</p>
                    </div>
                  </div>
                </div>

                {importResult.failed > 0 && (
                  <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-800">Errors</p>
                        <p className="text-sm text-amber-600">{importResult.failed} rows skipped</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="rounded-md bg-muted p-3 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium mb-1">Error details:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parsedItems.length > 0 && (
                <div className="rounded-md border p-3 max-h-48 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Preview (first 5 items):</p>
                  <div className="space-y-2">
                    {parsedItems.slice(0, 5).map((item, i) => (
                      <div key={i} className="text-xs bg-muted/50 p-2 rounded">
                        <span className="font-medium">Qty: {item.quantity}</span>
                        <span className="mx-2">|</span>
                        <span>{item.vendor}</span>
                        {item.description && (
                          <>
                            <span className="mx-2">|</span>
                            <span className="text-muted-foreground">{item.description}</span>
                          </>
                        )}
                      </div>
                    ))}
                    {parsedItems.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ...and {parsedItems.length - 5} more items
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsing || parsedItems.length === 0}
          >
            {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {parsedItems.length} Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
