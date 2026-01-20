import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Plus, FileSpreadsheet, Trash2, Save, X, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { populateRateCardFromItemTypes } from '@/lib/billingRates';
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
import { useIsMobile } from '@/hooks/use-mobile';
import {
  MobileDataCard,
  MobileDataCardHeader,
  MobileDataCardTitle,
  MobileDataCardDescription,
  MobileDataCardContent,
  MobileDataCardActions,
} from '@/components/ui/mobile-data-card';

interface RateRow {
  id: string;
  rate_card_id: string;
  rate_card_name: string;
  rate_card_code: string;
  service_type: string;
  rate: number;
  category: string | null;
  charge_unit: string | null;
  item_type_id: string | null;
  item_type_name: string | null;
  is_taxable: boolean;
  isNew?: boolean;
}

interface RateCard {
  id: string;
  rate_card_code: string;
  rate_card_name: string;
}

const SERVICE_OPTIONS = [
  { value: 'receiving', label: 'Receiving', category: 'item_service' },
  { value: 'shipping', label: 'Shipping', category: 'item_service' },
  { value: 'assembly', label: 'Assembly', category: 'item_service' },
  { value: 'inspection', label: 'Inspection', category: 'item_service' },
  { value: 'repair', label: 'Repair', category: 'item_service' },
  { value: 'storage', label: 'Storage', category: 'item_service' },
  { value: 'will_call', label: 'Will Call', category: 'item_service' },
  { value: 'disposal', label: 'Disposal', category: 'item_service' },
  { value: 'picking', label: 'Picking', category: 'item_service' },
  { value: 'packing', label: 'Packing', category: 'item_service' },
  { value: 'pull_for_delivery', label: 'Pull for Delivery', category: 'item_service' },
  { value: 'custom_packaging', label: 'Custom Packaging', category: 'item_service' },
  { value: 'pallet_sale', label: 'Pallet Sale', category: 'item_service' },
  { value: 'oversized', label: 'Oversized', category: 'accessorial' },
  { value: 'overweight', label: 'Overweight', category: 'accessorial' },
  { value: 'unstackable', label: 'Unstackable', category: 'accessorial' },
  { value: 'crate_disposal', label: 'Crate Disposal', category: 'accessorial' },
  { value: 'minor_touchup', label: 'Minor Touch Up', category: 'accessorial' },
  { value: 'received_without_id', label: 'Received Without ID', category: 'accessorial' },
];

