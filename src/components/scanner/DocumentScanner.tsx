/**
 * DocumentScanner Component
 * Main scanner modal with camera capture, review, and upload
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { MaterialIcon } from '@/components/ui/MaterialIcon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { DocumentContext, ScanState, UploadProgress, OcrResult } from '@/lib/scanner/types';
import {
  isNative,
  scanDocument,
  startScannerSession,
  addImageToSession,
  removeImageFromSession,
  getSessionImages,
  completeScannerSession,
  cancelScannerSession,
  cleanupScanOutput,
  resizeImage,
  fileToDataUrl,
} from '@/lib/scanner';
import { uploadDocument } from '@/lib/scanner/uploadService';
import { performOcr } from '@/lib/scanner/ocrService';

interface DocumentScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DocumentContext;
  isSensitive?: boolean;
  enableOcr?: boolean;
  onSuccess?: (documentId: string) => void;
  onError?: (error: Error) => void;
  initialMode?: 'camera' | 'upload';
}

export function DocumentScanner({
  open,
  onOpenChange,
  context,
  isSensitive = false,
  enableOcr = false,
  onSuccess,
  onError,
  initialMode = 'camera',
}: DocumentScannerProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<ScanState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [documentLabel, setDocumentLabel] = useState('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'camera' | 'upload'>(initialMode);
  const [cameraReady, setCameraReady] = useState(false);

  // Start camera when dialog opens
  useEffect(() => {
    if (open && mode === 'camera' && state === 'idle') {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [open, mode]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      cleanup();
    }
  }, [open]);

  const startCamera = async () => {
    try {
      setState('scanning');
      setCameraReady(false);
      
      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera is not available on this device. Please use the Upload option instead.');
        setState('error');
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
      
      // Start a new session
      const session = startScannerSession();
      setSessionId(session.id);
    } catch (err: any) {
      console.error('Camera error:', err);
      
      // Provide specific error messages based on the error type
      let errorMessage = 'Could not access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings and try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device. Please use the Upload option instead.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera is in use by another application. Please close other apps using the camera and try again.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the required settings. Trying with default settings...';
        // Try again with simpler constraints
        try {
          const simpleStream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = simpleStream;
          if (videoRef.current) {
            videoRef.current.srcObject = simpleStream;
            await videoRef.current.play();
            setCameraReady(true);
          }
          const session = startScannerSession();
          setSessionId(session.id);
          return; // Success with simple constraints
        } catch {
          errorMessage = 'Could not access camera with any settings. Please use the Upload option.';
        }
      }
      
      setError(errorMessage);
      setState('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const cleanup = () => {
    stopCamera();
    if (sessionId) {
      cancelScannerSession(sessionId);
    }
    setSessionId(null);
    setCapturedImages([]);
    setCurrentPreviewIndex(0);
    setDocumentLabel('');
    setUploadProgress(null);
    setError(null);
    setState('idle');
    setMode(initialMode);
  };

  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !sessionId) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    
    // Resize if needed
    const resized = await resizeImage(dataUrl, 1920, 1920, 0.85);
    
    addImageToSession(sessionId, resized);
    setCapturedImages(getSessionImages(sessionId));
    
    toast({
      title: `Page ${capturedImages.length + 1} captured`,
      description: 'Tap capture for more pages, or Done to finish.',
    });
  }, [sessionId, capturedImages.length, toast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setState('scanning');
    
    // Start session if not already started
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const session = startScannerSession();
      currentSessionId = session.id;
      setSessionId(currentSessionId);
    }

    try {
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          const dataUrl = await fileToDataUrl(file);
          const resized = await resizeImage(dataUrl, 1920, 1920, 0.85);
          addImageToSession(currentSessionId, resized);
        }
      }
      
      setCapturedImages(getSessionImages(currentSessionId));
      setState('reviewing');
    } catch (err) {
      console.error('File upload error:', err);
      setError('Failed to process uploaded files.');
      setState('error');
    }
    
    // Reset input
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    if (!sessionId) return;
    removeImageFromSession(sessionId, index);
    const images = getSessionImages(sessionId);
    setCapturedImages(images);
    
    if (currentPreviewIndex >= images.length) {
      setCurrentPreviewIndex(Math.max(0, images.length - 1));
    }
  };

  const handleDone = () => {
    if (capturedImages.length === 0) {
      setError('Please capture at least one page.');
      return;
    }
    stopCamera();
    setState('reviewing');
  };

  const handleUpload = async () => {
    if (!sessionId || capturedImages.length === 0) return;

    setState('uploading');
    setError(null);

    try {
      // Complete the session to generate PDF
      const scanOutput = await completeScannerSession(sessionId);
      
      // Perform OCR if enabled and we have page images
      let ocrResult: OcrResult | null = null;
      if (enableOcr && scanOutput.pageImageUris.length > 0) {
        setUploadProgress({ stage: 'preparing', percentage: 30 });
        try {
          ocrResult = await performOcr(scanOutput.pageImageUris);
        } catch (ocrErr) {
          console.warn('OCR failed, continuing without OCR:', ocrErr);
          // Continue without OCR - don't block upload
        }
      }
      
      // Upload the document with OCR result
      const result = await uploadDocument(
        scanOutput,
        context,
        ocrResult,
        {
          label: documentLabel || undefined,
          isSensitive,
          enableOcr,
        },
        setUploadProgress
      );
      
      // Cleanup
      cleanupScanOutput(scanOutput);
      
      setState('complete');
      toast({
        title: 'Document saved',
        description: 'Your document has been uploaded successfully.',
      });
      
      onSuccess?.(result.documentId);
      
      // Close after short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
      setState('error');
      onError?.(err instanceof Error ? err : new Error('Upload failed'));
    }
  };

  const handleRetry = () => {
    setError(null);
    if (mode === 'camera') {
      setState('scanning');
      startCamera();
    } else {
      setState('idle');
    }
  };

  const renderContent = () => {
    switch (state) {
      case 'idle':
      case 'scanning':
        if (mode === 'upload') {
          return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <MaterialIcon name="upload" className="text-primary" style={{ fontSize: '40px' }} />
              </div>
              <p className="text-muted-foreground">Select images to create a document</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <MaterialIcon name="upload" size="sm" className="mr-2" />
                Choose Files
              </Button>
              <Button variant="ghost" onClick={() => setMode('camera')}>
                Or use camera instead
              </Button>
            </div>
          );
        }
        
        return (
          <div className="relative">
            {/* Camera View */}
            <div className="aspect-[3/4] bg-black rounded-lg overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <MaterialIcon name="progress_activity" className="animate-spin text-white" style={{ fontSize: '32px' }} />
                </div>
              )}
              
              {/* Page count indicator */}
              {capturedImages.length > 0 && (
                <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                  {capturedImages.length} page{capturedImages.length !== 1 ? 's' : ''} captured
                </div>
              )}
            </div>
            
            {/* Capture Controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMode('upload')}
                className="h-12 w-12 rounded-full"
              >
                <MaterialIcon name="upload" size="md" />
              </Button>
              
              <Button
                size="icon"
                onClick={captureImage}
                disabled={!cameraReady}
                className="h-16 w-16 rounded-full"
              >
                <MaterialIcon name="photo_camera" style={{ fontSize: '32px' }} />
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleDone}
                disabled={capturedImages.length === 0}
                className="h-12 w-12 rounded-full"
              >
                <MaterialIcon name="check" size="md" />
              </Button>
            </div>
            
            {/* Thumbnail strip */}
            {capturedImages.length > 0 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {capturedImages.map((img, i) => (
                  <div
                    key={i}
                    className="relative flex-shrink-0 h-16 w-12 rounded border overflow-hidden"
                  >
                    <img src={img} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground p-0.5 rounded-bl"
                    >
                      <MaterialIcon name="close" style={{ fontSize: '12px' }} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={captureImage}
                  disabled={!cameraReady}
                  className="flex-shrink-0 h-16 w-12 rounded border-2 border-dashed flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                >
                  <MaterialIcon name="add" size="md" />
                </button>
              </div>
            )}
          </div>
        );

      case 'reviewing':
        return (
          <div className="space-y-4">
            {/* Preview carousel */}
            <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden">
              {capturedImages[currentPreviewIndex] && (
                <img
                  src={capturedImages[currentPreviewIndex]}
                  alt={`Page ${currentPreviewIndex + 1}`}
                  className="w-full h-full object-contain"
                />
              )}
              
              {capturedImages.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentPreviewIndex(i => Math.max(0, i - 1))}
                    disabled={currentPreviewIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80"
                  >
                    <MaterialIcon name="chevron_left" size="md" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentPreviewIndex(i => Math.min(capturedImages.length - 1, i + 1))}
                    disabled={currentPreviewIndex === capturedImages.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80"
                  >
                    <MaterialIcon name="chevron_right" size="md" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                    Page {currentPreviewIndex + 1} of {capturedImages.length}
                  </div>
                </>
              )}
            </div>

            {/* Document label */}
            <div className="space-y-2">
              <Label htmlFor="doc-label">Document Label (optional)</Label>
              <Input
                id="doc-label"
                placeholder="e.g., Bill of Lading, Invoice, etc."
                value={documentLabel}
                onChange={(e) => setDocumentLabel(e.target.value)}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setState('scanning');
                  if (mode === 'camera') startCamera();
                }}
                className="flex-1"
              >
                <MaterialIcon name="undo" size="sm" className="mr-2" />
                Retake
              </Button>
              <Button onClick={handleUpload} className="flex-1">
                <MaterialIcon name="check" size="sm" className="mr-2" />
                Save Document
              </Button>
            </div>
          </div>
        );

      case 'uploading':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <MaterialIcon name="progress_activity" className="animate-spin text-primary" style={{ fontSize: '48px' }} />
            <p className="font-medium">Uploading document...</p>
            {uploadProgress && (
              <div className="w-full max-w-xs space-y-2">
                <Progress value={uploadProgress.percentage} />
                <p className="text-sm text-muted-foreground text-center">
                  {uploadProgress.stage === 'preparing' && 'Preparing...'}
                  {uploadProgress.stage === 'uploading' && 'Uploading...'}
                  {uploadProgress.stage === 'saving' && 'Saving record...'}
                  {uploadProgress.stage === 'complete' && 'Complete!'}
                </p>
              </div>
            )}
          </div>
        );

      case 'complete':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <MaterialIcon name="check" className="text-green-600" style={{ fontSize: '32px' }} />
            </div>
            <p className="font-medium text-green-600">Document saved successfully!</p>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <MaterialIcon name="warning" className="text-destructive" style={{ fontSize: '32px' }} />
            </div>
            <p className="text-destructive font-medium">Something went wrong</p>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button onClick={handleRetry}>Try Again</Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state === 'reviewing' ? 'Review Document' :
             state === 'uploading' ? 'Uploading...' :
             state === 'complete' ? 'Complete' :
             state === 'error' ? 'Error' :
             'Scan Document'}
          </DialogTitle>
        </DialogHeader>
        
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
