import { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { ShipmentNumberBadge } from '@/components/shipments/ShipmentNumberBadge';
import { isValidUuid } from '@/lib/utils';
import { useExpectedShipmentDetail } from '@/hooks/useExpectedShipmentDetail';
import { useExternalRefs, type RefType } from '@/hooks/useExternalRefs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}

export default function ExpectedShipmentDetail() {
  const { id } = useParams<{ id: string }>();

  if (!id || !isValidUuid(id)) {
    return <Navigate to="/incoming" replace />;
  }

  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { shipment, items, refs: shipmentRefs, loading, refetch } = useExpectedShipmentDetail(id);
  const { refs, addRef, removeRef } = useExternalRefs(id);

  const [newRefType, setNewRefType] = useState<RefType>('BOL');
  const [newRefValue, setNewRefValue] = useState('');

  // Editable header
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerVendor, setHeaderVendor] = useState('');
  const [headerCarrier, setHeaderCarrier] = useState('');
  const [headerEtaStart, setHeaderEtaStart] = useState('');
  const [headerEtaEnd, setHeaderEtaEnd] = useState('');
  const [headerPieces, setHeaderPieces] = useState('');
  const [headerSaving, setHeaderSaving] = useState(false);

  // Add item form
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [addItemDesc, setAddItemDesc] = useState('');
  const [addItemVendor, setAddItemVendor] = useState('');
  const [addItemSidemark, setAddItemSidemark] = useState('');
  const [addItemRoom, setAddItemRoom] = useState('');
  const [addItemQty, setAddItemQty] = useState('1');
  const [addItemNotes, setAddItemNotes] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  const handleAddRef = async () => {
    if (!newRefValue.trim()) return;
    await addRef(newRefType, newRefValue);
    setNewRefValue('');
  };

  const handleEditHeader = () => {
    if (!shipment) return;
    setHeaderVendor(shipment.vendor_name || '');
    setHeaderCarrier((shipment as any).carrier as string || '');
    setHeaderEtaStart(shipment.eta_start ? String(shipment.eta_start).split('T')[0] : '');
    setHeaderEtaEnd(shipment.eta_end ? String(shipment.eta_end).split('T')[0] : '');
    setHeaderPieces(shipment.expected_pieces?.toString() || '');
    setEditingHeader(true);
  };

  const handleSaveHeader = async () => {
    if (!shipment) return;
    try {
      setHeaderSaving(true);
      const { error } = await supabase
        .from('shipments')
        .update({
          vendor_name: headerVendor || null,
          carrier: headerCarrier || null,
          eta_start: headerEtaStart || null,
          eta_end: headerEtaEnd || null,
          expected_pieces: headerPieces ? Number(headerPieces) : null,
        } as Record<string, unknown>)
        .eq('id', shipment.id);
      if (error) throw error;
      toast({ title: 'Expected Shipment Updated' });
      setEditingHeader(false);
      refetch();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update',
      });
    } finally {
      setHeaderSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!profile?.tenant_id || !id) return;
    try {
      setAddingItem(true);
      const { error } = await (supabase as any)
        .from('shipment_items')
        .insert({
          shipment_id: id,
          expected_description: addItemDesc || null,
          expected_vendor: addItemVendor || null,
          expected_sidemark: addItemSidemark || null,
          room: addItemRoom || null,
          expected_quantity: Number(addItemQty) || 1,
          notes: addItemNotes || null,
        });
      if (error) throw error;
      toast({ title: 'Item Added' });
      setShowAddItemDialog(false);
      setAddItemDesc('');
      setAddItemVendor('');
      setAddItemSidemark('');
      setAddItemRoom('');
      setAddItemQty('1');
      setAddItemNotes('');
      refetch();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to add item',
      });
    } finally {
      setAddingItem(false);
    }
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

  if (!shipment) {
    return (
      <DashboardLayout>
        <div className="text-center py-24 text-muted-foreground">
          <MaterialIcon name="error_outline" size="xl" className="mb-2 opacity-40" />
          <p>Expected shipment not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/incoming')}>
            Back to Incoming Manager
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const displayRefs = refs.length > 0 ? refs : shipmentRefs;
  const carrierName = (shipment as any).carrier as string | null;

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
              <MaterialIcon name="schedule" size="md" />
              <ShipmentNumberBadge shipmentNumber={shipment.shipment_number} exceptionType={(shipment as any).shipment_exception_type} className="text-2xl" />
              <Badge variant="secondary">{shipment.inbound_status || 'open'}</Badge>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {shipment.account_name && <span>{shipment.account_name} &middot; </span>}
              {shipment.vendor_name && <span>Vendor: {shipment.vendor_name} &middot; </span>}
              {carrierName && <span>Carrier: {carrierName} &middot; </span>}
              Created {formatDate(shipment.created_at)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleEditHeader}>
              <MaterialIcon name="edit" size="sm" className="mr-1" />
              Edit Details
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddItemDialog(true)}>
              <MaterialIcon name="add" size="sm" className="mr-1" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Edit Header Panel */}
        {editingHeader && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Edit Expected Shipment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Vendor Name</Label>
                  <Input
                    value={headerVendor}
                    onChange={(e) => setHeaderVendor(e.target.value)}
                    placeholder="Enter vendor..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Carrier Name
                    <HelpTip tooltip="The shipping carrier or trucking company delivering this shipment." />
                  </Label>
                  <Input
                    value={headerCarrier}
                    onChange={(e) => setHeaderCarrier(e.target.value)}
                    placeholder="Enter carrier..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expected Pieces</Label>
                  <Input
                    type="number"
                    value={headerPieces}
                    onChange={(e) => setHeaderPieces(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ETA Start</Label>
                  <Input
                    type="date"
                    value={headerEtaStart}
                    onChange={(e) => setHeaderEtaStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ETA End</Label>
                  <Input
                    type="date"
                    value={headerEtaEnd}
                    onChange={(e) => setHeaderEtaEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={handleSaveHeader} disabled={headerSaving}>
                  {headerSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingHeader(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipping Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">ETA Start</div>
              <div className="font-medium">{formatDate(shipment.eta_start)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">ETA End</div>
              <div className="font-medium">{formatDate(shipment.eta_end)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Carrier</div>
              <div className="font-medium">{carrierName || '-'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Expected Pieces</div>
              <div className="font-medium">{shipment.expected_pieces ?? '-'}</div>
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
              <HelpTip tooltip="BOL, PRO, tracking numbers, POs. These references are used to match dock intakes to this expected shipment." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {displayRefs.map((ref) => (
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
              {displayRefs.length === 0 && (
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
            <CardTitle className="text-base flex items-center gap-2">
              Expected Items
              <HelpTip tooltip="Items expected in this shipment. Items may be created manually or through allocation from a manifest." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MaterialIcon name="inventory_2" size="xl" className="mb-2 opacity-40" />
                <p>No items yet. Add items manually or allocate from a manifest.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Sidemark</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Expected Qty</TableHead>
                      <TableHead className="text-right">Actual Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {item.expected_description || '-'}
                        </TableCell>
                        <TableCell>{item.expected_vendor || '-'}</TableCell>
                        <TableCell>{item.expected_sidemark || '-'}</TableCell>
                        <TableCell>{item.room || '-'}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground text-sm">
                          {item.notes || '-'}
                        </TableCell>
                        <TableCell className="text-right">{item.expected_quantity}</TableCell>
                        <TableCell className="text-right">{item.actual_quantity ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'received' ? 'default' : 'outline'}>
                            {item.status || 'pending'}
                          </Badge>
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

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expected Item</DialogTitle>
            <DialogDescription>
              Manually add an item to this expected shipment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={addItemDesc}
                  onChange={(e) => setAddItemDesc(e.target.value)}
                  placeholder="Item description"
                />
              </div>
              <div className="space-y-1">
                <Label>Vendor</Label>
                <Input
                  value={addItemVendor}
                  onChange={(e) => setAddItemVendor(e.target.value)}
                  placeholder="Vendor name"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Sidemark</Label>
                <Input
                  value={addItemSidemark}
                  onChange={(e) => setAddItemSidemark(e.target.value)}
                  placeholder="Sidemark"
                />
              </div>
              <div className="space-y-1">
                <Label>Room</Label>
                <Input
                  value={addItemRoom}
                  onChange={(e) => setAddItemRoom(e.target.value)}
                  placeholder="Room"
                />
              </div>
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={addItemQty}
                  onChange={(e) => setAddItemQty(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={addItemNotes}
                onChange={(e) => setAddItemNotes(e.target.value)}
                placeholder="Optional notes for this item..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={addingItem || !addItemDesc.trim()}>
              {addingItem ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
