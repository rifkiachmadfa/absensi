"use client";
import type { AttendanceCheckInResponse } from "@/lib/types/attendance";



export function ScanResult({ result }: { result: AttendanceCheckInResponse }) {
  const jam = "time" in result && result.time
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(result.time))
    : null;

  const tanggal = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  if (result.type === "SUCCESS") {
    return (
      <div className="rounded-2xl border-2 border-green-500 bg-green-50 p-6 text-center dark:bg-green-950">
        <p className="text-lg font-bold text-green-700 dark:text-green-400">✓ ABSENSI BERHASIL</p>
        <p className="mt-3 text-xl font-semibold">{result.student.name}</p>
        <p className="text-sm text-muted-foreground">{result.student.nisn} · {result.student.className}</p>
        <p className="mt-2 text-sm">{tanggal}</p>
        <p className="text-2xl font-mono font-bold">{jam}</p>
        <span className="mt-2 inline-block rounded-full bg-green-600 px-4 py-1 text-sm font-medium text-white">
          {result.status}
        </span>
      </div>
    );
  }

  if (result.type === "ALREADY_CHECKED_IN") {
    return (
      <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-6 text-center dark:bg-amber-950">
        <p className="text-lg font-bold text-amber-700 dark:text-amber-400">SUDAH ABSEN</p>
        <p className="mt-3 text-xl font-semibold">{result.student.name}</p>
        <p className="text-sm text-muted-foreground">{result.student.className}</p>
        <p className="mt-2 text-sm">Sudah melakukan absensi pada:</p>
        <p className="text-2xl font-mono font-bold">{jam}</p>
      </div>
    );
  }

  if (result.type === "STUDENT_INACTIVE") {
    return (
      <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-6 text-center dark:bg-red-950">
        <p className="text-lg font-bold text-red-700 dark:text-red-400">SISWA TIDAK AKTIF</p>
        <p className="mt-2">{result.student.name} berstatus nonaktif.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-6 text-center dark:bg-red-950">
      <p className="text-lg font-bold text-red-700 dark:text-red-400">QR CODE TIDAK VALID</p>
      <p className="mt-2 text-sm">Kartu siswa tidak dikenali oleh sistem.</p>
    </div>
  );
}