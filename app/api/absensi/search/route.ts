import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { isRateLimited } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  if (isRateLimited(`search:${user.id}`)) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ students: [] });

  const students = await AttendanceService.searchStudents(query);
  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      nisn: s.nisn,
      className: s.class.name,
    })),
  });
}