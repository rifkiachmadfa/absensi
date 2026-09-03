"use server";

import { requireAuth } from "@/lib/auth/session";
import { AttendanceService, getTodayDateOnly } from "@/lib/services/attendance-service";
import { STATUS_LABEL } from "@/lib/constants/attendance";
import { MAX_LIVE_LOG_ROWS } from "./constants";
import type { LiveLogRow } from "./types";

// Snapshot AWAL (dipanggil sekali saat tab "Log Live" pertama kali dibuka)
// -- update SESUDAHNYA datang lewat Supabase Realtime Broadcast, bukan
// polling ulang action ini (lihat use-live-scan-log.ts).
//
// Sengaja TIDAK query Prisma langsung / bikin fungsi baru di
// attendance-service.ts -- AttendanceService.getRecentActivity() sudah
// melakukan persis yang dibutuhkan di sini (aktivitas absensi terbaru hari
// ini, join Student+Class, urut checkInAt terbaru dulu) dan sudah dipakai
// dashboard (Section 39 Development Rules: "Tidak membuat duplicate
// service"). Sengaja BUKAN endpoint API baru (Section "Yang TIDAK
// berubah") -- Server Action sudah cukup untuk pemanggilan sekali di awal
// dari Client Component.
//
// Catatan cakupan: hanya mengisi baris "masuk" (checkIn) karena
// getRecentActivity() diurutkan dari checkInAt -- riwayat "pulang" untuk
// hari berjalan belum ikut di-seed di sini (baris pulang akan tetap
// muncul secara live begitu ada scan baru selama tab ini terbuka). Ini
// trade-off yang wajar: yang penting bagi guru adalah aktivitas yang
// SEDANG berjalan, bukan riwayat lengkap sejak pagi (riwayat lengkap
// sudah tersedia di tabel /absensi).
export async function getInitialLiveLog(): Promise<LiveLogRow[]> {
  await requireAuth();

  const activity = await AttendanceService.getRecentActivity({
    date: getTodayDateOnly(),
    limit: MAX_LIVE_LOG_ROWS,
  });

  return activity.map((item) => ({
    // id sintetis (bukan scanId asli -- baris ini tidak pernah datang dari
    // broadcast) supaya tidak pernah "match" & ter-patch oleh event
    // broadcast manapun, hanya numpang tampil sebagai riwayat awal.
    id: `seed-${item.id}`,
    mode: "masuk" as const,
    name: item.studentName,
    className: item.className,
    status: item.status === "ALPHA" ? "error" : item.status === "HADIR" ? "success" : "warning",
    label: item.studentName,
    detail: `${STATUS_LABEL[item.status] ?? item.status}`,
    identified: true,
    ts: item.checkInAt,
  }));
}