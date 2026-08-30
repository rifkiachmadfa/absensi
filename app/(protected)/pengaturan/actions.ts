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
  createWhatsAppSenderSchema,
} from "@/lib/validations/pengaturan";
import {
  changeOwnPassword,
  upsertAttendanceSchedule,
  updateDefaultSchedule,
  createHoliday,
  deleteHoliday,
  createSenderAndGetQr,
  regenerateSenderQr,
  refreshSenderStatus,
  disconnectSender,
  deleteSender,
  PengaturanServiceError,
  type WhatsAppSenderSummary,
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

// ============================================================
// Notifikasi WhatsApp — Nomor Pengirim (khusus SUPERADMIN)
// docs/whatsapp-blast.md Section 45.3.2: "Setiap server action ...
// memanggil requireRole(["SUPERADMIN"]) di awal -- supaya akses langsung
// lewat request tidak bisa bypass UI." ADMIN/GURU/WALI_KELAS tidak boleh
// memanggil action-action ini sama sekali (bukan cuma read-only).
// ============================================================

export type WhatsAppSenderFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  sender?: WhatsAppSenderSummary;
  qrImageBase64?: string | null;
  qrError?: string;
};

/**
 * Langkah 1 alur "Tambah Nomor" (Section 45.3.1). Dipakai lewat
 * useActionState di whatsapp-sender-qr-dialog.tsx -- hasil (sender +
 * QR image) dipakai untuk pindah dari form input ke tampilan QR.
 */
export async function createWhatsAppSenderAction(
  _prevState: WhatsAppSenderFormState,
  formData: FormData
): Promise<WhatsAppSenderFormState> {
  const actor = await requireRole(["SUPERADMIN"]);

  const parsed = createWhatsAppSenderSchema.safeParse({
    label: formData.get("label"),
    phoneNumber: formData.get("phoneNumber"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { sender, qrImageBase64, qrError } = await createSenderAndGetQr(
      parsed.data,
      actor
    );
    revalidatePath("/pengaturan");
    return { success: true, sender, qrImageBase64, qrError };
  } catch (error) {
    if (error instanceof PengaturanServiceError) {
      return { error: error.message };
    }
    console.error("createWhatsAppSenderAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }
}

/**
 * "Scan Ulang" (Section 45.3.2) -- generate ulang QR untuk sender yang
 * sudah ada (PENDING_SCAN/DISCONNECTED) memakai device token yang sama.
 * Dipanggil langsung dari client (bukan lewat <form>), karena dipicu dari
 * tombol di dalam dialog QR yang sama, bukan submit form baru.
 */
export async function regenerateSenderQrAction(
  senderId: string
): Promise<{ qrImageBase64?: string | null; qrError?: string; error?: string }> {
  await requireRole(["SUPERADMIN"]);

  try {
    return await regenerateSenderQr(senderId);
  } catch (error) {
    if (error instanceof PengaturanServiceError) {
      return { error: error.message };
    }
    console.error("regenerateSenderQrAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }
}

/**
 * Langkah polling (Section 45.3.1) -- dipanggil berulang dari client
 * selagi modal QR terbuka. Hanya mengembalikan status/isActive terbaru,
 * tidak pernah token (Section 45.5).
 */
export async function refreshSenderStatusAction(
  senderId: string
): Promise<{ sender?: WhatsAppSenderSummary; error?: string }> {
  const actor = await requireRole(["SUPERADMIN"]);

  try {
    const sender = await refreshSenderStatus(senderId, actor);
    revalidatePath("/pengaturan");
    return { sender };
  } catch (error) {
    if (error instanceof PengaturanServiceError) {
      return { error: error.message };
    }
    console.error("refreshSenderStatusAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }
}

/**
 * Tombol "Putuskan" (Section 45.3.2) -- diizinkan untuk sender CONNECTED
 * manapun, termasuk yang sedang aktif.
 */
export async function disconnectSenderAction(
  senderId: string
): Promise<{ error?: string }> {
  const actor = await requireRole(["SUPERADMIN"]);

  try {
    await disconnectSender(senderId, actor);
  } catch (error) {
    if (error instanceof PengaturanServiceError) {
      return { error: error.message };
    }
    console.error("disconnectSenderAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/pengaturan");
  return {};
}

/**
 * Hapus nomor pengirim (Section 45.1) -- ditolak di service layer kalau
 * sender sedang isActive, dengan pesan jelas (bukan error database
 * mentah, Section 33).
 */
export async function deleteSenderAction(
  senderId: string
): Promise<{ error?: string }> {
  const actor = await requireRole(["SUPERADMIN"]);

  try {
    await deleteSender(senderId, actor);
  } catch (error) {
    if (error instanceof PengaturanServiceError) {
      return { error: error.message };
    }
    console.error("deleteSenderAction error:", error);
    return { error: "Terjadi kesalahan, silakan coba lagi." };
  }

  revalidatePath("/pengaturan");
  return {};
}