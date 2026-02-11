import { useState, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { isValidUuid } from '@/lib/utils';
import { useInboundManifestDetail, type ManifestItem } from '@/hooks/useInboundManifestDetail';
import { useExternalRefs, type RefType } from '@/hooks/useExternalRefs';
import { useAllocation } from '@/hooks/useAllocation';
import AllocationPicker from '@/components/incoming/AllocationPicker';
import ManifestImportDialog from '@/components/incoming/ManifestImportDialog';

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}

function allocationSummary(item: ManifestItem): string {
  const allocated = item.allocated_qty ?? 0;
  const expected = item.expected_quantity ?? 0;
  if (allocated === 0) return 'Unallocated';
  if (allocated >= expected) return 'Fully allocated';
  return `${allocated}/${expected}`;
}

function allocationBadgeVariant(item: ManifestItem): 'default' | 'secondary' | 'outline' {
  const allocated = item.allocated_qty ?? 0;
  const expected = item.expected_quantity ?? 0;
  if (allocated >= expected) return 'default';
  if (allocated > 0) return 'secondary';
  return 'outline';
}

export default function InboundManifestDetail() {
  const { id } = useParams<{ id: string }>();

  if (!id || !isValidUuid(id)) {
    return <Navigate to="/incoming" replace />;
  }

  const navigate = useNavigate();
  const { manifest, items, refs: manifestRefs, loading, refetch } = useInboundManifestDetail(id);
  const { refs, addRef, removeRef } = useExternalRefs(id);
  const { deallocate, loading: deallocating } = useAllocation();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showAllocationPicker, setShowAllocationPicker] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [newRefType, setNewRefType] = useState<RefType>('BOL');
  const [newRefValue, setNewRefValue] = useState('');

  const unallocatedItems = useMemo(
    () => items.filter((i) => (i.allocated_qty ?? 0) < (i.expected_quantity ?? 0)),
    [items]
  );

  const selectedForAllocation = useMemo(
    () => items.filter((i) => selectedItems.has(i.id)),
    [items, selectedItems]
  );

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedItems.size === unallocatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(unallocatedItems.map((i) => i.id)));
    }
  };

  const handleAddRef = async () => {
    if (!newRefValue.trim()) return;
    await addRef(newRefType, newRefValue);
    setNewRefValue('');
  };

  const handleDeallocate = async (allocationId: string) => {
    const result = await deallocate(allocationId);
    if (result?.success) {
      refetch();
    }
  };

  const handleAllocationComplete = () => {
    setShowAllocationPicker(false);
    setSelectedItems(new Set());
    refetch();
  };

  const handleImportComplete = () => {
    setShowImportDialog(false);
    refetch();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!manifest) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 text-muted-foreground">
          <MaterialIcon name="error_outline" size="xl" className="mb-2 opacity-40" />
          <p>Manifest not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/incoming')}>
            Back to Incoming Manager
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (showAllocationPicker && selectedForAllocation.length > 0) {
    return (
      <AllocationPicker
        manifestShipmentId={id}
        manifestItems={selectedForAllocation}
        onComplete={handleAllocationComplete}
        onCancel={() => setShowAllocationPicker(false)}
      />
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/incoming')}>
            <MaterialIcon name="arrow_back" size="sm" className="mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MaterialIcon name="list_alt" size="md" />
              {manifest.shipment_number}
              <Badge variant="secondary">{manifest.inbound_status || 'draft'}</Badge>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {manifest.account_name && <span>{manifest.account_name} &middot; </span>}
              {manifest.vendor_name && <span>Vendor: {manifest.vendor_name} &middot; </span>}
              {manifest.expected_pieces != null && <span>{manifest.expected_pieces} pieces &middot; </span>}
              Created {formatDate(manifest.created_at)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <MaterialIcon name="upload_file" size="sm" className="mr-1" />
              Import Items
            </Button>
          </div>
        </div>

        {/* ETA + Pieces info cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">ETA Start</div>
              <div className="font-medium">{formatDate(manifest.eta_start)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">ETA End</div>
              <div className="font-medium">{formatDate(manifest.eta_end)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Expected Pieces</div>
              <div className="font-medium">{manifest.expected_pieces ?? '-'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Items</div>
              <div className="font-medium">{items.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* External References */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              External References
              <HelpTip tooltip="BOL, PRO, tracking numbers, POs. Used for matching dock intakes to manifests and expected shipments." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {(refs.length > 0 ? refs : manifestRefs).map((ref) => (
                <Badge key={ref.id} variant="outline" className="gap-1 pl-2 pr-1 py-1">
                  <span className="text-xs font-semibold">{ref.ref_type}:</span>
                  <span className="text-xs">{ref.value}</span>
                  <button
                    onClick={() => removeRef(ref.id)}
                    className="ml-1 hover:text-destructive"
                  >
                    <MaterialIcon name="close" size="sm" />
                  </button>
                </Badge>
              ))}
              {refs.length === 0 && manifestRefs.length === 0 && (
                <span className="text-sm text-muted-foreground">No references yet.</span>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Select value={newRefType} onValueChange={(v) => setNewRefType(v as RefType)}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOL">BOL</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                  <SelectItem value="TRACKING">Tracking</SelectItem>
                  <SelectItem value="PO">PO</SelectItem>
                  <SelectItem value="REF">REF</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Enter reference value..."
                value={newRefValue}
                onChange={(e) => setNewRefValue(e.target.value)}
                className="max-w-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddRef();
                }}
              />
              <Button size="sm" onClick={handleAddRef} disabled={!newRefValue.trim()}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Items Grid */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Manifest Items
                <HelpTip tooltip="Items on this manifest. Select items and click 'Allocate' to assign them to an expected shipment." />
              </CardTitle>
              <div className="flex gap-2">
                {selectedItems.size > 0 && (
                  <Button size="sm" onClick={() => setShowAllocationPicker(true)}>
                    <MaterialIcon name="link" size="sm" className="mr-1" />
                    Allocate {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            </div>
            {items.length > 0 && (
              <CardDescription>
                {items.length} items &middot; {unallocatedItems.length} unallocated
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MaterialIcon name="inventory_2" size="xl" className="mb-2 opacity-40" />
                <p>No items yet. Import items from a spreadsheet or add them manually.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === unallocatedItems.length && unallocatedItems.length > 0}
                          onChange={toggleAll}
                          className="rounded border-muted-foreground"
                        />
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Sidemark</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Allocation</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const isFullyAllocated = (item.allocated_qty ?? 0) >= (item.expected_quantity ?? 0);
                      return (
                        <TableRow key={item.id} className={isFullyAllocated ? 'opacity-60' : ''}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.id)}
                              onChange={() => toggleItem(item.id)}
                              disabled={isFullyAllocated}
                              className="rounded border-muted-foreground"
                            />
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {item.expected_description || '-'}
                          </TableCell>
                          <TableCell>{item.expected_vendor || '-'}</TableCell>
                          <TableCell>{item.expected_sidemark || '-'}</TableCell>
                          <TableCell>{item.room || '-'}</TableCell>
                          <TableCell className="text-right">{item.expected_quantity}</TableCell>
                          <TableCell>
                            <Badge variant={allocationBadgeVariant(item)}>
                              {allocationSummary(item)}
                            </Badge>
                            {item.allocations.length > 0 && (
                              <div className="mt-1 space-y-1">
                                {item.allocations.map((alloc) => (
                                  <div key={alloc.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MaterialIcon name="arrow_forward" size="sm" />
                                    <span>{alloc.expected_shipment_number || 'Expected'}</span>
                                    <span>({alloc.allocated_qty})</span>
                                    <button
                                      onClick={() => handleDeallocate(alloc.id)}
                                      disabled={deallocating}
                                      className="ml-1 hover:text-destructive"
                                      title="Remove allocation"
                                    >
                                      <MaterialIcon name="close" size="sm" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showImportDialog && (
        <ManifestImportDialog
          shipmentId={id}
          open={showImportDialog}
          onClose={handleImportComplete}
        />
      )}
    </DashboardLayout>
  );
}
