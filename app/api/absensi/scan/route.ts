// app/api/absensi/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
      result.type === "STUDENT_INACTIVE" ? 409 : 200;

    // Absensi baru langsung mengubah angka Hadir/Terlambat/Belum Absen di
    // dashboard publik "/" -- invalidate cache-nya hanya ketika record baru
    // benar-benar tersimpan.
    if (result.type === "SUCCESS") {
      revalidatePath("/");
    }

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("Check-in (scan) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}