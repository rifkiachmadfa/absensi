// lib/services/pengaturan-service.ts
import "server-only";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { createClient } from "@/lib/supabase/server";
import type {
  ChangePasswordInput,
  AttendanceScheduleInput,
  DefaultScheduleInput,
  HolidayInput,
  CreateWhatsAppSenderInput,
} from "@/lib/validations/pengaturan";
import * as fonnteClient from "@/lib/services/fonnte-client";
import { SCHEDULE_CACHE_TAG } from "@/lib/services/attendance-service";

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

  // Attendance-service.ts (resolveStatus) mencache jadwal per dayOfWeek
  // selama 60 detik supaya scan tidak query AttendanceSchedule/SchoolSetting
  // berulang -- basi-kan cache itu SEKARANG supaya perubahan admin langsung
  // dipakai scan berikutnya, bukan menunggu sampai 60 detik habis sendiri.
  // updateTag() (bukan revalidateTag()) karena fungsi ini SELALU dipanggil
  // dari dalam Server Action (app/(protected)/pengaturan/actions.ts) --
  // updateTag() memberi invalidasi langsung ("read-your-own-writes") tanpa
  // perlu profile/cacheLife seperti revalidateTag() di Next.js 16.
  updateTag(SCHEDULE_CACHE_TAG);

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

  // Sama seperti upsertAttendanceSchedule() -- basi-kan cache jadwal supaya
  // perubahan default schedule langsung berlaku, bukan menunggu 60 detik.
  updateTag(SCHEDULE_CACHE_TAG);

  return setting;
}

// ============================================================
// Hari Libur — khusus SUPERADMIN (Section 11 project spec: hari libur
// non-akhir-pekan tidak boleh dihitung sebagai hari sekolah, baik untuk
// checkIn/checkOut/identify, auto-ALPHA, maupun perhitungan schoolDays di
// laporan -- lihat isNonSchoolDay()/getHolidayDateSet() di
// attendance-service.ts).
// ============================================================

export async function listHolidays() {
  return prisma.holiday.findMany({
    orderBy: { date: "asc" },
  });
}

export async function createHoliday(data: HolidayInput, actor: SessionUser) {
  const date = new Date(`${data.date}T00:00:00.000Z`);

  const existing = await prisma.holiday.findUnique({ where: { date } });
  if (existing) {
    throw new PengaturanServiceError(
      `Tanggal ${data.date} sudah terdaftar sebagai hari libur (${existing.name}).`
    );
  }

  const holiday = await prisma.holiday.create({
    data: {
      date,
      name: data.name,
      createdById: actor.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      entity: "Holiday",
      entityId: holiday.id,
      description: `Menambahkan hari libur ${data.date}: ${data.name}`,
    },
  });

  return holiday;
}

export async function deleteHoliday(id: string, actor: SessionUser) {
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) {
    throw new PengaturanServiceError("Hari libur tidak ditemukan.");
  }

  await prisma.holiday.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "DELETE",
      entity: "Holiday",
      entityId: holiday.id,
      description: `Menghapus hari libur ${holiday.date.toISOString().slice(0, 10)}: ${holiday.name}`,
    },
  });
}

// ============================================================
// Notifikasi WhatsApp — Nomor Pengirim (khusus SUPERADMIN)
// docs/whatsapp-blast.md Section 45.1/45.3/45.4/45.5. Role guard
// (requireRole(["SUPERADMIN"])) dilakukan di server action pemanggil
// (app/(protected)/pengaturan/actions.ts), bukan di sini -- fungsi di sini
// mempercayai `actor` yang diteruskan sudah lolos guard, sama seperti
// pola createHoliday/deleteHoliday di atas.
// ============================================================

