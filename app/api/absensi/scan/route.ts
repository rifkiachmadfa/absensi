// app/api/absensi/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { scanAttendanceSchema } from "@/lib/validations/attendance";
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
    // Hanya identifikasi siswa dari QR -- BELUM menyimpan absensi.
    // Status kehadiran dipilih manual oleh guru lewat POST /api/absensi/confirm,
    // karena jam masuk sekolah bisa berbeda-beda setiap hari (Section 11).
    const result = await AttendanceService.identify({
      identifier: parsed.data.qrToken,
      method: AttendanceMethod.QR,
    });

    const statusCode =
      result.type === "SUCCESS" ? 200 :
      result.type === "STUDENT_NOT_FOUND" ? 404 :
      result.type === "STUDENT_INACTIVE" ? 409 : 200;

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("Identify (scan) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}