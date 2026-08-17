// lib/services/pengaturan-service.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { createClient } from "@/lib/supabase/server";
import type {
  ChangePasswordInput,
  AttendanceScheduleInput,
  DefaultScheduleInput,
} from "@/lib/validations/pengaturan";

export class PengaturanServiceError extends Error {}

// Placeholder dipakai HANYA saat SchoolSetting belum pernah dibuat sama
// sekali dan admin mengubah jadwal default sebelum mengisi profil sekolah.
// Konsisten dengan fallback yang sudah dipakai di kartu-siswa/page.tsx.
const SCHOOL_NAME_PLACEHOLDER = "Sistem Absensi Siswa";

// Index 0 & 6 (Minggu/Sabtu) sengaja tidak dipakai -- sekolah hanya masuk
// Senin-Jumat, konsisten dengan konvensi dayOfWeek JS Date#getDay() yang
// sudah dipakai getJakartaNow() di attendance-service.ts (0=Minggu..6=Sabtu).
const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const SCHOOL_DAYS = [1, 2, 3, 4, 5]; // Senin - Jumat

// ============================================================
// Akun Saya — ganti password
// ============================================================

/**
 * Ganti password akun sendiri. Password lama diverifikasi dulu lewat
 * signInWithPassword sebelum updateUser dipanggil, agar orang yang
 * kebetulan memegang sesi yang sedang login (mis. lupa logout di
 * komputer bersama) tidak bisa mengganti password tanpa tahu password
 * lamanya.
 */
export async function changeOwnPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actor: SessionUser,
  input: ChangePasswordInput
) {
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: actor.email,
    password: input.currentPassword,
  });

  if (verifyError) {
    throw new PengaturanServiceError("Password saat ini salah.");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (updateError) {
    throw new PengaturanServiceError(
      "Gagal mengubah password, silakan coba lagi."
    );
  }

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "User",
      entityId: actor.id,
      description: "Mengubah password akun sendiri",
    },
  });
}

// ============================================================
// Jadwal Absensi — khusus SUPERADMIN
// ============================================================

export async function listAttendanceSchedules() {
  const schedules = await prisma.attendanceSchedule.findMany({
    where: { dayOfWeek: { in: SCHOOL_DAYS } },
    orderBy: { dayOfWeek: "asc" },
  });

  // Kembalikan 5 slot (Senin-Jumat) walaupun belum semua hari punya
  // record di database, supaya UI selalu tampil lengkap satu minggu sekolah.
  return SCHOOL_DAYS.map((dayOfWeek) => {
    const existing = schedules.find((s) => s.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      checkInStart: existing?.checkInStart ?? null,
      lateAfter: existing?.lateAfter ?? null,
      isActive: existing?.isActive ?? false,
    };
  });
}

export async function upsertAttendanceSchedule(
  data: AttendanceScheduleInput,
  actor: SessionUser
) {
  if (!SCHOOL_DAYS.includes(data.dayOfWeek)) {
    throw new PengaturanServiceError(
      "Jadwal absensi hanya berlaku untuk hari Senin-Jumat."
    );
  }

  const dayName = DAY_NAMES[data.dayOfWeek];

  const schedule = await prisma.attendanceSchedule.upsert({
    where: { dayOfWeek: data.dayOfWeek },
    update: {
      checkInStart: data.checkInStart,
      lateAfter: data.lateAfter,
      isActive: data.isActive,
    },
    create: {
      dayOfWeek: data.dayOfWeek,
      checkInStart: data.checkInStart,
      lateAfter: data.lateAfter,
      isActive: data.isActive,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "AttendanceSchedule",
      entityId: schedule.id,
      description: data.isActive
        ? `Mengatur jadwal absensi ${dayName}: mulai ${data.checkInStart}, batas terlambat ${data.lateAfter}`
        : `Menonaktifkan jadwal absensi khusus ${dayName} (kembali ke jadwal default)`,
    },
  });

  return schedule;
}

export async function getDefaultSchedule() {
  const setting = await prisma.schoolSetting.findFirst();
  return {
    defaultCheckInTime: setting?.defaultCheckInTime ?? "07:00",
    lateAfter: setting?.lateAfter ?? "07:15",
  };
}

export async function updateDefaultSchedule(
  data: DefaultScheduleInput,
  actor: SessionUser
) {
  const existing = await prisma.schoolSetting.findFirst();

  const setting = existing
    ? await prisma.schoolSetting.update({
        where: { id: existing.id },
        data: {
          defaultCheckInTime: data.defaultCheckInTime,
          lateAfter: data.lateAfter,
        },
      })
    : await prisma.schoolSetting.create({
        data: {
          schoolName: SCHOOL_NAME_PLACEHOLDER,
          defaultCheckInTime: data.defaultCheckInTime,
          lateAfter: data.lateAfter,
        },
      });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "SchoolSetting",
      entityId: setting.id,
      description: `Mengatur jadwal absensi default: mulai ${data.defaultCheckInTime}, batas terlambat ${data.lateAfter}`,
    },
  });

  return setting;
}