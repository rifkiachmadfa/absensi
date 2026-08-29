// lib/scanner-bridge/scanner-bridge-client.ts
"use client";

// Client WebSocket TIPIS untuk scanner-bridge (Phase 9 di repo terpisah
// `scanner-bridge/`, Phase 10 integrasi di sini). Protokol lengkap ada di
// README repo scanner-bridge. Sengaja dipisah dari React hook
// (use-scanner-bridge.ts) supaya logic koneksi murni (connect, reconnect,
// parsing pesan) tidak tercampur dengan lifecycle komponen React.
//
// PRINSIP DESAIN (identik dengan peran kamera di qr-scanner.tsx): client
// ini HANYA mengantar teks QR mentah yang datang dari hardware scanner ke
// pemanggilnya. Tidak ada identifikasi siswa, cek duplikat absensi, atau
// penentuan status HADIR/TERLAMBAT di sini -- itu tetap 100% tanggung
// jawab AttendanceService di server, lewat endpoint yang SAMA PERSIS
// dipakai kamera (/api/absensi/scan, /api/absensi/scan-pulang). File ini
// tidak pernah memanggil endpoint apa pun sendiri.

import {
  SCANNER_BRIDGE_RECONNECT_MS,
  SCANNER_BRIDGE_TOKEN,
} from "@/lib/constants/scanner-bridge";

export type ScannerBridgeStatus = "connecting" | "connected" | "disconnected";

export type ScannerBridgeScannerInfo = { id: string; name: string };

type ScannerBridgeEvents = {
  onStatusChange: (status: ScannerBridgeStatus) => void;
  onScannersUpdate: (scanners: ScannerBridgeScannerInfo[]) => void;
  onScan: (token: string, scanner: ScannerBridgeScannerInfo) => void;
};

type HelloMessage = { type: "hello"; scanners: ScannerBridgeScannerInfo[] };
type ScanMessage = {
  type: "scan";
  scannerId: string;
  scannerName: string;
  text: string;
  timestampUtc: string;
};
type PingMessage = { type: "ping" };
type BridgeMessage = HelloMessage | ScanMessage | PingMessage;

function isBridgeMessage(value: unknown): value is BridgeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

// Satu instance = satu percobaan koneksi (dengan reconnect otomatis)
// selama start()..stop(). Dipakai oleh useScannerBridge, dibuat ulang tiap
// kali dialog scan dibuka (lihat komentar di hook-nya).
export class ScannerBridgeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number = SCANNER_BRIDGE_RECONNECT_MS.initial;
  private stopped = true;
  private knownScanners: ScannerBridgeScannerInfo[] = [];

  constructor(
    private readonly url: string,
    private readonly events: ScannerBridgeEvents
  ) {}

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  get scanners(): ScannerBridgeScannerInfo[] {
    return this.knownScanners;
  }

  private connect() {
    if (this.stopped) return;
    this.events.onStatusChange("connecting");

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      // URL tidak valid / WebSocket tidak didukung -- tidak ada gunanya
      // dicoba ulang berkali-kali dengan konfigurasi yang sama, tapi tetap
      // jadwalkan reconnect (bukan throw) supaya satu error konfigurasi
      // tidak menjatuhkan seluruh dialog scan.
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      if (SCANNER_BRIDGE_TOKEN) {
        socket.send(JSON.stringify({ type: "auth", token: SCANNER_BRIDGE_TOKEN }));
      }
      this.reconnectDelay = SCANNER_BRIDGE_RECONNECT_MS.initial;
      this.events.onStatusChange("connected");
    };

    socket.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return; // pesan tidak valid -- abaikan, jangan sampai menjatuhkan koneksi
      }
      if (!isBridgeMessage(parsed)) return;

      if (parsed.type === "hello") {
        this.knownScanners = parsed.scanners;
        this.events.onScannersUpdate(this.knownScanners);
        return;
      }

      if (parsed.type === "scan") {
        this.events.onScan(parsed.text, { id: parsed.scannerId, name: parsed.scannerName });
        return;
      }

      // "ping" -- tidak perlu tindakan apa pun, kedatangannya sendiri
      // sudah cukup jadi bukti koneksi masih hidup.
    };

    socket.onclose = () => {
      this.socket = null;
      this.knownScanners = [];
      this.events.onStatusChange("disconnected");
      this.scheduleReconnect();
    };

    // onclose selalu menyusul setelah onerror pada WebSocket browser --
    // reconnect cukup dijadwalkan sekali di onclose, tidak perlu duplikat
    // logic di sini.
    socket.onerror = () => {};
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 1.5,
        SCANNER_BRIDGE_RECONNECT_MS.max
      );
      this.connect();
    }, this.reconnectDelay);
  }
}