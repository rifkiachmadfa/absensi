// lib/services/attendance-service.ts
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  AttendanceStatus,
  AttendanceMethod,
  StudentStatus,
  ClassStatus,
  AuditAction,
} from "@/app/generated/prisma/client";

// ============================================================
// Types
// ============================================================

// Hasil dari AttendanceService.confirmAttendance (Phase 8): status SUDAH
// ditentukan manual oleh guru/petugas yang scan, bukan otomatis oleh sistem.
export type CheckInResult =
  | { type: "SUCCESS"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "ALREADY_CHECKED_IN"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "STUDENT_NOT_FOUND" }
  | { type: "STUDENT_INACTIVE"; student: StudentSummary };

// Hasil dari AttendanceService.identify (Phase 7): HANYA mengidentifikasi siswa
// dari QR/pencarian manual, TIDAK membuat record absensi apapun.
// `suggestedStatus` adalah SARAN berdasarkan AttendanceSchedule/SchoolSetting,
// keputusan akhir tetap ada di tangan guru/petugas lewat confirmAttendance.
export type IdentifyResult =
  | { type: "SUCCESS"; student: StudentSummary; suggestedStatus: AttendanceStatus }
  | { type: "ALREADY_CHECKED_IN"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "STUDENT_NOT_FOUND" }
  | { type: "STUDENT_INACTIVE"; student: StudentSummary };

export type SetManualStatusResult =
  | {
      type: "SUCCESS";
      attendanceId: string;
      previousStatus: AttendanceStatus | null;
      newStatus: AttendanceStatus;
    }
  | { type: "STUDENT_NOT_FOUND" }
  | { type: "FUTURE_DATE_NOT_ALLOWED" };

export type DailyRecap = {
  date: string;
  totalSiswa: number;
  counts: Record<AttendanceStatus | "BELUM_ABSEN", number>;
  belumAbsen: { id: string; name: string; className: string }[];
};

// Dashboard (Phase 9) — statistik per kelas untuk hari tertentu.
export type ClassBreakdown = {
  classId: string;
  className: string;
  totalSiswa: number;
  hadir: number;
  terlambat: number;
  belumAbsen: number;
  lainnya: number; // SAKIT + IZIN + DISPENSASI + ALPHA
  persentaseHadir: number; // (hadir + terlambat) / totalSiswa * 100, dibulatkan
};

// Dashboard (Phase 9) — daftar aktivitas absensi terbaru.
export type RecentAttendanceItem = {
  id: string;
  studentName: string;
  className: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  checkInAt: string;
  recordedByName: string;
};

type StudentSummary = {
  id: string;
  name: string;
  nisn: string;
  className: string;
};
// (id disertakan agar hasil identify() bisa langsung dipakai sebagai
// studentId saat memanggil confirmAttendance())

// ============================================================
// Internal helpers
// ============================================================

const TIMEZONE = "Asia/Jakarta";

function getJakartaNow() {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return { serverTime: now, dayOfWeek: local.getDay(), hhmm };
}

// Diekspor agar dipakai halaman dashboard untuk menentukan "hari ini"
// dengan definisi yang SAMA PERSIS dengan yang dipakai AttendanceService.
// Jangan buat helper tanggal duplikat di tempat lain.
export function getTodayDateOnly(): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });
  return new Date(`${formatter.format(new Date())}T00:00:00.000Z`);
}

async function resolveStatus(dayOfWeek: number, hhmm: string): Promise<AttendanceStatus> {
  const daySchedule = await prisma.attendanceSchedule.findFirst({
    where: { dayOfWeek, isActive: true },
  });

  if (daySchedule) {
    return hhmm <= daySchedule.lateAfter ? AttendanceStatus.HADIR : AttendanceStatus.TERLAMBAT;
  }

  const setting = await prisma.schoolSetting.findFirst();
  const lateAfter = setting?.lateAfter ?? "07:15";
  return hhmm <= lateAfter ? AttendanceStatus.HADIR : AttendanceStatus.TERLAMBAT;
}

function toSummary(student: {
  id: string;
  name: string;
  nisn: string | null;
  class: { name: string };
}): StudentSummary {
  return {
    id: student.id,
    name: student.name,
    nisn: student.nisn ?? "-",
    className: student.class.name,
  };
}

