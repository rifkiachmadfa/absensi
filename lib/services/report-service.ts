import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  AttendanceStatus,
  StudentStatus,
  ClassStatus,
} from "@/app/generated/prisma/client";
import {
  getTodayDateOnly,
  isWeekendDate,
  getHolidayDateSet,
} from "@/lib/services/attendance-service";


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

// 1) Tambahkan checkOutAt ke tipe:
export type StudentAttendanceLogEntry = {
  date: string; // YYYY-MM-DD
  weekday: string; // "Senin".."Jumat"
  status: AttendanceStatus | "BELUM_ABSEN";
  checkInAt: string | null;
  checkOutAt: string | null;   // ⬅️ BARU
};

export type StudentReportDetail = {
  student: {
    id: string;
    name: string;
    nis: string;
    nisn: string;
    gender: "LAKI_LAKI" | "PEREMPUAN" | null;
    className: string;
  };
  period: ReportPeriod;
  summary: StatusCounts & { totalSchoolDays: number; persentaseKehadiran: number };
  log: StudentAttendanceLogEntry[]; // hanya hari sekolah (Senin-Jumat), terbaru dulu
};
// Dipakai oleh grafik tren kehadiran di dashboard (Bar Chart harian/bulanan,
// dengan tab status: Hadir / Sakit / Izin / Alpha).
export type TrendMode = "daily" | "monthly";
export type TrendStatus = "HADIR" | "SAKIT" | "IZIN" | "ALPHA";

export type AttendanceTrendPoint = {
  key: string; // ISO date (daily) atau "YYYY-MM" (monthly)
  label: string; // label singkat sumbu-X, mis. "12 Ags" atau "Ags 2026"
  totalSiswa: number;
  hadir: number; // HADIR + TERLAMBAT (tetap dihitung sebagai "masuk sekolah")
  terlambat: number;
  sakit: number;
  izin: number;
  alpha: number;
  persentaseHadir: number;
  persentaseSakit: number;
  persentaseIzin: number;
  persentaseAlpha: number;
};

export type AttendanceTrendPayload = {
  mode: TrendMode;
  points: AttendanceTrendPoint[];
};

// Dipakai oleh Line Chart perbandingan kehadiran antar kelas di dashboard.
export type ClassTrendPoint = {
  key: string;
  label: string;
  persentaseHadir: number;
};

export type ClassTrendSeries = {
  classId: string;
  className: string;
  totalSiswa: number;
  points: ClassTrendPoint[];
};

export type ClassAttendanceTrendPayload = {
  labels: string[]; // sumbu-X, sama untuk semua kelas
  series: ClassTrendSeries[];
};

// Dipakai oleh kartu "Top 5 Murid Paling Disiplin" di dashboard.
// Penilaian PER BULAN (bukan harian): (1) jumlah hari masuk sekolah
// (HADIR + TERLAMBAT) pada bulan tsb -- makin banyak makin disiplin,
// (2) jika jumlahnya sama, rata-rata jam check-in yang PALING PAGI menang.
export type DisciplineRow = {
  studentId: string;
  name: string;
  nis: string;
  className: string;
  hadirCount: number; // jumlah hari HADIR/TERLAMBAT (masuk sekolah) bulan ini
  avgCheckInLabel: string; // rata-rata jam check-in, format "HH:mm" (Asia/Jakarta)
};

export type DisciplineLeaderboardPayload = {
  month: string; // "YYYY-MM"
  monthLabel: string; // "Agustus 2026"
  schoolDays: number; // total hari sekolah (Senin-Jumat) pada bulan ini yang SUDAH LEWAT
  rows: DisciplineRow[]; // sudah diurutkan & dipotong ke `limit` (default 5)
};

// Dipakai oleh kartu "Top 5 Kehadiran Terendah" di dashboard -- kebalikan
// dari DisciplineLeaderboard: bulan yang sama, tapi diurutkan ASC dari
// `hadirCount` PALING SEDIKIT. `alphaCount` disertakan sebagai konteks
// tambahan (bukan penentu utama, hanya tie-breaker), karena siswa yang tidak
// scan default-nya BELUM_ABSEN, bukan otomatis ALPHA (Section 11).
export type LowAttendanceRow = {
  studentId: string;
  name: string;
  nis: string;
  className: string;
  hadirCount: number; // jumlah hari HADIR/TERLAMBAT (masuk sekolah) bulan ini
  alphaCount: number; // jumlah hari berstatus ALPHA bulan ini
  persentaseKehadiran: number; // hadirCount / schoolDays * 100, dibulatkan
};

