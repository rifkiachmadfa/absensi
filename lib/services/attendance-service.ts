// lib/services/attendance-service.ts
import { unstable_cache } from "next/cache";
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
  | { type: "STUDENT_INACTIVE"; student: StudentSummary }
  | { type: "SCHOOL_CLOSED" };

// Hasil dari AttendanceService.identify (Phase 7, LEGACY -- tidak lagi dipakai
// oleh /api/absensi/scan & /api/absensi/manual sejak checkIn() ada, lihat
// catatan di atas method identify()). HANYA mengidentifikasi siswa dari
// QR/pencarian manual, TIDAK membuat record absensi apapun. `suggestedStatus`
// adalah SARAN berdasarkan AttendanceSchedule/SchoolSetting.
// Hasil dari AttendanceService.checkOut (fitur "Pulang"): siswa yang di-scan
// HARUS sudah check-in (HADIR/TERLAMBAT) hari itu -- checkOut() TIDAK PERNAH
// membuat record Attendance baru, hanya mengisi checkOutAt pada record yang
// sudah ada. Sama seperti checkIn(), waktu SELALU dari server (Section 3.1).
export type CheckOutResult =
  | { type: "SUCCESS"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "ALREADY_CHECKED_OUT"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "NOT_CHECKED_IN"; student: StudentSummary }
  | { type: "STUDENT_NOT_FOUND" }
  | { type: "STUDENT_INACTIVE"; student: StudentSummary }
  | { type: "SCHOOL_CLOSED" };

export type IdentifyResult =
  | { type: "SUCCESS"; student: StudentSummary; suggestedStatus: AttendanceStatus }
  | { type: "ALREADY_CHECKED_IN"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "STUDENT_NOT_FOUND" }
  | { type: "STUDENT_INACTIVE"; student: StudentSummary }
  | { type: "SCHOOL_CLOSED" };

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

// Dipakai internal oleh checkOut() untuk mendeteksi race condition (dua
// request checkOut nyaris bersamaan untuk siswa yang sama) tanpa perlu
// unique constraint tambahan di database -- lihat catatan di checkOut().
class AlreadyCheckedOutError extends Error {}

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

// Sekolah hanya masuk Senin-Jumat (lihat SCHOOL_DAYS di pengaturan-service.ts
// & DAY_NAMES-nya). Satu-satunya definisi "akhir pekan" untuk seluruh sistem
// -- dipakai checkIn()/checkOut()/identify() untuk menolak absensi di
// Sabtu/Minggu, oleh cron auto-alpha untuk skip, dan oleh dashboard
// (/dashboard & /) untuk menampilkan status "libur" alih-alih angka
// perhitungan hari itu. JANGAN buat helper akhir-pekan duplikat di tempat
// lain -- report-service.ts mengimpor helper ini juga.
//
// `date` di sini SELALU date-only (midnight UTC yang merepresentasikan
// tanggal kalender Asia/Jakarta, hasil getTodayDateOnly()), karena itu
// day-of-week dibaca lewat getUTCDay(), bukan getDay().
export function isWeekendDate(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // 0 = Minggu, 6 = Sabtu
}

// Hari libur di LUAR akhir pekan (libur nasional, libur sekolah, dsb --
// lihat model Holiday di schema.prisma & pengaturan-service.ts). `date`
// harus date-only (midnight UTC), sama seperti isWeekendDate().
export async function isHoliday(date: Date): Promise<boolean> {
  const holiday = await prisma.holiday.findUnique({
    where: { date },
    select: { id: true },
  });
  return holiday !== null;
}

// Satu-satunya definisi "bukan hari sekolah" untuk seluruh sistem: akhir
// pekan ATAU hari libur yang diatur admin di /pengaturan. Dipakai
// checkIn()/checkOut()/identify() untuk menolak absensi, oleh
// markUnrecordedAsAlpha() untuk skip auto-ALPHA, dan report-service.ts
// (lewat getHolidayDateSet + isWeekendDate) untuk perhitungan schoolDays.
// JANGAN buat helper "hari sekolah" duplikat di tempat lain.
export async function isNonSchoolDay(date: Date): Promise<boolean> {
  return isWeekendDate(date) || (await isHoliday(date));
}

