import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useReceivingSession } from '@/hooks/useReceivingSession';
import { PhotoCapture } from './PhotoCapture';
import { format } from 'date-fns';
import {
  Loader2,
  Play,
  CheckCircle,
  X,
  Camera,
  FileText,
  StickyNote,
  Lock,
  User,
  Clock,
  Package,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react';

interface ShipmentItem {
  id: string;
  expected_description: string | null;
  expected_quantity: number | null;
  received_quantity: number | null;
}

interface ReceivingSessionProps {
  shipmentId: string;
  shipmentNumber: string;
  expectedItems: ShipmentItem[];
  onComplete: () => void;
  onPhotosChange: (type: 'photos' | 'documents', urls: string[]) => void;
  existingPhotos: string[];
  existingDocuments: string[];
}

export function ReceivingSession({
  shipmentId,
  shipmentNumber,
  expectedItems,
  onComplete,
  onPhotosChange,
  existingPhotos,
  existingDocuments,
}: ReceivingSessionProps) {
  const {
    session,
    loading,
    fetchSession,
    startSession,
    updateSessionNotes,
    finishSession,
    cancelSession,
  } = useReceivingSession(shipmentId);

  const [notes, setNotes] = useState('');
  const [trackingNumbers, setTrackingNumbers] = useState<string[]>(['']);
  const [receivedItems, setReceivedItems] = useState<{ description: string; quantity: number; receivedWithoutId: boolean }[]>([]);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    // Initialize received items from expected items
    if (expectedItems.length > 0 && receivedItems.length === 0) {
      setReceivedItems(
        expectedItems.map(item => ({
          description: item.expected_description || '',
          quantity: item.expected_quantity || 0,
          receivedWithoutId: false,
        }))
      );
    }
  }, [expectedItems]);

  const handleStartReceiving = async () => {
    const newSession = await startSession();
    if (newSession) {
      // Session started successfully
    }
  };

  const handleNotesBlur = () => {
    if (session) {
      updateSessionNotes(notes);
    }
  };

  const handleAddTrackingNumber = () => {
    setTrackingNumbers([...trackingNumbers, '']);
  };

  const handleTrackingChange = (index: number, value: string) => {
    const newNumbers = [...trackingNumbers];
    newNumbers[index] = value;
    setTrackingNumbers(newNumbers);
  };

  const handleReceivedQuantityChange = (index: number, quantity: number) => {
    const newItems = [...receivedItems];
    newItems[index] = { ...newItems[index], quantity };
    setReceivedItems(newItems);
  };

  const handleReceivedWithoutIdChange = (index: number, value: boolean) => {
    const newItems = [...receivedItems];
    newItems[index] = { ...newItems[index], receivedWithoutId: value };
    setReceivedItems(newItems);
  };

  const handleFinishReceiving = async () => {
    setFinishing(true);

    // Build verification data
    const discrepancies = receivedItems
      .map((item, index) => {
        const expected = expectedItems[index]?.expected_quantity || 0;
        if (item.quantity !== expected) {
          return {
            description: item.description,
            expected,
            received: item.quantity,
          };
        }
        return null;
      })
      .filter(Boolean) as { description: string; expected: number; received: number }[];

    const backorderItems = discrepancies
      .filter(d => d.received < d.expected)
      .map(d => ({
        description: d.description,
        quantity: d.expected - d.received,
      }));

    const verificationData = {
      expected_items: expectedItems.map(item => ({
        description: item.expected_description || '',
        quantity: item.expected_quantity || 0,
      })),
      received_items: receivedItems,
      discrepancies,
      backorder_items: backorderItems,
      tracking_numbers: trackingNumbers.filter(t => t.trim()),
      notes,
    };

    const success = await finishSession(verificationData);
    setFinishing(false);

    if (success) {
      setShowFinishDialog(false);
      onComplete();
    }
  };

  const handleCancelSession = async () => {
    await cancelSession();
  };

  // If another user has an active session
  if (session && session.started_by !== session.started_by) {
    const userName = session.started_by_user
      ? `${session.started_by_user.first_name || ''} ${session.started_by_user.last_name || ''}`.trim() || session.started_by_user.email
      : 'Another user';

    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Lock className="h-5 w-5" />
            Receiving in Progress
          </CardTitle>
          <CardDescription className="text-orange-600">
            This shipment is currently being received by another user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{userName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Started {format(new Date(session.started_at), 'MMM d, h:mm a')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No active session - show start button
  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Receive Shipment
          </CardTitle>
          <CardDescription>
            Start the receiving process to verify and create inventory items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleStartReceiving} disabled={loading} size="lg">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Start Receiving Shipment
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active session - show receiving UI
  return (
    <div className="space-y-6">
      {/* Session Header */}
      <Card className="border-primary">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Receiving {shipmentNumber}
              </CardTitle>
              <CardDescription>
                Started {format(new Date(session.started_at), 'MMM d, yyyy h:mm a')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelSession}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={() => setShowFinishDialog(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Finish Receiving
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Photos & Documents */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" />
              Receiving Photos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoCapture
              entityType="shipment"
              entityId={shipmentId}
              onPhotosChange={(urls) => onPhotosChange('photos', urls)}
              existingPhotos={existingPhotos}
              label=""
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Receiving Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoCapture
              entityType="shipment"
              entityId={shipmentId}
              onPhotosChange={(urls) => onPhotosChange('documents', urls)}
              existingPhotos={existingDocuments}
              label=""
              acceptDocuments
            />
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4" />
            Receiving Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any notes about this receiving..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Tracking Numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracking / Reference Numbers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trackingNumbers.map((number, index) => (
            <Input
              key={index}
              placeholder="Enter tracking number"
              value={number}
              onChange={(e) => handleTrackingChange(index, e.target.value)}
            />
          ))}
          <Button variant="outline" size="sm" onClick={handleAddTrackingNumber}>
            Add Another
          </Button>
        </CardContent>
      </Card>

      {/* Finish Receiving Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Verify & Complete Receiving</DialogTitle>
            <DialogDescription>
              Confirm the quantities received. Any discrepancies will be noted.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-24">Expected</TableHead>
                  <TableHead className="text-right w-32">Received</TableHead>
                  <TableHead className="w-32 text-center">No ID</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivedItems.map((item, index) => {
                  const expected = expectedItems[index]?.expected_quantity || 0;
                  const hasDiscrepancy = item.quantity !== expected;
                  return (
                    <TableRow key={index}>
                      <TableCell>{item.description || '-'}</TableCell>
                      <TableCell className="text-right">{expected}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) => handleReceivedQuantityChange(index, parseInt(e.target.value) || 0)}
                          className="w-24 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Checkbox
                            id={`no-id-${index}`}
                            checked={item.receivedWithoutId}
                            onCheckedChange={(checked) => handleReceivedWithoutIdChange(index, checked as boolean)}
                          />
                          <Label htmlFor={`no-id-${index}`} className="text-xs text-muted-foreground flex items-center gap-1">
                            <HelpCircle className="h-3 w-3" />
                          </Label>
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasDiscrepancy ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {item.quantity < expected ? 'Short' : 'Over'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinishDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFinishReceiving} disabled={finishing}>
              {finishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Complete Receiving
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
