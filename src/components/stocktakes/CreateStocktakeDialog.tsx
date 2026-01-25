import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useLocations } from '@/hooks/useLocations';
import { useAccounts } from '@/hooks/useAccounts';
import { CreateStocktakeData } from '@/hooks/useStocktakes';
import {
  MapPin,
  Loader2,
  Lock,
  Wrench,
  DollarSign,
  Building2,
  X,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateStocktakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateStocktakeData) => Promise<void>;
}

export function CreateStocktakeDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateStocktakeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateStocktakeData>({
    name: '',
    warehouse_id: '',
    location_ids: [],
    freeze_moves: true,
    allow_location_auto_fix: false,
    billable: false,
    include_accounts: [],
    scheduled_date: '',
    notes: '',
  });

  const { warehouses } = useWarehouses();
  const { locations } = useLocations(formData.warehouse_id || undefined);
  const { accounts } = useAccounts();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: '',
        warehouse_id: '',
        location_ids: [],
        freeze_moves: true,
        allow_location_auto_fix: false,
        billable: false,
        include_accounts: [],
        scheduled_date: '',
        notes: '',
      });
    }
  }, [open]);

  // Reset locations when warehouse changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, location_ids: [] }));
  }, [formData.warehouse_id]);

  const handleSubmit = async () => {
    if (!formData.warehouse_id) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        location_ids: formData.location_ids?.length ? formData.location_ids : undefined,
        include_accounts: formData.include_accounts?.length ? formData.include_accounts : undefined,
        scheduled_date: formData.scheduled_date || undefined,
        notes: formData.notes || undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLocation = (locationId: string) => {
    setFormData(prev => ({
      ...prev,
      location_ids: prev.location_ids?.includes(locationId)
        ? prev.location_ids.filter(id => id !== locationId)
        : [...(prev.location_ids || []), locationId],
    }));
  };

  const toggleAccount = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      include_accounts: prev.include_accounts?.includes(accountId)
        ? prev.include_accounts.filter(id => id !== accountId)
        : [...(prev.include_accounts || []), accountId],
    }));
  };

  const selectAllLocations = () => {
    setFormData(prev => ({
      ...prev,
      location_ids: locations.map(l => l.id),
    }));
  };

  const clearAllLocations = () => {
    setFormData(prev => ({
      ...prev,
      location_ids: [],
    }));
  };

  const activeLocations = locations.filter(l => l.is_active !== false);
  const selectedLocationCount = formData.location_ids?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Stocktake</DialogTitle>
          <DialogDescription>
            Set up a new cycle count for selected warehouse locations.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name (Optional)</Label>
                <Input
                  id="name"
                  placeholder="e.g., January Zone A Count"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse *</Label>
                <Select
                  value={formData.warehouse_id}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, warehouse_id: v }))}
                >
                  <SelectTrigger id="warehouse">
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
            </div>

            {/* Location Selection */}
            {formData.warehouse_id && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Locations
                    {selectedLocationCount > 0 && (
                      <Badge variant="secondary">{selectedLocationCount} selected</Badge>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllLocations}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllLocations}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedLocationCount === 0
                    ? 'Leave empty to count entire warehouse'
                    : `${selectedLocationCount} location${selectedLocationCount !== 1 ? 's' : ''} selected`}
                </p>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {activeLocations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No active locations in this warehouse
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {activeLocations.map((location) => {
                        const isSelected = formData.location_ids?.includes(location.id);
                        return (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => toggleLocation(location.id)}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-primary/20 border border-primary'
                                : 'bg-muted/50 border border-transparent hover:bg-muted'
                            )}
                          >
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                            <span className="font-mono truncate">{location.code}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Options */}
            <Accordion type="single" collapsible defaultValue="options">
              <AccordionItem value="options">
                <AccordionTrigger className="text-sm font-medium">
                  Options & Settings
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {/* Freeze Moves */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <Label htmlFor="freeze-moves" className="cursor-pointer">
                            Freeze Moves
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Block all item movements in selected locations until count is complete
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="freeze-moves"
                        checked={formData.freeze_moves}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({ ...prev, freeze_moves: checked }))
                        }
                      />
                    </div>

                    {/* Auto-Fix Location */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Wrench className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <Label htmlFor="auto-fix" className="cursor-pointer">
                            Auto-Fix Locations
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically update item location when found at different location
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="auto-fix"
                        checked={formData.allow_location_auto_fix}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({ ...prev, allow_location_auto_fix: checked }))
                        }
                      />
                    </div>

                    {/* Billable */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <Label htmlFor="billable" className="cursor-pointer">
                            Billable
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Create billing events for scanned items when stocktake is closed
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="billable"
                        checked={formData.billable}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({ ...prev, billable: checked }))
                        }
                      />
                    </div>

                    {/* Account Selection (for billing) */}
                    {formData.billable && (
                      <div className="space-y-2 pl-8">
                        <Label className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Bill Specific Accounts
                          {formData.include_accounts && formData.include_accounts.length > 0 && (
                            <Badge variant="secondary">
                              {formData.include_accounts.length} selected
                            </Badge>
                          )}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Leave empty to bill all accounts with items in selected locations
                        </p>
                        <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                          <div className="space-y-1">
                            {accounts.slice(0, 20).map((account) => {
                              const isSelected = formData.include_accounts?.includes(account.id);
                              return (
                                <button
                                  key={account.id}
                                  type="button"
                                  onClick={() => toggleAccount(account.id)}
                                  className={cn(
                                    'flex items-center gap-2 w-full p-2 rounded-md text-left text-sm transition-colors',
                                    isSelected
                                      ? 'bg-primary/20'
                                      : 'hover:bg-muted'
                                  )}
                                >
                                  <Checkbox checked={isSelected} className="pointer-events-none" />
                                  <span className="truncate">{account.account_name}</span>
                                  <span className="text-muted-foreground text-xs">
                                    ({account.account_code})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scheduled Date */}
                    <div className="space-y-2">
                      <Label htmlFor="scheduled-date">Scheduled Date (Optional)</Label>
                      <Input
                        id="scheduled-date"
                        type="date"
                        value={formData.scheduled_date || ''}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))
                        }
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any additional notes..."
                        value={formData.notes || ''}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, notes: e.target.value }))
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Summary */}
            {formData.warehouse_id && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Summary</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Warehouse: {warehouses.find(w => w.id === formData.warehouse_id)?.name}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Locations: {selectedLocationCount === 0 ? 'Entire warehouse' : `${selectedLocationCount} selected`}
                  </li>
                  <li className="flex items-center gap-2">
                    {formData.freeze_moves ? (
                      <Lock className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    Freeze moves: {formData.freeze_moves ? 'Yes' : 'No'}
                  </li>
                  <li className="flex items-center gap-2">
                    {formData.allow_location_auto_fix ? (
                      <Wrench className="h-4 w-4 text-blue-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    Auto-fix: {formData.allow_location_auto_fix ? 'Yes' : 'No'}
                  </li>
                  <li className="flex items-center gap-2">
                    {formData.billable ? (
                      <DollarSign className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    Billable: {formData.billable ? 'Yes' : 'No'}
                  </li>
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.warehouse_id}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Stocktake
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
