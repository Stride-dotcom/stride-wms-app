import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, RefreshCw, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type CameraDiagnostics = {
  timestamp: string;
  isSecureContext: boolean;
  href: string;
  protocol: string;
  host: string;
  isEmbedded: boolean;
  userAgent: string;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  hasEnumerateDevices: boolean;
  hasPermissionsApi: boolean;
  cameraPermissionState?: string;
  cameraPermissionError?: string;
  enumerateDevicesError?: string;
  devices?: Array<{
    kind: string;
    label: string;
    deviceId: string;
    groupId?: string;
  }>;
};

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

async function readCameraPermissionState(): Promise<{
  state?: string;
  error?: string;
}> {
  try {
    if (!navigator.permissions?.query) return { error: "Permissions API not supported" };
    // `camera` is not in TS PermissionName for all browsers; cast is required.
    const res = await navigator.permissions.query({ name: "camera" as any });
    return { state: res.state };
  } catch (err) {
    const { name, message } = formatError(err);
    return { error: `${name}: ${message}` };
  }
}

async function readEnumerateDevices(): Promise<{
  devices?: CameraDiagnostics["devices"];
  error?: string;
}> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { error: "navigator.mediaDevices.enumerateDevices not supported" };
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      devices: devices.map((d) => ({
        kind: d.kind,
        label: d.label,
        deviceId: d.deviceId,
        groupId: (d as any).groupId,
      })),
    };
  } catch (err) {
    const { name, message } = formatError(err);
    return { error: `${name}: ${message}` };
  }
}

async function gatherDiagnostics(): Promise<CameraDiagnostics> {
  const url = new URL(window.location.href);
  const hasMediaDevices = !!navigator.mediaDevices;

  const base: CameraDiagnostics = {
    timestamp: new Date().toISOString(),
    isSecureContext: window.isSecureContext,
    href: window.location.href,
    protocol: url.protocol,
    host: url.host,
    isEmbedded: isEmbeddedFrame(),
    userAgent: navigator.userAgent,
    hasMediaDevices,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    hasEnumerateDevices: !!navigator.mediaDevices?.enumerateDevices,
    hasPermissionsApi: !!navigator.permissions?.query,
  };

  const [perm, devs] = await Promise.all([readCameraPermissionState(), readEnumerateDevices()]);

  return {
    ...base,
    cameraPermissionState: perm.state,
    cameraPermissionError: perm.error,
    devices: devs.devices,
    enumerateDevicesError: devs.error,
  };
}

