// lib/services/attendance-service.ts
import { unstable_cache } from "next/cache";
import { ATTENDANCE_TODAY_STATS_TAG } from "@/lib/cache/tags";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  AttendanceStatus,
  AttendanceMethod,
  StudentStatus,
  ClassStatus,
  AuditAction,
} from "@/app/generated/prisma/client";
import { notifyAttendance } from "@/lib/services/whatsapp-service";

// Notifikasi WhatsApp (docs/whatsapp-blast.md) dijadwalkan lewat after() --
// dijalankan SETELAH response dikirim ke client, bukan sebelum. Ini
// memenuhi dua requirement sekaligus:
// - Section 9: request Fonnte tidak boleh terjadi di dalam transaksi Prisma
//   (di sini malah dijadwalkan setelah transaksi COMMIT DAN setelah
//   response terkirim -- lebih ketat dari yang diminta, bukan pelanggaran).
// - Section 29 & UX Scanner: feedback ke guru harus cepat -- guru tidak
//   perlu menunggu request WhatsApp selesai untuk melihat hasil scan.
// notifyAttendance() sendiri didesain tidak pernah throw (lihat
// whatsapp-service.ts), tapi tetap dibungkus try/catch di sini sebagai
// lapisan pertahanan tambahan (Section 8.1) -- error WhatsApp TIDAK BOLEH
// membuat proses ini gagal, dan karena after() berjalan pasca-response,
// error di sini juga tidak berpengaruh ke response yang sudah dikirim.
function scheduleWhatsAppNotification(params: Parameters<typeof notifyAttendance>[0]) {
  after(async () => {
    try {
      await notifyAttendance(params);
    } catch (error) {
      console.error("[AttendanceService] Gagal menjadwalkan notifikasi WhatsApp:", error);
    }
  });
}

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

// Hasil dari AttendanceService.identifyPulang -- pasangan IdentifyResult
// untuk alur PULANG. "SUCCESS" di sini berarti "siswa sudah check-in &
// belum check-out, siap diproses checkOut()" -- BUKAN berarti checkOutAt
// sudah tersimpan (itu baru terjadi di CheckOutResult.SUCCESS).
export type IdentifyPulangResult =
  | { type: "SUCCESS"; student: StudentSummary; checkInTime: string; status: AttendanceStatus }
  | { type: "ALREADY_CHECKED_OUT"; student: StudentSummary; time: string; status: AttendanceStatus }
  | { type: "NOT_CHECKED_IN"; student: StudentSummary }
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

// AttendanceSchedule (per hari) & SchoolSetting (fallback) HAMPIR TIDAK
// PERNAH berubah dalam satu hari berjalan -- keduanya cuma diubah admin
// lewat /pengaturan (lihat upsertAttendanceSchedule/updateDefaultSchedule
// di pengaturan-service.ts), bukan oleh proses scan. Sebelumnya
// resolveStatus() query ulang KEDUANYA di *setiap* scan (1-2 round trip DB
// tiap panggilan) padahal hasilnya nyaris selalu sama sepanjang hari --
// jadi dicache di sini per dayOfWeek. SCHEDULE_CACHE_SECONDS sengaja lebih
// panjang dari TODAY_STATS_CACHE_SECONDS (statistik dashboard, yang memang
// harus terasa "real-time") karena jadwal absensi bukan angka yang
// berubah-ubah -- 60 detik basi masih jauh lebih aman daripada 10 detik
// basi untuk data statistik.
//
// SCHEDULE_CACHE_TAG diekspor supaya pengaturan-service.ts bisa
// revalidateTag() begitu admin menyimpan perubahan jadwal/setting --
// perubahan admin jadi terasa SEGERA (tidak perlu menunggu 60 detik) tanpa
// mengorbankan cache untuk scan biasa.
export const SCHEDULE_CACHE_TAG = "attendance-schedule";
const SCHEDULE_CACHE_SECONDS = 60;

async function fetchScheduleForDay(dayOfWeek: number): Promise<{ lateAfter: string }> {
  const daySchedule = await prisma.attendanceSchedule.findFirst({
    where: { dayOfWeek, isActive: true },
  });

  if (daySchedule) {
    return { lateAfter: daySchedule.lateAfter };
  }

  const setting = await prisma.schoolSetting.findFirst();
  return { lateAfter: setting?.lateAfter ?? "07:15" };
}

const getCachedScheduleForDay = unstable_cache(fetchScheduleForDay, ["schedule-for-day"], {
  revalidate: SCHEDULE_CACHE_SECONDS,
  tags: [SCHEDULE_CACHE_TAG],
});

