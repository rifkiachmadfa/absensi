// lib/services/whatsapp-service.ts
import "server-only";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/services/fonnte-client";
import { STATUS_LABEL } from "@/lib/constants/attendance";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import type { AttendanceStatus } from "@/app/generated/prisma/client";

// Notifikasi WhatsApp orang tua/wali murid saat check-in/check-out
// (docs/whatsapp-blast.md, source of truth untuk fitur ini).
//
// PRINSIP UTAMA (Section 7): kegagalan pengiriman WhatsApp TIDAK BOLEH
// menyebabkan proses absensi gagal. Fungsi di file ini SENGAJA tidak pernah
// throw -- semua kegagalan (nomor kosong/invalid, tidak ada sender aktif,
// Fonnte timeout/error) ditangani di dalam dan hanya di-log. Caller
// (attendance-service.ts) TETAP wajib membungkus pemanggilan dengan
// try/catch sebagai lapisan pertahanan tambahan (Section 8.1), tapi secara
// desain seharusnya tidak pernah ada yang perlu ditangkap di sana.
//
// Tidak ada retry otomatis, tidak ada queue, tidak ada Promise.all() untuk
// blast paralel (Section 10 & 11) -- satu event attendance = maksimal satu
// panggilan Fonnte.

const SCHOOL_NAME = "SMK Yadika Tanjungsari";
const TIMEZONE = "Asia/Jakarta";

// Update Section 14: baris disclaimer yang muncul di SEMUA pesan (CHECK_IN
// maupun CHECK_OUT), menandakan pesan ini otomatis dari sistem -- bukan
// diketik manual oleh guru/admin -- supaya orang tua/wali tidak membalas
// pesan ini mengharapkan respons manusia.
const AUTO_MESSAGE_NOTE = "Pesan ini dikirim otomatis oleh sistem absensi sekolah.";

export type NotifyAttendanceParams =
  | {
      type: "CHECK_IN";
      studentName: string;
      className: string;
      whatsappNumber: string | null | undefined;
      time: string; // ISO string, hasil AttendanceService (server time)
      status: AttendanceStatus;
    }
  | {
      type: "CHECK_OUT";
      studentName: string;
      className: string;
      whatsappNumber: string | null | undefined;
      time: string; // ISO string, hasil AttendanceService (server time)
    };

/**
 * Kirim notifikasi WhatsApp untuk satu event check-in/check-out yang SUDAH
 * berhasil (result.type === "SUCCESS") di AttendanceService. Jangan panggil
 * untuk event lain (ALREADY_CHECKED_IN, STUDENT_NOT_FOUND, SCHOOL_CLOSED,
 * dll) -- lihat matrix Section 35.
 *
 * Best-effort: selalu resolve, tidak pernah reject.
 */
export async function notifyAttendance(params: NotifyAttendanceParams): Promise<void> {
  try {
    const target = normalizePhoneNumber(params.whatsappNumber);
    if (!target) {
      // Nomor kosong/whitespace/invalid -- bukan error, skip diam-diam
      // (Section 12.1 & 13.1), cukup warning untuk observability server.
      console.warn(
        `[WhatsAppService] Skip notifikasi ${params.type} untuk ${params.studentName}: nomor WhatsApp kosong/tidak valid.`
      );
      return;
    }

    // Sender aktif diambil di sini, sebelum membangun request -- satu query
    // ringan, bukan N+1, tidak menyentuh tabel Student/Attendance yang
    // datanya sudah tersedia dari AttendanceService (Section 18.1 & 45.2).
    const sender = await prisma.whatsAppSender.findFirst({
      where: { isActive: true },
      select: { fonteToken: true },
    });

    if (!sender) {
      console.warn(
        `[WhatsAppService] Skip notifikasi ${params.type} untuk ${params.studentName}: tidak ada nomor pengirim WhatsApp yang aktif.`
      );
      return;
    }

    const message = buildMessage(params);

    const result = await sendMessage({
      deviceToken: sender.fonteToken,
      target,
      message,
    });

    if (!result.ok) {
      console.error(
        `[WhatsAppService] Gagal mengirim notifikasi ${params.type} untuk ${params.studentName}: ${result.reason}`
      );
    }
  } catch (error) {
    // Lapisan pertahanan terakhir -- seharusnya tidak pernah sampai sini
    // karena sendMessage() sendiri sudah menangkap errornya masing-masing,
    // tapi tetap dijaga supaya notifyAttendance() BENAR-BENAR tidak pernah
    // throw ke caller (Section 7 & 8).
    console.error(
      `[WhatsAppService] Error tak terduga saat notifikasi ${params.type} untuk ${params.studentName}:`,
      error
    );
  }
}

// ============================================================
// Template pesan (Section 14) -- hardcoded untuk versi pertama, belum
// dapat diedit lewat UI.
// ============================================================

function buildMessage(params: NotifyAttendanceParams): string {
  const jam = formatJakartaTime(params.time);

  if (params.type === "CHECK_IN") {
    // STATUS_LABEL adalah satu-satunya sumber label status (Section 16) --
    // jangan buat mapping status baru di sini.
    const statusLabel = STATUS_LABEL[params.status] ?? params.status;
    const lines = [
      "Assalamu'alaikum, Bapak/Ibu Wali Murid.",
      "",
      `Ananda ${params.studentName} (${params.className}) telah tiba di sekolah pada ${jam} WIB`,
      `dengan status ${statusLabel}.`,
    ];

    // Update Section 14: khusus status TERLAMBAT, tambahkan satu baris yang
    // meminta orang tua/wali menanyakan alasan keterlambatan sekaligus
    // mengingatkan supaya tidak terulang -- status lain (HADIR/SAKIT/dll)
    // tidak berubah dari template sebelumnya.
    if (params.status === "TERLAMBAT") {
      lines.push(
        "",
        "Mohon Bapak/Ibu menanyakan alasan keterlambatan Ananda hari ini, dan mengingatkan agar besok tidak terlambat lagi. Terima kasih."
      );
    }

    lines.push("", `— ${SCHOOL_NAME}`, AUTO_MESSAGE_NOTE);
    return lines.join("\n");
  }

  return [
    "Assalamu'alaikum, Bapak/Ibu Wali Murid.",
    "",
    `Ananda ${params.studentName} (${params.className}) telah pulang sekolah pada ${jam} WIB.`,
    "",
    // Update Section 14: baris penutup check-out -- menegaskan bahwa
    // tanggung jawab sudah kembali ke orang tua/wali setelah keluar
    // gerbang sekolah, dan meminta konfirmasi sampai rumah.
    "Ananda telah diserahkan kembali kepada orang tua/wali. Mohon dipastikan Ananda sampai di rumah dengan selamat.",
    "",
    `— ${SCHOOL_NAME}`,
    AUTO_MESSAGE_NOTE,
  ].join("\n");
}

// Format HH:mm WIB (Section 17.1), SELALU dari Asia/Jakarta -- tidak boleh
// bergantung pada timezone server deployment.
function formatJakartaTime(isoTime: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoTime));
}