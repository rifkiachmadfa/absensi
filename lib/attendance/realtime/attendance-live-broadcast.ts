// lib/realtime/attendance-live-broadcast.ts
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ABSENSI_LIVE_LOG_CHANNEL } from "@/lib/attendance/realtime/attendance-live-channel";

// Channel Supabase Realtime Broadcast (application-level event, BUKAN
// Postgres Changes) untuk fitur "Log Live Absensi" (tab baru di dialog
// Scan Absensi / Scan Pulang). Berbeda dari dashboard-realtime-listener.tsx
// / public-realtime-listener.tsx yang mendengarkan perubahan tabel
// `Attendance` -- di sini kita perlu mengumumkan fase "nama sudah
// dikenali, TAPI belum tentu record absensinya sudah tersimpan", yang
// belum tentu punya row di database sama sekali (mis. QR tidak dikenali).
// Nama channel-nya sendiri ada di attendance-live-channel.ts (client-safe,
// tanpa "server-only") supaya bisa dipakai juga oleh
// use-live-scan-log.ts di sisi client.
export { ABSENSI_LIVE_LOG_CHANNEL };

export type LiveScanMode = "masuk" | "pulang";
export type LiveLogStatus = "success" | "warning" | "error";

// Dikirim segera setelah AttendanceService.identify()/identifyPulang()
// berhasil mengenali siswa (Section 29 UX Scanner: nama tampil duluan).
export type LiveLogIdentifiedPayload = {
  scanId: string;
  mode: LiveScanMode;
  name: string;
  className: string;
  ts: string;
};

// Dikirim setelah AttendanceService.checkIn()/checkOut() mengembalikan
// hasil AKHIR -- apa pun jenisnya (berhasil, sudah absen, QR tidak valid,
// dst). Ini SATU-SATUNYA sumber kebenaran untuk baris Log Live; event
// "identified" hanya mempercepat tampilan nama, tidak pernah dianggap
// hasil final.
export type LiveLogResultPayload = {
  scanId: string;
  mode: LiveScanMode;
  name: string | null;
  className: string | null;
  status: LiveLogStatus;
  label: string;
  detail?: string;
  ts: string;
};

async function sendBroadcast(
  event: "identified" | "result",
  payload: LiveLogIdentifiedPayload | LiveLogResultPayload
) {
  try {
    const supabase = getSupabaseAdmin();
    const channel = supabase.channel(ABSENSI_LIVE_LOG_CHANNEL);
    // PENTING: channel.send() dipanggil TANPA subscribe() lebih dulu --
    // menurut dokumentasi Supabase, ini membuat pesan dikirim lewat HTTP
    // biasa (satu request, tanpa handshake WebSocket), yang paling ringan
    // untuk lingkungan serverless/Vercel (function instance tidak perlu
    // menjaga koneksi persisten). subscribe() baru dibutuhkan kalau kita
    // juga ingin MENERIMA broadcast di sisi yang sama, yang tidak relevan
    // di sini karena helper ini hanya mengirim.
    await channel.send({ type: "broadcast", event, payload });
  } catch (error) {
    // Broadcast murni "mengumumkan" hasil yang SUDAH diputuskan oleh
    // AttendanceService (dipanggil setelah checkIn/checkOut selesai) --
    // kegagalan di sini TIDAK BOLEH menggagalkan atau mengubah response
    // absensi yang sudah dikirim ke guru. Log Live hanya kehilangan satu
    // update; guru tetap mendapat hasil scan seperti biasa lewat panel
    // Riwayat lokal (ScanQueuePanel).
    console.error("[attendance-live-broadcast] Gagal mengirim broadcast:", error);
  }
}

export function broadcastScanIdentified(payload: Omit<LiveLogIdentifiedPayload, "ts">) {
  return sendBroadcast("identified", { ...payload, ts: new Date().toISOString() });
}

export function broadcastScanResult(payload: Omit<LiveLogResultPayload, "ts">) {
  return sendBroadcast("result", { ...payload, ts: new Date().toISOString() });
}