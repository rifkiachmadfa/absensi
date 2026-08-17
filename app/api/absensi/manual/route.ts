// app/api/absensi/manual/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { manualAttendanceSchema } from "@/lib/validations/attendance";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceMethod } from "@/app/generated/prisma/client";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (isRateLimited(`manual:${user.id}`)) {
    return NextResponse.json({ message: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = manualAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Data tidak valid." }, { status: 400 });
  }

  try {
    // Hanya identifikasi siswa hasil pencarian manual -- BELUM menyimpan absensi.
    // Status kehadiran dipilih manual oleh petugas lewat POST /api/absensi/confirm.
    const result = await AttendanceService.identify({
      identifier: parsed.data.studentId,
      method: AttendanceMethod.MANUAL,
    });

    const statusCode =
      result.type === "SUCCESS" ? 200 :
      result.type === "STUDENT_NOT_FOUND" ? 404 :
      result.type === "STUDENT_INACTIVE" ? 409 : 200;

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("Identify (manual) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}