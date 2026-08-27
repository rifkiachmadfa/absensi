import { NextRequest, NextResponse } from "next/server";
import { notifyPublicDashboardChanged } from "@/lib/cache/public-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { bulkSetStatusSchema } from "@/lib/validations/attendance";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceStatus } from "@/app/generated/prisma/client";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // Satu request bulk = satu hit rate limit (bukan per siswa), supaya
  // mengubah status banyak siswa sekaligus tidak langsung kena limit yang
  // sama dengan endpoint status satuan.
  if (isRateLimited(`status-bulk:${user.id}`, 10)) {
    return NextResponse.json({ message: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bulkSetStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Data tidak valid." }, { status: 400 });
  }

  try {
    const result = await AttendanceService.setManualStatusBulk({
      studentIds: parsed.data.studentIds,
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      newStatus: parsed.data.status as AttendanceStatus,
      updatedById: user.id,
    });

    notifyPublicDashboardChanged();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("Bulk set status error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}