// Field yang aman ditampilkan ke UI -- TIDAK PERNAH menyertakan
// fonteToken (Section 45.5: query list untuk UI tidak boleh
// select fonteToken sama sekali).
const SENDER_LIST_SELECT = {
  id: true,
  label: true,
  phoneNumber: true,
  status: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type WhatsAppSenderSummary = {
  id: string;
  label: string;
  phoneNumber: string;
  status: "PENDING_SCAN" | "CONNECTED" | "DISCONNECTED";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function listWhatsAppSenders(): Promise<WhatsAppSenderSummary[]> {
  return prisma.whatsAppSender.findMany({
    select: SENDER_LIST_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

function getFonnteAccountToken(): string {
  const token = process.env.FONNTE_ACCOUNT_TOKEN;
  if (!token) {
    // Pesan jelas untuk admin (Section 33 Error Handling), bukan crash --
    // dan TIDAK memengaruhi attendance/WhatsApp yang sudah berjalan lewat
    // sender aktif existing (Section 45.7).
    throw new PengaturanServiceError(
      "Konfigurasi Fonnte belum lengkap, hubungi developer."
    );
  }
  return token;
}

/**
 * Langkah 1 alur tambah nomor (Section 45.3.1): buat device baru di Fonnte
 * (pakai Account Token), simpan sender baru dengan status PENDING_SCAN,
 * lalu ambil QR untuk ditampilkan ke admin. Device token dari Fonnte
 * ditulis langsung ke database di sini -- TIDAK PERNAH dikembalikan ke
 * client (Section 45.1, 45.5).
 *
 * Jika device berhasil dibuat tapi pengambilan QR gagal, sender TETAP
 * disimpan (Section 45.3.1: "sender yang gagal discan tetap tersimpan,
 * bisa di-generate ulang QR-nya") -- qrImageBase64 dikembalikan null
 * dengan qrError berisi alasan, supaya admin bisa pakai "Scan Ulang".
 */
export async function createSenderAndGetQr(
  input: CreateWhatsAppSenderInput,
  actor: SessionUser
): Promise<{
  sender: WhatsAppSenderSummary;
  qrImageBase64: string | null;
  qrError?: string;
}> {
  const accountToken = getFonnteAccountToken();

  const deviceResult = await fonnteClient.addDevice({
    accountToken,
    phoneNumber: input.phoneNumber,
    label: input.label,
  });

  if (!deviceResult.ok) {
    throw new PengaturanServiceError(`Gagal membuat device di Fonnte: ${deviceResult.reason}`);
  }

  const created = await prisma.whatsAppSender.create({
    data: {
      label: input.label,
      phoneNumber: input.phoneNumber,
      fonteToken: deviceResult.deviceToken,
      status: "PENDING_SCAN",
      isActive: false,
      updatedById: actor.id,
    },
    select: SENDER_LIST_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      entity: "WhatsAppSender",
      entityId: created.id,
      description: `Menambahkan nomor pengirim WhatsApp: ${input.label} (${input.phoneNumber}), menunggu scan QR`,
    },
  });

  const qrResult = await fonnteClient.getQr({ deviceToken: deviceResult.deviceToken });

  if (!qrResult.ok) {
    return { sender: created, qrImageBase64: null, qrError: qrResult.reason };
  }

  return { sender: created, qrImageBase64: qrResult.qrImageBase64 };
}

/**
 * Generate ulang QR untuk sender yang sudah ada (PENDING_SCAN/DISCONNECTED)
 * memakai device token yang sama -- TIDAK membuat device baru di Fonnte
 * (Section 45.3.2 "Scan Ulang").
 */
export async function regenerateSenderQr(
  senderId: string
): Promise<{ qrImageBase64: string | null; qrError?: string }> {
  const sender = await prisma.whatsAppSender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new PengaturanServiceError("Nomor pengirim tidak ditemukan.");
  }
  if (sender.status === "CONNECTED") {
    throw new PengaturanServiceError("Nomor ini sudah terhubung, tidak perlu scan ulang.");
  }

  const qrResult = await fonnteClient.getQr({ deviceToken: sender.fonteToken });
  if (!qrResult.ok) {
    return { qrImageBase64: null, qrError: qrResult.reason };
  }
  return { qrImageBase64: qrResult.qrImageBase64 };
}

/**
 * Langkah polling (Section 45.3.1): dipanggil berulang dari client selagi
 * modal QR terbuka. Cek status device ke Fonnte; begitu terdeteksi
 * "connect", sender ini OTOMATIS diaktifkan (isActive = true) dan seluruh
 * sender lain yang sebelumnya aktif otomatis dinonaktifkan -- semuanya
 * dalam SATU $transaction supaya tidak pernah ada 2 sender isActive = true
 * bersamaan (Section 45.1, 45.7).
 *
 * Endpoint polling ini hanya mengembalikan status/isActive, tidak pernah
 * token (Section 45.5).
 */
export async function refreshSenderStatus(
  senderId: string,
  actor: SessionUser
): Promise<WhatsAppSenderSummary> {
  const sender = await prisma.whatsAppSender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new PengaturanServiceError("Nomor pengirim tidak ditemukan.");
  }

  const statusResult = await fonnteClient.getDeviceStatus({ deviceToken: sender.fonteToken });
  if (!statusResult.ok) {
    // Gagal cek ke Fonnte (mis. timeout) -- jangan ubah apa pun, biarkan
    // client polling lagi nanti. Bukan error yang perlu menghentikan alur.
    console.error(
      `[pengaturan-service] Gagal cek status sender ${sender.id}: ${statusResult.reason}`
    );
    return toSenderSummary(sender);
  }

  if (statusResult.status === "connect" && sender.status !== "CONNECTED") {
    const activated = await prisma.$transaction(async (tx) => {
      // Nonaktifkan seluruh sender lain yang sedang aktif (biasanya cuma
      // satu, tapi query ini aman walau lebih dari satu secara tidak
      // sengaja) SEBELUM mengaktifkan sender ini, supaya tidak pernah ada
      // 2 sender isActive = true di waktu yang sama.
      const previouslyActive = await tx.whatsAppSender.findMany({
        where: { isActive: true, id: { not: sender.id } },
      });

      if (previouslyActive.length > 0) {
        await tx.whatsAppSender.updateMany({
          where: { id: { in: previouslyActive.map((s) => s.id) } },
          data: { isActive: false, updatedById: actor.id },
        });

        for (const old of previouslyActive) {
          await tx.auditLog.create({
            data: {
              userId: actor.id,
              action: "UPDATE",
              entity: "WhatsAppSender",
              entityId: old.id,
              description: `Nomor WhatsApp ${old.label} dinonaktifkan (digantikan ${sender.label})`,
            },
          });
        }
      }

      const updated = await tx.whatsAppSender.update({
        where: { id: sender.id },
        data: { status: "CONNECTED", isActive: true, updatedById: actor.id },
        select: SENDER_LIST_SELECT,
      });

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "UPDATE",
          entity: "WhatsAppSender",
          entityId: sender.id,
          description: `Nomor WhatsApp ${sender.label} (${sender.phoneNumber}) terhubung & otomatis diaktifkan sebagai pengirim`,
        },
      });

      return updated;
    });

    return activated;
  }

  // Sender yang SEBELUMNYA sudah CONNECTED tapi sekarang terdeteksi
  // disconnect di sisi Fonnte (logout dari HP, sesi kedaluwarsa, dsb) --
  // bukan bagian eksplisit dari alur "Tambah Nomor" di Section 45.3.1,
  // tapi konsisten dengan definisi status DISCONNECTED di Section 45.1
  // ("pernah connect, sekarang putus"). Ditandai di sini supaya dashboard
  // sender tidak menampilkan status yang sudah basi.
  if (statusResult.status === "disconnect" && sender.status === "CONNECTED") {
    const updated = await prisma.whatsAppSender.update({
      where: { id: sender.id },
      data: { status: "DISCONNECTED", isActive: false, updatedById: actor.id },
      select: SENDER_LIST_SELECT,
    });

    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        entity: "WhatsAppSender",
        entityId: sender.id,
        description: `Nomor WhatsApp ${sender.label} (${sender.phoneNumber}) terputus (terdeteksi saat cek status)`,
      },
    });

    return updated;
  }

  // Masih PENDING_SCAN & belum connect -- tidak ada perubahan, client
  // akan polling lagi.
  return toSenderSummary(sender);
}

