import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useManifestScan, useManifestHistory, useManifestItems, ManifestStatus } from '@/hooks/useManifests';
import { useManifests } from '@/hooks/useManifests';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { PrintLabelsDialog } from '@/components/inventory/PrintLabelsDialog';
import { ItemLabelData } from '@/lib/labelGenerator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ShipmentNumberBadge } from '@/components/shipments/ShipmentNumberBadge';
import { format } from 'date-fns';

const statusLabels: Record<ManifestStatus, string> = {
  draft: 'Draft',
  active: 'Ready',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const actionLabels: Record<string, { label: string; iconName: string; color: string }> = {
  created: { label: 'Created', iconName: 'add', color: 'text-green-400' },
  updated: { label: 'Updated', iconName: 'edit', color: 'text-blue-400' },
  item_added: { label: 'Item Added', iconName: 'add', color: 'text-green-400' },
  item_removed: { label: 'Item Removed', iconName: 'delete', color: 'text-red-400' },
  items_bulk_added: { label: 'Items Added (Bulk)', iconName: 'add', color: 'text-green-400' },
  items_bulk_removed: { label: 'Items Removed (Bulk)', iconName: 'delete', color: 'text-red-400' },
  started: { label: 'Started', iconName: 'play_arrow', color: 'text-yellow-400' },
  completed: { label: 'Completed', iconName: 'check_circle', color: 'text-green-400' },
  cancelled: { label: 'Cancelled', iconName: 'cancel', color: 'text-red-400' },
  status_changed: { label: 'Status Changed', iconName: 'schedule', color: 'text-blue-400' },
};

export default function ManifestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    type: 'start' | 'complete' | 'cancel' | 'remove';
    itemIds?: string[];
  } | null>(null);
  const [printLabelsOpen, setPrintLabelsOpen] = useState(false);

  const { profile } = useAuth();
  const { manifest, items, stats, loading, refetch } = useManifestScan(id!);
  const { history, loading: historyLoading } = useManifestHistory(id!);
  const { addItemsBulk, removeItemsBulk } = useManifestItems(id!);
  const { startManifest, completeManifest, cancelManifest } = useManifests();

  // Search results for adding items
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search for items to add
  const searchForItems = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !profile?.tenant_id) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, item_code, description, status')
        .eq('tenant_id', profile.tenant_id)
        .neq('status', 'released')
        .is('deleted_at', null)
        .or(`item_code.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(50);

      if (!error && data) {
        // Filter out items already on manifest
        const itemIdsOnManifest = new Set(items.map(i => i.item_id));
        setSearchResults(data.filter(i => !itemIdsOnManifest.has(i.id)));
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  }, [profile?.tenant_id, items]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchForItems(itemSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch, searchForItems]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      i => i.item_code.toLowerCase().includes(query) ||
           i.item_description?.toLowerCase().includes(query) ||
           i.account?.account_name?.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Prepare label data for selected items
  const selectedItemsLabelData: ItemLabelData[] = useMemo(() => {
    return items
      .filter(i => selectedItems.includes(i.item_id))
      .map(i => ({
        id: i.item_id,
        itemCode: i.item_code,
        description: i.item_description || i.item?.description || '',
        vendor: i.item?.vendor || '',
        account: i.account?.account_name || '',
        locationCode: i.expected_location?.code || i.scanned_location?.code || '',
      }));
  }, [items, selectedItems]);

  const handleAddItems = async (itemIds: string[]) => {
    await addItemsBulk(itemIds);
    setAddItemOpen(false);
    setItemSearch('');
    refetch();
  };

  const handleRemoveItems = async () => {
    if (!confirmAction?.itemIds?.length) return;
    await removeItemsBulk(confirmAction.itemIds);
    setSelectedItems([]);
    setConfirmAction(null);
    refetch();
  };

  const handleStartManifest = async () => {
    await startManifest(id!);
    setConfirmAction(null);
    refetch();
  };

  const handleCompleteManifest = async () => {
    await completeManifest(id!);
    setConfirmAction(null);
    refetch();
  };

  const handleCancelManifest = async () => {
    await cancelManifest(id!);
    setConfirmAction(null);
    refetch();
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const toggleAllItems = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.item_id));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <MaterialIcon name="progress_activity" size="xl" className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!manifest) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <MaterialIcon name="warning" size="xl" className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Manifest not found</h2>
          <Button variant="link" onClick={() => navigate('/manifests')}>
            Back to Manifests
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isDraft = manifest.status === 'draft';
  const isActive = manifest.status === 'active' || manifest.status === 'in_progress';
  const progressPercent = stats?.progress_percent || 0;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <MaterialIcon name="arrow_back" size="sm" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{manifest.name}</h1>
            <StatusIndicator status={manifest.status} label={statusLabels[manifest.status as ManifestStatus]} size="sm" />
            {manifest.billable && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                <MaterialIcon name="attach_money" size="sm" className="mr-1" />
                Billable
              </Badge>
            )}
          </div>
          <ShipmentNumberBadge shipmentNumber={manifest.manifest_number} />
        </div>
        <div className="flex gap-2">
          {isDraft && items.length > 0 && (
            <Button onClick={() => setConfirmAction({ type: 'start' })}>
              <MaterialIcon name="play_arrow" size="sm" className="mr-2" />
              Start
            </Button>
          )}
          {isActive && (
            <>
              <Button onClick={() => navigate(`/manifests/${id}/scan`)}>
                <MaterialIcon name="qr_code_scanner" size="sm" className="mr-2" />
                Scan Items
              </Button>
              <Button variant="outline" onClick={() => setConfirmAction({ type: 'complete' })}>
                <MaterialIcon name="check_circle" size="sm" className="mr-2" />
                Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{manifest.expected_item_count}</p>
              </div>
              <MaterialIcon name="inventory_2" size="xl" className="text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scanned</p>
                <p className="text-2xl font-bold text-green-400">{manifest.scanned_item_count}</p>
              </div>
              <MaterialIcon name="check_circle" size="xl" className="text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {manifest.expected_item_count - manifest.scanned_item_count}
                </p>
              </div>
              <MaterialIcon name="schedule" size="xl" className="text-yellow-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-bold">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Card */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Warehouse:</span>
              <p className="font-medium">{manifest.warehouse?.name || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>
              <p className="font-medium">
                {format(new Date(manifest.created_at), 'MMM d, yyyy h:mm a')}
              </p>
              <p className="text-xs text-muted-foreground">
                by {manifest.created_by_user?.first_name} {manifest.created_by_user?.last_name}
              </p>
            </div>
            {manifest.started_at && (
              <div>
                <span className="text-muted-foreground">Started:</span>
                <p className="font-medium">
                  {format(new Date(manifest.started_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
            {manifest.completed_at && (
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <p className="font-medium">
                  {format(new Date(manifest.completed_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <MaterialIcon name="assignment" size="sm" />
            Items ({items.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <MaterialIcon name="history" size="sm" />
            Audit History
          </TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Manifest Items</CardTitle>
                  <CardDescription>
                    {isDraft ? 'Add or remove items from this manifest' : 'Items on this manifest'}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1 md:w-64">
                    <MaterialIcon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {selectedItems.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrintLabelsOpen(true)}
                      >
                        <MaterialIcon name="print" size="sm" className="mr-1" />
                        Print Labels ({selectedItems.length})
                      </Button>
                      {isDraft && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmAction({ type: 'remove', itemIds: selectedItems })}
                        >
                          <MaterialIcon name="delete" size="sm" className="mr-1" />
                          Remove ({selectedItems.length})
                        </Button>
                      )}
                    </>
                  )}
                  {isDraft && (
                    <Popover open={addItemOpen} onOpenChange={setAddItemOpen}>
                      <PopoverTrigger asChild>
                        <Button size="sm">
                          <MaterialIcon name="add" size="sm" className="mr-1" />
                          Add Items
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="end">
                        <Command>
                          <CommandInput
                            placeholder="Search items to add..."
                            value={itemSearch}
                            onValueChange={setItemSearch}
                          />
                          <CommandList>
                            {itemSearch.length < 2 ? (
                              <div className="p-4 text-sm text-muted-foreground text-center">
                                Type at least 2 characters to search
                              </div>
                            ) : searchLoading ? (
                              <div className="p-4 flex justify-center">
                                <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                              </div>
                            ) : searchResults.length === 0 ? (
                              <CommandEmpty>No items found</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {searchResults.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.id}
                                    onSelect={() => handleAddItems([item.id])}
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium font-mono">{item.item_code}</div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {item.description}
                                      </div>
                                    </div>
                                    <MaterialIcon name="add" size="sm" className="text-muted-foreground" />
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MaterialIcon name="inventory_2" size="xl" className="mx-auto mb-4 opacity-50" />
                  <p>No items on this manifest</p>
                  {isDraft && (
                    <Button variant="link" onClick={() => setAddItemOpen(true)}>
                      Add items to get started
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isDraft && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                            onCheckedChange={toggleAllItems}
                          />
                        </TableHead>
                      )}
                      <TableHead>Item Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Expected Location</TableHead>
                      <TableHead>Status</TableHead>
                      {!isDraft && <TableHead>Scanned</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        {isDraft && (
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.includes(item.item_id)}
                              onCheckedChange={() => toggleItemSelection(item.item_id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono font-medium">{item.item_code}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {item.item_description || '-'}
                        </TableCell>
                        <TableCell>{item.account?.account_name || '-'}</TableCell>
                        <TableCell>
                          {item.expected_location?.code || '-'}
                        </TableCell>
                        <TableCell>
                          {item.scanned ? (
                            <StatusIndicator status="scanned" label="Scanned" size="sm" />
                          ) : (
                            <StatusIndicator status="pending" label="Pending" size="sm" />
                          )}
                        </TableCell>
                        {!isDraft && item.scanned && (
                          <TableCell className="text-xs text-muted-foreground">
                            {item.scanned_at && format(new Date(item.scanned_at), 'MMM d, h:mm a')}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
              <CardDescription>
                Complete history of all changes made to this manifest
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MaterialIcon name="history" size="xl" className="mx-auto mb-4 opacity-50" />
                  <p>No history available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((entry) => {
                    const actionConfig = actionLabels[entry.action] || {
                      label: entry.action,
                      iconName: 'schedule',
                      color: 'text-muted-foreground'
                    };

                    return (
                      <div key={entry.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className={`mt-1 ${actionConfig.color}`}>
                          <MaterialIcon name={actionConfig.iconName} size="md" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{actionConfig.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(entry.changed_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <MaterialIcon name="person" size="sm" />
                            {entry.changed_by_user?.first_name} {entry.changed_by_user?.last_name}
                            {entry.changed_by_user?.email && (
                              <span className="text-xs">({entry.changed_by_user.email})</span>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-sm mt-1">{entry.description}</p>
                          )}
                          {/* Show change details */}
                          {entry.old_values && Object.keys(entry.old_values).length > 0 && (
                            <div className="mt-2 text-xs bg-muted/50 rounded p-2">
                              <div className="font-medium mb-1">Changes:</div>
                              {Object.entries(entry.old_values).map(([key, oldVal]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-muted-foreground">{key}:</span>
                                  <span className="line-through text-red-400">{String(oldVal)}</span>
                                  <span>→</span>
                                  <span className="text-green-400">
                                    {String(entry.new_values?.[key] ?? '-')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Show affected items count */}
                          {entry.affected_item_ids && entry.affected_item_ids.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {entry.affected_item_ids.length} item(s) affected
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'start' && 'Start Manifest?'}
              {confirmAction?.type === 'complete' && 'Complete Manifest?'}
              {confirmAction?.type === 'cancel' && 'Cancel Manifest?'}
              {confirmAction?.type === 'remove' && 'Remove Items?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'start' && (
                <>
                  This will activate the manifest for scanning. Make sure all items have been added.
                  You will not be able to add or remove items after starting.
                </>
              )}
              {confirmAction?.type === 'complete' && (
                <>
                  This will mark the manifest as completed. Any unscanned items will remain in the report.
                </>
              )}
              {confirmAction?.type === 'cancel' && (
                <>
                  This will cancel the manifest. This action cannot be undone.
                </>
              )}
              {confirmAction?.type === 'remove' && (
                <>
                  Remove {confirmAction.itemIds?.length} item(s) from the manifest? This action will be
                  recorded in the audit history.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === 'start') handleStartManifest();
                else if (confirmAction?.type === 'complete') handleCompleteManifest();
                else if (confirmAction?.type === 'cancel') handleCancelManifest();
                else if (confirmAction?.type === 'remove') handleRemoveItems();
              }}
              className={confirmAction?.type === 'remove' || confirmAction?.type === 'cancel'
                ? 'bg-destructive hover:bg-destructive/90'
                : ''
              }
            >
              {confirmAction?.type === 'start' && 'Start'}
              {confirmAction?.type === 'complete' && 'Complete'}
              {confirmAction?.type === 'cancel' && 'Cancel Manifest'}
              {confirmAction?.type === 'remove' && 'Remove Items'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print Labels Dialog */}
      <PrintLabelsDialog
        open={printLabelsOpen}
        onOpenChange={setPrintLabelsOpen}
        items={selectedItemsLabelData}
        title="Print Item Labels"
        description={`Generate labels for ${selectedItems.length} selected item${selectedItems.length !== 1 ? 's' : ''} from this manifest`}
      />
    </DashboardLayout>
  );
}
