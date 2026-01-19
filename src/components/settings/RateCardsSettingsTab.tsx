import { useEffect, useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Plus, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

const rateCardSchema = z.object({
  rate_card_code: z.string().min(1, 'Code is required').max(50),
  rate_card_name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  effective_date: z.string().min(1, 'Effective date is required'),
  expiration_date: z.string().optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

type RateCardFormData = z.infer<typeof rateCardSchema>;

export function RateCardsSettingsTab() {
  const isMobile = useIsMobile();
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRateCard, setEditingRateCard] = useState<RateCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRateCard, setDeletingRateCard] = useState<RateCard | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  const form = useForm<RateCardFormData>({
    resolver: zodResolver(rateCardSchema),
    defaultValues: {
      rate_card_code: '',
      rate_card_name: '',
      description: '',
      effective_date: new Date().toISOString().split('T')[0],
      expiration_date: '',
      is_active: true,
      is_default: false,
    },
  });

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

  const handleCreate = () => {
    setEditingRateCard(null);
    form.reset({
      rate_card_code: '',
      rate_card_name: '',
      description: '',
      effective_date: new Date().toISOString().split('T')[0],
      expiration_date: '',
      is_active: true,
      is_default: false,
    });
    setDialogOpen(true);
  };

  const handleEdit = (card: RateCard) => {
    setEditingRateCard(card);
    form.reset({
      rate_card_code: card.rate_card_code,
      rate_card_name: card.rate_card_name,
      description: card.description || '',
      effective_date: card.effective_date.split('T')[0],
      expiration_date: card.expiration_date?.split('T')[0] || '',
      is_active: card.is_active ?? true,
      is_default: card.is_default ?? false,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingRateCard) return;

    try {
      const { error } = await supabase
        .from('rate_cards')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deletingRateCard.id);

      if (error) throw error;

      toast({
        title: 'Rate Card Deleted',
        description: 'The rate card has been deleted.',
      });
      fetchRateCards();
    } catch (error) {
      console.error('Error deleting rate card:', error);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'Failed to delete rate card.',
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingRateCard(null);
    }
  };

  const onSubmit = async (data: RateCardFormData) => {
    if (!profile?.tenant_id) return;

    setSaving(true);
    try {
      const rateCardData = {
        rate_card_code: data.rate_card_code,
        rate_card_name: data.rate_card_name,
        description: data.description || null,
        effective_date: data.effective_date,
        expiration_date: data.expiration_date || null,
        is_active: data.is_active ?? true,
        is_default: data.is_default ?? false,
        tenant_id: profile.tenant_id,
      };

      if (editingRateCard) {
        const { error } = await supabase
          .from('rate_cards')
          .update(rateCardData)
          .eq('id', editingRateCard.id);

        if (error) throw error;

        toast({
          title: 'Rate Card Updated',
          description: 'The rate card has been updated successfully.',
        });
      } else {
        const { data: newCard, error } = await supabase
          .from('rate_cards')
          .insert(rateCardData)
          .select('id')
          .single();

        if (error) throw error;

        // Auto-populate rates from item types
        if (newCard?.id) {
          try {
            const result = await populateRateCardFromItemTypes(profile.tenant_id, newCard.id);
            toast({
              title: 'Rate Card Created',
              description: `Created with ${result.inserted} rates from item types.`,
            });
          } catch {
            toast({
              title: 'Rate Card Created',
              description: 'Rate card created, but failed to populate rates from item types.',
            });
          }
        } else {
          toast({
            title: 'Rate Card Created',
            description: 'The rate card has been created successfully.',
          });
        }
      }

      setDialogOpen(false);
      fetchRateCards();
    } catch (error: any) {
      console.error('Error saving rate card:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Failed to save rate card.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Rate Cards
            </CardTitle>
            <CardDescription>
              Manage pricing and service rates for clients
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Rate Card
          </Button>
        </div>
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
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredRateCards.map((card) => (
              <MobileDataCard key={card.id} onClick={() => handleEdit(card)}>
                <MobileDataCardHeader>
                  <div>
                    <MobileDataCardTitle>{card.rate_card_code}</MobileDataCardTitle>
                    <MobileDataCardDescription>{card.rate_card_name}</MobileDataCardDescription>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {getStatusBadges(card)}
                  </div>
                </MobileDataCardHeader>
                <MobileDataCardContent>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>
                      <span className="text-xs">Effective:</span>
                      <div className="text-foreground">{format(new Date(card.effective_date), 'MMM d, yyyy')}</div>
                    </div>
                    <div>
                      <span className="text-xs">Expires:</span>
                      <div className="text-foreground">
                        {card.expiration_date ? format(new Date(card.expiration_date), 'MMM d, yyyy') : 'Never'}
                      </div>
                    </div>
                  </div>
                </MobileDataCardContent>
                <MobileDataCardActions>
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => handleEdit(card)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => {
                      setDeletingRateCard(card);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </MobileDataCardActions>
              </MobileDataCard>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRateCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">{card.rate_card_code}</TableCell>
                    <TableCell>{card.rate_card_name}</TableCell>
                    <TableCell className="line-clamp-1">
                      {card.description || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getStatusBadges(card)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(card.effective_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {card.expiration_date
                        ? format(new Date(card.expiration_date), 'MMM d, yyyy')
                        : 'No expiration'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(card)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingRateCard(card);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Rate Card Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingRateCard ? 'Edit Rate Card' : 'New Rate Card'}
            </DialogTitle>
            <DialogDescription>
              {editingRateCard
                ? 'Update the rate card details below.'
                : 'Create a new rate card for client pricing.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="rate_card_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input placeholder="RC-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rate_card_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Standard Pricing" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description of this rate card..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="effective_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiration_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription>Optional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_default"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Default</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingRateCard ? (
                    'Update'
                  ) : (
                    'Create'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRateCard?.rate_card_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
