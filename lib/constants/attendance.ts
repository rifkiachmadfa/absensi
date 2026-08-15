export const MANUAL_SETTABLE_STATUSES = ["SAKIT", "IZIN", "DISPENSASI", "ALPHA"] as const;

export const STATUS_LABEL: Record<string, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  SAKIT: "Sakit",
  IZIN: "Izin",
  DISPENSASI: "Dispensasi",
  ALPHA: "Alpha",
  BELUM_ABSEN: "Belum Absen",
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  HADIR: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  TERLAMBAT: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  SAKIT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  IZIN: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  DISPENSASI: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400",
  ALPHA: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  BELUM_ABSEN: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};