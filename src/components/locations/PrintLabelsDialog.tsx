import { useState, useMemo } from 'react';
import { Location } from '@/hooks/useLocations';
import { Warehouse } from '@/hooks/useWarehouses';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLocationLabelsPDF } from '@/lib/labelGenerator';

interface PrintLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: Location[];
  warehouses: Warehouse[];
}

export function PrintLabelsDialog({
  open,
  onOpenChange,
  locations,
  warehouses,
}: PrintLabelsDialogProps) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const warehouseMap = useMemo(() => {
    return new Map(warehouses.map((w) => [w.id, w]));
  }, [warehouses]);

  const handleGeneratePDF = async () => {
    try {
      setGenerating(true);

      const labelData = locations.map((location) => {
        const warehouse = warehouseMap.get(location.warehouse_id);
        return {
          code: location.code,
          name: location.name || '',
          type: location.type,
          warehouseName: warehouse?.name || '',
          warehouseCode: warehouse?.code || '',
        };
      });

      const pdfBlob = await generateLocationLabelsPDF(labelData);
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `location-labels-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Labels generated',
        description: `${locations.length} label${locations.length !== 1 ? 's' : ''} ready for printing.`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error generating labels:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate labels. Please try again.',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Print Location Labels</DialogTitle>
          <DialogDescription>
            Generate a PDF with QR code labels for the selected locations.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Labels to print:</span>
              <span className="text-2xl font-bold">{locations.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Labels will be generated as 4×6 inch format with QR codes
            </p>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Each label includes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Location code (large)</li>
              <li>Location name (if set)</li>
              <li>Location type</li>
              <li>Warehouse name</li>
              <li>QR code with deep link</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleGeneratePDF} disabled={generating || locations.length === 0}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
