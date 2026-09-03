// lib/types/attendance.ts
//
// Tipe response absensi yang dipakai komponen client (scan-dialog,
// scanner-fisik, tabel /absensi, dll). Sumber kebenaran untuk bentuk hasil
// AttendanceService tetap di lib/services/attendance-service.ts -- file ini
// hanya mengekspor ulang (alias) dengan nama yang lebih deskriptif untuk
// dipakai di frontend, supaya TIDAK ada duplikasi definisi tipe (Section 39
// Development Rules: "Tidak membuat duplicate service/model"). Validasi
// input (zod schema) untuk endpoint absensi ada di lib/validations/attendance.ts
// -- JANGAN duplikasi schema tersebut di sini.
import type {
  CheckInResult,
  CheckOutResult,
  IdentifyResult,
  IdentifyPulangResult,
} from "@/lib/services/attendance-service";
import type { AttendanceStatus } from "@/app/generated/prisma/client";

// Response dari POST /api/absensi/scan (checkIn()).
export type AttendanceCheckInResponse = CheckInResult;

// Response dari POST /api/absensi/scan-pulang (checkOut()).
export type AttendanceCheckOutResponse = CheckOutResult;

// Response dari POST /api/absensi/scan/identify (identify(), read-only).
export type AttendanceIdentifyResponse = IdentifyResult;

// Response dari POST /api/absensi/scan-pulang/identify (identifyPulang(),
// read-only).
export type AttendanceIdentifyPulangResponse = IdentifyPulangResult;

// Baris tabel GET /api/absensi/table -- lihat
// AttendanceService.getAttendanceTable().
export type AttendanceTableRow = {
  studentId: string;
  attendanceId: string | null;
  name: string;
  nisn: string;
  className: string;
  status: AttendanceStatus | "BELUM_ABSEN";
  checkInAt: string | null;
  checkOutAt: string | null;
};

// Opsi kelas untuk dropdown filter -- lihat GET /api/kelas.
export type ClassOption = {
  id: string;
  name: string;
};