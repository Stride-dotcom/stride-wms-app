import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Loader2, FlashlightOff, Flashlight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  scanning?: boolean;
  className?: string;
}

export function QRScanner({ onScan, onError, scanning = true, className }: QRScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!scanning) return;

    const scannerId = 'qr-scanner-region';
    
    const startScanner = async () => {
      try {
        setIsStarting(true);
        
        // Request camera permission first
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);

        // Create scanner instance
        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        // Get available cameras
        const cameras = await Html5Qrcode.getCameras();
        if (cameras.length === 0) {
          throw new Error('No cameras found');
        }

        // Prefer back camera
        const backCamera = cameras.find(cam => 
          cam.label.toLowerCase().includes('back') || 
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        );
        const cameraId = backCamera?.id || cameras[cameras.length - 1].id;

        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            // Debounce duplicate scans
            const now = Date.now();
            if (
              decodedText === lastScannedRef.current && 
              now - lastScanTimeRef.current < 2000
            ) {
              return;
            }
            lastScannedRef.current = decodedText;
            lastScanTimeRef.current = now;
            onScan(decodedText);
          },
          () => {
            // QR code not found - ignore
          }
        );

        // Check if torch is available
        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities();
          if ('torch' in capabilities) {
            setHasTorch(true);
          }
        } catch {
          // Torch not available
        }

        setIsStarting(false);
      } catch (err) {
        console.error('Camera error:', err);
        setHasPermission(false);
        setIsStarting(false);
        onError?.(err instanceof Error ? err.message : 'Camera access denied');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scanning, onScan, onError]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.error('Torch toggle failed:', err);
    }
  };

  if (hasPermission === false) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 bg-muted rounded-3xl", className)}>
        <CameraOff className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-center">Camera Access Required</p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Please allow camera access in your browser settings to scan QR codes.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {/* Scanner container */}
      <div 
        id="qr-scanner-region" 
        className="w-full aspect-square rounded-3xl overflow-hidden bg-black"
      />

      {/* Loading overlay */}
      {isStarting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted rounded-3xl">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Starting camera...</p>
        </div>
      )}

      {/* Scanning frame overlay */}
      {!isStarting && hasPermission && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner brackets */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[250px] h-[250px] relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Torch button */}
      {hasTorch && !isStarting && (
        <button
          onClick={toggleTorch}
          className="absolute bottom-4 right-4 p-3 bg-background/80 rounded-full backdrop-blur-sm"
        >
          {torchOn ? (
            <Flashlight className="h-6 w-6 text-yellow-500" />
          ) : (
            <FlashlightOff className="h-6 w-6 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );
}