export type LowAttendanceLeaderboardPayload = {
  month: string;
  monthLabel: string;
  schoolDays: number;
  rows: LowAttendanceRow[]; // sudah diurutkan & dipotong ke `limit` (default 5)
};

// Dipakai oleh kartu "Top 5 Siswa Paling Sering Terlambat" di dashboard.
// Penilaian PER BULAN, diurutkan dari jumlah TERLAMBAT terbanyak; jika sama,
// rata-rata jam check-in PALING SIANG (paling parah) yang menang.
export type LateStudentRow = {
  studentId: string;
  name: string;
  nis: string;
  className: string;
  terlambatCount: number; // jumlah hari berstatus TERLAMBAT bulan ini
  avgCheckInLabel: string; // rata-rata jam check-in SAAT terlambat, "HH:mm" (Asia/Jakarta)
};

export type LateLeaderboardPayload = {
  month: string;
  monthLabel: string;
  schoolDays: number;
  rows: LateStudentRow[]; // sudah diurutkan & dipotong ke `limit` (default 5)
};

// Dipakai oleh widget "Rekap Keterlambatan Hari Ini" di dashboard: jumlah
// TERLAMBAT hari ini dibanding HARI SEKOLAH SEBELUMNYA (bukan sekadar
// "kemarin" kalender -- kalau hari ini Senin, pembandingnya Jumat, bukan
// Minggu yang pasti 0 & bikin persentase menyesatkan). `compareLabel` akan
// bernilai "kemarin" jika hari sekolah sebelumnya itu memang benar kemarin.
export type LateRecapToday = {
  date: string; // YYYY-MM-DD, hari ini
  isSchoolDay: boolean; // apakah hari ini hari sekolah (bukan weekend/libur)
  todayCount: number; // jumlah TERLAMBAT hari ini
  compareDate: string | null; // YYYY-MM-DD hari sekolah sebelumnya, null jika tidak ditemukan dalam 14 hari terakhir
  compareLabel: string; // "kemarin" atau nama hari (mis. "Jumat")
  compareCount: number | null; // jumlah TERLAMBAT pada compareDate
  percentChange: number | null; // null jika compareCount 0 (tidak terhitung) atau compareDate null
  direction: "up" | "down" | "flat" | "new" | "none";
};

export type MonthOption = { value: string; label: string };

// ============================================================
// Helpers -- semua tanggal di sini adalah "date-only" (midnight UTC yang
// merepresentasikan tanggal kalender Asia/Jakarta), konsisten dengan
// getTodayDateOnly() di attendance-service.ts. Karena itu day-of-week HARUS
// dibaca lewat getUTCDay(), bukan getDay() (yang akan ikut timezone server).
// ============================================================

const WEEKDAY_LABEL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];


function countSchoolDays(start: Date, end: Date, holidaySet: Set<string> = new Set()): number {
  if (end.getTime() < start.getTime()) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (!isWeekendDate(cursor) && !holidaySet.has(toISODateOnly(cursor))) count += 1;
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

  const holidaySet = await getHolidayDateSet(periodStart, periodEnd);
  const schoolDays = countSchoolDays(periodStart, periodEnd, holidaySet);

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
    select: {
      id: true,
      name: true,
      nis: true,
      nisn: true,
      gender: true,
      class: { select: { name: true } },
    },
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

  const holidaySet = await getHolidayDateSet(periodStart, periodEnd);
  const schoolDays = countSchoolDays(periodStart, periodEnd, holidaySet);

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
          select: { date: true, status: true, checkInAt: true, checkOutAt: true },
        })
      : [];

  const byDate = new Map(attendances.map((a) => [toISODateOnly(a.date), a]));

  const log: StudentAttendanceLogEntry[] = [];
  if (schoolDays > 0) {
    for (const day of eachDateInRange(periodStart, periodEnd)) {
      if (isWeekendDate(day) || holidaySet.has(toISODateOnly(day))) continue;
      const iso = toISODateOnly(day);
      const record = byDate.get(iso);
      log.push({
        date: iso,
        weekday: WEEKDAY_LABEL[day.getUTCDay()],
        status: record?.status ?? "BELUM_ABSEN",
        checkInAt: record?.checkInAt.toISOString() ?? null,
        checkOutAt: record?.checkOutAt?.toISOString() ?? null,
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
      gender: student.gender,
      className: student.class.name,
    },
    period,
    summary: { ...counts, belumAbsen, totalSchoolDays: schoolDays, persentaseKehadiran },
    log,
  };
}

// ============================================================
// Tren persentase kehadiran keseluruhan siswa -- dipakai oleh Bar Chart
// di dashboard (§ Development Rules: satu sumber logic, reuse helper
// tanggal/tally yang sudah ada di file ini, tidak membuat service baru).
//
// daily   -> 14 hari sekolah (Senin-Jumat) terakhir, satu batang = satu hari
// monthly -> 6 bulan kalender terakhir, satu batang = satu bulan
// ============================================================

const SHORT_MONTH_LABEL = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
];

