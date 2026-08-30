import { z } from "zod";

export const studentFormSchema = z.object({
  nis: z
    .string()
    .trim()
    .min(3, "NIS minimal 3 karakter")
    .max(30, "NIS maksimal 30 karakter"),
  nisn: z
    .string()
    .trim()
    .max(20, "NISN maksimal 20 karakter")
    .optional(),
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  gender: z.enum(["LAKI_LAKI", "PEREMPUAN"], {
    message: "Jenis kelamin wajib dipilih",
  }),
  classId: z.string().min(1, "Kelas wajib dipilih"),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^[0-9+ -]{9,20}$/, "Format nomor WhatsApp tidak valid")
    .optional()
    .or(z.literal("")),
});

export type StudentFormInput = z.infer<typeof studentFormSchema>;

export const studentFilterSchema = z.object({
  search: z.string().trim().optional(),
  classId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type StudentFilterInput = z.infer<typeof studentFilterSchema>;