async function resolveStatus(dayOfWeek: number, hhmm: string): Promise<AttendanceStatus> {
  const { lateAfter } = await getCachedScheduleForDay(dayOfWeek);
  return hhmm <= lateAfter ? AttendanceStatus.HADIR : AttendanceStatus.TERLAMBAT;
}

// QR token SELALU digenerate uppercase (lihat generateQrToken() di
// siswa-service.ts: `STD-${...toUpperCase()}`), dan Student.qrToken di-lookup
// dengan exact match (case-sensitive di Postgres). Kamera (html5-qrcode)
// membaca ulang bitmap QR persis apa adanya sehingga selalu uppercase, TAPI
// scanner fisik (HID keyboard-emulation, mis. EPPOS EP5300BT) bisa mengirim
// huruf lowercase -- baik karena setting "case conversion" di scanner itu
// sendiri, maupun karena scanner meniru tombol Shift berdasarkan ASCII dan
// state Caps Lock di komputer guru saat itu ikut membalik huruf yang
// dikirim. Ini murni soal encoding teks yang masuk, BUKAN business rule,
// jadi aman dinormalisasi di sini (satu tempat, dipakai identify/checkIn/
// checkOut) tanpa melanggar prinsip "jangan ubah attendance business rules
// saat extend input mechanism". `identifier` untuk method MANUAL (studentId/
// cuid) TIDAK disentuh sama sekali karena cuid Prisma bersifat case-sensitive
// secara desain.
function normalizeIdentifier(identifier: string, method: AttendanceMethod): string {
  const trimmed = identifier.trim();
  return method === AttendanceMethod.QR ? trimmed.toUpperCase() : trimmed;
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
   * Awalnya dibuat untuk alur "identifikasi dulu, baru pilih status manual"
   * (Phase 7) yang lalu digantikan checkIn() -- lihat catatan lama di
   * confirmAttendance(). Sekarang dipakai LAGI, tapi untuk tujuan berbeda:
   * fase 1 dari pola "identify lalu checkIn" di endpoint
   * /api/absensi/scan/identify (dipanggil use-scan-queue.ts SEBELUM
   * /api/absensi/scan) supaya UI bisa menampilkan Nama/Kelas siswa SEGERA
   * begitu kartu dikenali, tanpa menunggu checkIn() (yang menulis ke
   * database) selesai (Section 29 UX Scanner). Method ini TIDAK MENULIS
   * apa pun -- hanya mengenali siswa & mengecek apakah siswa tsb sudah
   * absen hari ini. Hasilnya BUKAN keputusan akhir; checkIn() SELALU
   * dipanggil sesudahnya dan tetap satu-satunya yang menentukan status
   * final/menyimpan data (Section 26). Race condition antara identify() dan
   * checkIn() (mis. siswa sempat di-scan guru lain di antara keduanya) aman
   * -- checkIn() mengulang pengecekan yang sama dari awal.
   *
   * `suggestedStatus` dihitung dari AttendanceSchedule/SchoolSetting sebagai
   * SARAN saja (mis. highlight tombol "Hadir" di UI kalau suatu saat alur
   * manual dipakai lagi). Keputusan status akhir tetap 100% milik checkIn().
   */
  static async identify(params: {
    identifier: string; // qrToken (QR) atau studentId (MANUAL)
    method: AttendanceMethod;
  }): Promise<IdentifyResult> {
    const { method } = params;
    const identifier = normalizeIdentifier(params.identifier, method);
    const date = getTodayDateOnly();

    // isNonSchoolDay() (baca tabel Holiday) & pencarian siswa TIDAK saling
    // bergantung -- dulu di-await berurutan, sekarang paralel. Kalau
    // ternyata hari libur, hasil query siswa dibuang begitu saja -- ini
    // trade-off yang wajar: hari libur jauh lebih jarang daripada hari
    // sekolah biasa, jadi yang harus dioptimalkan adalah kasus paling
    // sering (hari sekolah), bukan kasus paling jarang.
    const [nonSchoolDay, student] = await Promise.all([
      isNonSchoolDay(date),
      prisma.student.findFirst({
        where: method === AttendanceMethod.QR ? { qrToken: identifier } : { id: identifier },
        include: { class: true },
      }),
    ]);

    if (nonSchoolDay) {
      return { type: "SCHOOL_CLOSED" };
    }

    if (!student) return { type: "STUDENT_NOT_FOUND" };
    if (student.status !== StudentStatus.ACTIVE) {
      return { type: "STUDENT_INACTIVE", student: toSummary(student) };
    }

    const { dayOfWeek, hhmm } = getJakartaNow();

    // Cek "sudah absen hari ini?" & hitung suggestedStatus TIDAK saling
    // bergantung -- jalankan paralel juga. resolveStatus() sendiri sekarang
    // dicache (lihat getCachedScheduleForDay di bawah class ini), jadi pada
    // kasus umum panggilan ini bahkan tidak menyentuh database sama sekali.
    const [existing, suggestedStatus] = await Promise.all([
      prisma.attendance.findUnique({
        where: { studentId_date: { studentId: student.id, date } },
      }),
      resolveStatus(dayOfWeek, hhmm),
    ]);

    if (existing) {
      return {
        type: "ALREADY_CHECKED_IN",
        student: toSummary(student),
        time: existing.checkInAt.toISOString(),
        status: existing.status,
      };
    }

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
    const { method, recordedById } = params;
    const identifier = normalizeIdentifier(params.identifier, method);
    const date = getTodayDateOnly();

    // Poin 3 (audit performa): isNonSchoolDay() (baca tabel Holiday) &
    // pencarian siswa TIDAK saling bergantung satu sama lain -- dulu
    // di-await berurutan (2 round trip DB berurutan), sekarang dijalankan
    // paralel lewat Promise.all (1 "round trip" -- keduanya nunggu
    // bersamaan). Kalau ternyata hari libur, hasil query siswa dibuang --
    // trade-off yang wajar karena hari libur jauh lebih jarang daripada
    // hari sekolah biasa; yang harus paling cepat justru kasus tersering
    // (hari sekolah, siswa valid).
    const [nonSchoolDay, student] = await Promise.all([
      isNonSchoolDay(date),
      prisma.student.findFirst({
        where: method === AttendanceMethod.QR ? { qrToken: identifier } : { id: identifier },
        include: { class: true },
      }),
    ]);

    // Sabtu/Minggu ATAU hari libur yang diatur admin (Section 11 & 30 --
    // siswa yang tidak sekolah bukan berarti ALPHA, dan hari libur bukan
    // hari sekolah sama sekali). Dicek sebelum apa pun disimpan, supaya
    // TIDAK ADA jalur (QR ataupun manual) yang bisa membuat record
    // Attendance di hari non-sekolah.
    if (nonSchoolDay) {
      return { type: "SCHOOL_CLOSED" };
    }

    if (!student) return { type: "STUDENT_NOT_FOUND" };
    if (student.status !== StudentStatus.ACTIVE) {
      return { type: "STUDENT_INACTIVE", student: toSummary(student) };
    }

    // Waktu & status SELALU dihitung dari server (Section 3.1), tidak pernah
    // dipercayakan ke client. dayOfWeek/hhmm murni komputasi lokal (tidak ada
    // I/O), jadi aman dihitung di sini sebelum query berikutnya.
    const { serverTime, dayOfWeek, hhmm } = getJakartaNow();

    // Poin 3: cek "sudah absen hari ini?" & hitung status (HADIR/TERLAMBAT)
    // JUGA tidak saling bergantung -- dulu berurutan (findUnique lalu
    // resolveStatus, yang di dalamnya sendiri masih 1-2 query lagi),
    // sekarang paralel. resolveStatus() sekarang lewat cache
    // (getCachedScheduleForDay, lihat bawah class ini) supaya pada kasus
    // umum bahkan TIDAK menyentuh database sama sekali -- AttendanceSchedule
    // & SchoolSetting nyaris tidak pernah berubah dalam satu hari berjalan.
    const [existing, status] = await Promise.all([
      prisma.attendance.findUnique({
        where: { studentId_date: { studentId: student.id, date } },
      }),
      resolveStatus(dayOfWeek, hhmm),
    ]);

    if (existing) {
      return {
        type: "ALREADY_CHECKED_IN",
        student: toSummary(student),
        time: existing.checkInAt.toISOString(),
        status: existing.status,
      };
    }

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

      // Hanya dipanggil pada jalur SUCCESS (Section 5.1 & 36 Acceptance
      // Criteria) -- ALREADY_CHECKED_IN/STUDENT_NOT_FOUND/SCHOOL_CLOSED/dll
      // TIDAK mengirim WhatsApp.
      scheduleWhatsAppNotification({
        type: "CHECK_IN",
        studentName: student.name,
        className: student.class.name,
        whatsappNumber: student.whatsappNumber,
        time: attendance.checkInAt.toISOString(),
        status: attendance.status,
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
    const { method, recordedById } = params;
    const identifier = normalizeIdentifier(params.identifier, method);
    const date = getTodayDateOnly();

    // isNonSchoolDay() & pencarian siswa tidak saling bergantung -- paralel,
    // sama seperti checkIn()/identify() di atas.
    const [nonSchoolDay, student] = await Promise.all([
      isNonSchoolDay(date),
      prisma.student.findFirst({
        where: method === AttendanceMethod.QR ? { qrToken: identifier } : { id: identifier },
        include: { class: true },
      }),
    ]);

    // Sabtu/Minggu ATAU hari libur: sistem absensi (termasuk absen pulang)
    // tidak aktif -- konsisten dengan guard yang sama di checkIn()/identify().
    if (nonSchoolDay) {
      return { type: "SCHOOL_CLOSED" };
    }

    if (!student) return { type: "STUDENT_NOT_FOUND" };
    if (student.status !== StudentStatus.ACTIVE) {
      return { type: "STUDENT_INACTIVE", student: toSummary(student) };
    }

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

      // Hanya dipanggil pada jalur SUCCESS (Section 5.2 & 36 Acceptance
      // Criteria) -- ALREADY_CHECKED_OUT/NOT_CHECKED_IN/dll TIDAK mengirim
      // WhatsApp.
      scheduleWhatsAppNotification({
        type: "CHECK_OUT",
        studentName: student.name,
        className: student.class.name,
        whatsappNumber: student.whatsappNumber,
        time: serverTime.toISOString(),
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
   * Fase 1 (read-only, TIDAK menulis apa pun) dari pola "identify lalu
   * checkOut" untuk absen PULANG -- pasangan identify() di atas, dipakai
   * endpoint /api/absensi/scan-pulang/identify supaya UI bisa menampilkan
   * Nama/Kelas siswa SEGERA begitu kartu dikenali, tanpa menunggu
   * checkOut() (yang menulis checkOutAt) selesai (Section 29 UX Scanner).
   *
   * Sengaja method TERPISAH dari identify() (bukan reuse) karena
   * pertanyaannya beda: identify() mengecek "apakah siswa ini sudah
   * check-in HARI INI?", method ini mengecek "apakah siswa ini sudah
   * check-in TAPI BELUM check-out HARI INI?" -- keduanya butuh baca record
   * Attendance yang sama tapi menyimpulkan hal berbeda darinya.
   *
   * Hasilnya BUKAN keputusan akhir; checkOut() SELALU dipanggil sesudahnya
   * dan tetap satu-satunya yang menyimpan checkOutAt (Section 26). Race
   * condition antara identifyPulang() dan checkOut() aman -- checkOut()
   * mengulang pengecekan yang sama dari awal (dan sudah menangani race
   * lewat updateMany + AlreadyCheckedOutError, lihat checkOut() di atas).
   */
  static async identifyPulang(params: {
    identifier: string; // qrToken (QR) atau studentId (MANUAL)
    method: AttendanceMethod;
  }): Promise<IdentifyPulangResult> {
    const { method } = params;
    const identifier = normalizeIdentifier(params.identifier, method);
    const date = getTodayDateOnly();

    const [nonSchoolDay, student] = await Promise.all([
      isNonSchoolDay(date),
      prisma.student.findFirst({
        where: method === AttendanceMethod.QR ? { qrToken: identifier } : { id: identifier },
        include: { class: true },
      }),
    ]);

    if (nonSchoolDay) {
      return { type: "SCHOOL_CLOSED" };
    }

    if (!student) return { type: "STUDENT_NOT_FOUND" };
    if (student.status !== StudentStatus.ACTIVE) {
      return { type: "STUDENT_INACTIVE", student: toSummary(student) };
    }

    const existing = await prisma.attendance.findUnique({
      where: { studentId_date: { studentId: student.id, date } },
    });

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

    return {
      type: "SUCCESS",
      student: toSummary(student),
      checkInTime: existing.checkInAt.toISOString(),
      status: existing.status,
    };
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
  tags: [ATTENDANCE_TODAY_STATS_TAG],
});

const getCachedClassBreakdown = unstable_cache(fetchClassBreakdown, ["class-breakdown"], {
  revalidate: TODAY_STATS_CACHE_SECONDS,
  tags: [ATTENDANCE_TODAY_STATS_TAG],
});

const getCachedRecentActivity = unstable_cache(fetchRecentActivity, ["recent-activity"], {
  revalidate: TODAY_STATS_CACHE_SECONDS,
  tags: [ATTENDANCE_TODAY_STATS_TAG],
});