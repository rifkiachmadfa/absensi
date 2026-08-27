// app/api/absensi/scan-pulang/route.ts
import { NextRequest, NextResponse } from "next/server";
import { notifyPublicDashboardChanged } from "@/lib/cache/public-dashboard";
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
  if (isRateLimited(`scan-pulang:${user.id}`)) {
    return NextResponse.json({ message: "Terlalu banyak percobaan scan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = scanAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ type: "STUDENT_NOT_FOUND", message: "QR code tidak valid." }, { status: 400 });
  }

  try {
    // Sama persis dengan /api/absensi/scan, hanya memanggil checkOut()
    // (bukan checkIn()) -- satu AttendanceService yang sama untuk keduanya.
    const result = await AttendanceService.checkOut({
      identifier: parsed.data.qrToken,
      method: AttendanceMethod.QR,
      recordedById: user.id,
    });

    const statusCode =
      result.type === "SUCCESS" ? 200 :
      result.type === "STUDENT_NOT_FOUND" ? 404 :
      result.type === "STUDENT_INACTIVE" ? 409 :
      result.type === "NOT_CHECKED_IN" ? 409 :
      result.type === "SCHOOL_CLOSED" ? 403 : 200;
    // Sama seperti scan absen masuk: invalidate dashboard publik "/" hanya
    // saat checkOutAt benar-benar tersimpan.
    if (result.type === "SUCCESS") {
      notifyPublicDashboardChanged();
    }

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("Check-out (scan) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}