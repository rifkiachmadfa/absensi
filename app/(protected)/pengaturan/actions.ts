"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import {
  changePasswordSchema,
  attendanceScheduleSchema,
  defaultScheduleSchema,
  holidaySchema,
} from "@/lib/validations/pengaturan";
import {
  changeOwnPassword,
  upsertAttendanceSchedule,
  updateDefaultSchedule,
  createHoliday,
  deleteHoliday,
  PengaturanServiceError,
} from "@/lib/services/pengaturan-service";

export type PengaturanFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

export async function changePasswordAction(
  _prevState: PengaturanFormState,
  formData: FormData
): Promise<PengaturanFormState> {
  const actor = await requireAuth();

  if (isRateLimited(`change-password:${actor.id}`, 5, 10 * 60_000)) {
    return {
      error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.",
    };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const supabase = await createClient();
    await changeOwnPassword(supabase, actor, parsed.data);
  } catch (error) {
    if (error instanceof PengaturanServiceError) {
      return { error: error.message };
    }
    console.error("changePasswordAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  return { success: true };
}

export async function upsertAttendanceScheduleAction(
  _prevState: PengaturanFormState,
  formData: FormData
): Promise<PengaturanFormState> {
  const actor = await requireRole(["SUPERADMIN"]);

  const parsed = attendanceScheduleSchema.safeParse({
    dayOfWeek: formData.get("dayOfWeek"),
    checkInStart: formData.get("checkInStart"),
    lateAfter: formData.get("lateAfter"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await upsertAttendanceSchedule(parsed.data, actor);
  } catch (error) {
    console.error("upsertAttendanceScheduleAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/pengaturan");
  return { success: true };
}

export async function createHolidayAction(
  _prevState: PengaturanFormState,
  formData: FormData
): Promise<PengaturanFormState> {
  const actor = await requireRole(["SUPERADMIN"]);

  const parsed = holidaySchema.safeParse({
    date: formData.get("date"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await createHoliday(parsed.data, actor);
  } catch (error) {
    if (error instanceof PengaturanServiceError) {
      return { error: error.message };
    }
    console.error("createHolidayAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/pengaturan");
  return { success: true };
}

export async function deleteHolidayAction(id: string): Promise<void> {
  const actor = await requireRole(["SUPERADMIN"]);

  try {
    await deleteHoliday(id, actor);
  } catch (error) {
    console.error("deleteHolidayAction error:", error);
  }

  revalidatePath("/pengaturan");
}

export async function updateDefaultScheduleAction(
  _prevState: PengaturanFormState,
  formData: FormData
): Promise<PengaturanFormState> {
  const actor = await requireRole(["SUPERADMIN"]);

  const parsed = defaultScheduleSchema.safeParse({
    defaultCheckInTime: formData.get("defaultCheckInTime"),
    lateAfter: formData.get("lateAfter"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await updateDefaultSchedule(parsed.data, actor);
  } catch (error) {
    console.error("updateDefaultScheduleAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/pengaturan");
  return { success: true };
}