import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Loader2, FlashlightOff, Flashlight, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [isStarting, setIsStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  // Check permission state on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // Check if permissions API is available
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setPermissionState(result.state as 'prompt' | 'granted' | 'denied');
          });
        } else {
          // Permissions API not available, assume prompt needed
          setPermissionState('prompt');
        }
      } catch {
        // Fallback - permissions API might not support camera query
        setPermissionState('prompt');
      }
    };

    checkPermission();
  }, []);

  // Start scanner when permission is granted and scanning is true
  useEffect(() => {
    if (!scanning || permissionState !== 'granted') return;

    const scannerId = 'qr-scanner-region';
    
    const startScanner = async () => {
      try {
        setIsStarting(true);

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

        setIsStarting(false);
      } catch (err) {
        console.error('Camera error:', err);
        setIsStarting(false);
        onError?.(err instanceof Error ? err.message : 'Camera error');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scanning, permissionState, onScan, onError]);

  const requestPermission = async () => {
    try {
      setIsStarting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      stream.getTracks().forEach(track => track.stop());
      setPermissionState('granted');
    } catch (err) {
      console.error('Permission denied:', err);
      setPermissionState('denied');
      setShowPermissionDialog(true);
    } finally {
      setIsStarting(false);
    }
  };

  const openDeviceSettings = () => {
    // Provide instructions based on platform
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS doesn't allow direct settings link, show instructions
      alert('To enable camera:\n\n1. Open Settings app\n2. Scroll down and tap Safari (or your browser)\n3. Tap "Camera"\n4. Select "Allow"\n5. Return to this app and refresh');
    } else if (isAndroid) {
      // Android Chrome allows site settings
      alert('To enable camera:\n\n1. Tap the lock icon in your browser address bar\n2. Tap "Site settings" or "Permissions"\n3. Find "Camera" and change to "Allow"\n4. Refresh this page');
    } else {
      // Desktop browsers
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

  // Permission prompt state
  if (permissionState === 'checking') {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 bg-muted rounded-2xl aspect-square", className)}>
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Need to request permission
  if (permissionState === 'prompt') {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 bg-muted rounded-2xl aspect-square", className)}>
        <button
          onClick={requestPermission}
          disabled={isStarting}
          className="flex flex-col items-center justify-center w-full h-full hover:bg-muted-foreground/10 rounded-xl transition-colors"
        >
          {isStarting ? (
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
          ) : (
            <Camera className="h-16 w-16 text-primary mb-4" />
          )}
          <p className="text-lg font-medium">Tap to Enable Camera</p>
          <p className="text-sm text-muted-foreground mt-1">
            Allow camera access to scan QR codes
          </p>
        </button>
      </div>
    );
  }

  // Permission denied
  if (permissionState === 'denied') {
    return (
      <>
        <div className={cn("flex flex-col items-center justify-center p-8 bg-muted rounded-2xl aspect-square", className)}>
          <button
            onClick={() => setShowPermissionDialog(true)}
            className="flex flex-col items-center justify-center w-full h-full hover:bg-muted-foreground/10 rounded-xl transition-colors"
          >
            <CameraOff className="h-16 w-16 text-destructive mb-4" />
            <p className="text-lg font-medium">Camera Blocked</p>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Tap here to learn how to enable
            </p>
          </button>
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
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={openDeviceSettings} className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                How to Enable Camera
              </Button>
              <Button variant="outline" onClick={() => setShowPermissionDialog(false)} className="w-full">
                Use Manual Entry Instead
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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

      {/* Loading overlay */}
      {isStarting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted rounded-2xl">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Starting camera...</p>
        </div>
      )}

      {/* Scanning frame overlay */}
      {!isStarting && (
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
      )}

      {/* Torch button */}
      {hasTorch && !isStarting && (
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
