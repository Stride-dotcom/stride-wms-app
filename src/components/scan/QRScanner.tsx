import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

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

  const isEmbedded = useMemo(() => isEmbeddedFrame(), []);
  const isCameraBlocked = useMemo(() => isCameraBlockedByEmbed(), []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const detectInFlightRef = useRef(false);

  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    detectInFlightRef.current = false;

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
  }, []);

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
            const now = Date.now();
            if (value !== lastScannedRef.current || now - lastScanTimeRef.current > 1500) {
              lastScannedRef.current = value;
              lastScanTimeRef.current = now;
              onScan(value);
            }
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
  }, [onScan, scanning]);

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

      if (typeof BarcodeDetector !== "undefined") {
        try {
          detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
        } catch (err) {
          detectorRef.current = null;
          const { name, message, raw } = formatError(err);
          console.error("[QRScanner] Failed to init BarcodeDetector", { name, message, raw });
        }
      }

      if (!detectorRef.current) {
        const msg =
          "QR scanning isn't supported in this browser (BarcodeDetector missing). Camera preview is running, but scanning may not work.";
        console.warn("[QRScanner]", msg);
        toast({ title: "Limited browser support", description: msg });
        setStatus("active");
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
  }, [isEmbedded, onError, scanning, startDetectLoop, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!scanning) stopCamera();
  }, [scanning, stopCamera]);

  return (
    <div className={cn("relative", className)}>
      <video
        ref={videoRef}
        className="w-full aspect-square rounded-2xl overflow-hidden bg-muted object-cover"
        playsInline
      />

      {/* Camera blocked or unavailable - show simple message */}
      {scanning && isCameraBlocked && status === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
          <CameraOff className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-base font-semibold text-center">Camera unavailable</p>
          <p className="text-sm text-muted-foreground text-center mt-2 max-w-[280px]">
            Please check your browser settings or try a different browser.
          </p>
        </div>
      )}

      {/* Tap-to-start overlay - only show if camera is NOT blocked */}
      {scanning && !isCameraBlocked && (status === "idle" || status === "starting") && (
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
