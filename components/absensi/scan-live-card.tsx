// components/absensi/scan-live-card.tsx
"use client";

import { CheckCircle2, AlertTriangle, XCircle, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useProcessingStage } from "@/components/absensi/use-processing-stage";
import type { ScanQueueItem, ScanQueueStatus } from "@/components/absensi/use-scan-queue";

// Kartu ini adalah pengganti tampilan kamera untuk mode "Scanner Fisik"
// (Section 29 UI_RULES: guru tetap butuh feedback visual yang jelas walau
// tidak ada preview kamera untuk dilihat). Menampilkan hasil scan TERBARU
// dari antrian (queue[0]) dalam format Nama / Kelas / Proses:
//
// - Selagi status "pending" (server belum menjawab): Nama & Kelas masih
//   "-" (identitas siswa memang baru diketahui SETELAH AttendanceService
//   mengidentifikasi di server -- lihat Section 26), dan baris "Proses"
//   berjalan berubah-ubah lewat useProcessingStage.
// - Begitu hasil final datang: Nama/Kelas terisi (atau pesan error kalau
//   kartu tidak dikenali), baris "Proses" berhenti di deskripsi hasil
//   akhir, dan warna kartu mengikuti status (hijau/kuning/merah) --
//   konsisten dengan Section 4 UI_RULES (warna sesuai makna, bukan
//   dekorasi).

const STATUS_CARD_CLASS: Record<ScanQueueStatus, string> = {
  pending: "border-border bg-muted/30",
  success: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  error: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
};

function StatusIcon({ status }: { status: ScanQueueStatus }) {
  if (status === "pending") return <Spinner className="size-5 text-muted-foreground" />;
  if (status === "success") return <CheckCircle2 className="size-5 shrink-0 text-[#16A34A]" aria-label="Berhasil" />;
  if (status === "warning") return <AlertTriangle className="size-5 shrink-0 text-[#D97706]" aria-label="Perhatian" />;
  return <XCircle className="size-5 shrink-0 text-[#DC2626]" aria-label="Gagal" />;
}

function LiveCardBody<TResult>({ item }: { item: ScanQueueItem<TResult> }) {
  const isPending = item.status === "pending";
  const stage = useProcessingStage(isPending);

  // Selagi pending, `label` masih diisi placeholder generik ("Memindai
  // kartu...") oleh handleDetected -- bukan nama siswa sungguhan, karena
  // identifikasi baru terjadi di server. Jangan tampilkan placeholder itu
  // seolah-olah nama siswa.
  const nama = isPending ? "-" : item.label;
  const kelas = isPending ? "-" : (item.meta?.className ?? "-");
  const proses = isPending ? stage : (item.detail ?? "Selesai diproses");

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        STATUS_CARD_CLASS[item.status]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Nama
          </p>
          <p className="truncate text-lg font-semibold text-foreground">{nama}</p>

          <p className="mt-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Kelas
          </p>
          <p className="text-sm text-foreground">{kelas}</p>
        </div>
        <StatusIcon status={item.status} />
      </div>

      <div className="mt-3 border-t border-border/70 pt-2.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Proses
        </p>
        <p
          className={cn(
            "text-sm text-foreground",
            isPending && "animate-pulse text-muted-foreground"
          )}
        >
          {proses}
        </p>
      </div>
    </div>
  );
}

export function ScanLiveCard<TResult>({ item }: { item?: ScanQueueItem<TResult> }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
        <ScanLine className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Menunggu kartu di-scan...</p>
      </div>
    );
  }

  // `key={item.id}` memastikan useProcessingStage di dalam LiveCardBody
  // benar-benar restart dari tahap pertama setiap kali ada scan BARU,
  // bukan melanjutkan index tahap dari scan sebelumnya.
  return <LiveCardBody key={item.id} item={item} />;
}