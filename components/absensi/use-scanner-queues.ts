// components/absensi/use-scanner-queues.ts
"use client";

import { useCallback, useRef, useState } from "react";
import type { ScanQueueItem, ScanQueueStatus } from "@/components/absensi/use-scan-queue";

// Versi "banyak antrian sekaligus" dari use-scan-queue.ts -- SATU hook,
// tapi state-nya dipartisi per `scannerId` supaya log/riwayat satu scanner
// meja TIDAK PERNAH bercampur dengan scanner lain (dipakai halaman
// /absensi/scanner-fisik, lihat scanner-fisik-client.tsx). Pola in-flight,
// classify, dan onResult sengaja disamakan dengan use-scan-queue.ts supaya
// perilakunya konsisten dengan dialog Scan Absensi/Scan Pulang -- hanya
// key-nya yang bertambah satu dimensi (scannerId), bukan logic absensi
// baru (Section 3.1, 3.2, 26 spesifikasi utama tetap 100% di server).

const DEFAULT_MAX_ITEMS_PER_SCANNER = 8;

type ClassifiedResult = {
  status: ScanQueueStatus;
  label: string;
  detail?: string;
  meta?: Record<string, string>;
};

type UseScannerQueuesOptions<TResult> = {
  // Mengubah response FINAL dari server menjadi label + warna badge --
  // sama persis kontraknya dengan `classify` di use-scan-queue.ts.
  classify: (result: TResult) => ClassifiedResult;
  // Dipanggil setiap kali response server datang, DISERTAI id scanner
  // asalnya -- supaya pemanggil (mis. untuk toast) tahu itu hasil dari
  // scanner mana kalau perlu, tanpa harus menebak dari isi `result`.
  onResult: (scannerId: string, result: TResult) => void;
  // Jumlah maksimum item riwayat yang disimpan PER scanner (bukan total).
  maxItemsPerScanner?: number;
};

export function useScannerQueues<TResult>({
  classify,
  onResult,
  maxItemsPerScanner = DEFAULT_MAX_ITEMS_PER_SCANNER,
}: UseScannerQueuesOptions<TResult>) {
  const [queues, setQueues] = useState<Record<string, ScanQueueItem<TResult>[]>>({});
  const seqRef = useRef(0);

  // In-flight di-key `${scannerId}:${key}` -- scan yang SAMA persis dari
  // scanner yang SAMA tidak dikirim dua kali sebelum response pertama
  // kembali, tapi scanner lain tetap bebas memproses token yang sama
  // (mis. dua guru kebetulan scan kartu yang identik di waktu hampir
  // bersamaan dari dua scanner berbeda).
  const inFlightRef = useRef<Set<string>>(new Set());

  const isInFlight = useCallback(
    (scannerId: string, key: string) => inFlightRef.current.has(`${scannerId}:${key}`),
    []
  );

  const enqueue = useCallback(
    (scannerId: string, key: string, pendingLabel: string, submit: () => Promise<TResult>) => {
      const inFlightKey = `${scannerId}:${key}`;
      inFlightRef.current.add(inFlightKey);
      const id = `scan-${scannerId}-${Date.now()}-${seqRef.current++}`;

      setQueues((prev) => {
        const existing = prev[scannerId] ?? [];
        const pendingItem: ScanQueueItem<TResult> = {
          id,
          createdAt: Date.now(),
          status: "pending",
          label: pendingLabel,
        };
        return {
          ...prev,
          [scannerId]: [pendingItem, ...existing].slice(0, maxItemsPerScanner),
        };
      });

      submit()
        .then((result) => {
          const { status, label, detail, meta } = classify(result);
          setQueues((prev) => {
            const existing = prev[scannerId];
            if (!existing) return prev;
            return {
              ...prev,
              [scannerId]: existing.map((item) =>
                item.id === id ? { ...item, status, label, detail, meta, result } : item
              ),
            };
          });
          onResult(scannerId, result);
        })
        .catch(() => {
          setQueues((prev) => {
            const existing = prev[scannerId];
            if (!existing) return prev;
            return {
              ...prev,
              [scannerId]: existing.map((item) =>
                item.id === id
                  ? { ...item, status: "error" as const, label: "Gagal terhubung ke server" }
                  : item
              ),
            };
          });
        })
        .finally(() => {
          inFlightRef.current.delete(inFlightKey);
        });
    },
    [classify, onResult, maxItemsPerScanner]
  );

  return { queues, enqueue, isInFlight };
}