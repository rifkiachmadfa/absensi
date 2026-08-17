import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAttendanceReport } from "@/lib/services/report-service";
import { buildReportWorkbook } from "@/lib/xlsx/report-workbook";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!["SUPERADMIN", "ADMIN", "WALI_KELAS"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "monthly" ? "monthly" : "daily";
  const date = searchParams.get("date") ?? undefined;
  const month = searchParams.get("month") ?? undefined;

  let classId = searchParams.get("classId") ?? undefined;

  // WALI_KELAS hanya boleh export laporan kelasnya sendiri.
  if (user.role === "WALI_KELAS") {
    const owned = await prisma.class.findFirst({
      where: { homeroomTeacherId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json(
        { message: "Anda belum ditugaskan sebagai wali kelas." },
        { status: 403 }
      );
    }
    classId = owned.id;
  }

  if (mode === "daily" && !date) {
    return NextResponse.json(
      { message: "Parameter 'date' wajib diisi untuk mode harian." },
      { status: 400 }
    );
  }
  if (mode === "monthly" && !month) {
    return NextResponse.json(
      { message: "Parameter 'month' wajib diisi untuk mode bulanan." },
      { status: 400 }
    );
  }

  try {
    const report = await getAttendanceReport(
      mode === "daily"
        ? { mode: "daily", date: date!, classId }
        : { mode: "monthly", month: month!, classId }
    );

    const setting = await prisma.schoolSetting.findFirst({ select: { schoolName: true } });
    const schoolName = setting?.schoolName?.trim() || "Sistem Absensi Siswa";

    const workbook = buildReportWorkbook(report, schoolName);
    const buffer = await workbook.xlsx.writeBuffer();

    const periodSlug =
      mode === "daily" ? report.period.startDate : report.period.startDate.slice(0, 7);
    const fileName = `laporan-absensi-${periodSlug}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export laporan error:", err);
    return NextResponse.json(
      { message: "Terjadi kesalahan saat membuat file Excel." },
      { status: 500 }
    );
  }
}