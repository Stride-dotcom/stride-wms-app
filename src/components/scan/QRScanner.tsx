import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, RefreshCw, Settings } from 'lucide-react';
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
  /** When false, scanner must not keep the camera active */
  scanning?: boolean;
  className?: string;
}

type ScannerStatus = 'idle' | 'starting' | 'active' | 'denied' | 'error';

const SCANNER_REGION_ID = 'qr-scanner-region';

export function QRScanner({ onScan, onError, scanning = true, className }: QRScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startInFlightRef = useRef<Promise<void> | null>(null);

  const lastScannedRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  const safeStop = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    // IMPORTANT: html5-qrcode.stop() can throw synchronously (not just reject).
    try {
      const maybePromise = (scanner as any).stop?.();
      if (maybePromise && typeof (maybePromise as any).then === 'function') {
        await maybePromise;
      }
    } catch {
      // Swallow: "Cannot stop, scanner is not running or paused." etc.
    }

    scannerRef.current = null;
    setHasTorch(false);
    setTorchOn(false);
  }, []);

  const classifyError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const lowered = msg.toLowerCase();
    const isPermission =
      lowered.includes('permission') ||
      lowered.includes('notallowederror') ||
      lowered.includes('denied') ||
      lowered.includes('permission denied');
    return { msg, isPermission };
  };

  const startCamera = useCallback(async () => {
    if (!scanning) return;

    // Prevent concurrent start/stop races
    if (startInFlightRef.current) return;

    startInFlightRef.current = (async () => {
      try {
        setStatus('starting');
        setErrorMessage('');

        // If a previous instance exists, stop it first.
        await safeStop();

        // Ensure region exists in DOM
        const region = document.getElementById(SCANNER_REGION_ID);
        if (!region) {
          throw new Error('Scanner region not mounted');
        }

        const html5QrCode = new Html5Qrcode(SCANNER_REGION_ID);
        scannerRef.current = html5QrCode;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) {
          throw new Error('No cameras found on this device');
        }

        // Prefer a back camera if labeled
        const backCamera = cameras.find((cam) => {
          const l = cam.label.toLowerCase();
          return l.includes('back') || l.includes('rear') || l.includes('environment');
        });
        const cameraId = backCamera?.id || cameras[cameras.length - 1].id;

        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1,
          },
          (decodedText) => {
            const now = Date.now();
            if (decodedText === lastScannedRef.current && now - lastScanTimeRef.current < 1500) {
              return;
            }
            lastScannedRef.current = decodedText;
            lastScanTimeRef.current = now;
            onScan(decodedText);
          },
          () => {
            // ignore scan failures (no QR in frame)
          }
        );

        // Torch capability (best-effort)
        try {
          const caps = (html5QrCode as any).getRunningTrackCapabilities?.();
          if (caps && 'torch' in caps) setHasTorch(true);
        } catch {
          // ignore
        }

        setStatus('active');
      } catch (err) {
        const { msg, isPermission } = classifyError(err);
        setErrorMessage(msg);
        setStatus(isPermission ? 'denied' : 'error');
        onError?.(msg);

        // Ensure we don't leave a half-started instance around
        await safeStop();
      } finally {
        startInFlightRef.current = null;
      }
    })();

    await startInFlightRef.current;
  }, [onError, onScan, safeStop, scanning]);

  // If parent disables scanning (e.g., confirm screen), release camera.
  useEffect(() => {
    if (!scanning) {
      // Stop without throwing, and reset UI to idle.
      safeStop();
      setStatus('idle');
      return;
    }

    // When scanning becomes true again, we intentionally do NOT autostart.
    // Many mobile browsers require a user gesture (tap) to start the camera.
  }, [scanning, safeStop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      safeStop();
    };
  }, [safeStop]);

  const openSettingsHelp = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      alert(
        'Enable camera on iPhone/iPad:\n\n1) Settings app\n2) Safari (or your browser)\n3) Camera\n4) Allow\n5) Return here and reload'
      );
    } else if (isAndroid) {
      alert(
        'Enable camera on Android:\n\n1) Tap the lock icon in the address bar\n2) Site settings / Permissions\n3) Camera → Allow\n4) Reload this page'
      );
    } else {
      alert('Enable camera:\n\n1) Click the camera icon near the address bar\n2) Allow camera\n3) Reload');
    }

    setShowHelpDialog(false);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await (scannerRef.current as any).applyVideoConstraints?.({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch {
      // ignore
    }
  };

  // Base container always includes the region div so html5-qrcode can mount into it.
  return (
    <>
      <div className={cn('relative', className)}>
        <div id={SCANNER_REGION_ID} className="w-full aspect-square rounded-2xl overflow-hidden bg-black" />

        {/* Tap-to-start overlay (user gesture) */}
        {scanning && (status === 'idle' || status === 'starting') && (
          <button
            type="button"
            onClick={startCamera}
            className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 rounded-2xl"
          >
            {status === 'starting' ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
            ) : (
              <Camera className="h-12 w-12 text-primary mb-3" />
            )}
            <div className="text-center">
              <p className="text-base font-semibold">Tap to start camera</p>
              <p className="text-sm text-muted-foreground mt-1">Needed for QR scanning</p>
            </div>
          </button>
        )}

        {/* Active frame overlay */}
        {status === 'active' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[220px] h-[220px] relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Error overlays */}
        {scanning && status === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
            <CameraOff className="h-12 w-12 text-destructive mb-3" />
            <p className="text-base font-semibold text-center">Camera blocked</p>
            <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
              Allow camera for this site, then try again.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[240px]">
              <Button onClick={() => setShowHelpDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                How to enable
              </Button>
              <Button variant="outline" onClick={startCamera}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
            </div>
          </div>
        )}

        {scanning && status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
            <Camera className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-base font-semibold text-center">Camera failed to start</p>
            <p className="text-sm text-muted-foreground text-center mt-1 mb-4 line-clamp-3">
              {errorMessage || 'Unknown error'}
            </p>
            <Button onClick={startCamera}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </div>
        )}

        {/* Torch button */}
        {status === 'active' && hasTorch && (
          <button
            type="button"
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

      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Enable Camera
            </DialogTitle>
            <DialogDescription>
              We cant open your device settings automatically from the browser, but well guide you to the right place.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button onClick={openSettingsHelp} className="w-full">
              Show steps for my device
            </Button>
            <Button variant="outline" onClick={() => setShowHelpDialog(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