const DAILY_TREND_POINTS = 14;
const MONTHLY_TREND_POINTS = 6;

// Helper bersama untuk daily & monthly: hitung 4 kategori persentase
// (Hadir/Sakit/Izin/Alpha) dari satu set counts + satu denom, supaya
// logic tidak diduplikasi antara dua mode.
function buildTrendCounts(
  counts: Omit<StatusCounts, "belumAbsen">,
  denom: number
): Pick<
  AttendanceTrendPoint,
  "hadir" | "terlambat" | "sakit" | "izin" | "alpha" | "persentaseHadir" | "persentaseSakit" | "persentaseIzin" | "persentaseAlpha"
> {
  const hadirTotal = counts.hadir + counts.terlambat;
  const pct = (n: number) => (denom > 0 ? Math.round((n / denom) * 100) : 0);
  return {
    hadir: counts.hadir,
    terlambat: counts.terlambat,
    sakit: counts.sakit,
    izin: counts.izin,
    alpha: counts.alpha,
    persentaseHadir: pct(hadirTotal),
    persentaseSakit: pct(counts.sakit),
    persentaseIzin: pct(counts.izin),
    persentaseAlpha: pct(counts.alpha),
  };
}

// Grafik trend (harian & bulanan) dipanggil di /dashboard DAN halaman publik
// "/" -- keduanya di-regenerate tiap ada aksi absensi lewat revalidatePath("/")
// (lihat lib/cache/public-dashboard.ts). Tanpa cache, tiap regenerasi menembak
// ulang query attendance penuh; saat jam masuk sekolah ramai ini bisa memicu
// burst query bersamaan dan menghabiskan connection pool (max: 10 per
// instance, lihat lib/prisma.ts). 20 detik cukup segar untuk sebuah chart
// (bukan angka "live"), sekaligus meredam burst.
const TREND_CACHE_SECONDS = 20;

