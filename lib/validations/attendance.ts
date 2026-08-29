import { z } from "zod";
import { AttendanceStatus } from "@/app/generated/prisma/client";

export const manualStatusValues = [
  AttendanceStatus.HADIR,
  AttendanceStatus.TERLAMBAT,
  AttendanceStatus.SAKIT,
  AttendanceStatus.IZIN,
  AttendanceStatus.DISPENSASI,
  AttendanceStatus.ALPHA,
] as const;

export const setStatusSchema = z.object({
  studentId: z.string().min(1),
  date: z.string().date(), // "YYYY-MM-DD"
  status: z.enum(manualStatusValues as unknown as [string, ...string[]]),
});

export const updateStatusSchema = z.object({
  status: z.enum(manualStatusValues as unknown as [string, ...string[]]),
});

// Perubahan status komunal (banyak siswa sekaligus) dari tabel /absensi.
// Batas 500 sesuai estimasi beban maksimal siswa pada Section 38 spesifikasi.
export const bulkSetStatusSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu siswa").max(500),
  date: z.string().date(), // "YYYY-MM-DD"
  status: z.enum(manualStatusValues as unknown as [string, ...string[]]),
});

export const dailyRecapQuerySchema = z.object({
  date: z.string().date(),
  classId: z.string().optional(),
});

export const tableQuerySchema = z.object({
  date: z.string().date(),
  classId: z.string().optional(),
  status: z.string().optional(),
  // Targeted refresh: hanya ambil baris untuk studentId ini (dipakai UI
  // /absensi setelah ubah status, supaya tidak perlu reload seluruh tabel).
  studentIds: z.array(z.string().min(1)).optional(),
});

// Semua status yang boleh dipilih guru/petugas saat konfirmasi kehadiran
// (Section 10). HADIR/TERLAMBAT termasuk karena sekarang dipilih manual,
// bukan lagi ditentukan otomatis oleh sistem berdasarkan jam server.
export const attendanceStatusValues = [
  AttendanceStatus.HADIR,
  AttendanceStatus.TERLAMBAT,
  AttendanceStatus.SAKIT,
  AttendanceStatus.IZIN,
  AttendanceStatus.DISPENSASI,
  AttendanceStatus.ALPHA,
] as const;

// Langkah 1 (identifikasi, TIDAK menyimpan apa pun):
export const scanAttendanceSchema = z.object({
  qrToken: z.string().min(1, "QR token tidak boleh kosong"),
});

export const manualAttendanceSchema = z.object({
  studentId: z.string().min(1, "Student ID tidak boleh kosong"),
});

// Langkah 2 (konfirmasi kehadiran, status dipilih manual oleh petugas):
export const confirmAttendanceSchema = z.object({
  studentId: z.string().min(1, "Student ID tidak boleh kosong"),
  status: z.enum(attendanceStatusValues as unknown as [string, ...string[]]),
  method: z.enum(["QR", "MANUAL"]),
});

export const manualSearchSchema = z.object({
  query: z.string().min(2, "Kata kunci minimal 2 karakter"),
});

export type ScanAttendanceInput = z.infer<typeof scanAttendanceSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
export type ConfirmAttendanceInput = z.infer<typeof confirmAttendanceSchema>;