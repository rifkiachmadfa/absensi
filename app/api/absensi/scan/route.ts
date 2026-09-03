// app/api/absensi/scan/route.ts
import { NextRequest, NextResponse, after } from "next/server";
import { notifyPublicDashboardChanged } from "@/lib/cache/public-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { scanAttendanceSchema } from "@/lib/validations/attendance";
import { classifyCheckInResult } from "@/lib/attendance/classify-result";
import { broadcastScanResult } from "@/lib/attendance/realtime/attendance-live-broadcast";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceMethod } from "@/app/generated/prisma/client";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["GURU", "ADMIN", "SUPERADMIN", "WALI_KELAS"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (isRateLimited(`scan:${user.id}`)) {
    return NextResponse.json({ message: "Terlalu banyak percobaan scan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = scanAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ type: "STUDENT_NOT_FOUND", message: "QR code tidak valid." }, { status: 400 });
  }

  try {
    // Identifikasi siswa dari QR sekaligus simpan absensinya. Status
    // (HADIR/TERLAMBAT) dihitung otomatis dari AttendanceSchedule -- guru
    // tidak perlu memilih status secara manual lagi (Section 11 & 29).
    const result = await AttendanceService.checkIn({
      identifier: parsed.data.qrToken,
      method: AttendanceMethod.QR,
      recordedById: user.id,
    });

    const statusCode =
      result.type === "SUCCESS" ? 201 :
      result.type === "STUDENT_NOT_FOUND" ? 404 :
      result.type === "STUDENT_INACTIVE" ? 409 :
      result.type === "SCHOOL_CLOSED" ? 403 : 200;

    // Absensi baru langsung mengubah angka Hadir/Terlambat/Belum Absen di
    // dashboard publik "/" -- invalidate cache-nya hanya ketika record baru
    // benar-benar tersimpan.
    if (result.type === "SUCCESS") {
      notifyPublicDashboardChanged();
    }

    // Umumkan hasil akhir ke channel "Log Live Absensi" (Supabase Realtime
    // Broadcast) supaya device LAIN yang sedang membuka tab Log Live/monitor
    // -- BUKAN device yang dipasangi scanner-bridge -- ikut melihat hasil
    // scan secara realtime tanpa reload. Sama persis polanya dengan
    // /api/absensi/scan-pulang (lihat catatan lengkap di sana); endpoint ini
    // sebelumnya TIDAK memanggil broadcast sama sekali, itulah sebabnya
    // scan "Masuk" dari scanner fisik tidak pernah muncul di monitor device
    // kedua walau scan-nya sendiri berhasil tersimpan.
    if (parsed.data.scanId) {
      const scanId = parsed.data.scanId;
      const classified = classifyCheckInResult(result);
      after(() =>
        broadcastScanResult({
          scanId,
          mode: "masuk",
          name: "student" in result ? result.student.name : null,
          className:
            "student" in result && "className" in result.student
              ? result.student.className
              : null,
          status: classified.status === "pending" ? "error" : classified.status,
          label: classified.label,
          detail: classified.detail,
        })
      );
    }

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("Check-in (scan) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}