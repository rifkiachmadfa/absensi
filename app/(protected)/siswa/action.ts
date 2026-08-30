"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import {
  canCreateStudent,
  canSetStudentStatus,
  canEditStudentIdentity,
} from "@/lib/auth/permissions";
import { studentFormSchema } from "@/lib/validations/siswa";
import {
  createStudent,
  updateStudent,
  setStudentStatus,
  getClassHomeroomTeacherId,
  getStudentClassHomeroomTeacherId,
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
    gender: formData.get("gender"),
    classId: formData.get("classId"),
    whatsappNumber: formData.get("whatsappNumber") ?? "",
  });
}

export async function createStudentAction(
  _prevState: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const actor = await requireAuth();

  const parsed = parseStudentForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const homeroomTeacherId = await getClassHomeroomTeacherId(parsed.data.classId);
  if (!canCreateStudent(actor, homeroomTeacherId)) {
    return {
      error: "Anda tidak memiliki izin untuk menambahkan siswa ke kelas ini.",
    };
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
  revalidatePath("/");
  redirect(`/siswa/${created.id}`);
}

export async function updateStudentAction(
  id: string,
  _prevState: StudentFormState,
  formData: FormData
): Promise<StudentFormState> {
  const actor = await requireAuth();

  const homeroomTeacherId = await getStudentClassHomeroomTeacherId(id);
  if (!canEditStudentIdentity(actor, homeroomTeacherId)) {
    return {
      error: "Anda tidak memiliki izin untuk mengubah identitas siswa ini.",
    };
  }

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
  revalidatePath("/");
  redirect(`/siswa/${id}`);
}

export async function setStudentStatusAction(
  id: string,
  status: "ACTIVE" | "INACTIVE"
) {
  const actor = await requireAuth();

  const homeroomTeacherId = await getStudentClassHomeroomTeacherId(id);
  if (!canSetStudentStatus(actor, homeroomTeacherId)) {
    redirect(
      `/siswa/${id}?error=${encodeURIComponent(
        "Anda tidak memiliki izin untuk mengubah status siswa ini."
      )}`
    );
  }

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