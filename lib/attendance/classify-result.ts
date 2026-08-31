// lib/attendance/classify-result.ts

// Diekstrak dari scan-dialog.tsx & scan-dialog-pulang.tsx supaya logic
// "ubah response AttendanceService menjadi label/warna/toast" hanya ada di
// SATU tempat (Section 39 Development Rules: "Tidak membuat duplicate
// service"). Dipakai oleh:
// - ScanDialog / ScanDialogPulang (mode kamera & scanner fisik dalam dialog)
// - Halaman /absensi/scanner-fisik (banyak scanner fisik sekaligus)
//
// File ini TIDAK menentukan status HADIR/TERLAMBAT/dsb -- itu tetap 100%
// keputusan AttendanceService di server (Section 26). Di sini hanya
// menerjemahkan response yang SUDAH final menjadi tampilan.

import { toast } from "sonner";
import { STATUS_LABEL } from "@/lib/constants/attendance";
import type { ScanQueueStatus } from "@/components/absensi/use-scan-queue";
import type {
  AttendanceCheckInResponse,
  AttendanceCheckOutResponse,
  AttendanceIdentifyResponse,
  AttendanceIdentifyPulangResponse,
} from "@/lib/types/attendance";

export function jamJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

type ClassifiedResult = {
  status: ScanQueueStatus;
  label: string;
  detail?: string;
  meta?: Record<string, string>;
};

// Menerjemahkan hasil fase 1 (identify/identifyPulang, read-only -- lihat
// /api/absensi/scan/identify & /api/absensi/scan-pulang/identify) menjadi
// { label, meta } yang siap dipakai use-scan-queue.ts untuk menampilkan
// Nama/Kelas SEGERA, SEBELUM fase 2 (checkIn()/checkOut(), yang benar-benar
// menyimpan) selesai. `null` berarti siswa belum bisa diidentifikasi sama
// sekali (STUDENT_NOT_FOUND/SCHOOL_CLOSED, atau request identify gagal) --
// dalam kasus ini UI TETAP menunggu hasil fase 2 seperti biasa, karena
// hanya fase 2 yang menentukan hasil akhir (Section 3.1, 3.2, 26).
// STUDENT_INACTIVE sengaja TIDAK menyertakan className (siswa nonaktif
// tidak selalu masih tergabung ke kelasnya di response ini).
export function identifiedMeta(
  result: AttendanceIdentifyResponse | AttendanceIdentifyPulangResponse
): { label: string; meta?: Record<string, string> } | null {
  if (!("student" in result)) return null;
  const meta = "className" in result.student ? { className: result.student.className } : undefined;
  return { label: result.student.name, meta };
}

// ---------- Absensi Masuk (check-in) ----------

export function classifyCheckInResult(result: AttendanceCheckInResponse): ClassifiedResult {
  if (result.type === "SUCCESS") {
    return {
      status: "success",
      label: result.student.name,
      detail: `${STATUS_LABEL[result.status] ?? result.status} · ${jamJakarta(result.time)}`,
      meta: { className: result.student.className },
    };
  }
  if (result.type === "ALREADY_CHECKED_IN") {
    return {
      status: "warning",
      label: result.student.name,
      detail: `Sudah absen · ${jamJakarta(result.time)}`,
      meta: { className: result.student.className },
    };
  }
  if (result.type === "STUDENT_INACTIVE") {
    return { status: "error", label: result.student.name, detail: "Siswa nonaktif" };
  }
  if (result.type === "SCHOOL_CLOSED") {
    return { status: "error", label: "Hari ini libur" };
  }
  return { status: "error", label: "QR tidak dikenali", detail: "Kartu siswa tidak dikenali oleh sistem" };
}

export function notifyCheckInResult(result: AttendanceCheckInResponse) {
  if (result.type === "SUCCESS") {
    toast.success(`${result.student.name} berhasil absen`, {
      description: `${STATUS_LABEL[result.status] ?? result.status} · ${result.student.className} · ${jamJakarta(result.time)}`,
    });
    return;
  }
  if (result.type === "ALREADY_CHECKED_IN") {
    toast.warning(`${result.student.name} sudah absen`, {
      description: `Tercatat pada ${jamJakarta(result.time)}`,
    });
    return;
  }
  if (result.type === "STUDENT_INACTIVE") {
    toast.error(`${result.student.name} berstatus nonaktif`);
    return;
  }
  if (result.type === "SCHOOL_CLOSED") {
    toast.error("Hari ini libur, absensi tidak aktif.");
    return;
  }
  toast.error("QR Code tidak dikenali oleh sistem");
}

// ---------- Absensi Pulang (check-out) ----------

export function classifyCheckOutResult(result: AttendanceCheckOutResponse): ClassifiedResult {
  if (result.type === "SUCCESS") {
    return {
      status: "success",
      label: result.student.name,
      detail: `Pulang · ${jamJakarta(result.time)}`,
      meta: { className: result.student.className },
    };
  }
  if (result.type === "ALREADY_CHECKED_OUT") {
    return {
      status: "warning",
      label: result.student.name,
      detail: `Sudah absen pulang · ${jamJakarta(result.time)}`,
      meta: { className: result.student.className },
    };
  }
  if (result.type === "NOT_CHECKED_IN") {
    return {
      status: "error",
      label: result.student.name,
      detail: "Belum absen masuk",
      meta: { className: result.student.className },
    };
  }
  if (result.type === "STUDENT_INACTIVE") {
    return { status: "error", label: result.student.name, detail: "Siswa nonaktif" };
  }
  if (result.type === "SCHOOL_CLOSED") {
    return { status: "error", label: "Hari ini libur" };
  }
  return { status: "error", label: "QR tidak dikenali", detail: "Kartu siswa tidak dikenali oleh sistem" };
}

export function notifyCheckOutResult(result: AttendanceCheckOutResponse) {
  if (result.type === "SUCCESS") {
    toast.success(`${result.student.name} berhasil absen pulang`, {
      description: `${result.student.className} · ${jamJakarta(result.time)}`,
    });
    return;
  }
  if (result.type === "ALREADY_CHECKED_OUT") {
    toast.warning(`${result.student.name} sudah absen pulang`, {
      description: `Tercatat pada ${jamJakarta(result.time)}`,
    });
    return;
  }
  if (result.type === "NOT_CHECKED_IN") {
    toast.error(`${result.student.name} belum absen masuk hari ini`);
    return;
  }
  if (result.type === "STUDENT_INACTIVE") {
    toast.error(`${result.student.name} berstatus nonaktif`);
    return;
  }
  if (result.type === "SCHOOL_CLOSED") {
    toast.error("Hari ini libur, absensi tidak aktif.");
    return;
  }
  toast.error("QR Code tidak dikenali oleh sistem");
}