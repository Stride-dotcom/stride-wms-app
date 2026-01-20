import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { hapticMedium } from "@/lib/haptics";

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  /** When false, scanner must not keep the camera active */
  scanning?: boolean;
  className?: string;
}

type ScannerStatus = "idle" | "starting" | "active" | "denied" | "error" | "unsupported";

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "environment" },
  audio: false,
};

function isEmbeddedFrame() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function formatError(err: unknown) {
  const anyErr = err as any;
  const name = anyErr?.name ? String(anyErr.name) : "UnknownError";
  const message = anyErr?.message ? String(anyErr.message) : String(err);
  return { name, message, raw: err };
}

function getLegacyGetUserMedia():
  | ((constraints: MediaStreamConstraints, onSuccess: (stream: MediaStream) => void, onError: (err: unknown) => void) => void)
  | null {
  const nav = navigator as any;
  return nav.getUserMedia || nav.webkitGetUserMedia || nav.mozGetUserMedia || nav.msGetUserMedia || null;
}

async function getUserMediaCompat(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacy = getLegacyGetUserMedia();
  if (!legacy) {
    throw new Error("getUserMedia is not available in this browser environment");
  }

  return await new Promise<MediaStream>((resolve, reject) => {
    try {
      legacy.call(navigator, constraints, resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

// Early detection: camera APIs missing in embedded context = blocked by iframe policy
function isCameraBlockedByEmbed(): boolean {
  if (!isEmbeddedFrame()) return false;
  const hasModern = !!navigator.mediaDevices?.getUserMedia;
  const hasLegacy = !!getLegacyGetUserMedia();
  return !hasModern && !hasLegacy;
}

export function QRScanner({ onScan, onError, scanning = true, className }: QRScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [usingFallback, setUsingFallback] = useState(false);

  const isEmbedded = useMemo(() => isEmbeddedFrame(), []);
  const isCameraBlocked = useMemo(() => isCameraBlockedByEmbed(), []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const detectInFlightRef = useRef(false);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2, 9)}`);

  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    // Stop native detector loop
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    detectInFlightRef.current = false;

    // Stop html5-qrcode fallback
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current = null;
    }

    // Stop camera stream
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      try {
        (video as any).srcObject = null;
      } catch {
        // ignore
      }
      video.removeAttribute("src");
    }

    setStatus("idle");
    setUsingFallback(false);
  }, []);

  const handleQrCodeSuccess = useCallback((decodedText: string) => {
    const now = Date.now();
    if (decodedText !== lastScannedRef.current || now - lastScanTimeRef.current > 1500) {
      lastScannedRef.current = decodedText;
      lastScanTimeRef.current = now;
      hapticMedium(); // Tactile feedback on successful scan
      onScan(decodedText);
    }
  }, [onScan]);

  const startDetectLoop = useCallback(() => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector) return;

    const tick = async () => {
      if (!scanning) return;
      if (!streamRef.current) return;

      if (!detectInFlightRef.current && video.readyState >= 2) {
        detectInFlightRef.current = true;
        try {
          const barcodes = await detector.detect(video);
          const first = barcodes?.[0] as any;
          const value = first?.rawValue ? String(first.rawValue) : "";

          if (value) {
            handleQrCodeSuccess(value);
          }
        } catch (err) {
          const { name, message, raw } = formatError(err);
          console.error("[QRScanner] BarcodeDetector.detect error", { name, message, raw });
        } finally {
          detectInFlightRef.current = false;
        }
      }

      rafRef.current = requestAnimationFrame(() => {
        tick();
      });
    };

    tick();
  }, [handleQrCodeSuccess, scanning]);

  const startFallbackScanner = useCallback(async () => {
    console.info("[QRScanner] Starting html5-qrcode fallback scanner");
    setUsingFallback(true);
    setStatus("starting");

    // Small delay to ensure DOM element is visible before html5-qrcode initializes
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const html5Qr = new Html5Qrcode(scannerContainerId.current);
      html5QrRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        handleQrCodeSuccess,
        () => {} // Ignore scan failures (no QR in frame)
      );

      setStatus("active");
    } catch (err) {
      const { name, message, raw } = formatError(err);
      console.error("[QRScanner] html5-qrcode fallback failed", { name, message, raw });

      const msg = `${name}: ${message}`;
      setErrorMessage(msg);
      setStatus("error");
      setUsingFallback(false);
      toast({
        variant: "destructive",
        title: "Scanner error",
        description: msg,
      });
      onError?.(msg);
    }
  }, [handleQrCodeSuccess, onError]);

  const startCamera = useCallback(async () => {
    if (!scanning) return;

    setStatus("starting");
    setErrorMessage("");

    const hasModernGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    const hasLegacyGetUserMedia = !!getLegacyGetUserMedia();

    if (!hasModernGetUserMedia && !hasLegacyGetUserMedia) {
      const msg = "Camera not available. Please check your browser settings or try a different browser.";

      console.error("[QRScanner] Camera API unavailable", {
        msg,
        hasModernGetUserMedia,
        hasLegacyGetUserMedia,
        isEmbedded,
      });

      setStatus("unsupported");
      setErrorMessage(msg);
      toast({ variant: "destructive", title: "Camera not supported", description: msg });
      onError?.(msg);
      return;
    }

    stopCamera();

    // Check if native BarcodeDetector is available
    const hasNativeBarcodeDetector = typeof BarcodeDetector !== "undefined";

    if (!hasNativeBarcodeDetector) {
      // Use html5-qrcode fallback directly - don't call stopCamera as it resets status
      console.info("[QRScanner] BarcodeDetector not available, using html5-qrcode fallback");
      await startFallbackScanner();
      return;
    }

    // Use native BarcodeDetector
    try {
      const stream = await getUserMediaCompat(DEFAULT_CONSTRAINTS);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not mounted");

      video.autoplay = true;
      video.muted = true;
      (video as any).playsInline = true;
      (video as any).srcObject = stream;

      await video.play();

      try {
        detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      } catch (err) {
        detectorRef.current = null;
        const { name, message, raw } = formatError(err);
        console.error("[QRScanner] Failed to init BarcodeDetector", { name, message, raw });
      }

      if (!detectorRef.current) {
        // Fallback to html5-qrcode - stop stream but don't reset status
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        await startFallbackScanner();
        return;
      }

      setStatus("active");
      startDetectLoop();
    } catch (err) {
      const { name, message, raw } = formatError(err);
      console.error("[QRScanner] getUserMedia failed", { name, message, raw });

      const msg = `${name}: ${message}`;
      setErrorMessage(msg);
      setStatus(name.toLowerCase().includes("notallowed") || name.toLowerCase().includes("permission") ? "denied" : "error");

      toast({
        variant: "destructive",
        title: "Camera error",
        description: msg,
      });
      onError?.(msg);

      stopCamera();
    }
  }, [isEmbedded, onError, scanning, startDetectLoop, startFallbackScanner, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!scanning) stopCamera();
  }, [scanning, stopCamera]);

  return (
    <div className={cn("relative", className)}>
      {/* Native video element - hidden when using fallback */}
      <video
        ref={videoRef}
        className={cn(
          "w-full aspect-square rounded-2xl overflow-hidden bg-muted object-cover",
          usingFallback && "hidden"
        )}
        playsInline
      />

      {/* html5-qrcode container - shown when using fallback */}
      <div
        id={scannerContainerId.current}
        className={cn(
          "w-full aspect-square rounded-2xl overflow-hidden bg-muted",
          !usingFallback && "hidden"
        )}
      />

      {/* Scanner frame with glowing orange corner brackets - only when active */}
      {status === 'active' && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top-left corner */}
          <div className="absolute top-4 left-4 w-12 h-12 border-l-4 border-t-4 border-primary rounded-tl-2xl shadow-[0_0_15px_hsl(14_100%_57%/0.5)]" />
          {/* Top-right corner */}
          <div className="absolute top-4 right-4 w-12 h-12 border-r-4 border-t-4 border-primary rounded-tr-2xl shadow-[0_0_15px_hsl(14_100%_57%/0.5)]" />
          {/* Bottom-left corner */}
          <div className="absolute bottom-4 left-4 w-12 h-12 border-l-4 border-b-4 border-primary rounded-bl-2xl shadow-[0_0_15px_hsl(14_100%_57%/0.5)]" />
          {/* Bottom-right corner */}
          <div className="absolute bottom-4 right-4 w-12 h-12 border-r-4 border-b-4 border-primary rounded-br-2xl shadow-[0_0_15px_hsl(14_100%_57%/0.5)]" />
          
          {/* Animated scan line */}
          <div className="absolute inset-x-8 h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-scan shadow-[0_0_20px_hsl(14_100%_57%/0.6)]" />
        </div>
      )}

      {/* Sensor Active indicator - only when active */}
      {status === 'active' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-primary uppercase tracking-wider font-medium">
            Sensor Active
          </span>
        </div>
      )}

      {/* Camera blocked by embedded preview - show new-tab action */}
      {scanning && isCameraBlocked && status === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
          <CameraOff className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-base font-semibold text-center">Camera unavailable in embedded view</p>
          <p className="text-sm text-muted-foreground text-center mt-2 mb-4 max-w-[280px]">
            Chrome blocks camera access inside embedded previews. Open the scanner in a new tab to use your camera.
          </p>
          <Button
            variant="outline"
            onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </Button>
        </div>
      )}

      {/* Tap-to-start overlay - only show if camera is NOT blocked and not using fallback */}
      {scanning && !isCameraBlocked && !usingFallback && (status === "idle" || status === "starting") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 rounded-2xl p-6">
          {status === "starting" ? (
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
          ) : (
            <Camera className="h-12 w-12 text-primary mb-3" />
          )}

          <div className="text-center mb-4">
            <p className="text-base font-semibold">Start camera</p>
            <p className="text-sm text-muted-foreground mt-1">Needed for QR scanning</p>
          </div>

          <Button onClick={startCamera} disabled={status === "starting"}>
            {status === "starting" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {status === "starting" ? "Starting…" : "Start camera"}
          </Button>
        </div>
      )}

      {/* Denied overlay */}
      {scanning && status === "denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
          <CameraOff className="h-12 w-12 text-destructive mb-4" />
          <p className="text-base font-semibold text-center">Camera blocked</p>
          <p className="text-sm text-muted-foreground text-center mt-2 mb-4 max-w-[280px]">
            Please check your browser settings or try a different browser.
          </p>
          <Button variant="outline" onClick={startCamera}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </div>
      )}

      {/* Error/unsupported overlay */}
      {scanning && (status === "error" || status === "unsupported") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
          <CameraOff className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-base font-semibold text-center">Camera failed to start</p>
          <p className="text-sm text-muted-foreground text-center mt-2 mb-4 max-w-[280px]">
            Please check your browser settings or try a different browser.
          </p>
          <Button variant="outline" onClick={startCamera}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
