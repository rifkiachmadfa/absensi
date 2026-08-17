"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import {
  guruCreateSchema,
  guruUpdateSchema,
  resetPasswordSchema,
} from "@/lib/validations/guru";
import {
  createGuru,
  updateGuru,
  setGuruStatus,
  resetGuruPassword,
  GuruServiceError,
} from "@/lib/services/guru-service";

export type GuruFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type ResetPasswordState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

function parseGuruCreateForm(formData: FormData) {
  return guruCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
}

function parseGuruUpdateForm(formData: FormData) {
  return guruUpdateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
}

export async function createGuruAction(
  _prevState: GuruFormState,
  formData: FormData
): Promise<GuruFormState> {
  // Sementara: yang boleh mengelola akun guru/pengguna adalah ADMIN & SUPERADMIN.
  // Aturan lebih rinci per role akan disesuaikan menyusul.
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const parsed = parseGuruCreateForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let created;
  try {
    created = await createGuru(parsed.data, actor);
  } catch (error) {
    if (error instanceof GuruServiceError) {
      return { error: error.message };
    }
    console.error("createGuruAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/guru");
  redirect(`/guru/${created.id}`);
}

export async function updateGuruAction(
  id: string,
  _prevState: GuruFormState,
  formData: FormData
): Promise<GuruFormState> {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const parsed = parseGuruUpdateForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateGuru(id, parsed.data, actor);
  } catch (error) {
    if (error instanceof GuruServiceError) {
      return { error: error.message };
    }
    console.error("updateGuruAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/guru");
  revalidatePath(`/guru/${id}`);
  redirect(`/guru/${id}`);
}

export async function setGuruStatusAction(id: string, status: "ACTIVE" | "INACTIVE") {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  try {
    await setGuruStatus(id, status, actor);
  } catch (error) {
    const message =
      error instanceof GuruServiceError
        ? error.message
        : "Terjadi kesalahan, silakan coba lagi.";

    if (!(error instanceof GuruServiceError)) {
      console.error("setGuruStatusAction error:", error);
    }

    redirect(`/guru/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/guru");
  revalidatePath(`/guru/${id}`);
  redirect(`/guru/${id}`);
}

export async function resetGuruPasswordAction(
  id: string,
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const actor = await requireRole(["SUPERADMIN", "ADMIN"]);

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await resetGuruPassword(id, parsed.data.password, actor);
  } catch (error) {
    if (error instanceof GuruServiceError) {
      return { error: error.message };
    }
    console.error("resetGuruPasswordAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  return { success: true };
}