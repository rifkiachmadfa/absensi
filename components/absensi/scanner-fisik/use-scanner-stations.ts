// components/absensi/scanner-fisik/use-scanner-stations.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScannerBridgeClient,
  type ScannerBridgeScannerInfo,
  type ScannerBridgeStatus,
} from "@/lib/scanner-bridge/scanner-bridge-client";
import { SCANNER_BRIDGE_DEDUPE_MS, SCANNER_BRIDGE_URL } from "@/lib/constants/scanner-bridge";
import { playScanBeep } from "@/lib/audio/beep";
import {
  classifyCheckInResult,
  classifyCheckOutResult,
  identifiedMeta,
} from "@/lib/attendance/classify-result";
import type { ScanQueueItem, ScanQueueStatus } from "@/components/absensi/use-scan-queue";
import type {
  AttendanceCheckInResponse,
  AttendanceCheckOutResponse,
  AttendanceIdentifyResponse,
  AttendanceIdentifyPulangResponse,
} from "@/lib/types/attendance";

export type AbsensiStationMode = "masuk" | "pulang";

// Satu "station" = satu scanner meja fisik yang terdaftar di scanner-bridge.
// Log-nya (`items`) TERPISAH per scanner -- inilah yang membedakan halaman
// ini dari dialog Scan Absensi biasa, yang menggabungkan semua sumber scan
// (kamera + SEMUA scanner meja) ke satu Riwayat.
export type ScannerStation = {
  info: ScannerBridgeScannerInfo;
  items: ScanQueueItem<AttendanceCheckInResponse | AttendanceCheckOutResponse>[];
};

const MAX_ITEMS_PER_STATION = 12;

function endpointFor(mode: AbsensiStationMode) {
  return mode === "masuk" ? "/api/absensi/scan" : "/api/absensi/scan-pulang";
}

// Fase 1 (read-only, cepat) dari pola identify-lalu-submit yang sama
// dipakai ScanDialog/ScanDialogPulang -- lihat catatan lengkap di
// scan-dialog.tsx & attendance-service.ts.
function identifyEndpointFor(mode: AbsensiStationMode) {
  return mode === "masuk" ? "/api/absensi/scan/identify" : "/api/absensi/scan-pulang/identify";
}

function classify(mode: AbsensiStationMode, result: AttendanceCheckInResponse | AttendanceCheckOutResponse) {
  return mode === "masuk"
    ? classifyCheckInResult(result as AttendanceCheckInResponse)
    : classifyCheckOutResult(result as AttendanceCheckOutResponse);
}

