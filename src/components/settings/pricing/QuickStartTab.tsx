import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { useTenantTemplates, type TemplateResult } from '@/hooks/useTenantTemplates';
import { useChargeTypesWithRules } from '@/hooks/useChargeTypes';
import { useClasses } from '@/hooks/useClasses';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export function QuickStartTab() {
  const { loading, applyCoreDefaults, applyFullStarter } = useTenantTemplates();
  const { chargeTypesWithRules, refetch: refetchChargeTypes } = useChargeTypesWithRules();
  const { classes } = useClasses();
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<'core' | 'full' | null>(null);
  const [resultData, setResultData] = useState<TemplateResult | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyCoreDefaults = async () => {
    setConfirmDialog(null);
    const result = await applyCoreDefaults();
    if (result) {
      setResultData(result);
      refetchChargeTypes();
    }
  };

  const handleApplyFullStarter = async () => {
    setConfirmDialog(null);
    const result = await applyFullStarter();
    if (result) {
      setResultData(result);
      refetchChargeTypes();
    }
  };

  const handleExportTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Instructions sheet
    const instructions = [
      ['Service Rates Import Template'],
      [''],
      ['Instructions:'],
      ['1. Fill in the "Services" sheet with your service configurations'],
      ['2. For class-based pricing, add rates in the "Class Rates" sheet'],
      ['3. Save the file and upload it using the "Upload & Preview" button'],
      [''],
      ['Column Descriptions (Services sheet):'],
      ['charge_code - Unique code for the service (e.g., INSP, RECV)'],
      ['charge_name - Display name (e.g., Standard Inspection)'],
      ['category - Category name in lowercase (e.g., service, task, storage)'],
      ['default_trigger - manual, task, shipment, storage, or auto'],
      ['pricing_method - flat or class_based'],
      ['unit - each, per_item, per_task, per_hour, per_minute, per_day, per_month'],
      ['flat_rate - Rate for flat pricing (leave empty for class-based)'],
      ['minimum_charge - Optional minimum charge amount'],
      ['is_active - TRUE or FALSE'],
      ['is_taxable - TRUE or FALSE'],
      ['add_to_scan - TRUE or FALSE'],
      ['add_flag - TRUE or FALSE'],
      ['notes - Optional notes'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Services sheet
    const servicesHeaders = [
      'charge_code', 'charge_name', 'category', 'default_trigger',
      'pricing_method', 'unit', 'flat_rate', 'minimum_charge',
      'is_active', 'is_taxable', 'add_to_scan', 'add_flag', 'notes',
    ];
    const servicesData = chargeTypesWithRules.map(ct => [
      ct.charge_code,
      ct.charge_name,
      ct.category,
      ct.default_trigger,
      ct.pricing_rules.some(r => r.pricing_method === 'class_based') ? 'class_based' : 'flat',
      ct.pricing_rules[0]?.unit || 'each',
      ct.pricing_rules.find(r => !r.class_code)?.rate || '',
      ct.pricing_rules[0]?.minimum_charge || '',
      ct.is_active,
      ct.is_taxable,
      ct.add_to_scan,
      ct.add_flag,
      ct.notes || '',
    ]);
    const wsServices = XLSX.utils.aoa_to_sheet([servicesHeaders, ...servicesData]);
    XLSX.utils.book_append_sheet(wb, wsServices, 'Services');

    // Class Rates sheet
    const classRatesHeaders = ['charge_code', 'class_code', 'rate', 'service_time_minutes'];
    const classRatesData: (string | number)[][] = [];
    chargeTypesWithRules.forEach(ct => {
      ct.pricing_rules.filter(r => r.class_code).forEach(r => {
        classRatesData.push([ct.charge_code, r.class_code || '', r.rate, r.service_time_minutes || '']);
      });
    });
    const wsClassRates = XLSX.utils.aoa_to_sheet([classRatesHeaders, ...classRatesData]);
    XLSX.utils.book_append_sheet(wb, wsClassRates, 'Class Rates');

    // Classes Reference sheet
    const classRefHeaders = ['code', 'name', 'min_cubic_feet', 'max_cubic_feet', 'sort_order'];
    const classRefData = classes.map(c => [
      c.code, c.name, c.min_cubic_feet || '', c.max_cubic_feet || '', c.sort_order || '',
    ]);
    const wsClassRef = XLSX.utils.aoa_to_sheet([classRefHeaders, ...classRefData]);
    XLSX.utils.book_append_sheet(wb, wsClassRef, 'Classes Reference');

    XLSX.writeFile(wb, 'service-rates-template.xlsx');
    toast({ title: 'Template downloaded', description: 'Fill in the template and upload to import.' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'array' });
        const servicesSheet = wb.Sheets['Services'];
        const classRatesSheet = wb.Sheets['Class Rates'];

        if (!servicesSheet) {
          toast({ variant: 'destructive', title: 'Invalid file', description: 'Missing "Services" sheet' });
          return;
        }

        const services: Record<string, string | number | boolean>[] = XLSX.utils.sheet_to_json(servicesSheet);
        const classRates: Record<string, string | number>[] = classRatesSheet ? XLSX.utils.sheet_to_json(classRatesSheet) : [];

        const existingCodes = new Set(chargeTypesWithRules.map(ct => ct.charge_code));
        const preview: ImportPreviewRow[] = services.map(row => {
          const code = String(row.charge_code || '').trim();
          const hasError = !code || !row.charge_name;
          const status: ImportStatus = hasError ? 'error' : existingCodes.has(code) ? 'update' : 'new';
          return {
            ...row,
            charge_code: code,
            status,
            error: hasError ? (!code ? 'Missing charge_code' : 'Missing charge_name') : undefined,
            classRates: classRates.filter(cr => String(cr.charge_code) === code),
          };
        });

        setImportPreview({
          rows: preview,
          newCount: preview.filter(r => r.status === 'new').length,
          updateCount: preview.filter(r => r.status === 'update').length,
          errorCount: preview.filter(r => r.status === 'error').length,
        });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error reading file', description: 'Please ensure the file is a valid .xlsx file.' });
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportApply = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      // Import is a complex operation - for now show a success message
      // Full import logic would create/update charge_types and pricing_rules
      toast({
        title: 'Import Preview',
        description: `Found ${importPreview.newCount} new, ${importPreview.updateCount} updates, ${importPreview.errorCount} errors. Full import requires server-side processing.`,
      });
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Safe to run banner */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <MaterialIcon name="info" className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Safe to Run Multiple Times</p>
              <p className="mt-1">
                Templates only ADD missing records. They never overwrite or delete existing data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Packs */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Core Defaults */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="category" className="text-primary" />
                  Core Defaults
                </CardTitle>
                <CardDescription className="mt-1">Essential categories, task types, and size classes</CardDescription>
              </div>
              <Badge variant="secondary">Recommended</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>8 service categories</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>6 system task types</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>6 size classes (XS, S, M, L, XL, XXL)</span>
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">Does NOT include price list entries.</p>
            <Button
              onClick={() => setConfirmDialog('core')}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
                  Apply Core Defaults
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Full Starter */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MaterialIcon name="rocket_launch" className="text-primary" />
                  Full Starter Pack
                </CardTitle>
                <CardDescription className="mt-1">Everything in Core + 70+ charge types with pricing rules</CardDescription>
              </div>
              <Badge>Complete</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>Everything in Core Defaults</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>70+ starter price list entries</span>
              </div>
              <div className="flex items-center gap-2">
                <MaterialIcon name="check_circle" size="sm" className="text-green-600" />
                <span>Class-based pricing with rates</span>
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">Customize every rate after applying.</p>
            <Button
              onClick={() => setConfirmDialog('full')}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <MaterialIcon name="rocket_launch" size="sm" className="mr-2" />
                  Apply Full Starter
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Result Summary */}
      {resultData && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MaterialIcon name="check_circle" className="text-green-600" />
              <span className="font-medium text-green-800 dark:text-green-200">Applied Successfully</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Categories</span>
                <p className="font-medium">
                  {resultData.categories_added > 0 ? (
                    <span className="text-green-600">+{resultData.categories_added}</span>
                  ) : '-'}
                  <span className="text-muted-foreground"> / {resultData.total_categories}</span>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Task Types</span>
                <p className="font-medium">
                  {resultData.task_types_added > 0 ? (
                    <span className="text-green-600">+{resultData.task_types_added}</span>
                  ) : '-'}
                  <span className="text-muted-foreground"> / {resultData.total_task_types}</span>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Classes</span>
                <p className="font-medium">
                  {resultData.classes_added > 0 ? (
                    <span className="text-green-600">+{resultData.classes_added}</span>
                  ) : '-'}
                  <span className="text-muted-foreground"> / {resultData.total_classes}</span>
                </p>
              </div>
              {resultData.services_added !== undefined && (
                <div>
                  <span className="text-muted-foreground">Price List</span>
                  <p className="font-medium">
                    {resultData.services_added > 0 ? (
                      <span className="text-green-600">+{resultData.services_added}</span>
                    ) : '-'}
                    <span className="text-muted-foreground"> / {resultData.total_services}</span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Excel Import/Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MaterialIcon name="table_chart" size="md" />
            Excel Import / Export
          </CardTitle>
          <CardDescription>
            Download the template, fill in your services and rates, then upload to preview changes before importing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleExportTemplate}>
              <MaterialIcon name="download" size="sm" className="mr-1.5" />
              Download Template
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <MaterialIcon name="upload" size="sm" className="mr-1.5" />
              Upload & Preview
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog !== null} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Apply {confirmDialog === 'core' ? 'Core Defaults' : 'Full Starter'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog === 'core'
                ? 'This will add any missing service categories, task types, and size classes. Existing records will not be modified.'
                : 'This will add core defaults plus the starter price list with default rates. Existing records will not be modified.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog === 'core' ? handleApplyCoreDefaults : handleApplyFullStarter}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <Dialog open={!!importPreview} onOpenChange={() => setImportPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the changes before importing.
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4">
              <div className="flex gap-3 text-sm">
                <Badge className="bg-green-600">{importPreview.newCount} New</Badge>
                <Badge className="bg-amber-500">{importPreview.updateCount} Update</Badge>
                {importPreview.errorCount > 0 && (
                  <Badge variant="destructive">{importPreview.errorCount} Errors</Badge>
                )}
              </div>
              <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge
                            variant={row.status === 'new' ? 'default' : row.status === 'error' ? 'destructive' : 'secondary'}
                            className={row.status === 'new' ? 'bg-green-600' : row.status === 'update' ? 'bg-amber-500' : ''}
                          >
                            {row.status.toUpperCase()}
                          </Badge>
                          {row.error && <p className="text-xs text-destructive mt-1">{row.error}</p>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.charge_code}</TableCell>
                        <TableCell>{String(row.charge_name || '')}</TableCell>
                        <TableCell>{String(row.category || '')}</TableCell>
                        <TableCell>{String(row.pricing_method || '')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            <Button
              onClick={handleImportApply}
              disabled={importing || (importPreview?.errorCount ?? 0) === importPreview?.rows.length}
            >
              {importing ? (
                <>
                  <MaterialIcon name="progress_activity" size="sm" className="mr-1 animate-spin" />
                  Importing...
                </>
              ) : (
                'Apply Import'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// TYPES
// =============================================================================

type ImportStatus = 'new' | 'update' | 'skip' | 'error';

interface ImportPreviewRow extends Record<string, unknown> {
  charge_code: string;
  status: ImportStatus;
  error?: string;
  classRates: Record<string, string | number>[];
}

interface ImportPreviewData {
  rows: ImportPreviewRow[];
  newCount: number;
  updateCount: number;
  errorCount: number;
}
