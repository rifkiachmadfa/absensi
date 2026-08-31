// lib/types/attendance.ts

// Hasil check-in (POST /api/absensi/scan atau /api/absensi/manual) -- kedua
// endpoint langsung mengidentifikasi SEKALIGUS menyimpan absensi dalam satu
// langkah, status (HADIR/TERLAMBAT) dihitung otomatis dari AttendanceSchedule
// oleh AttendanceService.checkIn(). Guru/petugas tidak lagi memilih status
// secara manual sesudah scan/pencarian (lihat catatan di attendance-service.ts).
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
  | { type: "STUDENT_NOT_FOUND"; message?: string }
  | { type: "SCHOOL_CLOSED" };

// Hasil check-out (POST /api/absensi/scan-pulang atau /api/absensi/manual-pulang)
// -- mengisi checkOutAt pada record Attendance hari itu yang SUDAH ADA
// (AttendanceService.checkOut()). Siswa yang belum check-in hari itu akan
// mendapat NOT_CHECKED_IN, bukan record baru.
export type AttendanceCheckOutResponse =
  | {
      type: "SUCCESS";
      student: { name: string; nisn: string; className: string };
      time: string;
      status: string;
    }
  | {
      type: "ALREADY_CHECKED_OUT";
      student: { name: string; className: string };
      time: string;
      status: string;
    }
  | { type: "NOT_CHECKED_IN"; student: { name: string; className: string } }
  | { type: "STUDENT_INACTIVE"; student: { name: string } }
  | { type: "STUDENT_NOT_FOUND"; message?: string }
  | { type: "SCHOOL_CLOSED" };

// Hasil identifikasi CEPAT (POST /api/absensi/scan/identify atau
// /api/absensi/scan-pulang/identify) -- read-only, TIDAK menyimpan absensi
// apa pun. Dipakai UI untuk menampilkan Nama/Kelas siswa SEGERA begitu
// kartu dikenali, SEBELUM AttendanceCheckInResponse/AttendanceCheckOutResponse
// (hasil final dari checkIn()/checkOut()) selesai diproses. Jangan pernah
// memakai response ini sebagai keputusan akhir (Section 3.1, 3.2, 26) --
// lihat identifiedMeta() di lib/attendance/classify-result.ts.
export type AttendanceIdentifyResponse =
  | { type: "SUCCESS"; student: { name: string; nisn: string; className: string } }
  | {
      type: "ALREADY_CHECKED_IN";
      student: { name: string; className: string };
      time: string;
      status: string;
    }
  | { type: "STUDENT_INACTIVE"; student: { name: string } }
  | { type: "STUDENT_NOT_FOUND"; message?: string }
  | { type: "SCHOOL_CLOSED" };

export type AttendanceIdentifyPulangResponse =
  | { type: "SUCCESS"; student: { name: string; nisn: string; className: string } }
  | {
      type: "ALREADY_CHECKED_OUT";
      student: { name: string; className: string };
      time: string;
      status: string;
    }
  | { type: "NOT_CHECKED_IN"; student: { name: string; className: string } }
  | { type: "STUDENT_INACTIVE"; student: { name: string } }
  | { type: "STUDENT_NOT_FOUND"; message?: string }
  | { type: "SCHOOL_CLOSED" };

export type AttendanceTableRow = {
  studentId: string;
  attendanceId: string | null;
  name: string;
  nisn: string;
  className: string;
  status: "HADIR" | "TERLAMBAT" | "SAKIT" | "IZIN" | "DISPENSASI" | "ALPHA" | "BELUM_ABSEN";
  checkInAt: string | null;
  checkOutAt: string | null;
};

export type ClassOption = { id: string; name: string };