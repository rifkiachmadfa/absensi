"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Spinner } from "@/components/ui/spinner";

const SCAN_COOLDOWN_MS = 3000;

type QrScannerProps = {
  onDetected: (token: string) => void;
  isProcessing: boolean;
};

export function QrScanner({ onDetected, isProcessing }: QrScannerProps) {
  const containerId = "qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ token: string; time: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  const handleDetected = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.token === decodedText && now - last.time < SCAN_COOLDOWN_MS) {
        return;
      }
      lastScanRef.current = { token: decodedText, time: now };
      onDetected(decodedText);
    },
    [onDetected]
  );

  useEffect(() => {
    let isMounted = true;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    const safeStop = async () => {
      try {
        if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
          await scanner.stop();
        }
        await scanner.clear();
      } catch {
        // scanner already stopped/cleared — safe to ignore
      }
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleDetected,
        () => {}
      )
      .then(() => {
        if (!isMounted) {
          // unmounted while camera was still starting up — shut it down now
          void safeStop();
          return;
        }
        setIsStarting(false);
      })
      .catch(() => {
        if (isMounted) {
          setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.");
          setIsStarting(false);
        }
      });

    return () => {
      isMounted = false;
      void safeStop();
    };
  }, [handleDetected]);

  return (
    <div className="w-full">
      <div
        id={containerId}
        className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black"
      />
{isStarting && (
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Mengaktifkan kamera...
        </p>
      )}
      {cameraError && (
        <p className="mt-3 text-center text-sm text-destructive">{cameraError}</p>
      )}
      {isProcessing && (
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Memproses...
        </p>
      )}
    </div>
  );
}