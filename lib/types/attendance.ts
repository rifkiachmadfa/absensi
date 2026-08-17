// lib/types/attendance.ts

// Hasil konfirmasi kehadiran (POST /api/absensi/confirm) -- absensi SUDAH
// tersimpan dengan status yang dipilih manual oleh guru/petugas.
export type AttendanceCheckInResponse =
  | {
      type: "SUCCESS";
      student: { name: string; nisn: string; className: string };
      time: string;
      status: string;
    }
  | {
      type: "ALREADY_CHECKED_IN";
      student: { name: string; className: string };
      time: string;
      status: string;
    }
  | { type: "STUDENT_INACTIVE"; student: { name: string } }
  | { type: "STUDENT_NOT_FOUND"; message?: string };

// Hasil identifikasi siswa (POST /api/absensi/scan atau /api/absensi/manual)
// -- BELUM ada absensi yang tersimpan. `suggestedStatus` hanya saran untuk
// di-highlight di UI, guru/petugas tetap memilih status final secara manual.
export type AttendanceIdentifyResponse =
  | {
      type: "SUCCESS";
      student: { id: string; name: string; nisn: string; className: string };
      suggestedStatus: string;
    }
  | {
      type: "ALREADY_CHECKED_IN";
      student: { name: string; className: string };
      time: string;
      status: string;
    }
  | { type: "STUDENT_INACTIVE"; student: { name: string } }
  | { type: "STUDENT_NOT_FOUND"; message?: string };

// State lokal di ScanDialog: siswa yang sudah diidentifikasi dan sedang
// menunggu petugas memilih status kehadirannya.
export type PendingStudent = {
  id: string;
  name: string;
  nisn: string;
  className: string;
  suggestedStatus: string;
  method: "QR" | "MANUAL";
};

export type AttendanceTableRow = {
  studentId: string;
  attendanceId: string | null;
  name: string;
  nisn: string;
  className: string;
  status: "HADIR" | "TERLAMBAT" | "SAKIT" | "IZIN" | "DISPENSASI" | "ALPHA" | "BELUM_ABSEN";
  checkInAt: string | null;
};

export type ClassOption = { id: string; name: string };