export function QRScanner({ onScan, onError, scanning = true, className }: QRScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<CameraDiagnostics | null>(null);

  const isEmbedded = useMemo(() => isEmbeddedFrame(), []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const detectInFlightRef = useRef(false);

  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const openInNewTab = () => {
    try {
      window.open(window.location.href, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

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

      // Avoid concurrent detect calls.
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
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        tick();
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    tick();
  }, [onScan, scanning]);

  const startCamera = useCallback(async () => {
    if (!scanning) return;

    setStatus("starting");
    setErrorMessage("");

    // Diagnostics collection should not block getUserMedia.
    const diagPromise = gatherDiagnostics().then((d) => {
      setDiagnostics(d);
      return d;
    });

    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Camera API unavailable: navigator.mediaDevices.getUserMedia is missing.";
      console.error("[QRScanner]", msg);
      setStatus("unsupported");
      setErrorMessage(msg);
      toast({ variant: "destructive", title: "Camera not supported", description: msg });
      onError?.(msg);
      await diagPromise;
      return;
    }

    // Ensure we don't keep an old stream alive.
    stopCamera();

    try {
      // 3) MUST happen directly in the click handler with no delays.
      const stream = await navigator.mediaDevices.getUserMedia(DEFAULT_CONSTRAINTS);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not mounted");

      // 5) iOS requirements.
      video.autoplay = true;
      video.muted = true;
      (video as any).playsInline = true;
      (video as any).srcObject = stream;

      await video.play();

      // Setup detector
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
        await diagPromise;
        return;
      }

      setStatus("active");
      startDetectLoop();

      await diagPromise;
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
      await diagPromise;
    }
  }, [onError, scanning, startDetectLoop, stopCamera]);

  const refreshDiagnostics = useCallback(async () => {
    const d = await gatherDiagnostics();
    setDiagnostics(d);

    toast({
      title: "Diagnostics updated",
      description: `${d.protocol}//${d.host} • secureContext=${String(d.isSecureContext)}`,
    });
  }, []);

  // 8) Cleanup on unmount.
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // If parent disables scanning, release camera.
  useEffect(() => {
    if (!scanning) stopCamera();
  }, [scanning, stopCamera]);

  const openSettingsHelp = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      alert(
        "Enable camera on iPhone/iPad:\n\n1) Settings app\n2) Safari (or your browser)\n3) Camera\n4) Allow\n5) Return here and reload"
      );
    } else if (isAndroid) {
      alert(
        "Enable camera on Android:\n\n1) Tap the lock icon in the address bar\n2) Site settings / Permissions\n3) Camera → Allow\n4) Reload this page"
      );
    } else {
      alert("Enable camera:\n\n1) Click the camera icon near the address bar\n2) Allow camera\n3) Reload");
    }

    setShowHelpDialog(false);
  };

  return (
    <>
      <div className={cn("relative", className)}>
        <video
          ref={videoRef}
          className="w-full aspect-square rounded-2xl overflow-hidden bg-muted object-cover"
          playsInline
        />

        {/* Tap-to-start overlay (user gesture) */}
        {scanning && (status === "idle" || status === "starting") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 rounded-2xl p-6">
            {status === "starting" ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
            ) : (
              <Camera className="h-12 w-12 text-primary mb-3" />
            )}

            <div className="text-center mb-4">
              <p className="text-base font-semibold">Start camera</p>
              <p className="text-sm text-muted-foreground mt-1">Needed for QR scanning</p>
              {isEmbedded && (
                <p className="text-xs text-muted-foreground mt-2">
                  You
reurrently inside an embedded preview. The preview iframe must allow camera
                  access (<code className="font-mono">allow=&quot;camera&quot;</code>) — otherwise open in a
                  new tab.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full max-w-[280px]">
              <Button onClick={startCamera} disabled={status === "starting"}>
                {status === "starting" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                {status === "starting" ? "Starting…" : "Start camera"}
              </Button>

              <Button variant="outline" onClick={() => setShowDiagnostics((v) => !v)}>
                <Settings className="h-4 w-4 mr-2" />
                {showDiagnostics ? "Hide diagnostics" : "Camera diagnostics"}
              </Button>

              {isEmbedded && (
                <Button variant="outline" onClick={openInNewTab}>
                  Open in new tab
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Denied overlay */}
        {scanning && status === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
            <CameraOff className="h-12 w-12 text-destructive mb-3" />
            <p className="text-base font-semibold text-center">Camera blocked</p>
            <p className="text-sm text-muted-foreground text-center mt-1 mb-4">{errorMessage}</p>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              <Button onClick={() => setShowHelpDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                How to enable
              </Button>
              <Button variant="outline" onClick={startCamera}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button variant="outline" onClick={() => setShowDiagnostics(true)}>
                Camera diagnostics
              </Button>
              {isEmbedded && (
                <Button variant="outline" onClick={openInNewTab}>
                  Open in new tab
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error overlay */}
        {scanning && (status === "error" || status === "unsupported") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/95 rounded-2xl p-6">
            <Camera className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-base font-semibold text-center">Camera failed to start</p>
            <p className="text-sm text-muted-foreground text-center mt-1 mb-4 line-clamp-4">
              {errorMessage || "Unknown error"}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              <Button onClick={startCamera}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button variant="outline" onClick={() => setShowDiagnostics(true)}>
                Camera diagnostics
              </Button>
              {isEmbedded && (
                <Button variant="outline" onClick={openInNewTab}>
                  Open in new tab
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {showDiagnostics && (
        <div className="mt-3 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Camera Diagnostics</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={refreshDiagnostics}>
                Refresh
              </Button>
            </div>
          </div>

          {!diagnostics ? (
            <p className="mt-2 text-sm text-muted-foreground">No diagnostics captured yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {!diagnostics.isSecureContext && (
                <div className="rounded-lg border bg-muted p-2 text-sm">
                  <p className="font-medium">Not a secure context</p>
                  <p className="text-muted-foreground">
                    Camera requires HTTPS (or localhost). Current: {diagnostics.protocol}//
                    {diagnostics.host}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-lg bg-muted p-2 text-xs font-mono overflow-x-auto">
                  {JSON.stringify(diagnostics, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Enable Camera
            </DialogTitle>
            <DialogDescription>
              We cant open your device settings automatically from the browser, but well guide you
              to the right place.
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
