"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { academicYearFormSchema } from "@/lib/validations/tahun-ajaran";
import {
  createAcademicYear,
  setActiveAcademicYear,
  AcademicYearServiceError,
} from "@/lib/services/tahun-ajaran-service";

export type AcademicYearFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function createAcademicYearAction(
  _prevState: AcademicYearFormState,
  formData: FormData
): Promise<AcademicYearFormState> {
  const actor = await requireRole(["SUPERADMIN"]);

  const parsed = academicYearFormSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await createAcademicYear(parsed.data, actor);
  } catch (error) {
    if (error instanceof AcademicYearServiceError) {
      return { error: error.message };
    }
    console.error("createAcademicYearAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/tahun-ajaran");
  revalidatePath("/kelas");
  return { success: true };
}

export async function setActiveAcademicYearAction(id: string) {
  const actor = await requireRole(["SUPERADMIN"]);

  try {
    await setActiveAcademicYear(id, actor);
  } catch (error) {
    const message =
      error instanceof AcademicYearServiceError
        ? error.message
        : "Terjadi kesalahan, silakan coba lagi.";

    if (!(error instanceof AcademicYearServiceError)) {
      console.error("setActiveAcademicYearAction error:", error);
    }

    redirect(`/tahun-ajaran?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/tahun-ajaran");
  revalidatePath("/kelas");
  redirect("/tahun-ajaran");
}