async function fetchAttendanceTrend(
  mode: TrendMode,
  classId: string | null
): Promise<AttendanceTrendPayload> {
  const today = getTodayDateOnly();

  const students = await prisma.student.findMany({
    where: { status: StudentStatus.ACTIVE, ...(classId ? { classId } : {}) },
    select: { id: true },
  });
  const totalSiswa = students.length;
  const studentIds = students.map((s) => s.id);

  if (totalSiswa === 0) {
    return { mode, points: [] };
  }

  if (mode === "daily") {
    // Kumpulkan N hari sekolah terakhir (mundur dari hari ini). Ambil set
    // hari libur untuk jendela mundur yang cukup lebar (90 hari kalender --
    // jauh lebih dari cukup untuk menampung 14 hari sekolah + hari libur di
    // dalamnya) sekali di awal, supaya loop mundur tidak query per-hari.
    const lookbackStart = new Date(today);
    lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 90);
    const holidaySet = await getHolidayDateSet(lookbackStart, today);

    const schoolDates: Date[] = [];
    const cursor = new Date(today);
    while (schoolDates.length < DAILY_TREND_POINTS) {
      if (!isWeekendDate(cursor) && !holidaySet.has(toISODateOnly(cursor))) {
        schoolDates.unshift(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    const rangeStart = schoolDates[0];
    const rangeEnd = schoolDates[schoolDates.length - 1];

    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
        studentId: { in: studentIds },
      },
      select: { date: true, status: true },
    });

    const byDate = new Map<string, AttendanceStatus[]>();
    for (const a of attendances) {
      const key = toISODateOnly(a.date);
      const list = byDate.get(key);
      if (list) list.push(a.status);
      else byDate.set(key, [a.status]);
    }

    const points: AttendanceTrendPoint[] = schoolDates.map((d) => {
      const key = toISODateOnly(d);
      const counts = tallyStatuses(byDate.get(key) ?? []);
      return {
        key,
        label: new Intl.DateTimeFormat("id-ID", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }).format(d),
        totalSiswa,
        ...buildTrendCounts(counts, totalSiswa),
      };
    });

    return { mode, points };
  }

  // mode === "monthly"
  const monthStarts: Date[] = [];
  for (let i = MONTHLY_TREND_POINTS - 1; i >= 0; i--) {
    monthStarts.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1)));
  }

  const monthlyHolidaySet = await getHolidayDateSet(monthStarts[0], today);

  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: monthStarts[0], lte: today },
      studentId: { in: studentIds },
    },
    select: { date: true, status: true },
  });

  const points: AttendanceTrendPoint[] = monthStarts.map((monthStart) => {
    const monthEndRequested = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)
    );
    const monthEnd = monthEndRequested.getTime() > today.getTime() ? today : monthEndRequested;
    const schoolDays = countSchoolDays(monthStart, monthEnd, monthlyHolidaySet);

    const inMonth = attendances.filter(
      (a) => a.date.getTime() >= monthStart.getTime() && a.date.getTime() <= monthEnd.getTime()
    );
    const counts = tallyStatuses(inMonth.map((a) => a.status));
    const denom = totalSiswa * schoolDays;

    return {
      key: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${SHORT_MONTH_LABEL[monthStart.getUTCMonth()]} ${monthStart.getUTCFullYear()}`,
      totalSiswa,
      ...buildTrendCounts(counts, denom),
    };
  });

  return { mode, points };
}

const getCachedAttendanceTrend = unstable_cache(
  fetchAttendanceTrend,
  ["attendance-trend"],
  { revalidate: TREND_CACHE_SECONDS }
);

export async function getAttendanceTrend(params: {
  mode: TrendMode;
  classId?: string;
}): Promise<AttendanceTrendPayload> {
  return getCachedAttendanceTrend(params.mode, params.classId ?? null);
}

export async function getReportClassOptions() {
  return prisma.class.findMany({
    where: { status: ClassStatus.ACTIVE },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ============================================================
// Tren kehadiran per kelas (14 hari sekolah terakhir) -- dipakai oleh
// Line Chart perbandingan kelas di dashboard. Satu query attendance untuk
// SEMUA kelas sekaligus (bukan N+1), lalu di-group manual per classId+date.
// Jika `classId` diberikan (mis. role WALI_KELAS), hanya kelas tsb yang
// dikembalikan.
// ============================================================

export async function getClassAttendanceTrend(params?: {
  classId?: string;
}): Promise<ClassAttendanceTrendPayload> {
  const classId = params?.classId;
  const today = getTodayDateOnly();

  const classes = await prisma.class.findMany({
    where: {
      status: ClassStatus.ACTIVE,
      ...(classId ? { id: classId } : {}),
    },
    select: {
      id: true,
      name: true,
      students: { where: { status: StudentStatus.ACTIVE }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  const classesWithStudents = classes.filter((k) => k.students.length > 0);
  if (classesWithStudents.length === 0) {
    return { labels: [], series: [] };
  }

  // 14 hari sekolah terakhir -- sama persis dengan getAttendanceTrend(daily)
  // supaya kedua chart di dashboard selalu merujuk periode yang sama.
  const lookbackStart = new Date(today);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 90);
  const holidaySet = await getHolidayDateSet(lookbackStart, today);

  const schoolDates: Date[] = [];
  const cursor = new Date(today);
  while (schoolDates.length < DAILY_TREND_POINTS) {
    if (!isWeekendDate(cursor) && !holidaySet.has(toISODateOnly(cursor))) {
      schoolDates.unshift(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const rangeStart = schoolDates[0];
  const rangeEnd = schoolDates[schoolDates.length - 1];
  const dateKeys = schoolDates.map(toISODateOnly);
  const labels = schoolDates.map((d) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(d)
  );

  const studentToClass = new Map<string, string>();
  const allStudentIds: string[] = [];
  for (const k of classesWithStudents) {
    for (const s of k.students) {
      studentToClass.set(s.id, k.id);
      allStudentIds.push(s.id);
    }
  }

  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
      studentId: { in: allStudentIds },
    },
    select: { date: true, status: true, studentId: true },
  });

  const byClassDate = new Map<string, AttendanceStatus[]>();
  for (const a of attendances) {
    const cId = studentToClass.get(a.studentId);
    if (!cId) continue;
    const key = `${cId}|${toISODateOnly(a.date)}`;
    const list = byClassDate.get(key);
    if (list) list.push(a.status);
    else byClassDate.set(key, [a.status]);
  }

  const series: ClassTrendSeries[] = classesWithStudents.map((k) => {
    const totalSiswa = k.students.length;
    const points: ClassTrendPoint[] = dateKeys.map((iso, i) => {
      const statuses = byClassDate.get(`${k.id}|${iso}`) ?? [];
      const counts = tallyStatuses(statuses);
      const hadirTotal = counts.hadir + counts.terlambat;
      const persentaseHadir =
        totalSiswa > 0 ? Math.round((hadirTotal / totalSiswa) * 100) : 0;
      return { key: iso, label: labels[i], persentaseHadir };
    });
    return { classId: k.id, className: k.name, totalSiswa, points };
  });

  return { labels, series };
}

// ============================================================
// Leaderboard "Top 5 Murid Paling Disiplin" -- PENILAIAN PER BULAN, bukan
// harian (Agustus, September, Oktober, dst -- reuse countSchoolDays/
// isWeekendDate yang sudah ada, TIDAK membuat helper hari-sekolah baru).
//
// Urutan peringkat:
//   1. Jumlah hari masuk sekolah (HADIR + TERLAMBAT) bulan tsb -- DESC
//   2. Rata-rata jam check-in (Asia/Jakarta) -- ASC (paling pagi menang)
// Siswa tanpa kehadiran sama sekali pada bulan itu tidak masuk peringkat.
// ============================================================

const DISCIPLINE_MONTH_OPTIONS_COUNT = 6;

// Jam check-in disimpan sebagai timestamp UTC di DB, tapi "jam" yang
// relevan untuk kedisiplinan adalah jam dinding Asia/Jakarta (sama seperti
// formatTime() di recent-attendance.tsx) -- bukan jam UTC mentah.
function jakartaSecondsOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

function secondsOfDayToLabel(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600) % 24;
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Daftar bulan yang bisa dipilih di dashboard: bulan berjalan + N bulan ke
// belakang (default 6), label pakai nama bulan Indonesia (Agustus 2026, dst).
export function getDisciplineMonthOptions(
  count: number = DISCIPLINE_MONTH_OPTIONS_COUNT
): MonthOption[] {
  const today = getTodayDateOnly();
  const options: MonthOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: formatPeriodLabel("monthly", d) });
  }
  return options; // index 0 = bulan berjalan, mundur ke belakang setelahnya
}

// Data mentah bulanan yang dipakai BERSAMA oleh ketiga leaderboard di bawah
// (Disiplin, Kehadiran Terendah, Paling Sering Terlambat). Sebelumnya
// masing-masing leaderboard melakukan query holiday + siswa + attendance
// SENDIRI-SENDIRI untuk bulan yang sama -- 3 leaderboard x 6 bulan x 3 query
// = ~54 query per render dashboard. Sekarang cukup 1x fetch per bulan,
// dipakai bertiga.
// PENTING: bentuk ini adalah yang disimpan oleh unstable_cache (lihat
// getCachedMonthlyAttendanceBase di bawah), jadi WAJIB plain JSON-serializable
// -- Map dan Date TIDAK dijamin selamat lewat serialisasi cache. `checkInAt`
// karena itu disimpan sebagai ISO string, bukan Date; konsumen yang butuh
// Map untuk lookup cepat membangunnya sendiri setelah membaca dari cache
// (lihat toAttendanceMap()).
type MonthlyAttendanceBase = {
  schoolDays: number;
  students: { id: string; name: string; nis: string; className: string }[];
  attendances: { studentId: string; status: AttendanceStatus; checkInAt: string }[];
};

function toAttendanceMap(
  attendances: MonthlyAttendanceBase["attendances"]
): Map<string, { status: AttendanceStatus; checkInAt: Date }[]> {
  const map = new Map<string, { status: AttendanceStatus; checkInAt: Date }[]>();
  for (const a of attendances) {
    const list = map.get(a.studentId) ?? [];
    list.push({ status: a.status, checkInAt: new Date(a.checkInAt) });
    map.set(a.studentId, list);
  }
  return map;
}

function parseMonthRange(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const periodStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const periodEndRequested = new Date(Date.UTC(year, monthNum, 0));
  const today = getTodayDateOnly();
  return {
    periodStart,
    periodEnd: periodEndRequested.getTime() > today.getTime() ? today : periodEndRequested,
    isFuture: periodStart.getTime() > today.getTime(),
    monthLabel: formatPeriodLabel("monthly", periodStart),
  };
}

async function fetchMonthlyAttendanceBase(
  month: string,
  classId: string | null
): Promise<MonthlyAttendanceBase | null> {
  const { periodStart, periodEnd, isFuture } = parseMonthRange(month);
  if (isFuture) return null;

  const holidaySet = await getHolidayDateSet(periodStart, periodEnd);
  const schoolDays = countSchoolDays(periodStart, periodEnd, holidaySet);

  const students = await prisma.student.findMany({
    where: { status: StudentStatus.ACTIVE, ...(classId ? { classId } : {}) },
    select: { id: true, name: true, nis: true, class: { select: { name: true } } },
  });
  if (students.length === 0) {
    return { schoolDays, students: [], attendances: [] };
  }

  const studentIds = students.map((s) => s.id);
  const attendances = await prisma.attendance.findMany({
    where: { studentId: { in: studentIds }, date: { gte: periodStart, lte: periodEnd } },
    select: { studentId: true, status: true, checkInAt: true },
  });

  return {
    schoolDays,
    students: students.map((s) => ({ id: s.id, name: s.name, nis: s.nis, className: s.class.name })),
    attendances: attendances.map((a) => ({
      studentId: a.studentId,
      status: a.status,
      checkInAt: a.checkInAt.toISOString(),
    })),
  };
}

// Leaderboard bulanan (Disiplin/Kehadiran Terendah/Terlambat) TIDAK perlu
// real-time -- data historis "bulan ini" cukup akurat walau tertinggal
// beberapa menit. Cache ini yang membuat refresh dashboard beruntun (mis.
// saat banyak siswa scan berurutan & realtime listener memicu
// router.refresh()) TIDAK menembak ulang query berat setiap kali; selama
// window cache, semua render memakai hasil yang sama dari memory/cache Next.
const LEADERBOARD_CACHE_SECONDS = 5 * 60; // 5 menit

const getCachedMonthlyAttendanceBase = unstable_cache(
  fetchMonthlyAttendanceBase,
  ["monthly-attendance-base"],
  { revalidate: LEADERBOARD_CACHE_SECONDS }
);

export async function getTopDisciplinedStudents(params: {
  month: string; // "YYYY-MM"
  classId?: string;
  limit?: number;
}): Promise<DisciplineLeaderboardPayload> {
  const { month, classId, limit = 5 } = params;
  const { isFuture, monthLabel } = parseMonthRange(month);
  if (isFuture) return { month, monthLabel, schoolDays: 0, rows: [] };

  const base = await getCachedMonthlyAttendanceBase(month, classId ?? null);
  if (!base) return { month, monthLabel, schoolDays: 0, rows: [] };
  const attendanceByStudent = toAttendanceMap(base.attendances);

  // Hanya HADIR/TERLAMBAT yang dihitung sebagai "masuk sekolah" -- SAKIT,
  // IZIN, DISPENSASI, ALPHA tidak menambah skor kedisiplinan (Section 10-11).
  const rows = base.students
    .map((s) => {
      const records = (attendanceByStudent.get(s.id) ?? []).filter(
        (a) => a.status === AttendanceStatus.HADIR || a.status === AttendanceStatus.TERLAMBAT
      );
      const hadirCount = records.length;
      const avgSeconds =
        hadirCount > 0
          ? records.reduce((sum, a) => sum + jakartaSecondsOfDay(a.checkInAt), 0) / hadirCount
          : null;
      return {
        studentId: s.id,
        name: s.name,
        nis: s.nis,
        className: s.className,
        hadirCount,
        avgCheckInLabel: avgSeconds === null ? "-" : secondsOfDayToLabel(avgSeconds),
        sortSeconds: avgSeconds ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((r) => r.hadirCount > 0) // siswa tanpa kehadiran bulan ini tidak masuk peringkat
    .sort((a, b) => {
      if (b.hadirCount !== a.hadirCount) return b.hadirCount - a.hadirCount; // (1) jumlah hadir DESC
      return a.sortSeconds - b.sortSeconds; // (2) rata-rata jam check-in ASC
    })
    .slice(0, limit)
    .map(({ sortSeconds: _sortSeconds, ...row }): DisciplineRow => row);

  return { month, monthLabel, schoolDays: base.schoolDays, rows };
}

// ============================================================
// Top 5 Kehadiran Terendah -- kebalikan getTopDisciplinedStudents():
//   1. Jumlah hari HADIR/TERLAMBAT (masuk sekolah) bulan ini -- ASC
//   2. Jumlah ALPHA bulan ini -- DESC (tie-breaker, konteks tambahan)
//   3. Nama -- alfabetis (tie-breaker terakhir, supaya urutan stabil)
// Siswa TETAP masuk peringkat meski hadirCount = 0 (justru itu yang paling
// relevan untuk widget ini), beda dengan getTopDisciplinedStudents() yang
// mengecualikan siswa tanpa kehadiran sama sekali.
// ============================================================

export async function getLowestAttendanceStudents(params: {
  month: string; // "YYYY-MM"
  classId?: string;
  limit?: number;
}): Promise<LowAttendanceLeaderboardPayload> {
  const { month, classId, limit = 5 } = params;
  const { isFuture, monthLabel } = parseMonthRange(month);
  if (isFuture) return { month, monthLabel, schoolDays: 0, rows: [] };

  const base = await getCachedMonthlyAttendanceBase(month, classId ?? null);
  if (!base || base.schoolDays === 0) {
    return { month, monthLabel, schoolDays: base?.schoolDays ?? 0, rows: [] };
  }
  const attendanceByStudent = toAttendanceMap(base.attendances);

  const rows = base.students
    .map((s) => {
      const records = attendanceByStudent.get(s.id) ?? [];
      const hadir = records.filter(
        (a) => a.status === AttendanceStatus.HADIR || a.status === AttendanceStatus.TERLAMBAT
      ).length;
      const alpha = records.filter((a) => a.status === AttendanceStatus.ALPHA).length;
      return {
        studentId: s.id,
        name: s.name,
        nis: s.nis,
        className: s.className,
        hadirCount: hadir,
        alphaCount: alpha,
        persentaseKehadiran: Math.round((hadir / base.schoolDays) * 100),
      };
    })
    .sort((a, b) => {
      if (a.hadirCount !== b.hadirCount) return a.hadirCount - b.hadirCount; // (1) hadirCount ASC
      if (b.alphaCount !== a.alphaCount) return b.alphaCount - a.alphaCount; // (2) alphaCount DESC
      return a.name.localeCompare(b.name); // (3) alfabetis
    })
    .slice(0, limit);

  return { month, monthLabel, schoolDays: base.schoolDays, rows };
}

// ============================================================
// Top 5 Siswa Paling Sering Terlambat -- sama seperti
// getTopDisciplinedStudents() tapi HANYA menghitung status TERLAMBAT:
//   1. Jumlah TERLAMBAT bulan ini -- DESC
//   2. Rata-rata jam check-in (Asia/Jakarta) -- DESC (paling siang = paling
//      parah yang menang, kebalikan dari leaderboard kedisiplinan)
// Siswa tanpa keterlambatan sama sekali pada bulan itu tidak masuk peringkat.
// ============================================================

export async function getTopLateStudents(params: {
  month: string; // "YYYY-MM"
  classId?: string;
  limit?: number;
}): Promise<LateLeaderboardPayload> {
  const { month, classId, limit = 5 } = params;
  const { isFuture, monthLabel } = parseMonthRange(month);
  if (isFuture) return { month, monthLabel, schoolDays: 0, rows: [] };

  const base = await getCachedMonthlyAttendanceBase(month, classId ?? null);
  if (!base) return { month, monthLabel, schoolDays: 0, rows: [] };
  const attendanceByStudent = toAttendanceMap(base.attendances);

  const rows = base.students
    .map((s) => {
      const records = (attendanceByStudent.get(s.id) ?? []).filter(
        (a) => a.status === AttendanceStatus.TERLAMBAT
      );
      const terlambatCount = records.length;
      const avgSeconds =
        terlambatCount > 0
          ? records.reduce((sum, a) => sum + jakartaSecondsOfDay(a.checkInAt), 0) / terlambatCount
          : null;
      return {
        studentId: s.id,
        name: s.name,
        nis: s.nis,
        className: s.className,
        terlambatCount,
        avgCheckInLabel: avgSeconds === null ? "-" : secondsOfDayToLabel(avgSeconds),
        sortSeconds: avgSeconds ?? -1,
      };
    })
    .filter((r) => r.terlambatCount > 0) // siswa tanpa keterlambatan bulan ini tidak masuk peringkat
    .sort((a, b) => {
      if (b.terlambatCount !== a.terlambatCount) return b.terlambatCount - a.terlambatCount; // (1) jumlah terlambat DESC
      return b.sortSeconds - a.sortSeconds; // (2) rata-rata jam check-in DESC (paling siang menang)
    })
    .slice(0, limit)
    .map(({ sortSeconds: _sortSeconds, ...row }): LateStudentRow => row);

  return { month, monthLabel, schoolDays: base.schoolDays, rows };
}

// ============================================================
// Rekap Keterlambatan Hari Ini -- membandingkan jumlah TERLAMBAT hari ini
// dengan HARI SEKOLAH SEBELUMNYA (mundur maksimal 14 hari kalender, skip
// weekend & Holiday -- definisi yang SAMA dengan isNonSchoolDay() di
// attendance-service.ts, JANGAN buat definisi "hari sekolah" duplikat).
// Kenapa bukan sekadar "kemarin" kalender: kalau hari ini Senin, "kemarin"
// (Minggu) pasti 0 keterlambatan karena sekolah libur -- persentase
// perubahannya jadi tidak berarti. `compareLabel` tetap menampilkan
// "kemarin" untuk kasus umum (Selasa-Jumat) di mana hari sekolah sebelumnya
// memang benar-benar kemarin.
//
// Batch 1x getHolidayDateSet() untuk 14 hari ke belakang, bukan sampai 14x
// isHoliday() sequential (tiap isHoliday() = 1 round-trip DB) seperti versi
// sebelumnya -- N+1 kecil tapi tetap menambah beban saat dipanggil beruntun.
// Hasilnya di-cache singkat (data "hari ini" perlu lebih segar daripada
// leaderboard bulanan, tapi tetap tidak perlu dihitung ulang di SETIAP
// refresh yang dipicu realtime listener).
// ============================================================

const LATE_RECAP_CACHE_SECONDS = 60; // 1 menit -- cukup segar utk "hari ini"

async function fetchLateRecapToday(
  today: string, // ISO date-only, supaya hasil unstable_cache tidak "menempel" ke hari kemarin lewat tengah malam
  classId: string | null
): Promise<LateRecapToday> {
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const rangeStart = new Date(todayDate);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 14);

  const holidaySet = await getHolidayDateSet(rangeStart, todayDate);
  const isNonSchoolDay = (d: Date) => isWeekendDate(d) || holidaySet.has(toISODateOnly(d));

  const isSchoolDayToday = !isNonSchoolDay(todayDate);

  let compareDate: Date | null = null;
  const cursor = new Date(todayDate);
  for (let i = 0; i < 14; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!isNonSchoolDay(cursor)) {
      compareDate = new Date(cursor);
      break;
    }
  }

  const classFilter = classId ? { student: { classId } } : {};

  const [todayCount, compareCount] = await Promise.all([
    prisma.attendance.count({
      where: { date: todayDate, status: AttendanceStatus.TERLAMBAT, ...classFilter },
    }),
    compareDate
      ? prisma.attendance.count({
          where: { date: compareDate, status: AttendanceStatus.TERLAMBAT, ...classFilter },
        })
      : Promise.resolve(null),
  ]);

  let percentChange: number | null = null;
  let direction: LateRecapToday["direction"] = "none";

  if (compareCount === null) {
    direction = "none";
  } else if (compareCount === 0) {
    direction = todayCount > 0 ? "new" : "flat";
  } else {
    percentChange = Math.round(((todayCount - compareCount) / compareCount) * 100);
    direction = percentChange > 0 ? "up" : percentChange < 0 ? "down" : "flat";
  }

  const yesterday = new Date(todayDate);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const compareLabel = !compareDate
    ? "-"
    : toISODateOnly(compareDate) === toISODateOnly(yesterday)
      ? "kemarin"
      : new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(compareDate);

  return {
    date: toISODateOnly(todayDate),
    isSchoolDay: isSchoolDayToday,
    todayCount,
    compareDate: compareDate ? toISODateOnly(compareDate) : null,
    compareLabel,
    compareCount,
    percentChange,
    direction,
  };
}

const getCachedLateRecapToday = unstable_cache(fetchLateRecapToday, ["late-recap-today"], {
  revalidate: LATE_RECAP_CACHE_SECONDS,
});

export async function getLateRecapToday(
  params: { classId?: string } = {}
): Promise<LateRecapToday> {
  const today = toISODateOnly(getTodayDateOnly());
  return getCachedLateRecapToday(today, params.classId ?? null);
}