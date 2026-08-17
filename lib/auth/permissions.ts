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
 *   kehadiran, lihat & export absensi, lihat & ubah identitas siswa.
 *   TIDAK bisa: tambah siswa, ubah status aktif siswa, tambah kelas,
 *   kelola akun guru, tahun ajaran, jadwal absensi.
 * - WALI_KELAS: hak GURU + tambah siswa & ubah status aktif siswa,
 *   TAPI hanya untuk kelas yang ia ampu. Di kelas lain, haknya
 *   turun jadi selevel GURU.
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

// ---------- ABSENSI (semua role login boleh) ----------
export function canScanAttendance(_user: SessionUser) {
  return true;
}
export function canManualAttendance(_user: SessionUser) {
  return true;
}
export function canEditAttendanceStatus(_user: SessionUser) {
  return true;
}
export function canViewAttendance(_user: SessionUser) {
  return true;
}
export function canExportAttendance(_user: SessionUser) {
  return true;
}

// ---------- SISWA ----------
export function canViewStudents(_user: SessionUser) {
  return true;
}

/** Edit identitas siswa (nama, NIS, NISN, pindah kelas) — semua role boleh. */
export function canEditStudentIdentity(_user: SessionUser) {
  return true;
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