// lib/realtime/attendance-live-channel.ts
//
// Nama channel Supabase Realtime Broadcast untuk fitur "Log Live Absensi",
// diekstrak ke file TERPISAH (tanpa `import "server-only"`) supaya bisa
// diimpor dari KEDUA sisi: server (lib/realtime/attendance-live-broadcast.ts,
// yang mengirim) maupun client (components/absensi/live-log/use-live-scan-log.ts,
// yang subscribe/menerima). Jangan tambahkan apa pun yang server-only di
// sini.
export const ABSENSI_LIVE_LOG_CHANNEL = "absensi-live-log";