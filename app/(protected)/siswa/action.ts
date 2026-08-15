"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { studentFormSchema } from "@/lib/validations/siswa";
import {
  createStudent,
  updateStudent,
  setStudentStatus,
  StudentServiceError,
} from "@/lib/services/siswa-service";

export type StudentFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

function parseStudentForm(formData: FormData) {
  return studentFormSchema.safeParse({
    nis: formData.get("nis"),
    nisn: formData.get("nisn") ?? "",
    name: formData.get("name"),
    classId: formData.get("classId"),
  });
}

export async function createStudentAction(
  _prevState: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const parsed = parseStudentForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let created;
  try {
    created = await createStudent(parsed.data, actor);
  } catch (error) {
    if (error instanceof StudentServiceError) {
      return { error: error.message };
    }
    console.error("createStudentAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/siswa");
  redirect(`/siswa/${created.id}`);
}

export async function updateStudentAction(
  id: string,
  _prevState: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const parsed = parseStudentForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateStudent(id, parsed.data, actor);
  } catch (error) {
    if (error instanceof StudentServiceError) {
      return { error: error.message };
    }
    console.error("updateStudentAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/siswa");
  revalidatePath(`/siswa/${id}`);
  redirect(`/siswa/${id}`);
}

export async function setStudentStatusAction(
  id: string,
  status: "ACTIVE" | "INACTIVE"
) {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  try {
    await setStudentStatus(id, status, actor);
  } catch (error) {
    const message =
      error instanceof StudentServiceError
        ? error.message
        : "Terjadi kesalahan, silakan coba lagi.";

    if (!(error instanceof StudentServiceError)) {
      console.error("setStudentStatusAction error:", error);
    }

    redirect(`/siswa/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/siswa");
  revalidatePath(`/siswa/${id}`);
  redirect(`/siswa/${id}`);
}