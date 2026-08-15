import { z } from "zod";

export const classFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama kelas minimal 3 karakter")
    .max(100, "Nama kelas maksimal 100 karakter"),
  academicYearId: z.string().min(1, "Tahun ajaran wajib dipilih"),
  level: z.string().trim().max(20, "Tingkat maksimal 20 karakter").optional(),
  major: z.string().trim().max(50, "Jurusan maksimal 50 karakter").optional(),
  homeroomTeacherId: z.string().optional(),
});

export type ClassFormInput = z.infer<typeof classFormSchema>;

export const classFilterSchema = z.object({
  search: z.string().trim().optional(),
  academicYearId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type ClassFilterInput = z.infer<typeof classFilterSchema>;