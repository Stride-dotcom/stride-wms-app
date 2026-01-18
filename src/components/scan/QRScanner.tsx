import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Loader2, FlashlightOff, Flashlight, Settings, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  scanning?: boolean;
  className?: string;
}

export function QRScanner({ onScan, onError, scanning = true, className }: QRScannerProps) {
  const [status, setStatus] = useState<'loading' | 'active' | 'error' | 'denied'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const startCamera = async () => {
    const scannerId = 'qr-scanner-region';
    
    // Make sure the element exists
    const element = document.getElementById(scannerId);
    if (!element) {
      console.log('Scanner element not found, retrying...');
      setTimeout(startCamera, 100);
      return;
    }

    try {
      setStatus('loading');
      setErrorMessage('');

      // Stop any existing scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // Ignore stop errors
        }
        scannerRef.current = null;
      }

      // Create scanner instance
      const html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      // Get available cameras
      const cameras = await Html5Qrcode.getCameras();
      console.log('Available cameras:', cameras);
      
      if (cameras.length === 0) {
        throw new Error('No cameras found on this device');
      }

      // Prefer back camera
      const backCamera = cameras.find(cam => 
        cam.label.toLowerCase().includes('back') || 
        cam.label.toLowerCase().includes('rear') ||
        cam.label.toLowerCase().includes('environment')
      );
      const cameraId = backCamera?.id || cameras[cameras.length - 1].id;
      console.log('Using camera:', cameraId);

      await html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 200, height: 200 },
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

      if (mountedRef.current) {
        setStatus('active');
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      
      if (!mountedRef.current) return;

      const errorStr = err?.message || err?.toString() || 'Unknown error';
      
      // Check if it's a permission error
      if (
        errorStr.includes('Permission') || 
        errorStr.includes('permission') ||
        errorStr.includes('NotAllowedError') ||
        errorStr.includes('denied')
      ) {
        setStatus('denied');
        setErrorMessage('Camera access was denied');
      } else {
        setStatus('error');
        setErrorMessage(errorStr);
      }
      
      onError?.(errorStr);
    }
  };

  // Start camera when component mounts and scanning is true
  useEffect(() => {
    mountedRef.current = true;

    if (scanning) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(startCamera, 200);
      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
        if (scannerRef.current) {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current = null;
        }
      };
    }

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scanning]);

  const openDeviceSettings = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      alert('To enable camera:\n\n1. Open Settings app\n2. Scroll down and tap Safari (or your browser)\n3. Tap "Camera"\n4. Select "Allow"\n5. Return to this app and refresh');
    } else if (isAndroid) {
      alert('To enable camera:\n\n1. Tap the lock icon in your browser address bar\n2. Tap "Site settings" or "Permissions"\n3. Find "Camera" and change to "Allow"\n4. Refresh this page');
    } else {
      alert('To enable camera:\n\n1. Click the camera icon in your browser address bar\n2. Select "Allow" for camera access\n3. Refresh this page');
    }
    
    setShowPermissionDialog(false);
  };

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

  const handleRetry = () => {
    startCamera();
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className={cn("relative", className)}>
        <div 
          id="qr-scanner-region" 
          className="w-full aspect-square rounded-2xl overflow-hidden bg-black"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted rounded-2xl">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Starting camera...</p>
        </div>
      </div>
    );
  }

  // Permission denied
  if (status === 'denied') {
    return (
      <>
        <div className={cn("flex flex-col items-center justify-center p-6 bg-muted rounded-2xl aspect-square", className)}>
          <CameraOff className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-medium text-center">Camera Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1 text-center mb-4">
            Enable camera in your browser settings
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <Button onClick={() => setShowPermissionDialog(true)} size="sm">
              <Settings className="h-4 w-4 mr-2" />
              How to Enable
            </Button>
            <Button onClick={handleRetry} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>

        <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CameraOff className="h-5 w-5 text-destructive" />
                Camera Access Blocked
              </DialogTitle>
              <DialogDescription>
                Camera access was denied. You'll need to enable it in your device or browser settings to scan QR codes.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Don't worry! You can still use the manual entry option below the scanner to type item codes directly.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={openDeviceSettings} className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                How to Enable Camera
              </Button>
              <Button variant="outline" onClick={() => setShowPermissionDialog(false)} className="w-full">
                Use Manual Entry Instead
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className={cn("flex flex-col items-center justify-center p-6 bg-muted rounded-2xl aspect-square", className)}>
        <Camera className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-center">Camera Error</p>
        <p className="text-sm text-muted-foreground mt-1 text-center mb-4 max-w-[250px]">
          {errorMessage || 'Could not start camera'}
        </p>
        <Button onClick={handleRetry} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  // Scanner active
  return (
    <div className={cn("relative", className)}>
      {/* Scanner container */}
      <div 
        id="qr-scanner-region" 
        className="w-full aspect-square rounded-2xl overflow-hidden bg-black"
      />

      {/* Scanning frame overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[200px] h-[200px] relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
          </div>
        </div>
      </div>

      {/* Torch button */}
      {hasTorch && (
        <button
          onClick={toggleTorch}
          className="absolute bottom-3 right-3 p-2 bg-background/80 rounded-full backdrop-blur-sm"
        >
          {torchOn ? (
            <Flashlight className="h-5 w-5 text-yellow-500" />
          ) : (
            <FlashlightOff className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );
}
