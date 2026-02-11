import { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useExpectedShipmentDetail } from '@/hooks/useExpectedShipmentDetail';
import { useExternalRefs, type RefType } from '@/hooks/useExternalRefs';

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
  const { shipment, items, refs: shipmentRefs, loading, refetch } = useExpectedShipmentDetail(id);
  const { refs, addRef, removeRef } = useExternalRefs(id);

  const [newRefType, setNewRefType] = useState<RefType>('BOL');
  const [newRefValue, setNewRefValue] = useState('');

  const handleAddRef = async () => {
    if (!newRefValue.trim()) return;
    await addRef(newRefType, newRefValue);
    setNewRefValue('');
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
              {shipment.shipment_number}
              <Badge variant="secondary">{shipment.inbound_status || 'open'}</Badge>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {shipment.account_name && <span>{shipment.account_name} &middot; </span>}
              {shipment.vendor_name && <span>Vendor: {shipment.vendor_name} &middot; </span>}
              Created {formatDate(shipment.created_at)}
            </p>
          </div>
        </div>

        {/* Shipping Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <p>No items yet. Items will appear here when allocated from a manifest.</p>
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
    </DashboardLayout>
  );
}