function toSenderSummary(sender: {
  id: string;
  label: string;
  phoneNumber: string;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WhatsAppSenderSummary {
  return {
    id: sender.id,
    label: sender.label,
    phoneNumber: sender.phoneNumber,
    status: sender.status as WhatsAppSenderSummary["status"],
    isActive: sender.isActive,
    createdAt: sender.createdAt,
    updatedAt: sender.updatedAt,
  };
}

/**
 * Tombol "Putuskan" (Section 45.3.2). Diizinkan untuk sender CONNECTED
 * MANAPUN, termasuk yang sedang aktif -- sengaja lebih longgar daripada
 * aturan hapus (Section 45.7): "putuskan" dipakai saat device bermasalah
 * dan admin perlu segera menandainya, bukan operasi destruktif seperti
 * hapus data. Jika sender yang diputuskan sedang aktif, sistem otomatis
 * berakhir TANPA sender aktif sampai admin scan/aktifkan nomor lain --
 * WhatsApp akan di-skip (attendance tetap SUCCESS, Section 7/45.2).
 */
export async function disconnectSender(
  senderId: string,
  actor: SessionUser
): Promise<WhatsAppSenderSummary> {
  const sender = await prisma.whatsAppSender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new PengaturanServiceError("Nomor pengirim tidak ditemukan.");
  }
  if (sender.status !== "CONNECTED") {
    throw new PengaturanServiceError("Nomor ini belum terhubung.");
  }

  const result = await fonnteClient.disconnectDevice({ deviceToken: sender.fonteToken });
  if (!result.ok) {
    throw new PengaturanServiceError(`Gagal memutuskan nomor di Fonnte: ${result.reason}`);
  }

  const updated = await prisma.whatsAppSender.update({
    where: { id: sender.id },
    data: { status: "DISCONNECTED", isActive: false, updatedById: actor.id },
    select: SENDER_LIST_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entity: "WhatsAppSender",
      entityId: sender.id,
      description: `Memutuskan nomor pengirim WhatsApp: ${sender.label} (${sender.phoneNumber})`,
    },
  });

  return updated;
}

