// app/api/cron/auto-alpha/route.ts
import { NextRequest, NextResponse } from "next/server";
import { AttendanceService, getTodayDateOnly } from "@/lib/services/attendance-service";

// Dipanggil oleh Vercel Cron (lihat vercel.json, jadwal "0 5 * * *" UTC =
// 12:00 Asia/Jakarta, Section 11: siswa yang sampai batas waktu ini belum
// absen otomatis diberi status ALPHA). BUKAN endpoint untuk dipanggil dari
// UI -- tidak memakai sesi guru/admin, hanya CRON_SECRET.
//
// Diamankan dengan header "Authorization: Bearer <CRON_SECRET>" yang otomatis
// dikirim Vercel Cron ketika env var CRON_SECRET diset di project settings
// (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Tanpa CRON_SECRET yang cocok, endpoint ini menolak request -- termasuk
// menolak semua request kalau env var belum diset sama sekali, supaya tidak
// pernah berjalan tanpa sengaja tanpa proteksi.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await AttendanceService.markUnrecordedAsAlpha({
      date: getTodayDateOnly(),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Auto-ALPHA cron error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
