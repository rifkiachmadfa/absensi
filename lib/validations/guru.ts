import { z } from "zod";

export const ROLE_VALUES = ["SUPERADMIN", "ADMIN", "GURU", "WALI_KELAS"] as const;

export const ROLE_LABEL: Record<(typeof ROLE_VALUES)[number], string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Admin",
  GURU: "Guru",
  WALI_KELAS: "Wali Kelas",
};

export const guruCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .email("Format email tidak valid")
    .toLowerCase(),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(72, "Password maksimal 72 karakter"),
  role: z.enum(ROLE_VALUES),
});

export type GuruCreateInput = z.infer<typeof guruCreateSchema>;

export const guruUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nama minimal 3 karakter")
    .max(100, "Nama maksimal 100 karakter"),
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi")
    .email("Format email tidak valid")
    .toLowerCase(),
  role: z.enum(ROLE_VALUES),
});

export type GuruUpdateInput = z.infer<typeof guruUpdateSchema>;

export const guruFilterSchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(ROLE_VALUES).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type GuruFilterInput = z.infer<typeof guruFilterSchema>;

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .max(72, "Password maksimal 72 karakter"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;