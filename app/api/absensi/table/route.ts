import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/lib/services/attendance-service";
import { tableQuerySchema } from "@/lib/validations/attendance";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const parsed = tableQuerySchema.safeParse({
    date: req.nextUrl.searchParams.get("date"),
    classId: req.nextUrl.searchParams.get("classId") ?? undefined,
    status: req.nextUrl.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ message: "Parameter tidak valid." }, { status: 400 });
  }

  let classId = parsed.data.classId;


  try {
    const rows = await AttendanceService.getAttendanceTable({
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      classId,
      status: parsed.data.status,
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("Attendance table error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}