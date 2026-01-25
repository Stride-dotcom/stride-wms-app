import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  RepairQuoteWorkflow,
  RepairQuoteItem,
  AuditLogEntry,
  useRepairQuoteWorkflow,
} from '@/hooks/useRepairQuotes';
import { useTechnicians } from '@/hooks/useTechnicians';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2,
  User,
  Building2,
  Clock,
  DollarSign,
  Wrench,
  Package,
  Send,
  FileText,
  History,
  ExternalLink,
  Copy,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface RepairQuoteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: RepairQuoteWorkflow | null;
  onRefresh: () => void;
}

export function RepairQuoteDetailDialog({
  open,
  onOpenChange,
  quote,
  onRefresh,
}: RepairQuoteDetailDialogProps) {
  const { toast } = useToast();
  const { activeTechnicians } = useTechnicians();
  const {
    assignTechnician,
    sendToTechnician,
    sendToClient,
    reviewQuote,
    closeQuote,
    getStatusInfo,
  } = useRepairQuoteWorkflow();

  const [quoteItems, setQuoteItems] = useState<RepairQuoteItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Load quote items when dialog opens
  useEffect(() => {
    if (open && quote) {
      loadQuoteItems();
    }
  }, [open, quote?.id]);

  const loadQuoteItems = async () => {
    if (!quote) return;

    setLoadingItems(true);
    try {
      const { data, error } = await (supabase as any)
        .from('repair_quote_items')
        .select(`
          *,
          item:items(id, item_code, description, status)
        `)
        .eq('repair_quote_id', quote.id);

      if (error) throw error;

      // Fetch photos for each item
      const itemsWithPhotos = await Promise.all(
        (data || []).map(async (qi: any) => {
          const { data: photos } = await supabase
            .from('item_photos')
            .select('photo_url')
            .eq('item_id', qi.item_id)
            .order('created_at', { ascending: false })
            .limit(5);

          return {
            ...qi,
            damage_photos: qi.damage_photos?.length > 0
              ? qi.damage_photos
              : (photos || []).map((p: any) => p.photo_url),
          } as RepairQuoteItem;
        })
      );

      setQuoteItems(itemsWithPhotos);
    } catch (error) {
      console.error('Error loading quote items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleAssignTechnician = async (techId: string) => {
    if (!quote) return;
    await assignTechnician(quote.id, techId);
    onRefresh();
  };

  const handleSendToTech = async () => {
    if (!quote) return;
    const token = await sendToTechnician(quote.id);
    if (token) {
      const link = `${window.location.origin}/quote/tech?token=${token}`;
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Link Copied',
        description: 'Quote link copied to clipboard.',
      });
      onRefresh();
    }
  };

  const handleSendToClient = async () => {
    if (!quote) return;
    const token = await sendToClient(quote.id);
    if (token) {
      const link = `${window.location.origin}/quote/review?token=${token}`;
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Link Copied',
        description: 'Quote link copied to clipboard.',
      });
      onRefresh();
    }
  };

  const handleReview = async () => {
    if (!quote) return;
    await reviewQuote(quote.id);
    onRefresh();
  };

  const handleClose = async () => {
    if (!quote) return;
    await closeQuote(quote.id);
    onOpenChange(false);
    onRefresh();
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return `$${amount.toFixed(2)}`;
  };

  const getAuditIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'technician_assigned':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'sent_to_tech':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'tech_submitted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'tech_declined':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'under_review':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'sent_to_client':
        return <ExternalLink className="h-4 w-4 text-indigo-500" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'declined':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'closed':
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatAuditAction = (action: string) => {
    const actionMap: Record<string, string> = {
      created: 'Quote Created',
      technician_assigned: 'Technician Assigned',
      sent_to_tech: 'Sent to Technician',
      tech_submitted: 'Tech Submitted Quote',
      tech_declined: 'Tech Declined Job',
      under_review: 'Marked Under Review',
      sent_to_client: 'Sent to Client',
      accepted: 'Client Accepted',
      declined: 'Client Declined',
      closed: 'Quote Closed',
    };
    return actionMap[action] || action;
  };

  if (!quote) return null;

  const statusInfo = getStatusInfo(quote.status || 'draft');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Repair Quote
              </DialogTitle>
              <DialogDescription>
                {quote.account?.name || 'Unknown Account'}
                {quote.sidemark && ` - ${quote.sidemark.name}`}
              </DialogDescription>
            </div>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">
              Items ({quoteItems.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              History ({(quote.audit_log || []).length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-4 space-y-6">
              {/* Quote Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Technician</p>
                  {quote.technician ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{quote.technician.name}</span>
                      <span className="text-sm text-muted-foreground">
                        ({quote.technician.markup_percent}% markup)
                      </span>
                    </div>
                  ) : (
                    <Select onValueChange={handleAssignTechnician}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Assign technician..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTechnicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.name} ({tech.markup_percent}% markup)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Expires</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      {quote.expires_at
                        ? format(new Date(quote.expires_at), 'MMM d, yyyy h:mm a')
                        : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pricing Section */}
              {quote.tech_submitted_at && (
                <div className="space-y-4">
                  <h4 className="font-medium">Quote Details</h4>
                  <div className="bg-muted rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Labor Hours</p>
                        <p className="font-medium">{quote.tech_labor_hours || 0} hrs</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Labor Rate</p>
                        <p className="font-medium">{formatCurrency(quote.tech_labor_rate)}/hr</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Materials</p>
                        <p className="font-medium">{formatCurrency(quote.tech_materials_cost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tech Total</p>
                        <p className="font-medium">{formatCurrency(quote.tech_total)}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-muted-foreground text-sm">
                          Markup Applied: {quote.markup_applied || 0}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Customer Total</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(quote.customer_total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {quote.tech_notes && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">Technician Notes</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {quote.tech_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Source Task Link */}
              {quote.source_task_id && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Source Task</p>
                  <Link
                    to={`/tasks/${quote.source_task_id}`}
                    className="text-primary hover:underline flex items-center gap-1"
                    onClick={() => onOpenChange(false)}
                  >
                    <FileText className="h-4 w-4" />
                    View Task
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Actions */}
              <Separator />
              <div className="flex flex-wrap gap-2">
                {quote.technician && !['sent_to_tech', 'tech_submitted', 'tech_declined'].includes(quote.status || '') && (
                  <Button onClick={handleSendToTech}>
                    <Send className="mr-2 h-4 w-4" />
                    Send to Technician
                  </Button>
                )}

                {quote.status === 'tech_submitted' && (
                  <Button onClick={handleReview} variant="secondary">
                    <FileText className="mr-2 h-4 w-4" />
                    Mark Under Review
                  </Button>
                )}

                {['tech_submitted', 'under_review'].includes(quote.status || '') && quote.customer_total && (
                  <Button onClick={handleSendToClient}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Send to Client
                  </Button>
                )}

                <Button onClick={handleClose} variant="outline" className="text-destructive">
                  <X className="mr-2 h-4 w-4" />
                  Close Quote
                </Button>
              </div>
            </TabsContent>

            {/* Items Tab */}
            <TabsContent value="items" className="mt-4 space-y-4">
              {loadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : quoteItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No items in this quote</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quoteItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link
                            to={`/inventory/${item.item_id}`}
                            className="font-medium hover:underline flex items-center gap-1"
                            onClick={() => onOpenChange(false)}
                          >
                            {item.item?.item_code || item.item_code}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {item.item?.description || item.item_description || 'No description'}
                          </p>
                        </div>
                        {item.item?.status && (
                          <Badge variant="outline" className="capitalize">
                            {item.item.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>

                      {item.damage_description && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-3">
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            {item.damage_description}
                          </p>
                        </div>
                      )}

                      {item.damage_photos && item.damage_photos.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            Photos ({item.damage_photos.length})
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {item.damage_photos.map((photo, i) => (
                              <a
                                key={i}
                                href={photo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0"
                              >
                                <img
                                  src={photo}
                                  alt={`Photo ${i + 1}`}
                                  className="h-16 w-16 object-cover rounded border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {(item.allocated_tech_amount || item.allocated_customer_amount) && (
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Tech: </span>
                            <span className="font-medium">
                              {formatCurrency(item.allocated_tech_amount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Customer: </span>
                            <span className="font-medium">
                              {formatCurrency(item.allocated_customer_amount)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-4">
              <div className="space-y-4">
                {(quote.audit_log || []).length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No history recorded</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                    {/* Timeline items */}
                    <div className="space-y-4">
                      {[...(quote.audit_log || [])].reverse().map((entry, index) => (
                        <div key={index} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className="absolute left-0 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center">
                            {getAuditIcon(entry.action)}
                          </div>

                          {/* Content */}
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">
                                {formatAuditAction(entry.action)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            {entry.by_name && (
                              <p className="text-sm text-muted-foreground">
                                By: {entry.by_name}
                              </p>
                            )}
                            {entry.details && Object.keys(entry.details).length > 0 && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {entry.details.source_task_id && (
                                  <Link
                                    to={`/tasks/${entry.details.source_task_id}`}
                                    className="text-primary hover:underline"
                                    onClick={() => onOpenChange(false)}
                                  >
                                    View Source Task
                                  </Link>
                                )}
                                {entry.details.technician_name && (
                                  <p>Technician: {entry.details.technician_name}</p>
                                )}
                                {entry.details.tech_total && (
                                  <p>Quote: ${entry.details.tech_total.toFixed(2)}</p>
                                )}
                                {entry.details.reason && (
                                  <p>Reason: {entry.details.reason}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