const toLabel = (serviceType: string) => {
  const found = SERVICE_OPTIONS.find(o => o.value === serviceType);
  if (found) return found.label;
  return serviceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export function RateSheetsSettingsTab() {
  const isMobile = useIsMobile();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRates, setEditingRates] = useState<Record<string, Partial<RateRow>>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRate, setDeletingRate] = useState<RateRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch rate cards for this tenant
      const { data: cardsData, error: cardsError } = await supabase
        .from('rate_cards')
        .select('id, rate_card_code, rate_card_name')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null)
        .order('rate_card_name', { ascending: true });

      if (cardsError) throw cardsError;
      setRateCards(cardsData || []);

      // Fetch all rate details with rate card info and item type info
      const { data: ratesData, error: ratesError } = await supabase
        .from('rate_card_details')
        .select(`
          id,
          rate_card_id,
          service_type,
          rate,
          category,
          charge_unit,
          item_type_id,
          is_taxable,
          rate_cards!inner(rate_card_name, rate_card_code, tenant_id),
          item_types(name)
        `)
        .eq('rate_cards.tenant_id', profile.tenant_id)
        .is('rate_cards.deleted_at', null)
        .order('service_type', { ascending: true });

      if (ratesError) throw ratesError;

      const formattedRates: RateRow[] = (ratesData || []).map((r: any) => ({
        id: r.id,
        rate_card_id: r.rate_card_id,
        rate_card_name: r.rate_cards.rate_card_name,
        rate_card_code: r.rate_cards.rate_card_code,
        service_type: r.service_type,
        rate: r.rate,
        category: r.category,
        charge_unit: r.charge_unit,
        item_type_id: r.item_type_id,
        item_type_name: r.item_types?.name || null,
        is_taxable: r.is_taxable || false,
      }));

      setRates(formattedRates);
    } catch (error) {
      console.error('Error fetching rates:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load rates.',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRates = rates.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.service_type.toLowerCase().includes(q) ||
      r.rate_card_name.toLowerCase().includes(q) ||
      r.rate_card_code.toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.item_type_name || '').toLowerCase().includes(q)
    );
  });

  const handleAddNewRate = () => {
    if (rateCards.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Rate Cards',
        description: 'Please create a rate card first before adding rates.',
      });
      return;
    }

    const tempId = `new-${Date.now()}`;
    const defaultCard = rateCards[0];
    const newRate: RateRow = {
      id: tempId,
      rate_card_id: defaultCard.id,
      rate_card_name: defaultCard.rate_card_name,
      rate_card_code: defaultCard.rate_card_code,
      service_type: 'receiving',
      rate: 0,
      category: 'item_service',
      charge_unit: 'per_item',
      item_type_id: null,
      item_type_name: null,
      is_taxable: false,
      isNew: true,
    };

    setRates(prev => [newRate, ...prev]);
    setEditingRates(prev => ({
      ...prev,
      [tempId]: { ...newRate },
    }));
  };

  const handleEditChange = (id: string, field: keyof RateRow, value: any) => {
    setEditingRates(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));

    // Only auto-update category when service type changes for NEW rates (not editing existing)
    if (field === 'service_type') {
      const rate = rates.find(r => r.id === id);
      if (rate?.isNew) {
        const serviceOption = SERVICE_OPTIONS.find(o => o.value === value);
        if (serviceOption) {
          setEditingRates(prev => ({
            ...prev,
            [id]: {
              ...prev[id],
              service_type: value,
              category: serviceOption.category,
            },
          }));
        }
      }
    }

    // Update rate card name/code when rate_card_id changes
    if (field === 'rate_card_id') {
      const card = rateCards.find(c => c.id === value);
      if (card) {
        setEditingRates(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            rate_card_id: value,
            rate_card_name: card.rate_card_name,
            rate_card_code: card.rate_card_code,
          },
        }));
      }
    }
  };

  const getEditValue = (rate: RateRow, field: keyof RateRow) => {
    if (editingRates[rate.id] && editingRates[rate.id][field] !== undefined) {
      return editingRates[rate.id][field];
    }
    return rate[field];
  };

  const isEditing = (id: string) => !!editingRates[id];

  const handleSaveRate = async (rate: RateRow) => {
    const edits = editingRates[rate.id] || {};
    const updatedRate = { ...rate, ...edits };

    setSavingIds(prev => new Set(prev).add(rate.id));

    try {
      if (rate.isNew) {
        // Insert new rate
        const { data: inserted, error } = await supabase
          .from('rate_card_details')
          .insert({
            rate_card_id: updatedRate.rate_card_id,
            service_type: updatedRate.service_type,
            rate: updatedRate.rate,
            category: updatedRate.category,
            charge_unit: updatedRate.charge_unit || 'per_item',
            item_type_id: updatedRate.item_type_id,
            is_taxable: updatedRate.is_taxable,
          })
          .select('id')
          .single();

        if (error) throw error;

        // Update the rate in the list with the real ID
        setRates(prev =>
          prev.map(r =>
            r.id === rate.id
              ? { ...updatedRate, id: inserted.id, isNew: false }
              : r
          )
        );

        toast({ title: 'Rate Added', description: 'New rate has been saved.' });
      } else {
        // Update existing rate
        const { error } = await supabase
          .from('rate_card_details')
          .update({
            rate_card_id: updatedRate.rate_card_id,
            service_type: updatedRate.service_type,
            rate: updatedRate.rate,
            category: updatedRate.category,
            charge_unit: updatedRate.charge_unit,
            is_taxable: updatedRate.is_taxable,
          })
          .eq('id', rate.id);

        if (error) throw error;

        // Update the rate in the list
        setRates(prev =>
          prev.map(r => (r.id === rate.id ? updatedRate : r))
        );

        toast({ title: 'Rate Updated', description: 'Rate has been saved.' });
      }

      // Clear editing state
      setEditingRates(prev => {
        const next = { ...prev };
        delete next[rate.id];
        return next;
      });
    } catch (error) {
      console.error('Error saving rate:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Failed to save rate.',
      });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(rate.id);
        return next;
      });
    }
  };

  const handleCancelEdit = (rate: RateRow) => {
    if (rate.isNew) {
      // Remove the new row
      setRates(prev => prev.filter(r => r.id !== rate.id));
    }
    setEditingRates(prev => {
      const next = { ...prev };
      delete next[rate.id];
      return next;
    });
  };

  const handleDeleteRate = async () => {
    if (!deletingRate) return;

    try {
      const { error } = await supabase
        .from('rate_card_details')
        .delete()
        .eq('id', deletingRate.id);

      if (error) throw error;

      setRates(prev => prev.filter(r => r.id !== deletingRate.id));
      toast({ title: 'Rate Deleted', description: 'Rate has been removed.' });
    } catch (error) {
      console.error('Error deleting rate:', error);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'Failed to delete rate.',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingRate(null);
    }
  };

  const handleSyncAll = async () => {
    if (!profile?.tenant_id || rateCards.length === 0) return;

    setSyncing(true);
    try {
      let totalInserted = 0;
      let totalUpdated = 0;

      for (const card of rateCards) {
        const result = await populateRateCardFromItemTypes(profile.tenant_id, card.id);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
      }

      toast({
        title: 'Sync Complete',
        description: `Added ${totalInserted} rates, updated ${totalUpdated} rates across all rate cards.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Error syncing rates:', error);
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: 'Failed to sync rates from item types.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const getCategoryBadge = (category: string | null) => {
    if (category === 'accessorial') {
      return <Badge variant="secondary">Accessorial</Badge>;
    }
    return <Badge variant="outline">Item Service</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Rate Sheets
            </CardTitle>
            <CardDescription>
              Manage pricing rates for all services
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSyncAll} disabled={syncing}>
              <RefreshCw className={syncing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Sync from Item Types
            </Button>
            <Button onClick={handleAddNewRate}>
              <Plus className="mr-2 h-4 w-4" />
              New Rate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by service, item type, rate card..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRates.length === 0 && !searchQuery ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No rates found</h3>
            <p className="text-muted-foreground">
              Click "Sync from Item Types" to populate rates from your item types, or add rates manually.
            </p>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredRates.map((rate) => (
              <MobileDataCard key={rate.id}>
                <MobileDataCardHeader>
                  <div>
                    <MobileDataCardTitle>{toLabel(rate.service_type)}</MobileDataCardTitle>
                    <MobileDataCardDescription>
                      {rate.rate_card_name}
                      {rate.item_type_name && ` • ${rate.item_type_name}`}
                    </MobileDataCardDescription>
                  </div>
                  {getCategoryBadge(rate.category)}
                </MobileDataCardHeader>
                <MobileDataCardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rate:</span>
                    {isEditing(rate.id) ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={getEditValue(rate, 'rate') as number}
                        onChange={(e) => handleEditChange(rate.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-24 h-8"
                      />
                    ) : (
                      <span
                        className="font-medium cursor-pointer hover:underline"
                        onClick={() => handleEditChange(rate.id, 'rate', rate.rate)}
                      >
                        ${rate.rate.toFixed(2)}
                      </span>
                    )}
                  </div>
                </MobileDataCardContent>
                <MobileDataCardActions>
                  {isEditing(rate.id) ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => handleSaveRate(rate)}
                        disabled={savingIds.has(rate.id)}
                      >
                        {savingIds.has(rate.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        onClick={() => handleCancelEdit(rate)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => {
                        setDeletingRate(rate);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </MobileDataCardActions>
              </MobileDataCard>
            ))}
          </div>
        ) : (
          <div className="rounded-md border max-h-[calc(100vh-350px)] overflow-auto relative">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-border">
                <TableRow>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Item Type</TableHead>
                  <TableHead>Rate Card</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead className="w-32">Rate</TableHead>
                  <TableHead className="w-20 text-center">Taxable</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRates.map((rate) => (
                  <TableRow key={rate.id} className={rate.isNew ? 'bg-primary/5' : ''}>
                    <TableCell>
                      {isEditing(rate.id) ? (
                        <Select
                          value={getEditValue(rate, 'service_type') as string}
                          onValueChange={(val) => handleEditChange(rate.id, 'service_type', val)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="font-medium">{toLabel(rate.service_type)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">
                        {rate.item_type_name || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isEditing(rate.id) ? (
                        <Select
                          value={getEditValue(rate, 'rate_card_id') as string}
                          onValueChange={(val) => handleEditChange(rate.id, 'rate_card_id', val)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {rateCards.map((card) => (
                              <SelectItem key={card.id} value={card.id}>
                                {card.rate_card_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">{rate.rate_card_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing(rate.id) ? (
                        <Select
                          value={(getEditValue(rate, 'category') as string) || 'item_service'}
                          onValueChange={(val) => handleEditChange(rate.id, 'category', val)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="item_service">Item Service</SelectItem>
                            <SelectItem value="accessorial">Accessorial</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getCategoryBadge((getEditValue(rate, 'category') as string) || 'item_service')
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={getEditValue(rate, 'rate') as number}
                          onChange={(e) => handleEditChange(rate.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-24 h-8"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={getEditValue(rate, 'is_taxable') as boolean}
                        onCheckedChange={(checked) => handleEditChange(rate.id, 'is_taxable', checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isEditing(rate.id) ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSaveRate(rate)}
                              disabled={savingIds.has(rate.id)}
                            >
                              {savingIds.has(rate.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelEdit(rate)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingRate(rate);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredRates.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredRates.length} rate{filteredRates.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {deletingRate ? toLabel(deletingRate.service_type) : ''} rate
              from {deletingRate?.rate_card_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRate}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
