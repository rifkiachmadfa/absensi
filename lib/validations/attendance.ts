import { z } from "zod";

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