import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useReceivingDiscrepancies,
  type ReceivingDiscrepancy,
  type DiscrepancyType,
} from '@/hooks/useReceivingDiscrepancies';

interface IssuesTabProps {
  shipmentId: string;
}

const TYPE_LABELS: Record<DiscrepancyType, { label: string; icon: string }> = {
  PIECES_MISMATCH: { label: 'Pieces Mismatch', icon: 'numbers' },
  DAMAGE: { label: 'Damage', icon: 'broken_image' },
  WET: { label: 'Wet', icon: 'water_drop' },
  OPEN: { label: 'Open', icon: 'package_2' },
  MISSING_DOCS: { label: 'Missing Docs', icon: 'description' },
  REFUSED: { label: 'Refused', icon: 'block' },
  OTHER: { label: 'Other', icon: 'more_horiz' },
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function IssuesTab({ shipmentId }: IssuesTabProps) {
  const { discrepancies, loading, openCount, resolveDiscrepancy } = useReceivingDiscrepancies(shipmentId);
  const [resolveTarget, setResolveTarget] = useState<ReceivingDiscrepancy | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!resolveTarget || !resolutionNotes.trim()) return;
    setResolving(true);
    const success = await resolveDiscrepancy(resolveTarget.id, resolutionNotes.trim());
    setResolving(false);
    if (success) {
      setResolveTarget(null);
      setResolutionNotes('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <MaterialIcon name="progress_activity" size="lg" className="animate-spin text-primary" />
      </div>
    );
  }

  if (discrepancies.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MaterialIcon name="check_circle" size="xl" className="mb-2 opacity-40" />
        <p>No issues recorded for this shipment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <Badge variant={openCount > 0 ? 'destructive' : 'default'}>
          {openCount} open
        </Badge>
        <Badge variant="secondary">
          {discrepancies.length - openCount} resolved
        </Badge>
      </div>

      {/* Issues list */}
      <div className="space-y-3">
        {discrepancies.map((d) => {
          const typeInfo = TYPE_LABELS[d.type] || { label: d.type, icon: 'info' };
          const details = d.details as Record<string, unknown>;

          return (
            <Card key={d.id} className={d.status === 'open' ? 'border-red-200' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <MaterialIcon
                      name={typeInfo.icon}
                      size="md"
                      className={d.status === 'open' ? 'text-red-500' : 'text-green-500'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{typeInfo.label}</span>
                        <Badge variant={d.status === 'open' ? 'destructive' : 'outline'} className="text-xs">
                          {d.status}
                        </Badge>
                        {details.stage && (
                          <Badge variant="secondary" className="text-xs">
                            {String(details.stage)}
                          </Badge>
                        )}
                      </div>

                      {/* Details */}
                      {details.note && (
                        <p className="text-sm text-muted-foreground mt-1">{String(details.note)}</p>
                      )}
                      {details.signed !== undefined && details.received !== undefined && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Signed: {String(details.signed)} → Received: {String(details.received)}
                          {details.difference && ` (diff: ${String(details.difference)})`}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-1">
                        Created {formatDateTime(d.created_at)}
                      </p>

                      {/* Resolution */}
                      {d.status === 'resolved' && d.resolution_notes && (
                        <div className="mt-2 p-2 bg-green-50 rounded-md border border-green-100">
                          <p className="text-xs font-medium text-green-700">Resolution</p>
                          <p className="text-sm text-green-800">{d.resolution_notes}</p>
                          {d.resolved_at && (
                            <p className="text-xs text-green-600 mt-1">
                              Resolved {formatDateTime(d.resolved_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {d.status === 'open' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResolveTarget(d)}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {resolveTarget && (
              <div className="text-sm">
                <span className="font-medium">
                  {TYPE_LABELS[resolveTarget.type]?.label || resolveTarget.type}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Resolution Notes <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Describe how this issue was resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!resolutionNotes.trim() || resolving}
            >
              {resolving ? (
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
              ) : (
                <MaterialIcon name="check" size="sm" className="mr-2" />
              )}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
