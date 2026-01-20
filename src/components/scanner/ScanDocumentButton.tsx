/**
 * ScanDocumentButton Component
 * Trigger button for document scanning
 */

import { useState } from 'react';
import { ScanLine, FileUp, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DocumentScanner } from './DocumentScanner';
import type { DocumentContext } from '@/lib/scanner/types';
import { isNative } from '@/lib/scanner/platformDetection';

interface ScanDocumentButtonProps {
  context: DocumentContext;
  onSuccess?: (documentId: string) => void;
  onError?: (error: Error) => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isSensitive?: boolean;
  label?: string;
  className?: string;
  showDropdown?: boolean;
  /** When true, skips dropdown and goes directly to camera mode */
  directToCamera?: boolean;
}

export function ScanDocumentButton({
  context,
  onSuccess,
  onError,
  variant = 'outline',
  size = 'default',
  isSensitive = false,
  label = 'Scan Document',
  className,
  showDropdown = true,
  directToCamera = false,
}: ScanDocumentButtonProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');

  const handleOpenScanner = (mode: 'camera' | 'upload') => {
    setScanMode(mode);
    setScannerOpen(true);
  };

  const handleSuccess = (documentId: string) => {
    setScannerOpen(false);
    onSuccess?.(documentId);
  };

  const handleError = (error: Error) => {
    setScannerOpen(false);
    onError?.(error);
  };

  // On native, use native scanner directly
  if (isNative()) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          onClick={() => handleOpenScanner('camera')}
          className={className}
        >
          <ScanLine className="mr-2 h-4 w-4" />
          {label}
        </Button>

        <DocumentScanner
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          context={context}
          isSensitive={isSensitive}
          onSuccess={handleSuccess}
          onError={handleError}
          initialMode={scanMode}
        />
      </>
    );
  }

  // If directToCamera is true, skip dropdown and go straight to camera
  if (directToCamera) {
    return (
      <>
        <Button
          variant={variant}
          size={size}
          onClick={() => handleOpenScanner('camera')}
          className={className}
        >
          <ScanLine className="mr-2 h-4 w-4" />
          {label}
        </Button>

        <DocumentScanner
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          context={context}
          isSensitive={isSensitive}
          onSuccess={handleSuccess}
          onError={handleError}
          initialMode={scanMode}
        />
      </>
    );
  }

  // On web, show dropdown with options
  if (showDropdown) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={variant} size={size} className={className}>
              <ScanLine className="mr-2 h-4 w-4" />
              {label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenScanner('camera')}>
              <Camera className="mr-2 h-4 w-4" />
              Use Camera
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenScanner('upload')}>
              <FileUp className="mr-2 h-4 w-4" />
              Upload File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DocumentScanner
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          context={context}
          isSensitive={isSensitive}
          onSuccess={handleSuccess}
          onError={handleError}
          initialMode={scanMode}
        />
      </>
    );
  }

  // Simple button without dropdown
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => handleOpenScanner('camera')}
        className={className}
      >
        <ScanLine className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <DocumentScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        context={context}
        isSensitive={isSensitive}
        onSuccess={handleSuccess}
        onError={handleError}
        initialMode={scanMode}
      />
    </>
  );
}