/**
 * Hard delete (Section 45.1: WhatsAppSender adalah data konfigurasi, bukan
 * data historis absensi, jadi tidak tunduk aturan soft-delete Section 3.3).
 * DITOLAK jika sender sedang isActive -- harus diputuskan/diganti aktifnya
 * dulu. Jika masih CONNECTED saat dihapus, panggil Fonnte Disconnect Device
 * lebih dulu (best-effort: kalau panggilan itu gagal, penghapusan baris
 * konfigurasi TETAP dilanjutkan -- baris ini murni data kita, dan
 * memblokir penghapusan hanya karena Fonnte sedang bermasalah akan
 * menjebak admin; device yang menggantung di Fonnte harus diberesi manual
 * lewat dashboard Fonnte pada kasus itu).
 */
export async function deleteSender(senderId: string, actor: SessionUser): Promise<void> {
  const sender = await prisma.whatsAppSender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new PengaturanServiceError("Nomor pengirim tidak ditemukan.");
  }
  if (sender.isActive) {
    throw new PengaturanServiceError(
      "Nomor ini sedang aktif. Putuskan atau aktifkan nomor lain terlebih dahulu sebelum menghapus."
    );
  }

  if (sender.status === "CONNECTED") {
    const result = await fonnteClient.disconnectDevice({ deviceToken: sender.fonteToken });
    if (!result.ok) {
      console.error(
        `[pengaturan-service] Gagal disconnect device Fonnte saat hapus sender ${sender.id}: ${result.reason}`
      );
    }
  }

  await prisma.whatsAppSender.delete({ where: { id: sender.id } });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "DELETE",
      entity: "WhatsAppSender",
      entityId: sender.id,
      description: `Menghapus nomor pengirim WhatsApp: ${sender.label} (${sender.phoneNumber})`,
    },
  });
}