import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Plus, DollarSign, ChevronDown, ChevronRight, Package, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface RateCard {
  id: string;
  rate_card_code: string;
  rate_card_name: string;
  description: string | null;
  effective_date: string;
  expiration_date: string | null;
  is_active: boolean | null;
  is_default: boolean | null;
  created_at: string;
}

interface RateCardDetail {
  id: string;
  rate_card_id: string;
  service_type: string;
  rate: number;
  charge_unit: string | null;
  category: string | null;
  item_type_id: string | null;
}

const ITEM_SERVICES = [
  { key: 'receiving', label: 'Receiving' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'repair', label: 'Repair' },
  { key: 'storage', label: 'Storage' },
  { key: 'will_call', label: 'Will Call' },
  { key: 'disposal', label: 'Disposal' },
  { key: 'picking', label: 'Picking' },
  { key: 'packing', label: 'Packing' },
];

const ACCESSORIAL_SERVICES = [
  { key: 'oversized', label: 'Oversized' },
  { key: 'overweight', label: 'Overweight' },
  { key: 'unstackable', label: 'Unstackable' },
  { key: 'crated', label: 'Crated' },
  { key: 'received_without_id', label: 'Received Without ID' },
];

export default function RateCards() {
  const { toast } = useToast();
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [rateCardDetails, setRateCardDetails] = useState<Record<string, RateCardDetail[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingRates, setEditingRates] = useState<Record<string, number>>({});
  const [savingRates, setSavingRates] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRateCards();
  }, []);

  const fetchRateCards = async () => {
    try {
      const { data, error } = await supabase
        .from('rate_cards')
        .select('id, rate_card_code, rate_card_name, description, effective_date, expiration_date, is_active, is_default, created_at')
        .is('deleted_at', null)
        .order('rate_card_name', { ascending: true });

      if (error) throw error;
      setRateCards(data || []);
    } catch (error) {
      console.error('Error fetching rate cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRateCardDetails = async (rateCardId: string) => {
    if (rateCardDetails[rateCardId]) return;

    try {
      const { data, error } = await supabase
        .from('rate_card_details')
        .select('*')
        .eq('rate_card_id', rateCardId);

      if (error) throw error;
      setRateCardDetails(prev => ({
        ...prev,
        [rateCardId]: data || [],
      }));
    } catch (error) {
      console.error('Error fetching rate card details:', error);
    }
  };

  const toggleExpanded = async (cardId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(cardId)) {
      newExpanded.delete(cardId);
    } else {
      newExpanded.add(cardId);
      await fetchRateCardDetails(cardId);
    }
    setExpandedCards(newExpanded);
  };

  const getRateForService = (rateCardId: string, serviceType: string): number => {
    const editKey = `${rateCardId}-${serviceType}`;
    if (editingRates[editKey] !== undefined) {
      return editingRates[editKey];
    }
    const details = rateCardDetails[rateCardId] || [];
    const detail = details.find(d => d.service_type === serviceType);
    return detail?.rate || 0;
  };

  const handleRateChange = (rateCardId: string, serviceType: string, value: string) => {
    const editKey = `${rateCardId}-${serviceType}`;
    setEditingRates(prev => ({
      ...prev,
      [editKey]: parseFloat(value) || 0,
    }));
  };

  const saveRate = async (rateCardId: string, serviceType: string, category: 'item_service' | 'accessorial') => {
    const editKey = `${rateCardId}-${serviceType}`;
    const rate = editingRates[editKey];
    if (rate === undefined) return;

    setSavingRates(prev => new Set(prev).add(editKey));

    try {
      const details = rateCardDetails[rateCardId] || [];
      const existingDetail = details.find(d => d.service_type === serviceType);

      if (existingDetail) {
        await supabase
          .from('rate_card_details')
          .update({ rate, category })
          .eq('id', existingDetail.id);
      } else {
        await supabase
          .from('rate_card_details')
          .insert({
            rate_card_id: rateCardId,
            service_type: serviceType,
            rate,
            category,
            charge_unit: 'per_item',
          });
      }

      // Refresh details
      const { data } = await supabase
        .from('rate_card_details')
        .select('*')
        .eq('rate_card_id', rateCardId);

      setRateCardDetails(prev => ({
        ...prev,
        [rateCardId]: data || [],
      }));

      // Clear edit state
      setEditingRates(prev => {
        const next = { ...prev };
        delete next[editKey];
        return next;
      });

      toast({ title: 'Rate saved', description: `${serviceType} rate updated.` });
    } catch (error) {
      console.error('Error saving rate:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save rate.' });
    } finally {
      setSavingRates(prev => {
        const next = new Set(prev);
        next.delete(editKey);
        return next;
      });
    }
  };

  const filteredRateCards = rateCards.filter((card) => {
    return (
      card.rate_card_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.rate_card_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getStatusBadges = (card: RateCard) => {
    const badges = [];
    if (card.is_default) {
      badges.push(<Badge key="default" className="mr-1">Default</Badge>);
    }
    if (card.is_active) {
      badges.push(<Badge key="active" variant="outline">Active</Badge>);
    } else {
      badges.push(<Badge key="inactive" variant="secondary">Inactive</Badge>);
    }
    return badges;
  };

  const renderServiceRatesTable = (rateCardId: string, services: { key: string; label: string }[], category: 'item_service' | 'accessorial', icon: React.ReactNode, title: string) => (
    <div className="space-y-2">
      <h4 className="font-medium flex items-center gap-2 text-sm">
        {icon}
        {title}
      </h4>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead className="w-32">Rate</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => {
              const editKey = `${rateCardId}-${service.key}`;
              const isEditing = editingRates[editKey] !== undefined;
              const isSaving = savingRates.has(editKey);
              const rate = getRateForService(rateCardId, service.key);

              return (
                <TableRow key={service.key}>
                  <TableCell>{service.label}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rate}
                        onChange={(e) => handleRateChange(rateCardId, service.key, e.target.value)}
                        className="w-24 h-8"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveRate(rateCardId, service.key, category)}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rate Cards</h1>
            <p className="text-muted-foreground">
              Manage pricing and service rates for clients
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Rate Card
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rate Cards</CardTitle>
            <CardDescription>
              {filteredRateCards.length} rate cards found. Click to expand and edit rates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code, name, or description..."
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
            ) : filteredRateCards.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No rate cards found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'Try adjusting your search'
                    : 'Get started by creating a new rate card'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRateCards.map((card) => (
                  <Collapsible
                    key={card.id}
                    open={expandedCards.has(card.id)}
                    onOpenChange={() => toggleExpanded(card.id)}
                  >
                    <div className="rounded-lg border">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center gap-4">
                            {expandedCards.has(card.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <div>
                              <div className="font-medium">{card.rate_card_name}</div>
                              <div className="text-sm text-muted-foreground">{card.rate_card_code}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex gap-1">{getStatusBadges(card)}</div>
                            <div className="text-sm text-muted-foreground">
                              Effective: {format(new Date(card.effective_date), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t p-4 space-y-6 bg-muted/20">
                          {card.description && (
                            <p className="text-sm text-muted-foreground">{card.description}</p>
                          )}
                          <div className="grid md:grid-cols-2 gap-6">
                            {renderServiceRatesTable(
                              card.id,
                              ITEM_SERVICES,
                              'item_service',
                              <Package className="h-4 w-4" />,
                              'Item Services'
                            )}
                            {renderServiceRatesTable(
                              card.id,
                              ACCESSORIAL_SERVICES,
                              'accessorial',
                              <Zap className="h-4 w-4" />,
                              'Accessorial Services'
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
