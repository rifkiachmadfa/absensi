import "server-only";
import type { SessionUser } from "./session";

/**
 * ================================================================
 * PERMISSION MATRIX — Sistem Absensi Siswa
 * ================================================================
 * Hierarki: GURU < WALI_KELAS < ADMIN < SUPERADMIN
 * WALI_KELAS = semua hak GURU + hak tambahan yang di-scope ke kelas
 * yang ia ampu (Class.homeroomTeacherId === user.id).
 *
 * - GURU (default role semua user): scan, absen manual, ubah status
 *   kehadiran siswa MANA PUN (tanpa kecuali), lihat riwayat/laporan
 *   absensi seluruh siswa & kelas, lihat daftar & statistik kelas,
 *   lihat seluruh data siswa.
 *   TIDAK bisa: ubah identitas siswa, tambah siswa, ubah status aktif
 *   siswa, kelola kelas, kelola akun guru, tahun ajaran, jadwal
 *   absensi, akses kartu siswa.
 * - WALI_KELAS: hak GURU + tambah siswa, ubah status aktif siswa, dan
 *   ubah identitas siswa — TAPI hanya untuk kelas yang ia ampu. Di
 *   kelas lain, haknya turun jadi selevel GURU. Juga punya akses
 *   Kartu Siswa (semua kelas, karena sifatnya cetak/lihat saja).
 * - ADMIN: hak WALI_KELAS/GURU di SEMUA kelas + kelola kelas penuh +
 *   kelola akun guru (buat/edit/hapus/identitas/status/reset password)
 *   + tautkan wali kelas. TIDAK bisa: tahun ajaran, jadwal absensi.
 * - SUPERADMIN: semua hak di atas + tahun ajaran + jadwal absensi +
 *   pengaturan sistem + audit log.
 * ================================================================
 */

const isSuperadmin = (user: SessionUser) => user.role === "SUPERADMIN";
const isAdminOrAbove = (user: SessionUser) =>
  user.role === "SUPERADMIN" || user.role === "ADMIN";

/** true jika actor adalah wali kelas DARI kelas dengan homeroomTeacherId tsb. */
function isHomeroomOwner(
  user: SessionUser,
  homeroomTeacherId: string | null | undefined
) {
  return (
    user.role === "WALI_KELAS" &&
    !!homeroomTeacherId &&
    homeroomTeacherId === user.id
  );
}

// ---------- ABSENSI (semua role login boleh, tanpa scoping kelas) ----------
export function canScanAttendance(_user: SessionUser) {
  return true;
}
export function canManualAttendance(_user: SessionUser) {
  return true;
}
/** Ubah status kehadiran (hadir/terlambat/sakit/izin/dispensasi/alpha)
 *  siswa mana pun — semua role login, tanpa kecuali, tanpa scoping kelas. */
export function canEditAttendanceStatus(_user: SessionUser) {
  return true;
}
/** Lihat riwayat/rekap absensi siswa mana pun — semua role login. */
export function canViewAttendance(_user: SessionUser) {
  return true;
}
export function canExportAttendance(_user: SessionUser) {
  return true;
}

// ---------- SISWA ----------
/** Lihat seluruh data siswa — semua role login boleh. */
export function canViewStudents(_user: SessionUser) {
  return true;
}

/**
 * Edit identitas siswa (nama, NIS, NISN, pindah kelas).
 * - SUPERADMIN/ADMIN: semua siswa, semua kelas.
 * - WALI_KELAS: hanya siswa yang ada di kelas yang ia ampu.
 * - GURU: tidak boleh (GURU hanya boleh input/ubah status kehadiran,
 *   bukan data identitas siswa).
 */
export function canEditStudentIdentity(
  user: SessionUser,
  studentClassHomeroomTeacherId: string | null | undefined
) {
  if (isAdminOrAbove(user)) return true;
  return isHomeroomOwner(user, studentClassHomeroomTeacherId);
}

/**
 * Tambah siswa baru ke sebuah kelas.
 * - SUPERADMIN/ADMIN: semua kelas.
 * - WALI_KELAS: hanya kelas yang ia ampu.
 * - GURU: tidak boleh.
 */
export function canCreateStudent(
  user: SessionUser,
  targetClassHomeroomTeacherId: string | null | undefined
) {
  if (isAdminOrAbove(user)) return true;
  return isHomeroomOwner(user, targetClassHomeroomTeacherId);
}

/** Dipakai untuk tampil/sembunyikan tombol "Tambah Siswa" tanpa konteks kelas spesifik. */
export function canCreateStudentSomewhere(user: SessionUser) {
  return isAdminOrAbove(user) || user.role === "WALI_KELAS";
}

/**
 * Aktifkan / nonaktifkan siswa.
 * - SUPERADMIN/ADMIN: semua kelas.
 * - WALI_KELAS: hanya siswa di kelas yang ia ampu.
 * - GURU: tidak boleh.
 */
export function canSetStudentStatus(
  user: SessionUser,
  studentClassHomeroomTeacherId: string | null | undefined
) {
  if (isAdminOrAbove(user)) return true;
  return isHomeroomOwner(user, studentClassHomeroomTeacherId);
}

// ---------- KELAS ----------
/** Lihat daftar kelas & statistik kelas — semua role login boleh. */
export function canViewClasses(_user: SessionUser) {
  return true;
}
/** Tambah/edit/nonaktifkan kelas — hanya SUPERADMIN/ADMIN. */
export function canManageClasses(user: SessionUser) {
  return isAdminOrAbove(user);
}
/** Menautkan guru menjadi wali kelas — hanya SUPERADMIN/ADMIN. */
export function canAssignHomeroomTeacher(user: SessionUser) {
  return isAdminOrAbove(user);
}

// ---------- KARTU SISWA & LAPORAN ----------
/** Lihat/cetak kartu siswa — SUPERADMIN, ADMIN, WALI_KELAS. */
export function canAccessStudentCard(user: SessionUser) {
  return isAdminOrAbove(user) || user.role === "WALI_KELAS";
}
/** Lihat halaman laporan/riwayat absensi — semua role login, tanpa kecuali. */
export function canAccessReports(_user: SessionUser) {
  return true;
}

// ---------- AKUN GURU ----------
/** Buat/edit/hapus/ubah identitas & status aktif akun guru — hanya SUPERADMIN/ADMIN. */
export function canManageTeacherAccounts(user: SessionUser) {
  return isAdminOrAbove(user);
}
/** Reset password guru langsung tanpa verifikasi password lama — hanya SUPERADMIN/ADMIN. */
export function canResetTeacherPassword(user: SessionUser) {
  return isAdminOrAbove(user);
}

// ---------- TAHUN AJARAN & JADWAL ABSENSI ----------
/** Hanya SUPERADMIN yang boleh mengatur tahun ajaran & jadwal/jam absensi. */
export function canManageAcademicYear(user: SessionUser) {
  return isSuperadmin(user);
}
export function canManageAttendanceSchedule(user: SessionUser) {
  return isSuperadmin(user);
}

// ---------- LOG AKTIVITAS ----------
export function canViewAuditLog(user: SessionUser) {
  return isSuperadmin(user);
}