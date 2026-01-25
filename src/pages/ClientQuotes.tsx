import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  FileText,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ClientPortalLayout } from '@/components/client-portal/ClientPortalLayout';
import { useClientPortalContext, useClientQuotes } from '@/hooks/useClientPortal';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

export default function ClientQuotes() {
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const { portalUser, account, tenant } = useClientPortalContext();
  const { data: quotes = [], isLoading, refetch } = useClientQuotes();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [responding, setResponding] = useState(false);

  const userName = portalUser?.first_name
    ? `${portalUser.first_name} ${portalUser.last_name || ''}`.trim()
    : portalUser?.email || 'User';

  // Check for pre-selected quote from URL
  const preSelectedQuoteId = searchParams.get('id');
  if (preSelectedQuoteId && !selectedQuote && quotes.length > 0) {
    const quote = quotes.find((q: any) => q.id === preSelectedQuoteId);
    if (quote) {
      setSelectedQuote(quote);
    }
  }

  // Filter quotes
  const filteredQuotes = quotes.filter((quote: any) => {
    const matchesSearch =
      quote.quote_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.repair_quote_items?.some((item: any) =>
        item.item_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_description?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent_to_client':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending Review
          </Badge>
        );
      case 'accepted':
        return (
          <Badge className="bg-green-500 gap-1">
            <CheckCircle className="h-3 w-3" />
            Accepted
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Declined
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status?.replace(/_/g, ' ')}</Badge>;
    }
  };

  const handleAccept = async () => {
    if (!selectedQuote) return;
    setResponding(true);

    try {
      const { error } = await (supabase.from('repair_quotes') as any)
        .update({
          status: 'accepted',
          client_response: 'accepted',
          client_responded_at: new Date().toISOString(),
          client_responded_by: portalUser?.id,
        })
        .eq('id', selectedQuote.id);

      if (error) throw error;

      toast.success('Quote accepted successfully');
      setShowAcceptDialog(false);
      setSelectedQuote(null);
      refetch();
    } catch (err) {
      console.error('Error accepting quote:', err);
      toast.error('Failed to accept quote');
    } finally {
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedQuote) return;
    setResponding(true);

    try {
      const { error } = await (supabase.from('repair_quotes') as any)
        .update({
          status: 'declined',
          client_response: 'declined',
          client_responded_at: new Date().toISOString(),
          client_responded_by: portalUser?.id,
        })
        .eq('id', selectedQuote.id);

      if (error) throw error;

      toast.success('Quote declined');
      setShowDeclineDialog(false);
      setDeclineReason('');
      setSelectedQuote(null);
      refetch();
    } catch (err) {
      console.error('Error declining quote:', err);
      toast.error('Failed to decline quote');
    } finally {
      setResponding(false);
    }
  };

  const isExpiringSoon = (expiresAt: string) => {
    if (!expiresAt) return false;
    const daysUntilExpiry = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 3;
  };

  return (
    <ClientPortalLayout
      accountName={account?.name}
      warehouseName={tenant?.name}
      userName={userName}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Repair Quotes</h1>
          <p className="text-muted-foreground">
            Review and respond to repair quotes for your items
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quotes</CardTitle>
            <CardDescription>
              {filteredQuotes.length} of {quotes.length} quotes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by quote number or item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent_to_client">Pending Review</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quotes List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredQuotes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                <h3 className="mt-4 text-lg font-semibold">No quotes found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'No quotes have been sent to you yet'}
                </p>
              </div>
            ) : isMobile ? (
              // Mobile view
              <div className="space-y-3">
                {filteredQuotes.map((quote: any) => (
                  <div
                    key={quote.id}
                    className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedQuote(quote)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{quote.quote_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {quote.repair_quote_items?.length || 0} item
                          {quote.repair_quote_items?.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {getStatusBadge(quote.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      {quote.customer_total && (
                        <p className="text-lg font-semibold text-green-600">
                          ${Number(quote.customer_total).toFixed(2)}
                        </p>
                      )}
                      {quote.status === 'sent_to_client' && isExpiringSoon(quote.expires_at) && (
                        <span className="text-xs text-amber-600">
                          Expires {formatDistanceToNow(new Date(quote.expires_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Desktop view
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.map((quote: any) => (
                      <TableRow
                        key={quote.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedQuote(quote)}
                      >
                        <TableCell className="font-medium">{quote.quote_number}</TableCell>
                        <TableCell>
                          {quote.repair_quote_items?.length || 0} item
                          {quote.repair_quote_items?.length !== 1 ? 's' : ''}
                        </TableCell>
                        <TableCell>
                          {quote.customer_total ? (
                            <span className="font-semibold text-green-600">
                              ${Number(quote.customer_total).toFixed(2)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(quote.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(quote.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {quote.status === 'sent_to_client' && quote.expires_at ? (
                            <span
                              className={
                                isExpiringSoon(quote.expires_at) ? 'text-amber-600 font-medium' : ''
                              }
                            >
                              {formatDistanceToNow(new Date(quote.expires_at), { addSuffix: true })}
                            </span>
                          ) : (
                            '-'
                          )}
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

      {/* Quote Detail Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedQuote?.quote_number}
              <span className="ml-2">{selectedQuote && getStatusBadge(selectedQuote.status)}</span>
            </DialogTitle>
            <DialogDescription>
              Review the repair quote details below
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-6">
              {/* Expiry Warning */}
              {selectedQuote.status === 'sent_to_client' &&
                isExpiringSoon(selectedQuote.expires_at) && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Expiring Soon</AlertTitle>
                    <AlertDescription className="text-amber-700">
                      This quote expires{' '}
                      {formatDistanceToNow(new Date(selectedQuote.expires_at), { addSuffix: true })}
                      . Please respond before it expires.
                    </AlertDescription>
                  </Alert>
                )}

              {/* Items */}
              <div>
                <h3 className="font-semibold mb-3">Items Included</h3>
                <div className="space-y-2">
                  {selectedQuote.repair_quote_items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.item_code}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.item_description || 'No description'}
                        </p>
                      </div>
                      {item.allocated_customer_amount && (
                        <p className="font-medium">
                          ${Number(item.allocated_customer_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-800">Total</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ${Number(selectedQuote.customer_total || 0).toFixed(2)}
                </p>
              </div>

              {/* Response History */}
              {selectedQuote.client_responded_at && (
                <div className="text-sm text-muted-foreground">
                  <p>
                    {selectedQuote.client_response === 'accepted' ? 'Accepted' : 'Declined'} on{' '}
                    {format(new Date(selectedQuote.client_responded_at), 'MMMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons - only for pending quotes */}
          {selectedQuote?.status === 'sent_to_client' && (
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeclineDialog(true)}
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Decline
              </Button>
              <Button onClick={() => setShowAcceptDialog(true)} className="flex-1 bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Accept Quote
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Accept Confirmation */}
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Repair Quote?</AlertDialogTitle>
            <AlertDialogDescription>
              By accepting this quote, you authorize {tenant?.name} to proceed with the repairs
              at a total cost of{' '}
              <span className="font-semibold text-foreground">
                ${Number(selectedQuote?.customer_total || 0).toFixed(2)}
              </span>
              . This amount will be added to your next invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={responding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAccept}
              disabled={responding}
              className="bg-green-600 hover:bg-green-700"
            >
              {responding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Accept Quote'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline Confirmation */}
      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Repair Quote?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline this repair quote? The items will remain in
              their current condition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Optional: Reason for declining..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={responding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecline}
              disabled={responding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {responding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Decline Quote'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientPortalLayout>
  );
}
