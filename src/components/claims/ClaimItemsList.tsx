import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClaims, ClaimItem, PayoutMethod } from '@/hooks/useClaims';
import { Package, DollarSign, Wrench, Loader2, Trash2, Edit2, Save, X } from 'lucide-react';

interface ClaimItemsListProps {
  claimId: string;
  claimStatus: string;
  onTotalsChange?: (totals: { requested: number; approved: number; deductible: number }) => void;
}

export function ClaimItemsList({ claimId, claimStatus, onTotalsChange }: ClaimItemsListProps) {
  const { fetchClaimItems, updateClaimItem, removeClaimItem, calculateItemPayout } = useClaims();
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    requested_amount: string;
    approved_amount: string;
    repairable: string;
    repair_cost: string;
    payout_method: string;
  }>({
    requested_amount: '',
    approved_amount: '',
    repairable: '',
    repair_cost: '',
    payout_method: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ClaimItem | null>(null);

  const loadItems = async () => {
    setLoading(true);
    const data = await fetchClaimItems(claimId);
    setItems(data);
    setLoading(false);

    // Calculate totals
    if (onTotalsChange && data.length > 0) {
      const totals = data.reduce(
        (acc, item) => ({
          requested: acc.requested + (item.requested_amount || 0),
          approved: acc.approved + (item.approved_amount || 0),
          deductible: acc.deductible + (item.deductible_applied || 0),
        }),
        { requested: 0, approved: 0, deductible: 0 }
      );
      onTotalsChange(totals);
    }
  };

  useEffect(() => {
    loadItems();
  }, [claimId]);

  const startEditing = (item: ClaimItem) => {
    setEditingItemId(item.id);
    setEditForm({
      requested_amount: item.requested_amount?.toString() || '',
      approved_amount: item.approved_amount?.toString() || '',
      repairable: item.repairable === null ? '' : item.repairable ? 'yes' : 'no',
      repair_cost: item.repair_cost?.toString() || '',
      payout_method: item.payout_method || '',
    });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditForm({
      requested_amount: '',
      approved_amount: '',
      repairable: '',
      repair_cost: '',
      payout_method: '',
    });
  };

  const saveEditing = async () => {
    if (!editingItemId) return;

    const updates: Partial<ClaimItem> = {};

    if (editForm.requested_amount) {
      updates.requested_amount = parseFloat(editForm.requested_amount);
    }
    if (editForm.approved_amount) {
      updates.approved_amount = parseFloat(editForm.approved_amount);
    }
    if (editForm.repairable !== '') {
      updates.repairable = editForm.repairable === 'yes';
    }
    if (editForm.repair_cost) {
      updates.repair_cost = parseFloat(editForm.repair_cost);
    }
    if (editForm.payout_method) {
      updates.payout_method = editForm.payout_method as PayoutMethod;
    }

    const success = await updateClaimItem(editingItemId, updates);
    if (success) {
      cancelEditing();
      loadItems();
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const success = await removeClaimItem(itemToDelete.id);
    if (success) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      loadItems();
    }
  };

  const getCoverageLabel = (type: string | null) => {
    switch (type) {
      case 'standard': return 'Standard';
      case 'full_replacement_deductible': return 'Full w/ Ded';
      case 'full_replacement_no_deductible': return 'Full';
      case 'pending': return 'Pending';
      default: return 'None';
    }
  };

  const getCoverageBadgeVariant = (type: string | null): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
      case 'full_replacement_no_deductible': return 'default';
      case 'full_replacement_deductible': return 'secondary';
      case 'standard': return 'outline';
      default: return 'destructive';
    }
  };

  const canEdit = ['initiated', 'under_review'].includes(claimStatus);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Claim Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Claim Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No items linked to this claim
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Claim Items
            <Badge variant="secondary">{items.length}</Badge>
          </CardTitle>
          <CardDescription>
            Items included in this claim with coverage and valuation details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead className="text-right">Declared</TableHead>
                  <TableHead className="text-right">Max Payout</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead>Repairable</TableHead>
                  <TableHead>Payout</TableHead>
                  {canEdit && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const maxPayout = calculateItemPayout(item);
                  const isEditing = editingItemId === item.id;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.item ? (
                          <Link
                            to={`/inventory/${item.item.id}`}
                            className="text-primary hover:underline font-mono text-sm"
                          >
                            {item.item.item_code}
                          </Link>
                        ) : item.non_inventory_ref ? (
                          <span className="text-sm text-muted-foreground">
                            {item.non_inventory_ref}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getCoverageBadgeVariant(item.coverage_type)}>
                          {getCoverageLabel(item.coverage_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.declared_value != null
                          ? `$${item.declared_value.toLocaleString()}`
                          : item.weight_lbs != null
                          ? `${item.weight_lbs} lbs`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${maxPayout.maxPayout.toFixed(2)}
                        {maxPayout.deductible > 0 && (
                          <span className="text-xs block">
                            (-${maxPayout.deductible} ded.)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.requested_amount}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, requested_amount: e.target.value }))
                            }
                            className="w-24 h-8 text-right"
                          />
                        ) : item.requested_amount != null ? (
                          `$${item.requested_amount.toFixed(2)}`
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.approved_amount}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, approved_amount: e.target.value }))
                            }
                            className="w-24 h-8 text-right"
                          />
                        ) : item.approved_amount != null ? (
                          <span className="text-green-600">
                            ${item.approved_amount.toFixed(2)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editForm.repairable}
                            onValueChange={(v) =>
                              setEditForm((f) => ({ ...f, repairable: v }))
                            }
                          >
                            <SelectTrigger className="w-20 h-8">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : item.repairable === true ? (
                          <Badge variant="outline" className="gap-1">
                            <Wrench className="h-3 w-3" />
                            Yes
                          </Badge>
                        ) : item.repairable === false ? (
                          'No'
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editForm.payout_method}
                            onValueChange={(v) =>
                              setEditForm((f) => ({ ...f, payout_method: v }))
                            }
                          >
                            <SelectTrigger className="w-24 h-8">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-</SelectItem>
                              <SelectItem value="credit">Credit</SelectItem>
                              <SelectItem value="check">Check</SelectItem>
                              <SelectItem value="repair_vendor_pay">Vendor</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : item.payout_method ? (
                          <Badge variant="secondary" className="capitalize">
                            {item.payout_method.replace('_', ' ')}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={saveEditing}
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={cancelEditing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => startEditing(item)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setItemToDelete(item);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Totals Summary */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-end gap-8 text-sm">
              <div>
                <span className="text-muted-foreground">Total Requested:</span>{' '}
                <span className="font-medium">
                  ${items.reduce((sum, i) => sum + (i.requested_amount || 0), 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Approved:</span>{' '}
                <span className="font-bold text-green-600">
                  ${items.reduce((sum, i) => sum + (i.approved_amount || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Item from Claim</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-mono">
                {itemToDelete?.item?.item_code || itemToDelete?.non_inventory_ref}
              </span>{' '}
              from this claim? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
