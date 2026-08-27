// lib/cache/public-dashboard.ts
//
// Semua route absensi (scan, manual, confirm, scan-pulang, manual-pulang,
// status, status/bulk) memanggil revalidatePath("/") setiap kali ada
// perubahan yang terlihat di dashboard publik "/". Sebelumnya setiap route
// memanggil revalidatePath("/") langsung dan TANPA throttle -- saat jam
// masuk sekolah ramai, ratusan scan dalam beberapa menit berarti ratusan
// regenerasi halaman "/" dipicu nyaris bersamaan (Section: lihat diskusi
// "web tidak bisa dibuka saat peak time").
//
// Query berat yang dipakai halaman "/" (getAttendanceTrend,
// AttendanceService.getDailyRecap/getClassBreakdown/getRecentActivity)
// sekarang SUDAH di-cache sendiri (lihat report-service.ts &
// attendance-service.ts) -- itu perbaikan utamanya. Helper ini adalah
// lapisan tambahan: throttle di level revalidatePath supaya invocation yang
// terjadi dalam window singkat pada instance serverless yang sama tidak
// berulang kali memicu regenerasi (yang tetap ada overhead-nya walau
// query di baliknya sudah cache-hit).
//
// CATATAN PENTING: throttle ini in-memory PER INSTANCE (sama seperti
// lib/rate-limit.ts) -- di Vercel, tiap instance serverless yang aktif
// bersamaan punya memori sendiri, jadi ini TIDAK menjamin "hanya 1x per
// 5 detik secara global". Ini lapisan pertahanan tambahan yang murah untuk
// ditambahkan, BUKAN pengganti caching di layer query (yang sudah jadi
// perbaikan utama dan efektif lintas-instance).
//
// Jangan panggil revalidatePath("/") langsung dari route manapun --
// selalu lewat notifyPublicDashboardChanged() di sini, supaya kalau nanti
// strategi invalidasi berubah (mis. pindah ke revalidateTag, atau throttle
// beneran lintas-instance pakai Redis/Upstash), cukup diubah di satu tempat
// (Dev Rules Section 39, poin 5: "Tidak membuat duplicate service").

import { revalidatePath } from "next/cache";

const THROTTLE_MS = 5_000;

let lastRevalidateAt = 0;

export function notifyPublicDashboardChanged(): void {
  const now = Date.now();
  if (now - lastRevalidateAt < THROTTLE_MS) {
    return;
  }
  lastRevalidateAt = now;
  revalidatePath("/");
}
