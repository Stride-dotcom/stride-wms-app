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
import { supabase } from '@/integrations/supabase/client';
import { Search, FileText, Loader2, Plus, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

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

export default function RateCards() {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
              {filteredRateCards.length} rate cards found
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Expiration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRateCards.map((card) => (
                      <TableRow key={card.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{card.rate_card_code}</TableCell>
                        <TableCell>{card.rate_card_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
