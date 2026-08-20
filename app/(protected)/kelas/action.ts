"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { classFormSchema } from "@/lib/validations/kelas";
import {
  createClass,
  updateClass,
  setClassStatus,
  ClassServiceError,
} from "@/lib/services/kelas-service";

export type ClassFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

function parseClassForm(formData: FormData) {
  return classFormSchema.safeParse({
    name: formData.get("name"),
    academicYearId: formData.get("academicYearId"),
    level: formData.get("level") ?? "",
    major: formData.get("major") ?? "",
    homeroomTeacherId: formData.get("homeroomTeacherId") ?? "",
  });
}

export async function createClassAction(
  _prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const parsed = parseClassForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let created;
  try {
    created = await createClass(parsed.data, actor);
  } catch (error) {
    if (error instanceof ClassServiceError) {
      return { error: error.message };
    }
    console.error("createClassAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }
  revalidatePath("/kelas");
  revalidatePath("/");
  redirect(`/kelas/${created.id}`);
}

export async function updateClassAction(
  id: string,
  _prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const parsed = parseClassForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateClass(id, parsed.data, actor);
  } catch (error) {
    if (error instanceof ClassServiceError) {
      return { error: error.message };
    }
    console.error("updateClassAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/kelas");
  revalidatePath(`/kelas/${id}`);
  revalidatePath("/");
  redirect(`/kelas/${id}`);
}

export async function setClassStatusAction(
  id: string,
  status: "ACTIVE" | "INACTIVE"
) {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  try {
    await setClassStatus(id, status, actor);
  } catch (error) {
    const message =
      error instanceof ClassServiceError
        ? error.message
        : "Terjadi kesalahan, silakan coba lagi.";

    if (!(error instanceof ClassServiceError)) {
      console.error("setClassStatusAction error:", error);
    }

    redirect(`/kelas/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/kelas");
  revalidatePath(`/kelas/${id}`);
  revalidatePath("/");
  redirect(`/kelas/${id}`);
}