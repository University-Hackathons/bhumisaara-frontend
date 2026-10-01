"use client";

import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CameraOff, Keyboard } from "lucide-react";

interface QrScannerProps {
  /** DOM id the camera stream is mounted into — must be unique per scanner. */
  scannerId: string;
  isActive: boolean;
  onScan: (decodedText: string) => void;
  onCameraError?: (message: string) => void;
}

/**
 * Camera QR reader backed by html5-qrcode.
 *
 * The library touches `navigator.mediaDevices` on import, so it is pulled in
 * dynamically inside the effect — importing it at module scope would break the
 * server render.
 */
export function QrScanner({ scannerId, isActive, onScan, onCameraError }: QrScannerProps) {
  // Held in refs so a re-rendered parent (every scan changes its state) doesn't
  // tear the camera down and start it again.
  const onScanRef = useRef(onScan);
  const onCameraErrorRef = useRef(onCameraError);

  useEffect(() => {
    onScanRef.current = onScan;
    onCameraErrorRef.current = onCameraError;
  }, [onScan, onCameraError]);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    let instance: Html5Qrcode | null = null;

    const stopInstance = async (scanner: Html5Qrcode) => {
      try {
        await scanner.stop();
      } catch {
        // Already stopped, or never got as far as a running stream.
      }
      try {
        scanner.clear();
      } catch {
        // Container already emptied by React.
      }
    };

    const start = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        instance = new Html5Qrcode(scannerId);
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => onScanRef.current(decodedText),
          // Per-frame decode misses are the normal state of a running camera;
          // reporting them would drown the console and the user in noise.
          undefined
        );

        // React 19 strict mode mounts effects twice — if the cleanup already
        // ran while start() was in flight, shut the stream we just opened.
        if (cancelled && instance) {
          await stopInstance(instance);
          instance = null;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not start the camera on this device.";
        onCameraErrorRef.current?.(message);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (instance) {
        stopInstance(instance);
        instance = null;
      }
    };
  }, [isActive, scannerId]);

  return (
    <div
      id={scannerId}
      className="w-full aspect-square max-w-xs rounded-xl overflow-hidden bg-muted border border-border [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
    />
  );
}

interface ScanFieldProps {
  /** Unique DOM id for this field's camera container. */
  scannerId: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  onValue: (value: string) => void;
  onCameraError?: (message: string) => void;
}

/**
 * A camera scanner with a manual text fallback beside it — demo halls have bad
 * light and borrowed phones, so there is always a way to type the code in.
 */
export function ScanField({
  scannerId,
  label,
  placeholder,
  disabled = false,
  onValue,
  onCameraError,
}: ScanFieldProps) {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [manualValue, setManualValue] = useState("");

  // A held-still QR decodes ~10x a second. Without this the same code would be
  // submitted (and rejected as a duplicate) dozens of times per second.
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);

  const handleScan = (decodedText: string) => {
    const now = Date.now();
    const last = lastScanRef.current;

    if (last && last.text === decodedText && now - last.at < 2000) return;

    lastScanRef.current = { text: decodedText, at: now };
    onValue(decodedText);
  };

  const submitManual = () => {
    const value = manualValue.trim();
    if (!value) return;

    onValue(value);
    setManualValue("");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Camera className="w-4 h-4" />
          {label} (camera)
        </span>

        {isCameraOn && !disabled ? (
          <QrScanner scannerId={scannerId} isActive onScan={handleScan} onCameraError={onCameraError} />
        ) : (
          <div className="w-full aspect-square max-w-xs rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground text-center px-4">
            Camera is off
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setIsCameraOn((on) => !on)}
          className="w-full max-w-xs h-11 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isCameraOn ? (
            <>
              <CameraOff className="w-4 h-4" />
              Stop Camera
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              Start Camera
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Keyboard className="w-4 h-4" />
          {label} (type it in)
        </span>
        <Input
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitManual();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="h-12 font-mono text-base bg-background"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !manualValue.trim()}
          onClick={submitManual}
          className="h-11 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Manually
        </Button>
      </div>
    </div>
  );
}

export default QrScanner;
