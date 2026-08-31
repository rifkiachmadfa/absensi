// lib/cache/tags.ts
//
// Tag constants dipakai bersama oleh unstable_cache(...) di
// attendance-service.ts & report-service.ts, dan oleh
// notifyPublicDashboardChanged() (lib/cache/public-dashboard.ts) untuk
// men-invalidate-nya lewat revalidateTag().
//
// Kenapa tag terpusat di sini (bukan string literal diulang di tiap file):
// Dev Rules Section 39 poin 5/6 -- "tidak membuat duplicate service/model".
// String tag yang sama harus dipakai persis di kedua sisi (unstable_cache
// tags: [...] dan revalidateTag(...)) supaya invalidation benar-benar kena;
// kalau ditulis manual berulang di banyak file, gampang typo/menyimpang dan
// invalidation diam-diam berhenti bekerja tanpa error apapun.

// Statistik "hari ini" (rekap harian, breakdown per kelas, aktivitas
// terbaru, rekap keterlambatan hari ini) -- semuanya berubah tiap ada
// scan/absensi manual baru.
export const ATTENDANCE_TODAY_STATS_TAG = "attendance-today-stats";

// Grafik trend harian & bulanan (getAttendanceTrend).
export const ATTENDANCE_TREND_TAG = "attendance-trend";