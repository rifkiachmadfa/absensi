// components/absensi/use-scanner-bridge.ts
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ScannerBridgeClient,
  type ScannerBridgeScannerInfo,
  type ScannerBridgeStatus,
} from "@/lib/scanner-bridge/scanner-bridge-client";
import { SCANNER_BRIDGE_DEDUPE_MS, SCANNER_BRIDGE_URL } from "@/lib/constants/scanner-bridge";

// Info scan TERAKHIR yang masuk lewat bridge -- dipakai UI (ScannerBridgePanel)
// untuk feedback "scan terakhir dari Scanner Meja mana, jam berapa". Ini
// murni tampilan; tidak dipakai untuk logic absensi apa pun (itu tetap
// AttendanceService di server).
export type ScannerBridgeLastScan = {
  scannerId: string;
  scannerName: string;
  time: number;
};

// Menghubungkan dialog Scan Absensi / Scan Pulang ke scanner-bridge lokal
// (Phase 9/10) -- kalau ada scanner meja (mis. 4x EPPOS Bluetooth) yang
// terpasang di PC yang sama dengan browser, hasil scan-nya masuk lewat
// WebSocket ini dan diperlakukan SAMA PERSIS seperti hasil kamera HP:
// diteruskan ke `onScan(token)`, yang di scan-dialog.tsx/scan-dialog-
// pulang.tsx adalah handleDetected() yang sama dipakai QrScanner. Tidak
// ada jalur atau endpoint terpisah untuk scanner meja -- keduanya berujung
// ke fetch("/api/absensi/scan"|"/api/absensi/scan-pulang") yang sama.
//
// Hanya aktif selagi `enabled` bernilai true (dialog sedang terbuka) --
// persis siklus hidup kamera di QrScanner (mount/unmount mengikuti `open`
// dialog). Kalau bridge memang tidak pernah dijalankan di PC ini (mayoritas
// guru hanya memakai kamera HP), koneksi akan gagal berulang dengan jeda
// yang membesar -- diam-diam di background, tanpa toast/error yang
// mengganggu (Section 20 UI_RULES: jangan menampilkan banyak informasi
// selama proses scanning berlangsung). Status hanya untuk indikator kecil
// opsional di UI, bukan sesuatu yang wajib ditampilkan.
export function useScannerBridge(options: {
  enabled: boolean;
  onScan: (token: string, scanner: ScannerBridgeScannerInfo) => void;
}) {
  const { enabled, onScan } = options;
  const [status, setStatus] = useState<ScannerBridgeStatus>("disconnected");
  const [scanners, setScanners] = useState<ScannerBridgeScannerInfo[]>([]);
  const [lastScan, setLastScan] = useState<ScannerBridgeLastScan | null>(null);

  // `onScan` datang dari parent dan bisa berubah identitas tiap render
  // (sama seperti onDetectedRef di qr-scanner.tsx) -- disimpan lewat ref
  // supaya tidak memicu effect koneksi jalan ulang tiap kali parent
  // re-render.
  const onScanRef = useRef<typeof onScan>(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Dedupe token yang sama dalam jeda singkat -- pola yang sama dengan
  // lastScanRef di qr-scanner.tsx, mencegah trigger fisik yang tertekan
  // dobel terkirim dua kali ke server.
  const lastScanRef = useRef<{ token: string; time: number } | null>(null);

  useEffect(() => {
    // Tidak ada apa pun untuk disubscribe selagi dialog tertutup -- state
    // sudah default ("disconnected"/0) di awal, dan kalau sebelumnya sempat
    // tersambung, cleanup effect PREVIOUS render (client.stop() di bawah)
    // sudah memicu socket "close" yang mengembalikan status ke
    // "disconnected" sebelum effect ini berjalan lagi.
    if (!enabled) return;

    const client = new ScannerBridgeClient(SCANNER_BRIDGE_URL, {
      onStatusChange: (next) => {
        setStatus(next);
        if (next !== "connected") setScanners([]);
      },
      onScannersUpdate: (next) => setScanners(next),
      onScan: (token, scanner) => {
        const now = Date.now();
        const last = lastScanRef.current;
        if (last && last.token === token && now - last.time < SCANNER_BRIDGE_DEDUPE_MS) {
          return;
        }
        lastScanRef.current = { token, time: now };
        setLastScan({ scannerId: scanner.id, scannerName: scanner.name, time: now });
        onScanRef.current(token, scanner);
      },
    });

    client.start();

    return () => {
      client.stop();
    };
  }, [enabled]);

  return { status, scanners, lastScan };
}