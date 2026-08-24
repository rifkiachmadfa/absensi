// lib/constants/attendance.ts
export const MANUAL_SETTABLE_STATUSES = [
  "HADIR",
  "TERLAMBAT",
  "SAKIT",
  "IZIN",
  "DISPENSASI",
  "ALPHA",
] as const;

// Status yang bisa dipilih guru/petugas tepat setelah scan/identifikasi
// berhasil (Phase 7 & 8). Semua status termasuk HADIR/TERLAMBAT karena
// keputusan akhir sekarang manual, bukan otomatis oleh sistem (Section 11).
export const ATTENDANCE_ACTION_STATUSES = [
  "HADIR",
  "TERLAMBAT",
  "SAKIT",
  "IZIN",
  "DISPENSASI",
  "ALPHA",
] as const;

// Warna tombol aksi konfirmasi kehadiran, konsisten dengan STATUS_BADGE_CLASS
// (UI_RULES Section 4: Blue=primary, Green=hadir, Amber=terlambat, Red=alpha/error).
export const ATTENDANCE_ACTION_BUTTON_CLASS: Record<string, string> = {
  HADIR:
    "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950",
  TERLAMBAT:
    "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950",
  SAKIT:
    "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950",
  IZIN:
    "border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950",
  DISPENSASI:
    "border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950",
  ALPHA:
    "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950",
};

export const STATUS_LABEL: Record<string, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  SAKIT: "Sakit",
  IZIN: "Izin",
  DISPENSASI: "Dispensasi",
  ALPHA: "Alpha",
  BELUM_ABSEN: "Belum Absen",
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  HADIR: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  TERLAMBAT: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  SAKIT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  IZIN: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  DISPENSASI: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400",
  ALPHA: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  BELUM_ABSEN: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};