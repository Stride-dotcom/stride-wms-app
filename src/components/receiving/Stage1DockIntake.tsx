import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AutosaveIndicator } from './AutosaveIndicator';
import { useReceivingAutosave } from '@/hooks/useReceivingAutosave';
import { useShipmentPhotos, type ShipmentPhoto } from '@/hooks/useShipmentPhotos';
import { useReceivingDiscrepancies, type DiscrepancyType } from '@/hooks/useReceivingDiscrepancies';
import { SignaturePad } from '@/components/shipments/SignaturePad';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Exception types for Stage 1
type ExceptionType = 'NO_EXCEPTIONS' | 'DAMAGE' | 'WET' | 'OPEN' | 'MISSING_DOCS' | 'REFUSED' | 'OTHER';

const EXCEPTION_OPTIONS: { value: ExceptionType; label: string; icon: string }[] = [
  { value: 'NO_EXCEPTIONS', label: 'No Exceptions', icon: 'check_circle' },
  { value: 'DAMAGE', label: 'Damage', icon: 'broken_image' },
  { value: 'WET', label: 'Wet', icon: 'water_drop' },
  { value: 'OPEN', label: 'Open', icon: 'package_2' },
  { value: 'MISSING_DOCS', label: 'Missing Docs', icon: 'description' },
  { value: 'REFUSED', label: 'Refused', icon: 'block' },
  { value: 'OTHER', label: 'Other', icon: 'more_horiz' },
];

export interface MatchingParamsUpdate {
  vendorName: string;
  pieces: number;
  accountId: string | null;
}

interface Stage1DockIntakeProps {
  shipmentId: string;
  shipmentNumber: string;
  shipment: {
    account_id: string | null;
    vendor_name: string | null;
    signed_pieces: number | null;
    driver_name: string | null;
    signature_data: string | null;
    signature_name: string | null;
    dock_intake_breakdown: Record<string, unknown> | null;
    notes: string | null;
  };
  onComplete: () => void;
  onRefresh: () => void;
  /** Called whenever fields that affect matching change, so the matching panel can update reactively */
  onMatchingParamsChange?: (params: MatchingParamsUpdate) => void;
}

