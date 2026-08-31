// app/api/absensi/scan-pulang/identify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { scanAttendanceSchema } from "@/lib/validations/attendance";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceMethod } from "@/app/generated/prisma/client";

// Sama persis polanya dengan /api/absensi/scan/identify, hanya memanggil
// AttendanceService.identifyPulang() (pasangan checkOut()) -- lihat catatan
// lengkap di sana. Response endpoint ini BUKAN keputusan akhir; hanya
// /api/absensi/scan-pulang yang menyimpan checkOutAt.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["GURU", "ADMIN", "SUPERADMIN", "WALI_KELAS"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (isRateLimited(`scan-pulang-identify:${user.id}`, 60)) {
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
    const result = await AttendanceService.identifyPulang({
      identifier: parsed.data.qrToken,
      method: AttendanceMethod.QR,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Identify (scan-pulang) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}