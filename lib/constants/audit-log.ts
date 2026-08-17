// lib/constants/audit-log.ts
// Mengikuti pola STATUS_LABEL/STATUS_BADGE_CLASS di lib/constants/attendance.ts
// (UI_RULES §4: Blue=primary, Green=success, Amber=warning, Red=danger, Gray=neutral).

export const ACTION_LABEL: Record<string, string> = {
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  LOGIN: "Login",
  LOGOUT: "Logout",
  ATTENDANCE_SCAN: "Scan Absensi",
  ATTENDANCE_MANUAL: "Absensi Manual",
  STATUS_CHANGE: "Ubah Status",
};

export const ACTION_BADGE_CLASS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  LOGIN: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  LOGOUT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  ATTENDANCE_SCAN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  ATTENDANCE_MANUAL: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  STATUS_CHANGE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};

export const ENTITY_LABEL: Record<string, string> = {
  Student: "Siswa",
  Class: "Kelas",
  AcademicYear: "Tahun Ajaran",
  Attendance: "Absensi",
  User: "Pengguna",
};