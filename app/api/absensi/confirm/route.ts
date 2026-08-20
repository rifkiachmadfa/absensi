import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AttendanceService } from "@/lib/services/attendance-service";
import { confirmAttendanceSchema } from "@/lib/validations/attendance";
import { isRateLimited } from "@/lib/rate-limit";
import { AttendanceMethod, AttendanceStatus } from "@/app/generated/prisma/client";

// Langkah 2 dari flow scan/manual (Phase 7 & 8): menyimpan absensi dengan
// status yang DIPILIH MANUAL oleh guru/petugas yang men-scan atau mencari
// siswa -- bukan otomatis oleh sistem, karena jam masuk sekolah bisa
// berbeda-beda setiap hari (Section 11).
//
// Ini BUKAN pengganti POST /api/absensi/status: endpoint itu tetap dipakai
// khusus untuk KOREKSI status yang sudah tercatat oleh admin/wali kelas dari
// tabel /absensi (Section 4.2/4.4). Endpoint ini hanya untuk konfirmasi awal
// tepat setelah identifikasi via scan/pencarian, jadi rolenya sama dengan
// yang berhak melakukan scan (Section 4.3): GURU, ADMIN, SUPERADMIN, WALI_KELAS.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!["GURU", "ADMIN", "SUPERADMIN", "WALI_KELAS"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if (isRateLimited(`confirm:${user.id}`)) {
    return NextResponse.json({ message: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = confirmAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Data tidak valid." }, { status: 400 });
  }

  try {
    const result = await AttendanceService.confirmAttendance({
      studentId: parsed.data.studentId,
      status: parsed.data.status as AttendanceStatus,
      method: parsed.data.method as AttendanceMethod,
      recordedById: user.id,
    });

    const statusCode =
      result.type === "SUCCESS" ? 201 :
      result.type === "STUDENT_NOT_FOUND" ? 404 :
      result.type === "STUDENT_INACTIVE" ? 409 : 200;

    // Konfirmasi status awal (langkah ke-2 setelah scan/pencarian manual)
    // juga membuat record absensi baru -- dashboard publik "/" harus ikut
    // ter-update.
    if (result.type === "SUCCESS") {
      revalidatePath("/");
    }

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("Confirm attendance error:", err);
    return NextResponse.json({ message: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}