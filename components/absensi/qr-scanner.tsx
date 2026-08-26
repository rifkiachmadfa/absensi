"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { Spinner } from "@/components/ui/spinner";

const SCAN_COOLDOWN_MS = 3000;

type QrScannerProps = {
  onDetected: (token: string) => void;
  isProcessing: boolean;
};

// Kamera sekarang dipertahankan hidup TERUS-MENERUS selama dialog terbuka
// (tidak lagi dibongkar-pasang tiap 1x scan, lihat scan-dialog.tsx). Efek
// sampingnya: kalau HP tidak disentuh beberapa detik, LAYAR HP sendiri yang
// meredup/mengunci untuk hemat baterai -- video kamera jadi terlihat
// "gelap" padahal stream-nya masih hidup. Dua mekanisme di bawah menjaga
// kamera tetap dalam kondisi "standby" siap-pakai, bukan gelap:
//
// 1. Screen Wake Lock -- minta browser menahan layar tetap menyala selama
//    scanner aktif (dilepas otomatis saat tab disembunyikan/di-background,
//    makanya perlu diminta ULANG setiap kali tab kembali terlihat).
// 2. Auto-recovery -- kalau tab sempat di-background lalu dibuka lagi (mis.
//    guru sempat pindah app / HP terkunci manual), beberapa browser
//    menghentikan stream kamera. Saat tab terlihat lagi, cek status
//    scanner; kalau ternyata sudah berhenti, start ulang otomatis TANPA
//    guru perlu menutup-buka dialog.
export function QrScanner({ onDetected, isProcessing }: QrScannerProps) {
  const containerId = "qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastScanRef = useRef<{ token: string; time: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  // `onDetected` datang dari parent (scan-dialog.tsx) dan identitasnya BISA
  // berubah tiap render (parent re-render tiap kali antrian scan berubah --
  // bisa beberapa kali per 1x scan: masuk "pending", lalu update jadi hasil
  // akhir). Kalau effect di bawah langsung bergantung pada `onDetected`,
  // setiap perubahan identitas itu akan membuat kamera di-stop lalu
  // di-start ULANG -- itulah penyebab flicker cepat setelah tiap 1x scan.
  // Simpan versi terbaru lewat ref (diperbarui diam-diam, TIDAK memicu
  // effect utama jalan ulang) supaya kamera hanya dinyalakan SEKALI saat
  // mount, tidak peduli seberapa sering parent re-render.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const requestWakeLock = useCallback(async () => {
    try {
      if (!("wakeLock" in navigator)) return; // browser tidak mendukung -- diamkan saja
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // Gagal minta wake lock (mis. baterai lemah / tidak diizinkan OS) --
      // bukan error fatal, scanner tetap jalan seperti biasa.
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    // Dibuat di DALAM effect (bukan useCallback di level komponen) supaya
    // tidak ikut menjadi alasan effect ini jalan ulang -- selalu membaca
    // callback TERBARU lewat onDetectedRef, bukan closure yang beku.
    const handleDetected = (decodedText: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.token === decodedText && now - last.time < SCAN_COOLDOWN_MS) {
        return;
      }
      lastScanRef.current = { token: decodedText, time: now };
      onDetectedRef.current(decodedText);
    };

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

    const startScanning = () =>
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleDetected,
        () => {}
      );

    startScanning()
      .then(() => {
        if (!isMounted) {
          // unmounted while camera was still starting up — shut it down now
          void safeStop();
          return;
        }
        setIsStarting(false);
        setCameraError(null);
        void requestWakeLock();
      })
      .catch(() => {
        if (isMounted) {
          setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.");
          setIsStarting(false);
        }
      });

    // Wake Lock otomatis dilepas browser saat tab disembunyikan. Begitu
    // guru kembali ke tab ini, minta lagi -- dan kalau ternyata stream
    // kamera sempat ikut terhenti (state bukan SCANNING lagi), start ulang
    // sendiri supaya guru tidak perlu tutup-buka dialog secara manual.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void requestWakeLock();

      if (scanner.getState() !== Html5QrcodeScannerState.SCANNING) {
        setIsStarting(true);
        startScanning()
          .then(() => {
            if (isMounted) {
              setIsStarting(false);
              setCameraError(null);
            }
          })
          .catch(() => {
            if (isMounted) {
              setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.");
              setIsStarting(false);
            }
          });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      void safeStop();
    };

  }, [requestWakeLock]);

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