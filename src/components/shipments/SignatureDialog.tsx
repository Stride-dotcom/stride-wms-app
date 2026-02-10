import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import { SignaturePad } from './SignaturePad';

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releasedToName?: string;
  itemCount: number;
  onConfirm: (data: { signatureData: string | null; signatureName: string }) => Promise<void>;
}

export function SignatureDialog({
  open,
  onOpenChange,
  releasedToName,
  itemCount,
  onConfirm,
}: SignatureDialogProps) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasSignature = !!signatureData || !!signatureName.trim();

  const handleSignatureChange = (data: { signatureData: string | null; signatureName: string }) => {
    setSignatureData(data.signatureData);
    setSignatureName(data.signatureName);
  };

  const handleConfirm = async () => {
    if (!hasSignature) return;
    setSubmitting(true);
    try {
      await onConfirm({ signatureData, signatureName });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting) return;
    if (!nextOpen) {
      setSignatureData(null);
      setSignatureName('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MaterialIcon name="draw" size="sm" />
            Driver / Pickup Signature
          </DialogTitle>
          <DialogDescription>
            {releasedToName
              ? `${releasedToName} is picking up ${itemCount} item${itemCount !== 1 ? 's' : ''}. A signature is required to complete the release.`
              : `A signature is required to release ${itemCount} item${itemCount !== 1 ? 's' : ''}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <SignaturePad
            onSignatureChange={handleSignatureChange}
            initialName={releasedToName || ''}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!hasSignature || submitting}
          >
            {submitting ? (
              <>
                <MaterialIcon name="progress_activity" size="sm" className="mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <MaterialIcon name="check" size="sm" className="mr-2" />
                Sign & Complete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
