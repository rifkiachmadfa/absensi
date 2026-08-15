import { z } from "zod";

export const academicYearFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "Format harus YYYY/YYYY, contoh: 2026/2027"),
  })
  .refine(
    (data) => {
      const [start, end] = data.name.split("/").map(Number);
      return end === start + 1;
    },
    {
      message: "Tahun kedua harus tahun pertama + 1, contoh: 2026/2027",
      path: ["name"],
    }
  );

export type AcademicYearFormInput = z.infer<typeof academicYearFormSchema>;