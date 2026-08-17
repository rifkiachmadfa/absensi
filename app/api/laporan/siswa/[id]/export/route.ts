import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getStudentAttendanceDetail } from "@/lib/services/report-service";
import { buildStudentReportWorkbook } from "@/lib/xlsx/report-workbook";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!["SUPERADMIN", "ADMIN", "WALI_KELAS"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // WALI_KELAS hanya boleh export laporan siswa di kelas yang diampu.
  if (user.role === "WALI_KELAS") {
    const student = await prisma.student.findUnique({
      where: { id },
      select: { class: { select: { homeroomTeacherId: true } } },
    });
    if (!student || student.class.homeroomTeacherId !== user.id) {
      return NextResponse.json(
        { message: "Anda tidak memiliki akses ke siswa ini." },
        { status: 403 }
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "monthly" ? "monthly" : "daily";
  const date = searchParams.get("date") ?? undefined;
  const month = searchParams.get("month") ?? undefined;

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
    const detail = await getStudentAttendanceDetail(
      mode === "daily"
        ? { studentId: id, mode: "daily", date: date! }
        : { studentId: id, mode: "monthly", month: month! }
    );

    if (!detail) {
      return NextResponse.json({ message: "Siswa tidak ditemukan." }, { status: 404 });
    }

    const setting = await prisma.schoolSetting.findFirst({ select: { schoolName: true } });
    const schoolName = setting?.schoolName?.trim() || "Sistem Absensi Siswa";

    const workbook = buildStudentReportWorkbook(detail, schoolName);
    const buffer = await workbook.xlsx.writeBuffer();

    const periodSlug =
      mode === "daily" ? detail.period.startDate : detail.period.startDate.slice(0, 7);
    const namaSlug = detail.student.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const fileName = `laporan-${namaSlug}-${periodSlug}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export laporan siswa error:", err);
    return NextResponse.json(
      { message: "Terjadi kesalahan saat membuat file Excel." },
      { status: 500 }
    );
  }
}