import { NextRequest, NextResponse } from "next/server";
import { notifyPublicDashboardChanged } from "@/lib/cache/public-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/lib/services/attendance-service";
import { setStatusSchema } from "@/lib/validations/attendance";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceStatus } from "@/app/generated/prisma/client";


export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // Semua role login (GURU, WALI_KELAS, ADMIN, SUPERADMIN) boleh mengubah
  // status kehadiran siswa mana pun, tanpa dibatasi kelas ampuan.
  if (isRateLimited(`status:${user.id}`)) {
    return NextResponse.json({ message: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = setStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Data tidak valid." }, { status: 400 });
  }

  try {
    const result = await AttendanceService.setManualStatus({
      studentId: parsed.data.studentId,
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      newStatus: parsed.data.status as AttendanceStatus,
      updatedById: user.id,
    });

    if (result.type === "STUDENT_NOT_FOUND") {
      return NextResponse.json({ message: "Siswa tidak ditemukan." }, { status: 404 });
    }
    if (result.type === "FUTURE_DATE_NOT_ALLOWED") {
      return NextResponse.json({ message: "Tidak dapat mengubah status untuk tanggal yang akan datang." }, { status: 400 });
    }
  notifyPublicDashboardChanged();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Set status error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}