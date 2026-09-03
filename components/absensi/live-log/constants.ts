// components/absensi/live-log/constants.ts

// Cap ±50 baris terbaru (auto-buang yang lama) supaya panel tidak berat
// saat jam sibuk (±500 siswa, Section 38 spesifikasi project). Dipakai
// baik oleh seed awal (actions.ts, lewat parameter `limit`) maupun oleh
// buffer live di client (use-live-scan-log.ts), supaya keduanya konsisten.
export const MAX_LIVE_LOG_ROWS = 50;