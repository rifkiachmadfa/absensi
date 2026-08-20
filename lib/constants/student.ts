// lib/constants/student.ts
// Jenis kelamin siswa -- fix 2 pilihan, tidak boleh ditambah tanpa
// perubahan schema (enum Gender di prisma/schema.prisma).
export const GENDER_OPTIONS = [
  { value: "LAKI_LAKI", label: "Laki-laki" },
  { value: "PEREMPUAN", label: "Perempuan" },
] as const;

export const GENDER_LABEL: Record<string, string> = {
  LAKI_LAKI: "Laki-laki",
  PEREMPUAN: "Perempuan",
};