// lib/constants/scanner-bridge.ts

// URL default WebSocket lokal scanner-bridge (Phase 9 di repo terpisah
// `scanner-bridge/`). Bridge ini HANYA bind ke loopback (127.0.0.1) di PC
// yang sama dengan browser yang membuka dialog Scan Absensi/Scan Pulang --
// makanya URL-nya selalu localhost, tidak pernah mengarah ke server
// produksi Vercel. Override lewat env kalau admin sekolah menjalankan
// bridge di port lain dari default (mis. port 8765 dipakai aplikasi lain).
export const SCANNER_BRIDGE_URL =
  process.env.NEXT_PUBLIC_SCANNER_BRIDGE_URL ?? "ws://127.0.0.1:8765";

// Token pairing OPSIONAL, harus sama persis dengan "websocket.token" di
// scanner-map.json milik scanner-bridge. Kosong (default) berarti bridge
// tidak mengaktifkan token -- browser tidak perlu mengirim apa pun.
export const SCANNER_BRIDGE_TOKEN = process.env.NEXT_PUBLIC_SCANNER_BRIDGE_TOKEN ?? "";

// Sama seperti SCAN_COOLDOWN_MS di qr-scanner.tsx -- mencegah QR token yang
// sama terkirim dua kali ke server kalau scanner meja sempat terbaca dobel
// dalam waktu sangat singkat (operator menekan trigger dua kali cepat).
export const SCANNER_BRIDGE_DEDUPE_MS = 3000;

// Jeda reconnect WebSocket: mulai cepat (bridge mungkin baru saja start
// bersamaan dengan browser), naik bertahap, dibatasi maksimum supaya tidak
// spam percobaan koneksi kalau bridge memang tidak pernah dijalankan di PC
// ini (mayoritas guru hanya memakai kamera HP, bukan scanner meja).
export const SCANNER_BRIDGE_RECONNECT_MS = { initial: 1500, max: 10000 } as const;