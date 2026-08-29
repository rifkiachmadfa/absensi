// components/absensi/use-scan-queue.ts
"use client";

import { useCallback, useRef, useState } from "react";

// Antrian scan untuk SATU sesi dialog (in-memory, tidak persisten) supaya
// guru bisa langsung lanjut men-scan kartu berikutnya TANPA menunggu request
// sebelumnya selesai. Setiap scan diproses di background dan hasilnya
// "menyusul" di ScanQueuePanel + toast, persis pola upload banyak file di
// Google Drive: item langsung muncul begitu proses dimulai, browser tetap
// bisa dipakai, dan status tiap item berubah sendiri saat selesai.
//
// PENTING (Section 3.1 & 3.2 spesifikasi project): hook ini TIDAK menebak
// apakah sebuah scan akan berhasil, sudah absen, atau statusnya
// HADIR/TERLAMBAT. Identifikasi siswa, pengecekan duplikat, penentuan
// status, dan penyimpanan tetap 100% ditentukan server dalam satu transaksi
// (AttendanceService.checkIn/checkOut) -- hook ini hanya menghilangkan
// blocking di UI selagi menunggu jawaban server, bukan mendahului jawaban
// server itu sendiri.

export type ScanQueueStatus = "pending" | "success" | "warning" | "error";

export type ScanQueueItem<TResult> = {
  id: string;
  createdAt: number;
  status: ScanQueueStatus;
  label: string;
  detail?: string;
  // Info tambahan bebas bentuk (mis. { className: "XI TKJ 1" }) untuk
  // ditampilkan di UI (lihat ScanLiveCard) tanpa perlu mengubah bentuk
  // dasar ScanQueueItem tiap kali ada field baru yang mau ditonjolkan.
  meta?: Record<string, string>;
  result?: TResult;
};

type UseScanQueueOptions<TResult> = {
  // Mengubah response FINAL dari server menjadi label + warna badge.
  classify: (result: TResult) => {
    status: ScanQueueStatus;
    label: string;
    detail?: string;
    meta?: Record<string, string>;
  };
  // Dipanggil setiap kali response server datang (mis. untuk toast + refresh tabel).
  onResult: (result: TResult) => void;
  // Jumlah maksimum item yang ditampilkan di panel riwayat (yang terlama dibuang).
  maxItems?: number;
};

export function useScanQueue<TResult>({
  classify,
  onResult,
  maxItems = 8,
}: UseScanQueueOptions<TResult>) {
  const [queue, setQueue] = useState<ScanQueueItem<TResult>[]>([]);
  const seqRef = useRef(0);

  // Key (qrToken atau studentId) yang request-nya masih berjalan -- mencegah
  // kartu/siswa yang sama dikirim dua kali selagi request pertamanya belum
  // kembali. Ini independen dari cooldown 3 detik di QrScanner (yang hanya
  // mencegah kamera membaca ulang kartu fisik yang sama terlalu cepat).
  const inFlightRef = useRef<Set<string>>(new Set());

  const isInFlight = useCallback((key: string) => inFlightRef.current.has(key), []);

  const enqueue = useCallback(
    (key: string, pendingLabel: string, submit: () => Promise<TResult>) => {
      inFlightRef.current.add(key);
      const id = `scan-${Date.now()}-${seqRef.current++}`;

      setQueue((prev) =>
        [{ id, createdAt: Date.now(), status: "pending" as const, label: pendingLabel }, ...prev].slice(
          0,
          maxItems
        )
      );

      submit()
        .then((result) => {
          const { status, label, detail, meta } = classify(result);
          setQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status, label, detail, meta, result } : item))
          );
          onResult(result);
        })
        .catch(() => {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: "error" as const, label: "Gagal terhubung ke server" }
                : item
            )
          );
        })
        .finally(() => {
          inFlightRef.current.delete(key);
        });
    },
    [classify, onResult, maxItems]
  );

  const reset = useCallback(() => {
    setQueue([]);
    inFlightRef.current.clear();
  }, []);

  return { queue, enqueue, isInFlight, reset };
}