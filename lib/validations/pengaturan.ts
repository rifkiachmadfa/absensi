import { z } from "zod";

// ============================================================
// Akun Saya — ganti password (semua role)
// ============================================================

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter.")
      .max(72, "Password baru maksimal 72 karakter."),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok dengan password baru.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Password baru tidak boleh sama dengan password saat ini.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================================
// Jadwal Absensi — khusus SUPERADMIN
// ============================================================

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam harus HH:MM, contoh: 07:00");

export const attendanceScheduleSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    checkInStart: timeSchema,
    lateAfter: timeSchema,
    isActive: z.coerce.boolean().default(true),
  })
  .refine((data) => data.checkInStart < data.lateAfter, {
    message: "Batas terlambat harus lebih besar dari jam mulai absen.",
    path: ["lateAfter"],
  });

export type AttendanceScheduleInput = z.infer<typeof attendanceScheduleSchema>;

// Fallback default (dipakai resolveStatus() saat hari tsb tidak punya
// AttendanceSchedule aktif). Field lain di SchoolSetting (nama sekolah, dsb)
// TIDAK diubah lewat form ini agar scope tetap sesuai permintaan.
export const defaultScheduleSchema = z
  .object({
    defaultCheckInTime: timeSchema,
    lateAfter: timeSchema,
  })
  .refine((data) => data.defaultCheckInTime < data.lateAfter, {
    message: "Batas terlambat harus lebih besar dari jam mulai absen.",
    path: ["lateAfter"],
  });

export type DefaultScheduleInput = z.infer<typeof defaultScheduleSchema>;

// ============================================================
// Hari Libur — khusus SUPERADMIN
// ============================================================

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const holidaySchema = z.object({
  date: isoDateSchema,
  name: z
    .string()
    .trim()
    .min(1, "Nama hari libur wajib diisi.")
    .max(150, "Nama hari libur maksimal 150 karakter."),
});

export type HolidayInput = z.infer<typeof holidaySchema>;