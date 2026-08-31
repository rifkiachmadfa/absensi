// app/api/absensi/scan/identify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { scanAttendanceSchema } from "@/lib/validations/attendance";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceMethod } from "@/app/generated/prisma/client";

// Fase 1 (read-only, TIDAK menyimpan absensi apa pun) dari pola
// "identify lalu checkIn": dipanggil use-scan-queue.ts SEBELUM
// /api/absensi/scan supaya UI bisa menampilkan Nama/Kelas siswa SEGERA
// begitu kartu dikenali, sementara /api/absensi/scan (checkIn(), yang
// benar-benar menyimpan) diproses menyusul (Section 29 UX Scanner).
//
// PENTING: response endpoint ini BUKAN keputusan akhir. Hanya
// /api/absensi/scan yang boleh dianggap sumber kebenaran soal status
// tersimpan/tidaknya absensi (Section 3.1, 3.2, 26) -- kalau endpoint ini
// gagal/timeout, UI tetap lanjut memanggil /api/absensi/scan seperti
// biasa (lihat handleDetected di scan-dialog.tsx).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["GURU", "ADMIN", "SUPERADMIN", "WALI_KELAS"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  // Limit lebih longgar dari /api/absensi/scan (60 vs 30/menit) karena
  // endpoint ini dipanggil BERPASANGAN dengan /api/absensi/scan untuk
  // setiap satu kartu yang di-scan, dan query-nya jauh lebih ringan
  // (read-only, tanpa transaksi/tulis).
  if (isRateLimited(`scan-identify:${user.id}`, 60)) {
    return NextResponse.json({ message: "Terlalu banyak percobaan scan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = scanAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { type: "STUDENT_NOT_FOUND", message: "QR code tidak valid." },
      { status: 400 }
    );
  }

  try {
    const result = await AttendanceService.identify({
      identifier: parsed.data.qrToken,
      method: AttendanceMethod.QR,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Identify (scan) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}