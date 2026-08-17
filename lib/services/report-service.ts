// lib/services/report-service.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  AttendanceStatus,
  StudentStatus,
  ClassStatus,
} from "@/app/generated/prisma/client";
import { getTodayDateOnly } from "@/lib/services/attendance-service";

// ============================================================
// Types
// ============================================================

export type ReportMode = "daily" | "monthly";

export type ReportPeriod = {
  mode: ReportMode;
  label: string; // "Sabtu, 15 Agustus 2026" atau "Agustus 2026"
  startDate: string; // ISO date-only (YYYY-MM-DD)
  endDate: string; // ISO date-only -- untuk daily sama dengan startDate,
  // untuk monthly = akhir bulan yang DIMINTA (bukan yang sudah lewat)
  schoolDays: number; // jumlah hari Senin-Jumat yang SUDAH LEWAT dalam periode
};

// Catatan penamaan: `belumAbsen` punya arti berbeda tergantung mode --
// - daily   : siswa belum scan/diinput HARI INI
// - monthly : total hari-sekolah pada periode yang TIDAK punya record sama
//             sekali (bukan berarti ALPHA -- sesuai Section 11, sistem tidak
//             boleh otomatis menganggap "tidak absen" = ALPHA)
export type StatusCounts = {
  hadir: number;
  terlambat: number;
  sakit: number;
  izin: number;
  dispensasi: number;
  alpha: number;
  belumAbsen: number;
};

export type OverallReport = StatusCounts & {
  totalSiswa: number;
  persentaseKehadiran: number; // (hadir+terlambat) / (totalSiswa * schoolDays) * 100
};

export type ClassReportRow = StatusCounts & {
  classId: string;
  className: string;
  totalSiswa: number;
  persentaseKehadiran: number;
};

export type StudentReportRow = StatusCounts & {
  studentId: string;
  classId: string;
  name: string;
  nis: string;
  nisn: string;
  className: string;
  totalSchoolDays: number;
  persentaseKehadiran: number;
};

export type ReportPayload = {
  period: ReportPeriod;
  overall: OverallReport;
  perClass: ClassReportRow[];
  perStudent: StudentReportRow[];
};

export type StudentAttendanceLogEntry = {
  date: string; // YYYY-MM-DD
  weekday: string; // "Senin".."Jumat"
  status: AttendanceStatus | "BELUM_ABSEN";
  checkInAt: string | null;
};

export type StudentReportDetail = {
  student: { id: string; name: string; nis: string; nisn: string; className: string };
  period: ReportPeriod;
  summary: StatusCounts & { totalSchoolDays: number; persentaseKehadiran: number };
  log: StudentAttendanceLogEntry[]; // hanya hari sekolah (Senin-Jumat), terbaru dulu
};

// ============================================================
// Helpers -- semua tanggal di sini adalah "date-only" (midnight UTC yang
// merepresentasikan tanggal kalender Asia/Jakarta), konsisten dengan
// getTodayDateOnly() di attendance-service.ts. Karena itu day-of-week HARUS
// dibaca lewat getUTCDay(), bukan getDay() (yang akan ikut timezone server).
// ============================================================