// ============================================================
// AttendanceService
// Satu-satunya pintu masuk logic absensi. Dipakai oleh:
// - QR Scan (Phase 7)      -> identify()          (identifikasi saja)
// - Input manual (Phase 7) -> identify()          (identifikasi saja)
// - Konfirmasi kehadiran   -> confirmAttendance()  (Phase 8, status DIPILIH
//   MANUAL oleh guru/petugas yang scan/mencari siswa -- BUKAN otomatis oleh
//   sistem, karena jam masuk sekolah bisa berbeda-beda setiap hari)
// - Perubahan status oleh admin/wali kelas (Phase 8) -> setManualStatus()
//   (koreksi status yang SUDAH tercatat, dari tabel /absensi)
// - Rekap harian, statistik per kelas & aktivitas terbaru untuk
//   dashboard (Phase 9) dan laporan (Phase 10)
//
// Flow scan/manual sekarang 2 langkah (bukan auto-create langsung):
//   1. identify(identifier, method)        -> kenali siswa, TIDAK menyimpan apa pun
//   2. confirmAttendance(studentId, status) -> baru menyimpan, status pilihan guru
//
// Jangan buat logic absensi terpisah di luar service ini.
// ============================================================

export class AttendanceService {

    /**
   * Tabel rekap absensi untuk /absensi: menggabungkan record Attendance
   * dengan siswa yang belum punya record (BELUM_ABSEN), untuk satu tanggal.
   * Diurutkan: yang sudah check-in terbaru dulu, lalu BELUM_ABSEN by nama.
   */
  static async getAttendanceTable(params: {
    date: Date;
    classId?: string;
    studentId?: string;
    status?: string;
  }) {
    const { date, classId, studentId, status } = params;

    const students = await prisma.student.findMany({
      where: {
        status: StudentStatus.ACTIVE,
        ...(classId ? { classId } : {}),
        ...(studentId ? { id: studentId } : {}),
      },
      select: { id: true, name: true, nisn: true, class: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    const studentIds = students.map((s) => s.id);

    const attendances = await prisma.attendance.findMany({
      where: { date, studentId: { in: studentIds } },
    });
    const byStudent = new Map(attendances.map((a) => [a.studentId, a]));

    let rows = students.map((s) => {
      const a = byStudent.get(s.id);
      return {
        studentId: s.id,
        attendanceId: a?.id ?? null,
        name: s.name,
        nisn: s.nisn ?? "-",
        className: s.class.name,
        status: a?.status ?? ("BELUM_ABSEN" as const),
        checkInAt: a?.checkInAt.toISOString() ?? null,
      };
    });

    if (status) {
      rows = rows.filter((r) => r.status === status);
    }

    rows.sort((a, b) => {
      if (a.checkInAt && b.checkInAt) return b.checkInAt.localeCompare(a.checkInAt);
      if (a.checkInAt) return -1;
      if (b.checkInAt) return 1;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }
  /**
   * Langkah 1: identifikasi siswa dari QR Scan atau input manual.
   * TIDAK menyimpan record absensi apapun -- hanya mengenali siswa dan
   * memberi tahu UI apakah siswa tsb sudah absen hari ini.
   *
   * `suggestedStatus` dihitung dari AttendanceSchedule/SchoolSetting sebagai
   * SARAN saja (mis. highlight tombol "Hadir" di UI). Keputusan status akhir
   * TETAP di tangan guru/petugas lewat confirmAttendance, karena jam masuk
   * sekolah bisa berbeda-beda setiap hari (Section 11).
   */
  static async identify(params: {
    identifier: string; // qrToken (QR) atau studentId (MANUAL)
    method: AttendanceMethod;
  }): Promise<IdentifyResult> {
    const { identifier, method } = params;

    const student = await prisma.student.findFirst({
      where: method === AttendanceMethod.QR ? { qrToken: identifier } : { id: identifier },
      include: { class: true },
    });

    if (!student) return { type: "STUDENT_NOT_FOUND" };
    if (student.status !== StudentStatus.ACTIVE) {
      return { type: "STUDENT_INACTIVE", student: toSummary(student) };
    }

    const date = getTodayDateOnly();
    const existing = await prisma.attendance.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
    });

    if (existing) {
      return {
        type: "ALREADY_CHECKED_IN",
        student: toSummary(student),
        time: existing.checkInAt.toISOString(),
        status: existing.status,
      };
    }

    const { dayOfWeek, hhmm } = getJakartaNow();
    const suggestedStatus = await resolveStatus(dayOfWeek, hhmm);

    return { type: "SUCCESS", student: toSummary(student), suggestedStatus };
  }

  /**
   * Langkah 2: konfirmasi kehadiran siswa yang sudah diidentifikasi.
   * Status (HADIR/TERLAMBAT/SAKIT/IZIN/DISPENSASI/ALPHA) DIPILIH MANUAL oleh
   * guru/petugas yang melakukan scan/pencarian -- sistem tidak lagi
   * menentukan status secara otomatis di sini.
   * Waktu SELALU diambil dari server, tidak pernah dari client.
   */
  static async confirmAttendance(params: {
    studentId: string;
    status: AttendanceStatus;
    method: AttendanceMethod;
    recordedById: string;
  }): Promise<CheckInResult> {
    const { studentId, status, method, recordedById } = params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student) return { type: "STUDENT_NOT_FOUND" };
    if (student.status !== StudentStatus.ACTIVE) {
      return { type: "STUDENT_INACTIVE", student: toSummary(student) };
    }

    const date = getTodayDateOnly();
    const { serverTime } = getJakartaNow();

    try {
      const attendance = await prisma.$transaction(async (tx) => {
        const created = await tx.attendance.create({
          data: {
            studentId: student.id,
            date,
            checkInAt: serverTime,
            status,
            method,
            recordedById,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: recordedById,
            action:
              method === AttendanceMethod.QR
                ? AuditAction.ATTENDANCE_SCAN
                : AuditAction.ATTENDANCE_MANUAL,
            entity: "Attendance",
            entityId: created.id,
            description: `Absen ${student.name} (${student.class.name}) - ${status} (dipilih manual oleh petugas)`,
          },
        });

        return created;
      });

      return {
        type: "SUCCESS",
        student: toSummary(student),
        time: attendance.checkInAt.toISOString(),
        status: attendance.status,
      };
    } catch (err) {
      // Unique constraint (studentId + date) -> sudah absen hari ini.
      // Ditangkap di sini untuk melindungi dari race condition saat burst request
      // (banyak siswa scan bersamaan saat jam masuk sekolah), atau saat dua
      // guru mengonfirmasi siswa yang sama nyaris bersamaan.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.attendance.findUnique({
          where: { studentId_date: { studentId: student.id, date } },
        });
        return {
          type: "ALREADY_CHECKED_IN",
          student: toSummary(student),
          time: existing?.checkInAt.toISOString() ?? "",
          status: existing?.status ?? status,
        };
      }
      throw err;
    }
  }

  /**
   * Cari siswa aktif berdasarkan nama/NIS/NISN untuk input manual.
   */
  static async searchStudents(query: string) {
    return prisma.student.findMany({
      where: {
        status: StudentStatus.ACTIVE,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { nis: { contains: query } },
          { nisn: { contains: query } },
        ],
      },
      include: { class: true },
      take: 10,
    });
  }

  /**
   * Set atau ubah status absensi secara manual (admin/wali kelas).
   * Dipakai untuk: BELUM_ABSEN -> SAKIT/IZIN/DISPENSASI/ALPHA,
   * atau koreksi status yang salah.
   * Selalu tercatat di AuditLog dengan status lama -> baru.
   *
   * Catatan: jika belum ada record (siswa BELUM_ABSEN), checkInAt diisi waktu
   * server saat admin melakukan input -- ini BUKAN jam kehadiran fisik siswa,
   * hanya timestamp administratif. Schema saat ini mewajibkan checkInAt diisi.
   */
  static async setManualStatus(params: {
    studentId: string;
    date: Date; // date-only, jam 00:00:00.000Z
    newStatus: AttendanceStatus;
    updatedById: string;
  }): Promise<SetManualStatusResult> {
    const { studentId, date, newStatus, updatedById } = params;

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return { type: "STUDENT_NOT_FOUND" };

    const today = getTodayDateOnly();
    if (date.getTime() > today.getTime()) {
      return { type: "FUTURE_DATE_NOT_ALLOWED" };
    }

    const existing = await prisma.attendance.findUnique({
      where: { studentId_date: { studentId, date } },
    });

    const result = await prisma.$transaction(async (tx) => {
      const attendance = existing
        ? await tx.attendance.update({
            where: { id: existing.id },
            data: { status: newStatus },
          })
        : await tx.attendance.create({
            data: {
              studentId,
              date,
              checkInAt: new Date(),
              status: newStatus,
              method: AttendanceMethod.MANUAL,
              recordedById: updatedById,
            },
          });

      await tx.auditLog.create({
        data: {
          userId: updatedById,
          action: AuditAction.STATUS_CHANGE,
          entity: "Attendance",
          entityId: attendance.id,
          description: existing
            ? `Ubah status ${student.name}: ${existing.status} -> ${newStatus}`
            : `Set status ${student.name}: BELUM_ABSEN -> ${newStatus}`,
        },
      });

      return attendance;
    });

    return {
      type: "SUCCESS",
      attendanceId: result.id,
      previousStatus: existing?.status ?? null,
      newStatus: result.status,
    };
  }

  /**
   * Rekap harian yang benar: termasuk siswa yang belum punya record (BELUM_ABSEN).
   * Dipakai oleh dashboard (Section 7) dan laporan (Section 16-17).
   */
  static async getDailyRecap(params: { date: Date; classId?: string }): Promise<DailyRecap> {
    const { date, classId } = params;

    const students = await prisma.student.findMany({
      where: {
        status: StudentStatus.ACTIVE,
        ...(classId ? { classId } : {}),
      },
      select: {
        id: true,
        name: true,
        nisn: true,
        class: { select: { id: true, name: true } },
      },
    });

    const studentIds = students.map((s) => s.id);

    const attendances = await prisma.attendance.findMany({
      where: { date, studentId: { in: studentIds } },
      select: { studentId: true, status: true, checkInAt: true },
    });

    const attendanceByStudent = new Map(attendances.map((a) => [a.studentId, a]));

    const counts: Record<AttendanceStatus | "BELUM_ABSEN", number> = {
      HADIR: 0,
      TERLAMBAT: 0,
      SAKIT: 0,
      IZIN: 0,
      DISPENSASI: 0,
      ALPHA: 0,
      BELUM_ABSEN: 0,
    };

    const belumAbsenList: { id: string; name: string; className: string }[] = [];

    for (const student of students) {
      const attendance = attendanceByStudent.get(student.id);
      if (!attendance) {
        counts.BELUM_ABSEN += 1;
        belumAbsenList.push({
          id: student.id,
          name: student.name,
          className: student.class.name,
        });
        continue;
      }
      counts[attendance.status] += 1;
    }

    return {
      date: date.toISOString().slice(0, 10),
      totalSiswa: students.length,
      counts,
      belumAbsen: belumAbsenList,
    };
  }

  /**
   * Breakdown kehadiran per kelas untuk satu tanggal.
   * Dipakai dashboard (Section 7 & 31) untuk "Statistik per kelas".
   * 2 query saja (kelas + attendance), grouping dilakukan di memori —
   * aman untuk skala ±500 siswa (Section 38).
   */
  static async getClassBreakdown(params: {
    date: Date;
    classId?: string;
  }): Promise<ClassBreakdown[]> {
    const { date, classId } = params;

    const classes = await prisma.class.findMany({
      where: {
        status: ClassStatus.ACTIVE,
        ...(classId ? { id: classId } : {}),
      },
      select: {
        id: true,
        name: true,
        students: {
          where: { status: StudentStatus.ACTIVE },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const studentIds = classes.flatMap((k) => k.students.map((s) => s.id));

    const attendances = await prisma.attendance.findMany({
      where: { date, studentId: { in: studentIds } },
      select: { studentId: true, status: true },
    });
    const statusByStudent = new Map(attendances.map((a) => [a.studentId, a.status]));

    return classes.map((kelas) => {
      let hadir = 0;
      let terlambat = 0;
      let belumAbsen = 0;
      let lainnya = 0;

      for (const s of kelas.students) {
        const status = statusByStudent.get(s.id);
        if (!status) belumAbsen += 1;
        else if (status === AttendanceStatus.HADIR) hadir += 1;
        else if (status === AttendanceStatus.TERLAMBAT) terlambat += 1;
        else lainnya += 1;
      }

      const totalSiswa = kelas.students.length;
      const persentaseHadir =
        totalSiswa > 0 ? Math.round(((hadir + terlambat) / totalSiswa) * 100) : 0;

      return {
        classId: kelas.id,
        className: kelas.name,
        totalSiswa,
        hadir,
        terlambat,
        belumAbsen,
        lainnya,
        persentaseHadir,
      };
    });
  }

  /**
   * Aktivitas absensi terbaru pada satu tanggal (default: hari ini).
   * Dipakai dashboard (Section 7) untuk panel "Absensi Terbaru".
   */
  static async getRecentActivity(params: {
    date: Date;
    limit?: number;
    classId?: string;
  }): Promise<RecentAttendanceItem[]> {
    const { date, limit = 8, classId } = params;

    const attendances = await prisma.attendance.findMany({
      where: {
        date,
        ...(classId ? { student: { classId } } : {}),
      },
      include: {
        student: { select: { name: true, class: { select: { name: true } } } },
        recordedBy: { select: { name: true } },
      },
      orderBy: { checkInAt: "desc" },
      take: limit,
    });

    return attendances.map((a) => ({
      id: a.id,
      studentName: a.student.name,
      className: a.student.class.name,
      status: a.status,
      method: a.method,
      checkInAt: a.checkInAt.toISOString(),
      recordedByName: a.recordedBy?.name ?? "-",
    }));
  }
}