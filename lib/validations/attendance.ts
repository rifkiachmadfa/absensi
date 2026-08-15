import { z } from "zod";
import { AttendanceStatus } from "@/app/generated/prisma/client";

export const manualStatusValues = [
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

export const dailyRecapQuerySchema = z.object({
  date: z.string().date(),
  classId: z.string().optional(),
});

export const tableQuerySchema = z.object({
  date: z.string().date(),
  classId: z.string().optional(),
  status: z.string().optional(),
});

export const scanAttendanceSchema = z.object({
  qrToken: z.string().min(1, "QR token tidak boleh kosong"),
});

export const manualAttendanceSchema = z.object({
  studentId: z.string().min(1, "Student ID tidak boleh kosong"),
});

export const manualSearchSchema = z.object({
  query: z.string().min(2, "Kata kunci minimal 2 karakter"),
});

export type ScanAttendanceInput = z.infer<typeof scanAttendanceSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;