// Menghubungkan halaman /absensi/scanner-fisik ke scanner-bridge lokal yang
// SAMA dipakai ScanDialog/ScanDialogPulang (lib/scanner-bridge/scanner-
// bridge-client.ts) -- tidak ada protokol atau koneksi terpisah. Bedanya
// hanya di sini: hasil setiap scan disimpan ke log milik scanner ASALNYA
// (berdasarkan `scannerId` yang dikirim bridge), bukan ke satu antrian
// gabungan. Setiap scan tetap diproses lewat AttendanceService di server
// (endpoint /api/absensi/scan atau /api/absensi/scan-pulang tergantung
// `mode`) -- tidak ada logic absensi baru di sini, murni routing hasil ke
// kartu station yang tepat (Section 26).
export function useScannerStations(mode: AbsensiStationMode) {
  const [bridgeStatus, setBridgeStatus] = useState<ScannerBridgeStatus>("connecting");
  const [stations, setStations] = useState<Record<string, ScannerStation>>({});

  // `mode` bisa berubah (tab Masuk/Pulang) tanpa perlu memutus & menyambung
  // ulang koneksi WebSocket -- disimpan lewat ref supaya callback `onScan`
  // milik client (dibuat sekali di effect connect) selalu memakai mode
  // TERBARU tanpa effect ikut re-run tiap ganti tab.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Dedupe token yang sama dari scanner yang sama dalam jeda singkat --
  // pola identik dengan use-scanner-bridge.ts, tapi di-key per scanner
  // supaya scanner lain tetap bisa memindai kartu yang (secara kebetulan)
  // sama persis tanpa saling memblokir.
  const lastScanRef = useRef<Map<string, { token: string; time: number }>>(new Map());

  // Token yang requestnya masih berjalan, di-key `${scannerId}:${token}` --
  // mencegah scan fisik yang sama terkirim dua kali sebelum response
  // pertama kembali (independen dari dedupe waktu di atas).
  const inFlightRef = useRef<Set<string>>(new Set());
  const seqRef = useRef(0);

  const submitScan = useCallback((scanner: ScannerBridgeScannerInfo, token: string) => {
    const inFlightKey = `${scanner.id}:${token}`;
    if (inFlightRef.current.has(inFlightKey)) return;
    inFlightRef.current.add(inFlightKey);

    playScanBeep();

    const itemId = `station-scan-${Date.now()}-${seqRef.current++}`;
    const currentMode = modeRef.current;

    setStations((prev) => {
      const existing = prev[scanner.id];
      const pendingItem: ScanQueueItem<AttendanceCheckInResponse | AttendanceCheckOutResponse> = {
        id: itemId,
        createdAt: Date.now(),
        status: "pending",
        label: "Memindai kartu...",
      };
      const items = [pendingItem, ...(existing?.items ?? [])].slice(0, MAX_ITEMS_PER_STATION);
      return { ...prev, [scanner.id]: { info: scanner, items } };
    });

    const applyPatch = (
      patch: Partial<ScanQueueItem<AttendanceCheckInResponse | AttendanceCheckOutResponse>>
    ) => {
      setStations((prev) => {
        const existing = prev[scanner.id];
        if (!existing) return prev;
        return {
          ...prev,
          [scanner.id]: {
            ...existing,
            items: existing.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
          },
        };
      });
    };

    const applyResult = (
      status: ScanQueueStatus,
      label: string,
      detail?: string,
      meta?: Record<string, string>,
      result?: AttendanceCheckInResponse | AttendanceCheckOutResponse
    ) => applyPatch({ status, label, detail, meta, result, identified: true });

    (async () => {
      // Fase 1 (read-only, cepat): tampilkan Nama/Kelas SEGERA begitu
      // dikenali server, sama seperti ScanDialog/ScanDialogPulang -- lihat
      // catatan lengkap di scan-dialog.tsx & attendance-service.ts. Hasil
      // fase ini BUKAN keputusan akhir; fase 2 di bawah tetap satu-satunya
      // yang menentukan hasil (kalau fase ini gagal, fase 2 tetap jalan).
      try {
        const identifyRes = await fetch(identifyEndpointFor(currentMode), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken: token }),
        });
        const identified = (await identifyRes.json()) as
          | AttendanceIdentifyResponse
          | AttendanceIdentifyPulangResponse;
        const meta = identifiedMeta(identified);
        if (meta) applyPatch({ label: meta.label, meta: meta.meta, identified: true });
      } catch {
        // Diam -- fase 2 di bawah tetap jalan & menentukan hasil akhir.
      }

      // Fase 2: proses & simpan absensi sesungguhnya (satu-satunya sumber
      // kebenaran, Section 26).
      fetch(endpointFor(currentMode), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token }),
      })
        .then((res) => res.json())
        .then((result: AttendanceCheckInResponse | AttendanceCheckOutResponse) => {
          const c = classify(currentMode, result);
          applyResult(c.status, c.label, c.detail, c.meta, result);
        })
        .catch(() => {
          applyResult("error", "Gagal terhubung ke server");
        })
        .finally(() => {
          inFlightRef.current.delete(inFlightKey);
        });
    })();
  }, []);

  useEffect(() => {
    const client = new ScannerBridgeClient(SCANNER_BRIDGE_URL, {
      onStatusChange: (next) => {
        setBridgeStatus(next);
      },
      onScannersUpdate: (next) => {
        // Daftarkan station untuk semua scanner yang dikenal bridge --
        // begitu scanner terdeteksi, kartunya langsung tampil (status
        // "Siap") walau belum ada satu scan pun.
        setStations((prev) => {
          const updated = { ...prev };
          for (const s of next) {
            if (!updated[s.id]) {
              updated[s.id] = { info: s, items: [] };
            } else {
              updated[s.id] = { ...updated[s.id], info: s };
            }
          }
          return updated;
        });
      },
      onScan: (token, scanner) => {
        const now = Date.now();
        const last = lastScanRef.current.get(scanner.id);
        if (last && last.token === token && now - last.time < SCANNER_BRIDGE_DEDUPE_MS) {
          return;
        }
        lastScanRef.current.set(scanner.id, { token, time: now });
        submitScan(scanner, token);
      },
    });

    client.start();
    return () => client.stop();
  }, [submitScan]);

  const stationList = Object.values(stations).sort((a, b) => a.info.name.localeCompare(b.info.name));

  return { bridgeStatus, stations: stationList };
}