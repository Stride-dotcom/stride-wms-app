/**
 * PhotoScannerButton Component
 * A button that opens the PhotoScanner dialog
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { PhotoScanner } from './PhotoScanner';

interface PhotoScannerButtonProps {
  entityType: 'item' | 'shipment' | 'receiving' | 'inspection' | 'repair' | 'task' | 'claim';
  entityId?: string;
  tenantId?: string;
  existingPhotos?: string[];
  maxPhotos?: number;
  onPhotosSaved: (urls: string[]) => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  label?: string;
  showCount?: boolean;
}

export function PhotoScannerButton({
  entityType,
  entityId,
  tenantId,
  existingPhotos = [],
  maxPhotos = 20,
  onPhotosSaved,
  variant = 'outline',
  size = 'default',
  className,
  label = 'Take Photos',
  showCount = true,
}: PhotoScannerButtonProps) {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setScannerOpen(true)}
        className={className}
      >
        <Camera className="h-4 w-4 mr-2" />
        {label}
        {showCount && existingPhotos.length > 0 && (
          <span className="ml-1 text-muted-foreground">({existingPhotos.length})</span>
        )}
      </Button>

      <PhotoScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        entityType={entityType}
        entityId={entityId}
        tenantId={tenantId}
        existingPhotos={existingPhotos}
        maxPhotos={maxPhotos}
        onPhotosSaved={onPhotosSaved}
      />
    </>
  );
}