const WEEKDAY_LABEL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function isWeekendDate(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function countSchoolDays(start: Date, end: Date): number {
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (!isWeekendDate(cursor)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function eachDateInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function toISODateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatPeriodLabel(mode: ReportMode, start: Date): string {
  if (mode === "daily") {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start);
  }
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
}

function tallyStatuses(statuses: AttendanceStatus[]): Omit<StatusCounts, "belumAbsen"> {
  const counts = { hadir: 0, terlambat: 0, sakit: 0, izin: 0, dispensasi: 0, alpha: 0 };
  for (const s of statuses) {
    if (s === AttendanceStatus.HADIR) counts.hadir += 1;
    else if (s === AttendanceStatus.TERLAMBAT) counts.terlambat += 1;
    else if (s === AttendanceStatus.SAKIT) counts.sakit += 1;
    else if (s === AttendanceStatus.IZIN) counts.izin += 1;
    else if (s === AttendanceStatus.DISPENSASI) counts.dispensasi += 1;
    else if (s === AttendanceStatus.ALPHA) counts.alpha += 1;
  }
  return counts;
}

function sumCounts(rows: StatusCounts[]): StatusCounts {
  return rows.reduce(
    (acc, r) => ({
      hadir: acc.hadir + r.hadir,
      terlambat: acc.terlambat + r.terlambat,
      sakit: acc.sakit + r.sakit,
      izin: acc.izin + r.izin,
      dispensasi: acc.dispensasi + r.dispensasi,
      alpha: acc.alpha + r.alpha,
      belumAbsen: acc.belumAbsen + r.belumAbsen,
    }),
    { hadir: 0, terlambat: 0, sakit: 0, izin: 0, dispensasi: 0, alpha: 0, belumAbsen: 0 }
  );
}

function buildEmptyReport(
  period: ReportPeriod,
  classes: { id: string; name: string; students: { id: string }[] }[]
): ReportPayload {
  const zero: StatusCounts = {
    hadir: 0,
    terlambat: 0,
    sakit: 0,
    izin: 0,
    dispensasi: 0,
    alpha: 0,
    belumAbsen: 0,
  };
  const perClass: ClassReportRow[] = classes.map((k) => ({
    classId: k.id,
    className: k.name,
    totalSiswa: k.students.length,
    ...zero,
    persentaseKehadiran: 0,
  }));
  const totalSiswa = classes.reduce((sum, k) => sum + k.students.length, 0);
  return {
    period,
    overall: { totalSiswa, ...zero, persentaseKehadiran: 0 },
    perClass,
    perStudent: [],
  };
}

// ============================================================
// Report utama: gabungan Ringkasan + Per Kelas + Per Siswa.
// Dipakai oleh halaman /laporan DAN export xlsx (satu sumber logic,
// tidak ada perhitungan yang di-duplikasi -- Section 39.5).
// ============================================================

export async function getAttendanceReport(
  params:
    | { mode: "daily"; date: string; classId?: string }
    | { mode: "monthly"; month: string; classId?: string }
): Promise<ReportPayload> {
  const { mode, classId } = params;

  let periodStart: Date;
  let periodEndRequested: Date;

  if (mode === "daily") {
    periodStart = new Date(`${params.date}T00:00:00.000Z`);
    periodEndRequested = periodStart;
  } else {
    const [yearStr, monthStr] = params.month.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr); // 1-12
    periodStart = new Date(Date.UTC(year, monthNum - 1, 1));
    periodEndRequested = new Date(Date.UTC(year, monthNum, 0)); // hari terakhir bulan itu
  }

  const today = getTodayDateOnly();
  // Untuk bulan yang sedang berjalan (atau bulan depan), jangan hitung
  // hari-hari yang belum terjadi -- supaya persentase kehadiran tidak
  // menyesatkan (rendah semu) di awal bulan.
  const periodEnd =
    mode === "monthly" && periodEndRequested.getTime() > today.getTime()
      ? today
      : periodEndRequested;

  const schoolDays = countSchoolDays(periodStart, periodEnd);

  const period: ReportPeriod = {
    mode,
    label: formatPeriodLabel(mode, periodStart),
    startDate: toISODateOnly(periodStart),
    endDate: toISODateOnly(periodEndRequested),
    schoolDays,
  };

  const classes = await prisma.class.findMany({
    where: { status: ClassStatus.ACTIVE, ...(classId ? { id: classId } : {}) },
    select: {
      id: true,
      name: true,
      students: {
        where: { status: StudentStatus.ACTIVE },
        select: { id: true, name: true, nis: true, nisn: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Tidak ada hari sekolah dalam periode (akhir pekan utk daily, atau
  // seluruh bulan yang diminta masih di masa depan) -> laporan kosong.
  if (schoolDays === 0) {
    return buildEmptyReport(period, classes);
  }

  const allStudents = classes.flatMap((k) =>
    k.students.map((s) => ({
      id: s.id,
      name: s.name,
      nis: s.nis,
      nisn: s.nisn,
      classId: k.id,
      className: k.name,
    }))
  );

  if (allStudents.length === 0) {
    return buildEmptyReport(period, classes);
  }

  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: periodStart, lte: periodEnd },
      studentId: { in: allStudents.map((s) => s.id) },
    },
    select: { studentId: true, status: true },
  });

  const byStudent = new Map<string, AttendanceStatus[]>();
  for (const a of attendances) {
    const list = byStudent.get(a.studentId);
    if (list) list.push(a.status);
    else byStudent.set(a.studentId, [a.status]);
  }

  const perStudent: StudentReportRow[] = allStudents.map((s) => {
    const counts = tallyStatuses(byStudent.get(s.id) ?? []);
    const filled =
      counts.hadir + counts.terlambat + counts.sakit + counts.izin + counts.dispensasi + counts.alpha;
    const belumAbsen = Math.max(0, schoolDays - filled);
    const persentaseKehadiran =
      schoolDays > 0 ? Math.round(((counts.hadir + counts.terlambat) / schoolDays) * 100) : 0;

    return {
      studentId: s.id,
      classId: s.classId,
      name: s.name,
      nis: s.nis,
      nisn: s.nisn ?? "-",
      className: s.className,
      ...counts,
      belumAbsen,
      totalSchoolDays: schoolDays,
      persentaseKehadiran,
    };
  });

  const perClass: ClassReportRow[] = classes.map((kelas) => {
    const studentsInClass = perStudent.filter((s) => s.classId === kelas.id);
    const totals = sumCounts(studentsInClass);
    const totalSiswa = studentsInClass.length;
    const denom = totalSiswa * schoolDays;

    return {
      classId: kelas.id,
      className: kelas.name,
      totalSiswa,
      ...totals,
      persentaseKehadiran:
        denom > 0 ? Math.round(((totals.hadir + totals.terlambat) / denom) * 100) : 0,
    };
  });

  const overallTotals = sumCounts(perStudent);
  const overallDenom = allStudents.length * schoolDays;
  const overall: OverallReport = {
    totalSiswa: allStudents.length,
    ...overallTotals,
    persentaseKehadiran:
      overallDenom > 0
        ? Math.round(((overallTotals.hadir + overallTotals.terlambat) / overallDenom) * 100)
        : 0,
  };

  return { period, overall, perClass, perStudent };
}

// ============================================================
// Detail kehadiran satu siswa (log harian) untuk periode yang sama
// dengan halaman /laporan -- dipakai oleh /laporan/siswa/[id].
// ============================================================

export async function getStudentAttendanceDetail(
  params:
    | { studentId: string; mode: "daily"; date: string }
    | { studentId: string; mode: "monthly"; month: string }
): Promise<StudentReportDetail | null> {
  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { id: true, name: true, nis: true, nisn: true, class: { select: { name: true } } },
  });
  if (!student) return null;

  const { mode } = params;
  let periodStart: Date;
  let periodEndRequested: Date;

  if (mode === "daily") {
    periodStart = new Date(`${params.date}T00:00:00.000Z`);
    periodEndRequested = periodStart;
  } else {
    const [yearStr, monthStr] = params.month.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    periodStart = new Date(Date.UTC(year, monthNum - 1, 1));
    periodEndRequested = new Date(Date.UTC(year, monthNum, 0));
  }

  const today = getTodayDateOnly();
  const periodEnd =
    mode === "monthly" && periodEndRequested.getTime() > today.getTime()
      ? today
      : periodEndRequested;

  const schoolDays = countSchoolDays(periodStart, periodEnd);

  const period: ReportPeriod = {
    mode,
    label: formatPeriodLabel(mode, periodStart),
    startDate: toISODateOnly(periodStart),
    endDate: toISODateOnly(periodEndRequested),
    schoolDays,
  };

  const attendances =
    schoolDays > 0
      ? await prisma.attendance.findMany({
          where: { studentId: student.id, date: { gte: periodStart, lte: periodEnd } },
          select: { date: true, status: true, checkInAt: true },
        })
      : [];

  const byDate = new Map(attendances.map((a) => [toISODateOnly(a.date), a]));

  const log: StudentAttendanceLogEntry[] = [];
  if (schoolDays > 0) {
    for (const day of eachDateInRange(periodStart, periodEnd)) {
      if (isWeekendDate(day)) continue;
      const iso = toISODateOnly(day);
      const record = byDate.get(iso);
      log.push({
        date: iso,
        weekday: WEEKDAY_LABEL[day.getUTCDay()],
        status: record?.status ?? "BELUM_ABSEN",
        checkInAt: record?.checkInAt.toISOString() ?? null,
      });
    }
  }
  log.sort((a, b) => b.date.localeCompare(a.date)); // terbaru dulu

  const counts = tallyStatuses(attendances.map((a) => a.status));
  const filled =
    counts.hadir + counts.terlambat + counts.sakit + counts.izin + counts.dispensasi + counts.alpha;
  const belumAbsen = Math.max(0, schoolDays - filled);
  const persentaseKehadiran =
    schoolDays > 0 ? Math.round(((counts.hadir + counts.terlambat) / schoolDays) * 100) : 0;

  return {
    student: {
      id: student.id,
      name: student.name,
      nis: student.nis,
      nisn: student.nisn ?? "-",
      className: student.class.name,
    },
    period,
    summary: { ...counts, belumAbsen, totalSchoolDays: schoolDays, persentaseKehadiran },
    log,
  };
}

export async function getReportClassOptions() {
  return prisma.class.findMany({
    where: { status: ClassStatus.ACTIVE },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}