export function Stage1DockIntake({
  shipmentId,
  shipmentNumber,
  shipment,
  onComplete,
  onRefresh,
  onMatchingParamsChange,
}: Stage1DockIntakeProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  // Form state
  const [vendorName, setVendorName] = useState(shipment.vendor_name || '');
  const [signedPieces, setSignedPieces] = useState<number>(shipment.signed_pieces || 0);
  const [driverName, setDriverName] = useState(shipment.driver_name || '');
  const [notes, setNotes] = useState(shipment.notes || '');
  const [exceptions, setExceptions] = useState<ExceptionType[]>([]);
  const [exceptionNotes, setExceptionNotes] = useState<Record<string, string>>({});
  const [breakdown, setBreakdown] = useState<{ cartons: number; pallets: number; crates: number }>({
    cartons: 0,
    pallets: 0,
    crates: 0,
    ...(shipment.dock_intake_breakdown as any || {}),
  });

  // Signature
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(shipment.signature_data || null);
  const [signatureName, setSignatureName] = useState(shipment.signature_name || '');

  // Submitting
  const [completing, setCompleting] = useState(false);

  // Autosave
  const autosave = useReceivingAutosave(shipmentId, true);

  // Photos
  const {
    photos,
    loading: photosLoading,
    uploadPhoto,
    deletePhoto,
    paperworkCount,
    conditionCount,
  } = useShipmentPhotos(shipmentId);

  // Discrepancies
  const { createDiscrepancy } = useReceivingDiscrepancies(shipmentId);

  // File input refs
  const paperworkInputRef = useRef<HTMLInputElement>(null);
  const conditionInputRef = useRef<HTMLInputElement>(null);

  // Emit matching params whenever relevant fields change
  useEffect(() => {
    onMatchingParamsChange?.({
      vendorName,
      pieces: signedPieces,
      accountId: shipment.account_id,
    });
  }, [vendorName, signedPieces, shipment.account_id]);

  // Autosave handlers
  const handleVendorNameChange = (value: string) => {
    setVendorName(value);
    autosave.saveField('vendor_name', value);
  };

  const handleSignedPiecesChange = (value: number) => {
    setSignedPieces(value);
    autosave.saveField('signed_pieces', value);
  };

  const handleDriverNameChange = (value: string) => {
    setDriverName(value);
    autosave.saveField('driver_name', value);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    autosave.saveField('notes', value);
  };

  const handleBreakdownChange = (field: string, value: number) => {
    const newBreakdown = { ...breakdown, [field]: value };
    setBreakdown(newBreakdown);
    autosave.saveField('dock_intake_breakdown', newBreakdown);
  };

  // Exception toggles — mutual exclusion with NO_EXCEPTIONS
  const toggleException = (ex: ExceptionType) => {
    setExceptions(prev => {
      if (ex === 'NO_EXCEPTIONS') {
        return ['NO_EXCEPTIONS'];
      }
      const filtered = prev.filter(e => e !== 'NO_EXCEPTIONS');
      if (filtered.includes(ex)) {
        return filtered.filter(e => e !== ex);
      }
      return [...filtered, ex];
    });
  };

  // Photo upload handler
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    category: ShipmentPhoto['category']
  ) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      await uploadPhoto(files[i], category);
    }

    // Reset input
    event.target.value = '';
  };

  // Signature handlers
  const handleSignatureComplete = (data: string, name: string) => {
    setSignatureData(data);
    setSignatureName(name);
    setShowSignatureDialog(false);

    // Save signature to shipment
    supabase
      .from('shipments')
      .update({
        signature_data: data,
        signature_name: name,
        signature_timestamp: new Date().toISOString(),
      } as any)
      .eq('id', shipmentId)
      .then(({ error }) => {
        if (error) console.error('[Stage1] signature save error:', error);
      });
  };

  // Validation
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!vendorName.trim()) errors.push('Vendor name is required');
    if (signedPieces <= 0) errors.push('Signed pieces must be greater than 0');
    if (exceptions.length === 0) errors.push('At least one exception selection is required');
    if (paperworkCount < 1) errors.push('At least 1 paperwork photo is required');
    if (conditionCount < 1) errors.push('At least 1 condition photo is required');
    return errors;
  };

  // Complete Stage 1
  const handleComplete = async () => {
    const errors = validate();
    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Complete Stage 1',
        description: errors.join('. '),
      });
      return;
    }

    setCompleting(true);

    try {
      // Flush any pending autosave
      await autosave.saveNow();

      // Create discrepancy records for exceptions (not NO_EXCEPTIONS)
      const exceptionTypes = exceptions.filter(e => e !== 'NO_EXCEPTIONS');
      for (const exType of exceptionTypes) {
        await createDiscrepancy({
          shipmentId,
          type: exType as DiscrepancyType,
          details: {
            stage: 'stage1',
            note: exceptionNotes[exType] || undefined,
          },
        });
      }

      // Update shipment: set inbound_status to stage1_complete
      const updateData: Record<string, unknown> = {
        inbound_status: 'stage1_complete',
        vendor_name: vendorName,
        signed_pieces: signedPieces,
        driver_name: driverName || null,
        notes: notes || null,
        dock_intake_breakdown: breakdown,
      };

      const { error } = await supabase
        .from('shipments')
        .update(updateData as any)
        .eq('id', shipmentId);

      if (error) throw error;

      toast({ title: 'Stage 1 Complete', description: 'Dock intake has been recorded.' });
      onComplete();
    } catch (err: any) {
      console.error('[Stage1] complete error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to complete Stage 1',
      });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MaterialIcon name="local_shipping" size="md" className="text-primary" />
                Stage 1 — Dock Intake
                <Badge variant="outline">{shipmentNumber}</Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Record the delivery at the dock. All fields autosave.
              </CardDescription>
            </div>
            <AutosaveIndicator status={autosave.status} onRetry={autosave.retryNow} />
          </div>
        </CardHeader>
      </Card>

      {/* Vendor + Pieces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="business" size="sm" />
            Delivery Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor_name">
                Vendor Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vendor_name"
                placeholder="Enter vendor name"
                value={vendorName}
                onChange={(e) => handleVendorNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signed_pieces">
                Signed Pieces <span className="text-red-500">*</span>
                <HelpTip tooltip="The number of pieces counted and signed for at the dock. This is the authoritative piece count." />
              </Label>
              <Input
                id="signed_pieces"
                type="number"
                min={0}
                placeholder="0"
                value={signedPieces || ''}
                onChange={(e) => handleSignedPiecesChange(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="driver_name">Driver Name (optional)</Label>
              <Input
                id="driver_name"
                placeholder="Enter driver name"
                value={driverName}
                onChange={(e) => handleDriverNameChange(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mixed Unit Breakdown (optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="inventory" size="sm" />
            Unit Breakdown (optional)
            <HelpTip tooltip="Break down signed pieces by packaging type. Does not need to sum to signed pieces." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cartons">Cartons</Label>
              <Input
                id="cartons"
                type="number"
                min={0}
                value={breakdown.cartons || ''}
                onChange={(e) => handleBreakdownChange('cartons', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pallets">Pallets</Label>
              <Input
                id="pallets"
                type="number"
                min={0}
                value={breakdown.pallets || ''}
                onChange={(e) => handleBreakdownChange('pallets', parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crates">Crates</Label>
              <Input
                id="crates"
                type="number"
                min={0}
                value={breakdown.crates || ''}
                onChange={(e) => handleBreakdownChange('crates', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exceptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="report_problem" size="sm" />
            Exceptions <span className="text-red-500">*</span>
            <HelpTip tooltip="Select any exceptions observed at the dock. Selecting 'No Exceptions' clears all others. At least one selection required." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {EXCEPTION_OPTIONS.map((opt) => {
              const isSelected = exceptions.includes(opt.value);
              return (
                <Button
                  key={opt.value}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => toggleException(opt.value)}
                >
                  <MaterialIcon name={opt.icon} size="sm" />
                  {opt.label}
                </Button>
              );
            })}
          </div>

          {/* Exception notes for selected exceptions */}
          {exceptions.filter(e => e !== 'NO_EXCEPTIONS').map((ex) => (
            <div key={ex} className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Note for {EXCEPTION_OPTIONS.find(o => o.value === ex)?.label}
              </Label>
              <Textarea
                placeholder="Describe the exception..."
                rows={2}
                value={exceptionNotes[ex] || ''}
                onChange={(e) => setExceptionNotes(prev => ({ ...prev, [ex]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Photos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Paperwork Photos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MaterialIcon name="description" size="sm" />
                Paperwork Photos <span className="text-red-500">*</span>
                <Badge variant={paperworkCount >= 1 ? 'default' : 'destructive'}>
                  {paperworkCount}
                </Badge>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => paperworkInputRef.current?.click()}
              >
                <MaterialIcon name="add_a_photo" size="sm" className="mr-1" />
                Add
              </Button>
              <input
                ref={paperworkInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoUpload(e, 'PAPERWORK')}
              />
            </div>
          </CardHeader>
          <CardContent>
            {photos.filter(p => p.category === 'PAPERWORK').length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.filter(p => p.category === 'PAPERWORK').map((photo) => (
                  <div key={photo.id} className="relative group aspect-square rounded-md overflow-hidden border">
                    <img
                      src={photo.url}
                      alt={photo.file_name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MaterialIcon name="close" size="sm" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No paperwork photos yet. At least 1 required.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Condition Photos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MaterialIcon name="photo_camera" size="sm" />
                Condition Photos <span className="text-red-500">*</span>
                <Badge variant={conditionCount >= 1 ? 'default' : 'destructive'}>
                  {conditionCount}
                </Badge>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => conditionInputRef.current?.click()}
              >
                <MaterialIcon name="add_a_photo" size="sm" className="mr-1" />
                Add
              </Button>
              <input
                ref={conditionInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoUpload(e, 'CONDITION')}
              />
            </div>
          </CardHeader>
          <CardContent>
            {photos.filter(p => p.category === 'CONDITION').length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.filter(p => p.category === 'CONDITION').map((photo) => (
                  <div key={photo.id} className="relative group aspect-square rounded-md overflow-hidden border">
                    <img
                      src={photo.url}
                      alt={photo.file_name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MaterialIcon name="close" size="sm" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No condition photos yet. At least 1 required.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signature (optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="draw" size="sm" />
            Signature (optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signatureData ? (
            <div className="space-y-2">
              <div className="border rounded-md p-2 bg-white">
                <img src={signatureData} alt="Signature" className="max-h-24 mx-auto" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Signed by: {signatureName}</span>
                <Button variant="outline" size="sm" onClick={() => setShowSignatureDialog(true)}>
                  Redo Signature
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowSignatureDialog(true)}>
              <MaterialIcon name="draw" size="sm" className="mr-2" />
              Capture Signature
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MaterialIcon name="sticky_note_2" size="sm" />
            Notes (optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add any notes about this delivery..."
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Complete Stage 1 */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          size="lg"
          onClick={handleComplete}
          disabled={completing}
          className="gap-2"
        >
          {completing ? (
            <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
          ) : (
            <MaterialIcon name="check_circle" size="sm" />
          )}
          Complete Dock Intake
        </Button>
      </div>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MaterialIcon name="draw" size="sm" />
              Driver / Delivery Signature
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sig-name">Signed By <span className="text-red-500">*</span></Label>
                <Input
                  id="sig-name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Name of person signing"
                />
              </div>
              <SignaturePad
                onSignatureChange={(data) => {
                  setSignatureData(data.signatureData);
                  if (data.signatureName) setSignatureName(data.signatureName);
                }}
                initialName=""
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignatureDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleSignatureComplete(signatureData || '', signatureName);
              }}
              disabled={!signatureData && !signatureName.trim()}
            >
              <MaterialIcon name="check" size="sm" className="mr-2" />
              Save Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