// Ambil seluruh tanggal libur (non-akhir-pekan) dalam satu rentang sekaligus
// sebagai Set<"YYYY-MM-DD">, supaya kode yang meng-iterasi rentang tanggal
// (report-service.ts) tidak melakukan query per-hari (N+1). `start`/`end`
// harus date-only (midnight UTC), inklusif di kedua ujung.
export async function getHolidayDateSet(start: Date, end: Date): Promise<Set<string>> {
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  return new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
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
// - QR Scan            -> checkIn(method: QR)      (identifikasi + simpan,
//   status dihitung OTOMATIS dari AttendanceSchedule/SchoolSetting)
// - Input manual        -> checkIn(method: MANUAL)  (sama persis dengan QR,
//   satu-satunya bedanya identifier-nya studentId hasil pencarian, bukan qrToken)
// - Scan/Input manual "Pulang" -> checkOut(method: QR | MANUAL) (mengisi
//   checkOutAt pada record Attendance yang sudah ada; siswa yang belum
//   check-in hari itu akan mendapat NOT_CHECKED_IN, bukan record baru)
// - Perubahan status oleh admin/wali kelas -> setManualStatus()
//   (koreksi status yang SUDAH tercatat, atau set SAKIT/IZIN/DISPENSASI/ALPHA
//   untuk siswa yang masih BELUM_ABSEN, dari tabel /absensi)
// - Auto-ALPHA batas akhir absensi -> markUnrecordedAsAlpha()
//   (dipanggil oleh cron job harian, Section 11: siswa yang sampai batas
//   waktu tertentu belum absen otomatis diberi status ALPHA)
// - Rekap harian, statistik per kelas & aktivitas terbaru untuk
//   dashboard (Phase 9) dan laporan (Phase 10)
//
// checkIn() adalah SATU LANGKAH: identifikasi siswa, hitung status dari
// AttendanceSchedule (hari ini) -- fallback ke SchoolSetting kalau tidak ada
// jadwal aktif untuk hari tsb -- lalu langsung simpan. Ini SENGAJA berbeda
// dari identify()+confirmAttendance() (masih ada di bawah, LEGACY, tidak lagi
// dipanggil oleh route manapun) yang mewajibkan guru memilih status secara
// manual lewat tombol. Guru/petugas TETAP bisa mengoreksi status yang salah
// sesudahnya lewat setManualStatus() (StatusDropdown di tabel /absensi).
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
    studentIds?: string[];
    status?: string;
  }) {
    const { date, classId, studentId, studentIds, status } = params;

    // studentIds dipakai untuk targeted refresh (mis. setelah ubah status
    // satu/beberapa baris di /absensi) -- ambil ulang baris tsb saja tanpa
    // query ulang seluruh tabel. studentId (tunggal) tetap didukung untuk
    // kompatibilitas pemanggil lain.
    const idFilter =
      studentIds && studentIds.length > 0
        ? { id: { in: studentIds } }
        : studentId
          ? { id: studentId }
          : {};

    const students = await prisma.student.findMany({
      where: {
        status: StudentStatus.ACTIVE,
        ...(classId ? { classId } : {}),
        ...idFilter,
      },
      select: { id: true, name: true, nisn: true, class: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

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
        checkOutAt: a?.checkOutAt?.toISOString() ?? null,
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
   * LEGACY -- tidak lagi dipanggil oleh route manapun sejak checkIn() ada
   * (lihat checkIn() di bawah). Disimpan sebagai opsi kalau suatu saat
   * dibutuhkan alur "identifikasi dulu, baru pilih status manual" lagi.
   *
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

    // Sabtu/Minggu ATAU hari libur yang diatur admin (lihat isNonSchoolDay).
    // Dicek PALING AWAL, sebelum query siswa apapun, supaya tidak ada
    // absensi (atau bahkan identifikasi) yang bisa lolos di hari libur
    // lewat jalur legacy ini.
    if (await isNonSchoolDay(getTodayDateOnly())) {
      return { type: "SCHOOL_CLOSED" };
    }

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
   * Identifikasi siswa dari QR Scan atau input manual, DAN langsung simpan
   * absensinya dalam satu langkah -- status (HADIR/TERLAMBAT) dihitung
   * OTOMATIS dari AttendanceSchedule (jadwal hari ini) / SchoolSetting,
   * konsisten dengan Section 3.1 (server sebagai sumber waktu) & Section 11
   * (aturan jam absensi) pada spesifikasi project.
   *
   * Dipakai oleh QR Scan (Phase 7) maupun input manual (Phase 7) -- SATU
   * service yang sama untuk keduanya (Section 9), hanya `identifier` dan
   * `method` yang berbeda.
   *
   * TIDAK PERNAH menghasilkan SAKIT/IZIN/DISPENSASI/ALPHA -- status itu
   * hanya bisa di-set lewat setManualStatus() oleh admin/wali kelas, karena
   * checkIn() berarti siswa TERBUKTI hadir secara fisik (baru saja di-scan /
   * ditemukan & dipilih oleh petugas).
   */
  static async checkIn(params: {
    identifier: string; // qrToken (QR) atau studentId (MANUAL)
    method: AttendanceMethod;
    recordedById: string;
  }): Promise<CheckInResult> {
    const { identifier, method, recordedById } = params;

    // Sabtu/Minggu ATAU hari libur yang diatur admin (Section 11 & 30 --
    // siswa yang tidak sekolah bukan berarti ALPHA, dan hari libur bukan
    // hari sekolah sama sekali). Dicek paling awal, sebelum query siswa,
    // supaya TIDAK ADA jalur (QR ataupun manual) yang bisa membuat record
    // Attendance di hari non-sekolah.
    if (await isNonSchoolDay(getTodayDateOnly())) {
      return { type: "SCHOOL_CLOSED" };
    }

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

    // Waktu & status SELALU dihitung dari server (Section 3.1), tidak pernah
    // dipercayakan ke client, dan diambil di sini -- sedekat mungkin dengan
    // penyimpanan -- supaya jam yang dipakai untuk menentukan status sama
    // persis dengan jam yang tersimpan sebagai checkInAt.
    const { serverTime, dayOfWeek, hhmm } = getJakartaNow();
    const status = await resolveStatus(dayOfWeek, hhmm);

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
            description: `Absen ${student.name} (${student.class.name}) - ${status} (otomatis dari AttendanceSchedule)`,
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
      // Unique constraint (studentId + date) -> race condition: siswa yang
      // sama sempat di-scan guru lain / dua kali nyaris bersamaan saat burst
      // request jam masuk sekolah (Section 38). Tangkap di sini, bukan crash.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existingRace = await prisma.attendance.findUnique({
          where: { studentId_date: { studentId: student.id, date } },
        });
        return {
          type: "ALREADY_CHECKED_IN",
          student: toSummary(student),
          time: existingRace?.checkInAt.toISOString() ?? "",
          status: existingRace?.status ?? status,
        };
      }
      throw err;
    }
  }

  /**
   * Fitur "Pulang": mencatat jam pulang siswa yang HARI INI sudah check-in
   * (HADIR/TERLAMBAT). Dipanggil dari QR Scan (method: QR) maupun input
   * manual (method: MANUAL) -- SATU service yang sama untuk keduanya,
   * konsisten dengan Section 9 & pola checkIn() di atas.
   *
   * checkOut() TIDAK PERNAH membuat record Attendance baru: siswa yang belum
   * check-in hari ini (BELUM_ABSEN) akan mendapat NOT_CHECKED_IN, bukan
   * dianggap sudah pulang. Ini menjaga agar `status` (HADIR/TERLAMBAT/...)
   * tetap murni ditentukan oleh checkIn()/setManualStatus() -- checkOut()
   * hanya menambahkan `checkOutAt` pada record yang sudah ada.
   *
   * Waktu SELALU diambil dari server (Section 3.1), tidak pernah dari client.
   */
  static async checkOut(params: {
    identifier: string; // qrToken (QR) atau studentId (MANUAL)
    method: AttendanceMethod;
    recordedById: string;
  }): Promise<CheckOutResult> {
    const { identifier, method, recordedById } = params;

    // Sabtu/Minggu ATAU hari libur: sistem absensi (termasuk absen pulang)
    // tidak aktif -- konsisten dengan guard yang sama di checkIn()/identify().
    if (await isNonSchoolDay(getTodayDateOnly())) {
      return { type: "SCHOOL_CLOSED" };
    }

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

    // Siswa belum check-in hari ini -> tidak ada apa pun untuk "dipulangkan".
    // checkOut() sengaja TIDAK membuat record baru (lihat catatan di atas).
    if (!existing) {
      return { type: "NOT_CHECKED_IN", student: toSummary(student) };
    }

    if (existing.checkOutAt) {
      return {
        type: "ALREADY_CHECKED_OUT",
        student: toSummary(student),
        time: existing.checkOutAt.toISOString(),
        status: existing.status,
      };
    }

    const { serverTime } = getJakartaNow();

    try {
      await prisma.$transaction(async (tx) => {
        // updateMany + where checkOutAt: null (bukan update biasa) supaya
        // dua request checkOut yang nyaris bersamaan untuk siswa yang sama
        // (mis. dua guru scan kartu yang sama) tidak menimpa satu sama lain
        // atau membuat dua audit log untuk satu kejadian.
        const updateResult = await tx.attendance.updateMany({
          where: { id: existing.id, checkOutAt: null },
          data: { checkOutAt: serverTime },
        });

        if (updateResult.count === 0) {
          throw new AlreadyCheckedOutError();
        }

        await tx.auditLog.create({
          data: {
            userId: recordedById,
            action:
              method === AttendanceMethod.QR
                ? AuditAction.ATTENDANCE_SCAN
                : AuditAction.ATTENDANCE_MANUAL,
            entity: "Attendance",
            entityId: existing.id,
            description: `Absen pulang ${student.name} (${student.class.name})`,
          },
        });
      });

      return {
        type: "SUCCESS",
        student: toSummary(student),
        time: serverTime.toISOString(),
        status: existing.status,
      };
    } catch (err) {
      if (err instanceof AlreadyCheckedOutError) {
        const latest = await prisma.attendance.findUnique({ where: { id: existing.id } });
        return {
          type: "ALREADY_CHECKED_OUT",
          student: toSummary(student),
          time: latest?.checkOutAt?.toISOString() ?? "",
          status: latest?.status ?? existing.status,
        };
      }
      throw err;
    }
  }

  /**
   * LEGACY -- tidak lagi dipanggil oleh route manapun sejak checkIn() ada.
   * Disimpan (bukan dihapus) sebagai opsi kalau suatu saat dibutuhkan alur
   * "pilih status manual sesudah scan" lagi. Jangan panggil dari kode baru;
   * gunakan checkIn().
   *
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
   * Perubahan status massal (komunal) untuk beberapa siswa sekaligus dari
   * tabel /absensi, dipakai saat guru/admin mencentang banyak baris lalu
   * memilih satu status untuk semuanya. SENGAJA memanggil setManualStatus()
   * satu-per-satu (bukan reimplementasi logic terpisah) supaya validasi,
   * audit log, dan aturan (mis. FUTURE_DATE_NOT_ALLOWED) tetap konsisten
   * dengan perubahan status satuan lewat StatusDropdown.
   *
   * Tidak menghentikan proses jika satu siswa gagal -- siswa lain tetap
   * diproses, dan daftar kegagalan dikembalikan supaya UI bisa memberi tahu
   * guru/admin siswa mana saja yang tidak berhasil diubah.
   */
  static async setManualStatusBulk(params: {
    studentIds: string[];
    date: Date;
    newStatus: AttendanceStatus;
    updatedById: string;
  }): Promise<{
    successCount: number;
    failed: { studentId: string; reason: string }[];
  }> {
    const { studentIds, date, newStatus, updatedById } = params;

    let successCount = 0;
    const failed: { studentId: string; reason: string }[] = [];

    for (const studentId of studentIds) {
      const result = await this.setManualStatus({ studentId, date, newStatus, updatedById });
      if (result.type === "SUCCESS") {
        successCount += 1;
      } else if (result.type === "STUDENT_NOT_FOUND") {
        failed.push({ studentId, reason: "Siswa tidak ditemukan." });
      } else {
        failed.push({ studentId, reason: "Tanggal yang akan datang tidak dapat diubah." });
      }
    }

    return { successCount, failed };
  }

  /**
   * Auto-ALPHA batas akhir absensi (Section 11): siswa aktif yang SAMPAI SAAT
   * INI belum punya record absensi pada `date` otomatis diberi status ALPHA.
   * Dipanggil oleh cron job harian (lihat /api/cron/auto-alpha), BUKAN oleh
   * UI guru/admin secara langsung.
   *
   * PENTING: siswa yang tidak scan BUKAN otomatis ALPHA sejak awal hari --
   * mereka tetap BELUM_ABSEN sampai method ini dijalankan setelah batas waktu
   * terlewati (mis. jam 12:00). Sebelum itu, admin/wali kelas tetap bisa
   * menandai siswa SAKIT/IZIN/DISPENSASI lewat setManualStatus() seperti biasa
   * -- method ini hanya menyentuh siswa yang MASIH BELUM_ABSEN saat dipanggil.
   *
   * `recordedById`/`userId` sengaja null (bukan user manapun) supaya di
   * laporan/audit log jelas terlihat ini perubahan OTOMATIS oleh sistem,
   * bukan input seorang guru/admin.
   */
  static async markUnrecordedAsAlpha(params: {
    date: Date;
  }): Promise<{ marked: number; alreadyRecorded: number; totalActive: number; skippedWeekend: boolean }> {
    const { date } = params;

    // Sabtu/Minggu ATAU hari libur bukan hari sekolah -- jangan pernah
    // menandai siapapun ALPHA di hari libur (Section 11: BELUM_ABSEN !=
    // ALPHA, dan hari libur bukan hari sekolah sama sekali, jadi tidak
    // relevan menghitung siapapun "belum absen"). Guard ini yang membuat
    // cron job (vercel.json, berjalan SETIAP hari) aman dijalankan tanpa
    // perlu jadwal cron terpisah untuk Senin-Jumat saja.
    if (await isNonSchoolDay(date)) {
      return { marked: 0, alreadyRecorded: 0, totalActive: 0, skippedWeekend: true };
    }

    const students = await prisma.student.findMany({
      where: { status: StudentStatus.ACTIVE },
      select: { id: true, name: true, class: { select: { name: true } } },
    });
    const studentIds = students.map((s) => s.id);

    const existing = await prisma.attendance.findMany({
      where: { date, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    const alreadyRecordedIds = new Set(existing.map((a) => a.studentId));

    const toMark = students.filter((s) => !alreadyRecordedIds.has(s.id));
    const serverTime = new Date();
    let marked = 0;

    for (const student of toMark) {
      try {
        await prisma.$transaction(async (tx) => {
          const created = await tx.attendance.create({
            data: {
              studentId: student.id,
              date,
              checkInAt: serverTime,
              status: AttendanceStatus.ALPHA,
              method: AttendanceMethod.MANUAL,
              recordedById: null,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: null,
              action: AuditAction.STATUS_CHANGE,
              entity: "Attendance",
              entityId: created.id,
              description: `Set status ${student.name} (${student.class.name}): BELUM_ABSEN -> ALPHA (otomatis oleh sistem, batas absensi terlewati)`,
            },
          });
        });
        marked += 1;
      } catch (err) {
        // Race condition: siswa sempat discan tepat saat job auto-ALPHA
        // berjalan -> lewati, jangan timpa record yang baru saja tersimpan.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          continue;
        }
        throw err;
      }
    }

    return {
      marked,
      alreadyRecorded: alreadyRecordedIds.size,
      totalActive: students.length,
      skippedWeekend: false,
    };
  }

  /**
   * Rekap harian yang benar: termasuk siswa yang belum punya record (BELUM_ABSEN).
   * Dipakai oleh dashboard (Section 7) dan laporan (Section 16-17).
   *
   * Dibungkus cache pendek (lihat fetchDailyRecap/getCachedDailyRecap di bawah
   * class ini) karena dipanggil dari /dashboard DAN halaman publik "/", dan
   * keduanya di-regenerate tiap ada aksi absensi (revalidatePath("/") --
   * lihat lib/cache/public-dashboard.ts). Tanpa cache, jam masuk sekolah yang
   * ramai bisa memicu query ini berkali-kali dalam hitungan detik dan
   * menghabiskan connection pool (lib/prisma.ts: max 10 per instance).
   */
  static async getDailyRecap(params: { date: Date; classId?: string }): Promise<DailyRecap> {
    return getCachedDailyRecap(params.date.toISOString(), params.classId ?? null);
  }

  /**
   * Breakdown kehadiran per kelas untuk satu tanggal.
   * Dipakai dashboard (Section 7 & 31) untuk "Statistik per kelas".
   * 2 query saja (kelas + attendance), grouping dilakukan di memori —
   * aman untuk skala ±500 siswa (Section 38).
   *
   * Sama seperti getDailyRecap: dibungkus cache pendek (lihat "Cache layer"
   * di bawah class ini) karena dipanggil dari /dashboard DAN halaman publik.
   */
  static async getClassBreakdown(params: {
    date: Date;
    classId?: string;
  }): Promise<ClassBreakdown[]> {
    return getCachedClassBreakdown(params.date.toISOString(), params.classId ?? null);
  }

  /**
   * Aktivitas absensi terbaru pada satu tanggal (default: hari ini).
   * Dipakai dashboard (Section 7) untuk panel "Absensi Terbaru".
   *
   * Sama seperti getDailyRecap: dibungkus cache pendek (lihat "Cache layer"
   * di bawah class ini) karena dipanggil dari /dashboard DAN halaman publik.
   */
  static async getRecentActivity(params: {
    date: Date;
    limit?: number;
    classId?: string;
  }): Promise<RecentAttendanceItem[]> {
    return getCachedRecentActivity(
      params.date.toISOString(),
      params.limit ?? 8,
      params.classId ?? null
    );
  }
}

// ============================================================
// Cache layer untuk statistik "hari ini" (Section 7 & 31)
// ============================================================
//
// getDailyRecap/getClassBreakdown/getRecentActivity dipanggil dari DUA
// halaman (/dashboard protected & "/" publik), dan KEDUANYA di-regenerate
// tiap ada aksi absensi lewat revalidatePath("/") (lihat
// lib/cache/public-dashboard.ts). Tanpa cache, jam masuk sekolah yang ramai
// -- ratusan scan dalam hitungan menit -- bisa memicu ketiga query ini
// berkali-kali per detik dan menghabiskan connection pool (lib/prisma.ts:
// max 10 koneksi per instance, connectionTimeoutMillis pendek supaya GAGAL
// CEPAT saat pool penuh -- itulah yang bikin web terasa "tidak bisa dibuka"
// saat peak time).
//
// TODAY_STATS_CACHE_SECONDS sengaja pendek (bukan 5 menit seperti
// leaderboard bulanan di report-service.ts) karena angka ini diklaim
// "real-time" di UI. 10 detik adalah kompromi: tetap terasa segar untuk
// guru/admin, tapi cukup untuk meredam burst request saat banyak scan
// bersamaan dalam satu-dua detik. Client-side listener
// (dashboard-realtime-listener.tsx / public-realtime-listener.tsx) sendiri
// sudah throttle refresh ke 30 detik, jadi cache 10 detik di sini tidak
// membuat UI terasa lebih basi dari itu.
//
// `date` sengaja diteruskan sebagai ISO string (bukan Date) ke fungsi yang
// di-cache -- args unstable_cache di-serialize untuk membentuk cache key,
// dan string lebih predictable/aman daripada Date object.
const TODAY_STATS_CACHE_SECONDS = 10;

async function fetchDailyRecap(dateISO: string, classId: string | null): Promise<DailyRecap> {
  const date = new Date(dateISO);

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

async function fetchClassBreakdown(
  dateISO: string,
  classId: string | null
): Promise<ClassBreakdown[]> {
  const date = new Date(dateISO);

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

async function fetchRecentActivity(
  dateISO: string,
  limit: number,
  classId: string | null
): Promise<RecentAttendanceItem[]> {
  const date = new Date(dateISO);

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

const getCachedDailyRecap = unstable_cache(fetchDailyRecap, ["daily-recap"], {
  revalidate: TODAY_STATS_CACHE_SECONDS,
});

const getCachedClassBreakdown = unstable_cache(fetchClassBreakdown, ["class-breakdown"], {
  revalidate: TODAY_STATS_CACHE_SECONDS,
});

const getCachedRecentActivity = unstable_cache(fetchRecentActivity, ["recent-activity"], {
  revalidate: TODAY_STATS_CACHE_SECONDS,
});