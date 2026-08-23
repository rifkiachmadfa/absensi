// app/api/absensi/manual-pulang/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { manualAttendanceSchema } from "@/lib/validations/attendance";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceMethod } from "@/app/generated/prisma/client";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["GURU", "ADMIN", "SUPERADMIN", "WALI_KELAS"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (isRateLimited(`manual-pulang:${user.id}`)) {
    return NextResponse.json({ message: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = manualAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Data tidak valid." }, { status: 400 });
  }

  try {
    // Sama persis dengan /api/absensi/manual, hanya memanggil checkOut()
    // (bukan checkIn()) -- satu AttendanceService yang sama untuk keduanya,
    // hanya identifier-nya studentId hasil pencarian (Section 9).
    const result = await AttendanceService.checkOut({
      identifier: parsed.data.studentId,
      method: AttendanceMethod.MANUAL,
      recordedById: user.id,
    });

    const statusCode =
      result.type === "SUCCESS" ? 200 :
      result.type === "STUDENT_NOT_FOUND" ? 404 :
      result.type === "STUDENT_INACTIVE" ? 409 :
      result.type === "NOT_CHECKED_IN" ? 409 :
      result.type === "SCHOOL_CLOSED" ? 403 : 200;

    if (result.type === "SUCCESS") {
      revalidatePath("/");
    }

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("Check-out (manual) attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}