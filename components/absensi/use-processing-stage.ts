// components/absensi/use-processing-stage.ts
"use client";

import { useEffect, useState } from "react";

// Label tahapan yang ditampilkan selagi SATU scan masih menunggu jawaban
// server. Urutannya mengikuti tanggung jawab AttendanceService.checkIn()/
// checkOut() di Section 26 spesifikasi (identifikasi -> validasi siswa ->
// cek duplikat -> tentukan status -> simpan) supaya teks yang berubah-ubah
// ini tetap jujur menggambarkan APA yang sedang dikerjakan sistem, bukan
// sekadar animasi kosong -- meski di server semuanya terjadi dalam SATU
// transaksi cepat, bukan langkah bertahap yang benar-benar dilacak dari
// client.
const DEFAULT_STAGES = [
  "Mengidentifikasi kartu...",
  "Memvalidasi data siswa...",
  "Mengecek absensi hari ini...",
  "Menentukan status kehadiran...",
  "Menyimpan data absensi...",
] as const;

// `active=true` -> mulai berjalan dari tahap pertama, lalu maju satu
// tahap tiap `intervalMs`. Berhenti (diam) di tahap terakhir kalau
// respons server ternyata belum juga datang -- tidak looping balik ke
// awal, supaya tidak terkesan mengulang proses yang sama.
// Pasang `key={item.id}` pada komponen pemanggil supaya hook ini restart
// bersih setiap kali ada scan BARU (lihat scan-live-card.tsx).
export function useProcessingStage(active: boolean, stages: readonly string[] = DEFAULT_STAGES, intervalMs = 500) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1 < stages.length ? prev + 1 : prev));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, stages, intervalMs]);

  return stages[index];
}